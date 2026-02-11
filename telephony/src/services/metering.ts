// Metering service
// Track minutes usage and manage the minute ledger

import crypto from 'crypto';
import Stripe from 'stripe';
import { getSupabaseClient, UltauraAccountRow, MinuteLedgerRow } from '../utils/supabase.js';
import { logger } from '../server.js';
import { TRIAL_DAILY_LIMIT_MINUTES } from '../utils/constants.js';
import { trialReservationFailuresTotal } from '../utils/metrics.js';

function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(key, { apiVersion: '2024-04-10' });
}

// Minimum seconds for a billable call
const MIN_BILLABLE_SECONDS = 30;

// Calculate billable minutes from seconds
export function calculateBillableMinutes(seconds: number): number {
  if (seconds < MIN_BILLABLE_SECONDS) {
    return 0;
  }
  return Math.ceil(seconds / 60);
}

interface TrialReservationRpcRow {
  allowed: boolean;
  reason: string | null;
  reserved_minutes: number;
  minutes_used_today: number;
  minutes_reserved_today: number;
  minutes_remaining_today: number;
  day_start_utc: string | null;
  day_end_utc: string | null;
}

export interface TrialDailyReservationResult {
  allowed: boolean;
  reason: string | null;
  reservedMinutes: number;
  minutesUsedToday: number;
  minutesReservedToday: number;
  minutesRemainingToday: number;
  dayStartUtc: string | null;
  dayEndUtc: string | null;
}

interface TrialReleaseRpcRow {
  released: boolean;
  reserved_minutes: number;
  actual_billable_minutes: number;
  end_reason: string | null;
}

export interface TrialDailyReleaseResult {
  released: boolean;
  reservedMinutes: number;
  actualBillableMinutes: number;
  endReason: string | null;
}

function getRpcFirstRow<T>(data: T | T[] | null): T | null {
  if (!data) {
    return null;
  }

  return Array.isArray(data) ? data[0] ?? null : data;
}

function toTrialReservationResult(row: TrialReservationRpcRow): TrialDailyReservationResult {
  return {
    allowed: Boolean(row.allowed),
    reason: row.reason,
    reservedMinutes: row.reserved_minutes ?? 0,
    minutesUsedToday: row.minutes_used_today ?? 0,
    minutesReservedToday: row.minutes_reserved_today ?? 0,
    minutesRemainingToday: row.minutes_remaining_today ?? 0,
    dayStartUtc: row.day_start_utc,
    dayEndUtc: row.day_end_utc,
  };
}

function toTrialReleaseResult(row: TrialReleaseRpcRow): TrialDailyReleaseResult {
  return {
    released: Boolean(row.released),
    reservedMinutes: row.reserved_minutes ?? 0,
    actualBillableMinutes: row.actual_billable_minutes ?? 0,
    endReason: row.end_reason,
  };
}

export async function reserveTrialDailyCap(options: {
  accountId: string;
  lineTimezone: string;
  callSessionId: string;
}): Promise<TrialDailyReservationResult | null> {
  const { accountId, lineTimezone, callSessionId } = options;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('reserve_trial_daily_cap', {
    p_account_id: accountId,
    p_line_timezone: lineTimezone,
    p_call_session_id: callSessionId,
  });

  if (error) {
    trialReservationFailuresTotal.labels('reserve').inc();
    logger.error(
      { error, accountId, lineTimezone, callSessionId },
      'Failed to reserve trial daily cap'
    );
    return null;
  }

  const row = getRpcFirstRow(data as TrialReservationRpcRow | TrialReservationRpcRow[] | null);
  if (!row) {
    trialReservationFailuresTotal.labels('reserve').inc();
    logger.error({ accountId, lineTimezone, callSessionId }, 'Trial daily cap reservation returned empty result');
    return null;
  }

  const result = toTrialReservationResult(row);

  if (result.allowed && result.reservedMinutes > TRIAL_DAILY_LIMIT_MINUTES) {
    logger.warn(
      {
        accountId,
        callSessionId,
        reservedMinutes: result.reservedMinutes,
        configuredLimit: TRIAL_DAILY_LIMIT_MINUTES,
      },
      'Trial reservation exceeded configured daily limit'
    );
  }

  if (!result.allowed && result.reason !== 'trial_cap') {
    logger.warn(
      {
        accountId,
        callSessionId,
        reason: result.reason,
        minutesUsedToday: result.minutesUsedToday,
        minutesReservedToday: result.minutesReservedToday,
      },
      'Trial daily cap reservation denied for non-cap reason'
    );
  }

  return result;
}

