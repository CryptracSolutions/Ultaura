// Metering service
// Track minutes usage and manage the minute ledger

import Stripe from 'stripe';
import { getSupabaseClient, UltauraAccountRow, MinuteLedgerRow } from '../utils/supabase.js';
import { logger } from '../server.js';

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

// Determine billable type based on account status and usage
export async function determineBillableType(
  account: UltauraAccountRow,
  minutes: number
): Promise<'trial' | 'included' | 'overage' | 'payg'> {
  // PAYG accounts always pay per minute
  if (account.plan_id === 'payg') {
    return 'payg';
  }

  // Trial accounts
  if (account.status === 'trial') {
    return 'trial';
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
}): Promise<MinuteLedgerRow | null> {
  const { accountId, lineId, callSessionId, secondsConnected, direction } = options;

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
  const billableMinutes = calculateBillableMinutes(secondsConnected);

  // Skip if less than minimum billable
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
    await reportOverageToStripe(accountId, billableMinutes);
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

  if (!data || data.length === 0) {
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    minutesIncluded: row.minutes_included,
    minutesUsed: row.minutes_used,
    minutesRemaining: row.minutes_remaining,
    overageMinutes: row.overage_minutes,
    cycleStart: row.cycle_start,
    cycleEnd: row.cycle_end,
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
  overageMinutes: number
): Promise<void> {
  if (overageMinutes <= 0) return;

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
        quantity: overageMinutes,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      }
    );

    logger.info({
      accountId,
      overageMinutes,
      usageRecordId: usageRecord.id,
    }, 'Reported overage to Stripe');

    // Mark ledger entries as reported
    await markReportedOverageEntries(accountId, usageRecord.id);

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

  return data || [];
}

// Mark ledger entries as reported
async function markReportedOverageEntries(accountId: string, stripeRecordId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('ultaura_minute_ledger')
    .update({
      stripe_usage_reported: true,
      stripe_usage_record_id: stripeRecordId,
    })
    .eq('account_id', accountId)
    .eq('stripe_usage_reported', false)
    .in('billable_type', ['overage', 'payg']);
}