export async function releaseTrialDailyCap(options: {
  callSessionId: string;
  endReason: 'hangup' | 'no_answer' | 'busy' | 'trial_cap' | 'minutes_cap' | 'error';
  actualBillableMinutes: number;
}): Promise<TrialDailyReleaseResult | null> {
  const { callSessionId, endReason, actualBillableMinutes } = options;
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('release_trial_daily_cap', {
    p_call_session_id: callSessionId,
    p_end_reason: endReason,
    p_actual_billable_minutes: Math.max(0, actualBillableMinutes),
  });

  if (error) {
    trialReservationFailuresTotal.labels('release').inc();
    logger.error({ error, callSessionId, endReason }, 'Failed to release trial daily cap reservation');
    return null;
  }

  const row = getRpcFirstRow(data as TrialReleaseRpcRow | TrialReleaseRpcRow[] | null);
  if (!row) {
    trialReservationFailuresTotal.labels('release').inc();
    return null;
  }

  return toTrialReleaseResult(row);
}

// Determine billable type based on account status and usage
export async function determineBillableType(
  account: UltauraAccountRow,
  minutes: number
): Promise<'trial' | 'included' | 'overage' | 'payg'> {
  // Trial accounts
  if (account.status === 'trial') {
    return 'trial';
  }

  // PAYG accounts always pay per minute
  if (account.plan_id === 'payg') {
    return 'payg';
  }

  // Get current usage
  const supabase = getSupabaseClient();
  const { data: usage } = await supabase.rpc('get_ultaura_usage_summary', {
    p_account_id: account.id,
  });

  if (!usage) {
    return 'included';
  }

  const currentUsed = usage.minutes_used || 0;
  const included = account.minutes_included;

  // Check if this call would go into overage
  if (currentUsed + minutes > included) {
    return 'overage';
  }

  return 'included';
}

// Record usage to the minute ledger
export async function recordUsage(options: {
  accountId: string;
  lineId: string;
  callSessionId: string;
  secondsConnected: number;
  direction: 'inbound' | 'outbound';
  isReminderCall?: boolean;
}): Promise<MinuteLedgerRow | null> {
  const { accountId, lineId, callSessionId, secondsConnected, direction, isReminderCall } = options;

  const supabase = getSupabaseClient();

  // Get account info
  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    logger.error({ error: accountError, accountId }, 'Failed to get account for metering');
    return null;
  }

  // Calculate billable minutes
  let billableMinutes = calculateBillableMinutes(secondsConnected);

  // Reminder calls have a minimum of 1 minute charge
  if (isReminderCall && billableMinutes < 1) {
    billableMinutes = 1;
    logger.info({ callSessionId, isReminderCall }, 'Applying 1-minute minimum for reminder call');
  }

  // Skip if less than minimum billable (unless it's a reminder call)
  if (billableMinutes === 0) {
    logger.info({ callSessionId, secondsConnected }, 'Call too short to bill');
    return null;
  }

  // Determine billable type
  const billableType = await determineBillableType(account, billableMinutes);

  // Create idempotency key from call session ID
  const idempotencyKey = `call_${callSessionId}`;

  // Insert ledger entry
  const { data: ledgerEntry, error: ledgerError } = await supabase
    .from('ultaura_minute_ledger')
    .insert({
      account_id: accountId,
      line_id: lineId,
      call_session_id: callSessionId,
      cycle_start: account.cycle_start,
      cycle_end: account.cycle_end,
      seconds_connected: secondsConnected,
      billable_minutes: billableMinutes,
      direction,
      billable_type: billableType,
      idempotency_key: idempotencyKey,
    })
    .select()
    .single();

  if (ledgerError) {
    // Check if it's a duplicate (idempotency)
    if (ledgerError.code === '23505') {
      logger.info({ callSessionId }, 'Duplicate ledger entry, already recorded');
      return null;
    }

    logger.error({ error: ledgerError, callSessionId }, 'Failed to record ledger entry');
    return null;
  }

  logger.info(
    {
      callSessionId,
      billableMinutes,
      billableType,
      direction,
    },
    'Recorded usage to ledger'
  );

  // Update account usage cache
  await supabase.rpc('update_ultaura_account_usage', {
    p_account_id: accountId,
  });

  // Report overage immediately if applicable
  if (billableType === 'overage' || billableType === 'payg') {
    await reportOverageToStripe(accountId);
  }

  return ledgerEntry;
}

// Get usage summary for an account
export interface UsageSummary {
  minutesIncluded: number;
  minutesUsed: number;
  minutesRemaining: number;
  overageMinutes: number;
  cycleStart: string | null;
  cycleEnd: string | null;
}

export async function getUsageSummary(accountId: string): Promise<UsageSummary | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_ultaura_usage_summary', {
    p_account_id: accountId,
  });

  if (error) {
    logger.error({ error, accountId }, 'Failed to get usage summary');
    return null;
  }

  const row = getRpcFirstRow(data as Record<string, unknown> | Record<string, unknown>[] | null);
  if (!row) {
    return null;
  }

  return {
    minutesIncluded: Number(row.minutes_included ?? 0),
    minutesUsed: Number(row.minutes_used ?? 0),
    minutesRemaining: Number(row.minutes_remaining ?? 0),
    overageMinutes: Number(row.overage_minutes ?? 0),
    cycleStart: (row.cycle_start as string | null) ?? null,
    cycleEnd: (row.cycle_end as string | null) ?? null,
  };
}

// Check if account should warn about low minutes
export async function shouldWarnLowMinutes(accountId: string): Promise<{
  warn: boolean;
  critical: boolean;
  remaining: number;
}> {
  const summary = await getUsageSummary(accountId);

  if (!summary) {
    return { warn: false, critical: false, remaining: 0 };
  }

  const LOW_THRESHOLD = 15;
  const CRITICAL_THRESHOLD = 5;

  return {
    warn: summary.minutesRemaining <= LOW_THRESHOLD,
    critical: summary.minutesRemaining <= CRITICAL_THRESHOLD,
    remaining: summary.minutesRemaining,
  };
}

// Report overage usage to Stripe (to be implemented with Stripe integration)
export async function reportOverageToStripe(
  accountId: string,
): Promise<void> {
  const supabase = getSupabaseClient();
  const stripe = getStripeClient();

  // Get the subscription
  const { data: subscription } = await supabase
    .from('ultaura_subscriptions')
    .select('stripe_subscription_id')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .single();

  if (!subscription?.stripe_subscription_id) {
    logger.warn({ accountId }, 'No active subscription for overage reporting');
    return;
  }

  try {
    const entriesToReport = await getUnreportedOverage(accountId);
    if (entriesToReport.length === 0) {
      return;
    }

    const quantity = entriesToReport.reduce((total, entry) => total + (entry.billable_minutes ?? 0), 0);
    if (quantity <= 0) {
      return;
    }

    const usageTimestamp = Math.floor(
      Math.max(
        ...entriesToReport.map((entry) => new Date(entry.created_at).getTime()),
        Date.now()
      ) / 1000
    );
    const ledgerIds = entriesToReport.map((entry) => entry.id);
    const idempotencyKey = buildStripeUsageIdempotencyKey(accountId, ledgerIds);

    // Get the subscription to find metered item
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    // Find the metered price item (overage)
    const overagePriceId = process.env.STRIPE_ULTAURA_OVERAGE_PRICE_ID;
    const meteredItem = stripeSub.items.data.find(
      item => item.price.id === overagePriceId
    );

    if (!meteredItem) {
      logger.warn({ accountId }, 'No metered overage item on subscription');
      return;
    }

    // Report usage
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      meteredItem.id,
      {
        quantity,
        timestamp: usageTimestamp,
        action: 'increment',
      },
      { idempotencyKey }
    );

    logger.info({
      accountId,
      overageMinutes: quantity,
      usageRecordId: usageRecord.id,
      idempotencyKey,
      ledgerEntryCount: entriesToReport.length,
    }, 'Reported overage to Stripe');

    // Mark ledger entries as reported
    await markReportedOverageEntries(accountId, usageRecord.id, ledgerIds);

  } catch (error) {
    logger.error({ error, accountId }, 'Failed to report overage to Stripe');
    throw error;
  }
}

// Get unreported overage entries for Stripe billing
export async function getUnreportedOverage(accountId: string): Promise<MinuteLedgerRow[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_minute_ledger')
    .select('*')
    .eq('account_id', accountId)
    .eq('stripe_usage_reported', false)
    .in('billable_type', ['overage', 'payg']);

  if (error) {
    logger.error({ error, accountId }, 'Failed to get unreported overage');
    return [];
  }

  return data ?? [];
}

function buildStripeUsageIdempotencyKey(accountId: string, ledgerIds: string[]): string {
  const sortedIds = [...ledgerIds].sort().join(',');
  const digest = crypto
    .createHash('sha256')
    .update(`${accountId}:${sortedIds}`)
    .digest('hex')
    .slice(0, 32);
  return `ultaura_overage_${accountId}_${digest}`;
}

// Mark ledger entries as reported
async function markReportedOverageEntries(
  accountId: string,
  stripeRecordId: string,
  ledgerIds: string[]
): Promise<void> {
  if (ledgerIds.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  await supabase
    .from('ultaura_minute_ledger')
    .update({
      stripe_usage_reported: true,
      stripe_usage_record_id: stripeRecordId,
    })
    .eq('account_id', accountId)
    .eq('stripe_usage_reported', false)
    .in('id', ledgerIds);
}
