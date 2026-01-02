// @ts-nocheck
'use server';

// Ultaura Server Actions
// Server-side actions for managing Ultaura accounts, lines, and schedules

import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { getShortLineId } from '~/lib/ultaura';
import type {
  Line,
  Schedule,
  UsageSummary,
  LineActivity,
  CreateLineInput,
  UpdateLineInput,
  CreateScheduleInput,
  UpdateScheduleInput,
  PlanId,
  UltauraAccountRow,
  LineRow,
  ScheduleRow,
  CallSessionRow,
} from './types';
import { BILLING, PLANS } from './constants';
import { getNextOccurrence, getNextReminderOccurrence, validateTimezone } from './timezone';

const logger = getLogger();

// ============================================
// ACCOUNT ACTIONS
// ============================================

// Get or create Ultaura account for an organization
export async function getOrCreateUltauraAccount(
  organizationId: number,
  userId: string,
  name: string,
  email: string
): Promise<{ accountId: string; isNew: boolean }> {
  const client = getSupabaseServerComponentClient();

  // Check for existing account
  const { data: existing } = await client
    .from('ultaura_accounts')
    .select('id')
    .eq('organization_id', organizationId)
    .single();

  if (existing) {
    return { accountId: existing.id, isNew: false };
  }

  // Create new account
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + BILLING.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const defaultTrialPlanId: PlanId = 'comfort';
  const plan = PLANS[defaultTrialPlanId];

  const { data: account, error } = await client
    .from('ultaura_accounts')
    .insert({
      organization_id: organizationId,
      name,
      billing_email: email,
      created_by_user_id: userId,
      status: 'trial',
      plan_id: defaultTrialPlanId,
      trial_plan_id: defaultTrialPlanId,
      trial_starts_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      minutes_included: plan.minutesIncluded,
      minutes_used: 0,
      cycle_start: now.toISOString(),
      cycle_end: trialEndsAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create Ultaura account');
    throw new Error('Failed to create account');
  }

  return { accountId: account.id, isNew: true };
}

// Get Ultaura account for organization
export async function getUltauraAccount(organizationId: number): Promise<UltauraAccountRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error({ error }, 'Failed to get Ultaura account');
    }
    return null;
  }

  return data;
}

// ============================================
// TRIAL HELPERS
// ============================================

export async function isTrialExpired(accountId: string): Promise<boolean> {
  const account = await getUltauraAccountById(accountId);
  if (!account) return false;

  return getTrialStatus(account).isExpired;
}

export async function getTrialInfo(accountId: string): Promise<{
  isOnTrial: boolean;
  isExpired: boolean;
  trialPlanId: PlanId | null;
  trialEndsAt: string | null;
  daysRemaining: number;
} | null> {
  const account = await getUltauraAccountById(accountId);
  if (!account) return null;

  const status = getTrialStatus(account);

  return {
    isOnTrial: status.isOnTrial,
    isExpired: status.isExpired,
    trialPlanId: status.trialPlanId,
    trialEndsAt: status.trialEndsAt,
    daysRemaining: status.daysRemaining,
  };
}

// ============================================
// LINE ACTIONS
// ============================================

// Get all lines for an account
export async function getLines(accountId: string): Promise<LineRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get lines');
    throw new Error('Failed to get lines');
  }

  return data || [];
}

// Get a single line (supports both full UUID and truncated 8-char ID)
export async function getLine(lineId: string): Promise<LineRow | null> {
  const client = getSupabaseServerComponentClient();

  let data: LineRow | null = null;
  let error: { message: string } | null = null;

  if (lineId.length === 8) {
    // Truncated ID - fetch all lines and filter by prefix
    // (UUID columns need text cast for LIKE, which isn't directly supported by client)
    const result = await client
      .from('ultaura_lines')
      .select('*');

    if (result.error) {
      error = result.error;
    } else if (result.data) {
      // Find line where ID starts with the short ID
      const match = result.data.find(line =>
        line.id.toLowerCase().startsWith(lineId.toLowerCase())
      );
      data = match || null;
    }
  } else {
    // Full UUID - exact match
    const result = await client
      .from('ultaura_lines')
      .select('*')
      .eq('id', lineId)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    logger.error({ error }, 'Failed to get line');
    return null;
  }

  return data;
}

// Create a new line
export async function createLine(input: CreateLineInput): Promise<{ success: boolean; lineId?: string; error?: string }> {
  const client = getSupabaseServerComponentClient();

  try {
    if (input.timezone) {
      validateTimezone(input.timezone);
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  // Check line limit
  const account = await getUltauraAccountById(input.accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  const existingLines = await getLines(input.accountId);
  const plan = await getPlan(account.plan_id);

  if (existingLines.length >= (plan?.lines_included || 1)) {
    return { success: false, error: 'Line limit reached for your plan' };
  }

  // Check if phone number already exists
  const { data: existingPhone } = await client
    .from('ultaura_lines')
    .select('id')
    .eq('phone_e164', input.phoneE164)
    .single();

  if (existingPhone) {
    return { success: false, error: 'This phone number is already registered' };
  }

  // Create the line
  const { data: line, error } = await client
    .from('ultaura_lines')
    .insert({
      account_id: input.accountId,
      display_name: input.displayName,
      phone_e164: input.phoneE164,
      preferred_language: input.preferredLanguage || 'auto',
      spanish_formality: input.spanishFormality || 'usted',
      timezone: input.timezone || 'America/Los_Angeles',
      status: 'paused', // Paused until verified
      seed_interests: input.seedInterests || null,
      seed_avoid_topics: input.seedAvoidTopics || null,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create line');
    return { success: false, error: 'Failed to create line' };
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true, lineId: line.id };
}

// Update a line
export async function updateLine(
  lineId: string,
  input: UpdateLineInput
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  try {
    if (input.timezone !== undefined) {
      validateTimezone(input.timezone);
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  const { data: line, error: lineError } = await client
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return { success: false, error: 'Line not found' };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  try {
    if (input.timezone !== undefined) {
      validateTimezone(input.timezone);
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  const updates: Record<string, unknown> = {};

  if (input.displayName !== undefined) updates.display_name = input.displayName;
  if (input.preferredLanguage !== undefined) updates.preferred_language = input.preferredLanguage;
  if (input.spanishFormality !== undefined) updates.spanish_formality = input.spanishFormality;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.quietHoursStart !== undefined) updates.quiet_hours_start = input.quietHoursStart;
  if (input.quietHoursEnd !== undefined) updates.quiet_hours_end = input.quietHoursEnd;
  if (input.doNotCall !== undefined) updates.do_not_call = input.doNotCall;
  if (input.inboundAllowed !== undefined) updates.inbound_allowed = input.inboundAllowed;
  if (input.seedInterests !== undefined) updates.seed_interests = input.seedInterests;
  if (input.seedAvoidTopics !== undefined) updates.seed_avoid_topics = input.seedAvoidTopics;
  if (input.allowVoiceReminderControl !== undefined) updates.allow_voice_reminder_control = input.allowVoiceReminderControl;

  const { error } = await client
    .from('ultaura_lines')
    .update(updates)
    .eq('id', lineId);

  if (error) {
    logger.error({ error }, 'Failed to update line');
    return { success: false, error: 'Failed to update line' };
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true };
}

// Delete a line
export async function deleteLine(lineId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const { data: line, error: lineError } = await client
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return { success: false, error: 'Line not found' };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  const { error } = await client
    .from('ultaura_lines')
    .delete()
    .eq('id', lineId);

  if (error) {
    logger.error({ error }, 'Failed to delete line');
    return { success: false, error: 'Failed to delete line' };
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true };
}

// Trusted Contacts Actions
export async function getTrustedContacts(lineId: string) {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function addTrustedContact(
  lineId: string,
  input: {
    name: string;
    phoneE164: string;
    relationship?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get account from line
  const line = await getLine(lineId);
  if (!line) return { success: false, error: 'Line not found' };

  const account = await getUltauraAccountById(line.account_id);
  if (!account) return { success: false, error: 'Account not found' };

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  const { error } = await client.from('ultaura_trusted_contacts').insert({
    account_id: line.account_id,
    line_id: lineId,
    name: input.name,
    phone_e164: input.phoneE164,
    relationship: input.relationship,
    notify_on: ['medium', 'high'],
    enabled: true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/lines/${getShortLineId(lineId)}/contacts`);
  return { success: true };
}

export async function removeTrustedContact(contactId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('line_id, account_id')
    .eq('id', contactId)
    .single();

  if (data?.account_id) {
    const account = await getUltauraAccountById(data.account_id);
    if (account) {
      const trialStatus = getTrialStatus(account);
      if (trialStatus.isExpired) {
        return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
      }
    }
  }

  await client.from('ultaura_trusted_contacts').delete().eq('id', contactId);

  if (data?.line_id) {
    revalidatePath(`/dashboard/lines/${getShortLineId(data.line_id)}/contacts`);
  }
  return { success: true };
}

// ============================================
// PHONE VERIFICATION ACTIONS
// ============================================

// Start phone verification
export async function startPhoneVerification(
  lineId: string,
  channel: 'sms' | 'call'
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get the line
  const line = await getLine(lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  // Call the telephony backend to send verification
  const telephonyUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${telephonyUrl}/verify/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        lineId,
        phoneNumber: line.phone_e164,
        channel,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to send verification' };
    }

    // Create verification record
    await client.from('ultaura_phone_verifications').insert({
      line_id: lineId,
      channel,
      status: 'pending',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return { success: true };
  } catch (error) {
    logger.error({ error }, 'Failed to start verification');
    return { success: false, error: 'Failed to send verification code' };
  }
}

// Check phone verification
export async function checkPhoneVerification(
  lineId: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get the line
  const line = await getLine(lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  // Call the telephony backend to check verification
  const telephonyUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  try {
    const response = await fetch(`${telephonyUrl}/verify/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        phoneNumber: line.phone_e164,
        code,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Verification failed' };
    }

    const result = await response.json();

    if (result.verified) {
      // Update line status
      await client
        .from('ultaura_lines')
        .update({
          phone_verified_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', lineId);

      // Update verification record
      await client
        .from('ultaura_phone_verifications')
        .update({ status: 'approved' })
        .eq('line_id', lineId)
        .eq('status', 'pending');

      revalidatePath('/dashboard/lines', 'page');

      return { success: true };
    } else {
      return { success: false, error: 'Invalid verification code' };
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check verification');
    return { success: false, error: 'Verification check failed' };
  }
}

// ============================================
// SCHEDULE ACTIONS
// ============================================

// Get schedules for a line
export async function getSchedules(lineId: string): Promise<ScheduleRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get schedules');
    return [];
  }

  return data || [];
}

// Get a single schedule by ID
export async function getSchedule(scheduleId: string): Promise<ScheduleRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (error) {
    logger.error({ error }, 'Failed to get schedule');
    return null;
  }

  return data;
}

/**
 * Calculate the next run time for a schedule, properly accounting for timezone.
 * Returns a Date in UTC that represents when the call should be made.
 */
function getNextRunAt(timeOfDay: string, timezone: string, daysOfWeek: number[]): Date {
  return getNextOccurrence({
    timeOfDay,
    timezone,
    daysOfWeek,
  });
}

// Create a schedule
export async function createSchedule(
  accountId: string,
  input: CreateScheduleInput
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const account = await getUltauraAccountById(accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  // Build RRULE
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const rruleDays = input.daysOfWeek.map(d => dayNames[d]).join(',');
  const rrule = `FREQ=WEEKLY;BYDAY=${rruleDays}`;

  let next: Date;
  try {
    validateTimezone(input.timezone);
    next = getNextRunAt(input.timeOfDay, input.timezone, input.daysOfWeek);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }

  const { data: schedule, error } = await client
    .from('ultaura_schedules')
    .insert({
      account_id: accountId,
      line_id: input.lineId,
      enabled: true,
      timezone: input.timezone,
      rrule,
      days_of_week: input.daysOfWeek,
      time_of_day: input.timeOfDay,
      next_run_at: next.toISOString(),
      retry_policy: input.retryPolicy || { max_retries: 2, retry_window_minutes: 30 },
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create schedule');
    return { success: false, error: 'Failed to create schedule' };
  }

  // Update line's next scheduled call
  await client
    .from('ultaura_lines')
    .update({ next_scheduled_call_at: next.toISOString() })
    .eq('id', input.lineId);

  // Record consent for outbound calls
  await client.from('ultaura_consents').insert({
    account_id: accountId,
    line_id: input.lineId,
    type: 'outbound_calls',
    granted: true,
    granted_by: 'payer_ack',
    evidence: { timestamp: new Date().toISOString() },
  });

  revalidatePath('/dashboard/lines', 'page');
  revalidatePath('/dashboard/schedules', 'page');

  return { success: true, scheduleId: schedule.id };
}

// Update a schedule
export async function updateSchedule(
  scheduleId: string,
  input: UpdateScheduleInput
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const { data: schedule, error: scheduleError } = await client
    .from('ultaura_schedules')
    .select('account_id')
    .eq('id', scheduleId)
    .single();

  if (scheduleError || !schedule) {
    return { success: false, error: 'Schedule not found' };
  }

  const account = await getUltauraAccountById(schedule.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  const updates: Record<string, unknown> = {};

  if (input.enabled !== undefined) updates.enabled = input.enabled;
  if (input.timezone !== undefined) updates.timezone = input.timezone;
  if (input.daysOfWeek !== undefined) {
    updates.days_of_week = input.daysOfWeek;
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
    updates.rrule = `FREQ=WEEKLY;BYDAY=${input.daysOfWeek.map(d => dayNames[d]).join(',')}`;
  }
  if (input.timeOfDay !== undefined) updates.time_of_day = input.timeOfDay;
  if (input.retryPolicy !== undefined) updates.retry_policy = input.retryPolicy;

  // Recalculate next run if schedule changed
  if (input.daysOfWeek || input.timeOfDay || input.timezone) {
    const { data: current } = await client
      .from('ultaura_schedules')
      .select('days_of_week, time_of_day, timezone')
      .eq('id', scheduleId)
      .single();

    const daysOfWeek = input.daysOfWeek || current?.days_of_week || [];
    const timeOfDay = input.timeOfDay || current?.time_of_day || '18:00';
    const timezone = input.timezone || current?.timezone || 'America/Los_Angeles';

    try {
      validateTimezone(timezone);
      const next = getNextRunAt(timeOfDay, timezone, daysOfWeek);
      updates.next_run_at = next.toISOString();
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  const { error } = await client
    .from('ultaura_schedules')
    .update(updates)
    .eq('id', scheduleId);

  if (error) {
    logger.error({ error }, 'Failed to update schedule');
    return { success: false, error: 'Failed to update schedule' };
  }

  revalidatePath('/dashboard/schedules', 'page');

  return { success: true };
}

// Delete a schedule
export async function deleteSchedule(scheduleId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const { data: schedule, error: scheduleError } = await client
    .from('ultaura_schedules')
    .select('account_id')
    .eq('id', scheduleId)
    .single();

  if (scheduleError || !schedule) {
    return { success: false, error: 'Schedule not found' };
  }

  const account = await getUltauraAccountById(schedule.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  const { error } = await client
    .from('ultaura_schedules')
    .delete()
    .eq('id', scheduleId);

  if (error) {
    logger.error({ error }, 'Failed to delete schedule');
    return { success: false, error: 'Failed to delete schedule' };
  }

  revalidatePath('/dashboard/schedules', 'page');

  return { success: true };
}

// ============================================
// USAGE ACTIONS
// ============================================

// Get usage summary for an account
export async function getUsageSummary(accountId: string): Promise<UsageSummary | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client.rpc('get_ultaura_usage_summary', {
    p_account_id: accountId,
  });

  if (error) {
    logger.error({ error }, 'Failed to get usage summary');
    return null;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
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

export async function updateOverageCap(accountId: string, overageCentsCap: number): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const account = await getUltauraAccountById(accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  const { error } = await client
    .from('ultaura_accounts')
    .update({ overage_cents_cap: overageCentsCap })
    .eq('id', accountId);

  if (error) {
    logger.error({ error, accountId }, 'Failed to update overage cap');
    return { success: false, error: 'Failed to update overage cap' };
  }

  revalidatePath('/dashboard/usage', 'page');
  revalidatePath('/dashboard', 'page');

  return { success: true };
}

// Get call sessions for a line
export async function getCallSessions(
  lineId: string,
  limit: number = 10
): Promise<CallSessionRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_call_sessions')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, 'Failed to get call sessions');
    return [];
  }

  return data || [];
}

// Get line activity
export async function getLineActivity(accountId: string): Promise<LineActivity[]> {
  const client = getSupabaseServerComponentClient();

  const { data: lines } = await client
    .from('ultaura_lines')
    .select('id, display_name, last_successful_call_at, next_scheduled_call_at')
    .eq('account_id', accountId);

  if (!lines) return [];

  const activities: LineActivity[] = [];

  for (const line of lines) {
    // Get last call duration
    let lastCallDuration: number | null = null;
    if (line.last_successful_call_at) {
      const { data: lastCall } = await client
        .from('ultaura_call_sessions')
        .select('seconds_connected')
        .eq('line_id', line.id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      lastCallDuration = lastCall?.seconds_connected || null;
    }

    activities.push({
      lineId: line.id,
      displayName: line.display_name,
      lastCallAt: line.last_successful_call_at,
      lastCallDuration,
      nextScheduledAt: line.next_scheduled_call_at,
    });
  }

  return activities;
}

// Get all upcoming scheduled calls for the dashboard
export async function getUpcomingScheduledCalls(accountId: string): Promise<{
  scheduleId: string;
  lineId: string;
  displayName: string;
  nextRunAt: string;
  timeOfDay: string;
  daysOfWeek: number[];
}[]> {
  const client = getSupabaseServerComponentClient();

  // Fetch enabled schedules with their associated line info
  const { data: schedules, error } = await client
    .from('ultaura_schedules')
    .select(`
      id,
      line_id,
      next_run_at,
      time_of_day,
      days_of_week,
      enabled,
      ultaura_lines!inner (
        display_name
      )
    `)
    .eq('account_id', accountId)
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .order('next_run_at', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get upcoming scheduled calls');
    return [];
  }

  return (schedules || []).map((schedule) => ({
    scheduleId: schedule.id,
    lineId: schedule.line_id,
    displayName: (schedule.ultaura_lines as { display_name: string }).display_name,
    nextRunAt: schedule.next_run_at!,
    timeOfDay: schedule.time_of_day,
    daysOfWeek: schedule.days_of_week,
  }));
}

// Get all schedules for an account (across all lines, including disabled)
export async function getAllSchedules(accountId: string): Promise<{
  scheduleId: string;
  lineId: string;
  displayName: string;
  enabled: boolean;
  nextRunAt: string | null;
  timeOfDay: string;
  daysOfWeek: number[];
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: schedules, error } = await client
    .from('ultaura_schedules')
    .select(`
      id,
      line_id,
      next_run_at,
      time_of_day,
      days_of_week,
      enabled,
      ultaura_lines!inner (
        display_name
      )
    `)
    .eq('account_id', accountId)
    .order('enabled', { ascending: false })
    .order('next_run_at', { ascending: true, nullsFirst: false });

  if (error) {
    logger.error({ error }, 'Failed to get all schedules');
    return [];
  }

  return (schedules || []).map((schedule) => ({
    scheduleId: schedule.id,
    lineId: schedule.line_id,
    displayName: (schedule.ultaura_lines as { display_name: string }).display_name,
    enabled: schedule.enabled,
    nextRunAt: schedule.next_run_at,
    timeOfDay: schedule.time_of_day,
    daysOfWeek: schedule.days_of_week,
  }));
}

// ============================================
// TEST CALL ACTION
// ============================================

// Initiate a test call
export async function initiateTestCall(lineId: string): Promise<{ success: boolean; error?: string }> {
  const telephonyUrl = process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001';

  const line = await getLine(lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  try {
    const response = await fetch(`${telephonyUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        lineId,
        reason: 'test',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error || 'Failed to initiate test call' };
    }

    return { success: true };
  } catch (error) {
    logger.error({ error }, 'Failed to initiate test call');
    return { success: false, error: 'Failed to initiate test call' };
  }
}

// ============================================
// REMINDER ACTIONS
// ============================================

export interface ReminderRow {
  id: string;
  account_id: string;
  line_id: string;
  created_at: string;
  due_at: string;
  timezone: string;
  message: string;
  delivery_method: string;
  status: 'scheduled' | 'sent' | 'missed' | 'canceled';
  privacy_scope: 'line_only' | 'shareable_with_payer';
  created_by_call_session_id: string | null;
  // Recurrence fields
  is_recurring: boolean;
  rrule: string | null;
  interval_days: number | null;
  days_of_week: number[] | null;
  day_of_month: number | null;
  time_of_day: string | null;
  ends_at: string | null;
  occurrence_count: number;
  // Pause/snooze fields
  is_paused: boolean;
  paused_at: string | null;
  snoozed_until: string | null;
  original_due_at: string | null;
  current_snooze_count: number;
  last_delivery_status: 'completed' | 'no_answer' | 'failed' | null;
}

export interface ReminderEventRow {
  id: string;
  account_id: string;
  reminder_id: string;
  line_id: string;
  created_at: string;
  event_type: 'created' | 'edited' | 'paused' | 'resumed' | 'snoozed' | 'skipped' | 'canceled' | 'delivered' | 'no_answer' | 'failed';
  triggered_by: 'dashboard' | 'voice' | 'system';
  call_session_id: string | null;
  metadata: Record<string, unknown> | null;
  reminder_message?: string; // Joined from reminders table
}

// Get reminders for a line
export async function getReminders(lineId: string): Promise<ReminderRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminders')
    .select('*')
    .eq('line_id', lineId)
    .order('due_at', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get reminders');
    return [];
  }

  return data || [];
}

// Get a single reminder by ID
export async function getReminder(reminderId: string): Promise<ReminderRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminders')
    .select('*')
    .eq('id', reminderId)
    .single();

  if (error) {
    logger.error({ error }, 'Failed to get reminder');
    return null;
  }

  return data;
}

// Create a reminder from dashboard
export async function createReminder(input: {
  lineId: string;
  dueAt: string;
  message: string;
  timezone: string;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endsAt?: string;
  };
}): Promise<{ success: boolean; reminder?: ReminderRow; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get line to get account_id
  const line = await getLine(input.lineId);
  if (!line) {
    return { success: false, error: 'Line not found' };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  // Validate due date is in the future
  const dueDate = new Date(input.dueAt);
  if (dueDate.getTime() < Date.now()) {
    return { success: false, error: 'Reminder time must be in the future' };
  }

  // Validate message length
  if (!input.message || input.message.trim().length === 0) {
    return { success: false, error: 'Message is required' };
  }

  if (input.message.length > 500) {
    return { success: false, error: 'Message must be 500 characters or less' };
  }

  // Build recurrence fields
  let isRecurring = false;
  let rrule: string | null = null;
  let intervalDays: number | null = null;
  let daysOfWeek: number[] | null = null;
  let dayOfMonth: number | null = null;
  let timeOfDay: string | null = null;
  let endsAt: string | null = null;

  if (input.recurrence) {
    isRecurring = true;
    const { frequency, interval, daysOfWeek: dow, dayOfMonth: dom, endsAt: ends } = input.recurrence;

    // Extract time from dueAt
    timeOfDay = `${String(dueDate.getHours()).padStart(2, '0')}:${String(dueDate.getMinutes()).padStart(2, '0')}`;

    // Build RRULE based on frequency
    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    switch (frequency) {
      case 'daily':
        intervalDays = interval || 1;
        rrule = intervalDays > 1 ? `FREQ=DAILY;INTERVAL=${intervalDays}` : 'FREQ=DAILY';
        break;

      case 'weekly':
        daysOfWeek = dow && dow.length > 0 ? dow : [dueDate.getDay()];
        const byDay = daysOfWeek.map(d => dayNames[d]).join(',');
        rrule = interval && interval > 1
          ? `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`
          : `FREQ=WEEKLY;BYDAY=${byDay}`;
        break;

      case 'monthly':
        dayOfMonth = dom || dueDate.getDate();
        rrule = interval && interval > 1
          ? `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${dayOfMonth}`
          : `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
        break;

      case 'custom':
        intervalDays = interval || 1;
        rrule = `FREQ=DAILY;INTERVAL=${intervalDays}`;
        break;
    }

    endsAt = ends || null;
  }

  const { data: reminder, error } = await client
    .from('ultaura_reminders')
    .insert({
      account_id: line.account_id,
      line_id: input.lineId,
      due_at: input.dueAt,
      timezone: input.timezone || line.timezone,
      message: input.message.trim(),
      delivery_method: 'outbound_call',
      status: 'scheduled',
      privacy_scope: 'line_only',
      // Recurrence fields
      is_recurring: isRecurring,
      rrule,
      interval_days: intervalDays,
      days_of_week: daysOfWeek,
      day_of_month: dayOfMonth,
      time_of_day: timeOfDay,
      ends_at: endsAt,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create reminder');
    return { success: false, error: 'Failed to create reminder' };
  }

  revalidatePath(`/dashboard/lines/${getShortLineId(input.lineId)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(input.lineId)}`, 'page');

  return { success: true, reminder };
}

// Cancel a reminder
export async function cancelReminder(reminderId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get reminder to check status and get lineId for revalidation
  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  if (reminder.status !== 'scheduled') {
    return { success: false, error: 'Can only cancel scheduled reminders' };
  }

  const { error } = await client
    .from('ultaura_reminders')
    .update({ status: 'canceled' })
    .eq('id', reminderId);

  if (error) {
    logger.error({ error }, 'Failed to cancel reminder');
    return { success: false, error: 'Failed to cancel reminder' };
  }

  // Log the cancel event
  await logReminderEvent({
    accountId: reminder.account_id,
    reminderId: reminder.id,
    lineId: reminder.line_id,
    eventType: 'canceled',
    triggeredBy: 'dashboard',
  });

  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}`, 'page');

  return { success: true };
}

/**
 * Calculate the next occurrence for a recurring reminder.
 * Helper function used by skipNextOccurrence.
 */
function calculateNextReminderOccurrence(reminder: ReminderRow): string | null {
  if (!reminder.is_recurring || !reminder.rrule || !reminder.time_of_day) {
    return null;
  }

  try {
    const next = getNextReminderOccurrence({
      rrule: reminder.rrule,
      timezone: reminder.timezone,
      timeOfDay: reminder.time_of_day,
      currentDueAt: new Date(reminder.due_at),
      daysOfWeek: reminder.days_of_week,
      dayOfMonth: reminder.day_of_month,
      intervalDays: reminder.interval_days,
    });

    return next ? next.toISOString() : null;
  } catch (error) {
    logger.error({ error, reminderId: reminder.id }, 'Failed to calculate next reminder occurrence');
    return null;
  }
}

// Skip the next occurrence of a recurring reminder
export async function skipNextOccurrence(reminderId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get reminder
  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  if (!reminder.is_recurring) {
    return { success: false, error: 'Can only skip recurring reminders' };
  }

  if (reminder.status !== 'scheduled') {
    return { success: false, error: 'Reminder is not scheduled' };
  }

  // Calculate next occurrence
  const nextDueAt = calculateNextReminderOccurrence(reminder);

  if (!nextDueAt) {
    return { success: false, error: 'Could not calculate next occurrence' };
  }

  // Check if series should end
  if (reminder.ends_at && new Date(nextDueAt) > new Date(reminder.ends_at)) {
    // Skipping would end the series - cancel instead
    return cancelReminder(reminderId);
  }

  // Update reminder to next occurrence
  const { error } = await client
    .from('ultaura_reminders')
    .update({
      due_at: nextDueAt,
      // Don't increment occurrence_count since we're skipping
    })
    .eq('id', reminderId);

  if (error) {
    logger.error({ error }, 'Failed to skip reminder occurrence');
    return { success: false, error: 'Failed to skip occurrence' };
  }

  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}`, 'page');

  // Log the skip event
  await logReminderEvent({
    accountId: reminder.account_id,
    reminderId: reminder.id,
    lineId: reminder.line_id,
    eventType: 'skipped',
    triggeredBy: 'dashboard',
    metadata: { skippedDueAt: reminder.due_at, nextDueAt },
  });

  return { success: true };
}

// ============================================
// REMINDER EVENT LOGGING
// ============================================

/**
 * Log a reminder event for audit trail and caregiver visibility
 */
export async function logReminderEvent(params: {
  accountId: string;
  reminderId: string;
  lineId: string;
  eventType: ReminderEventRow['event_type'];
  triggeredBy: ReminderEventRow['triggered_by'];
  callSessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_reminder_events')
    .insert({
      account_id: params.accountId,
      reminder_id: params.reminderId,
      line_id: params.lineId,
      event_type: params.eventType,
      triggered_by: params.triggeredBy,
      call_session_id: params.callSessionId || null,
      metadata: params.metadata || null,
    });

  if (error) {
    logger.error({ error }, 'Failed to log reminder event');
    return { success: false, error: 'Failed to log event' };
  }

  return { success: true };
}

/**
 * Get events for a specific reminder
 */
export async function getReminderEvents(reminderId: string): Promise<ReminderEventRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminder_events')
    .select('*')
    .eq('reminder_id', reminderId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get reminder events');
    return [];
  }

  return data || [];
}

/**
 * Get all reminder events for a line (for caregiver activity view)
 * Joins with reminders table to include the reminder message
 */
export async function getLineReminderEvents(lineId: string, limit = 50): Promise<ReminderEventRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminder_events')
    .select(`
      *,
      ultaura_reminders!inner(message)
    `)
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, 'Failed to get line reminder events');
    return [];
  }

  // Flatten the joined data to include reminder_message
  return (data || []).map(event => ({
    ...event,
    reminder_message: event.ultaura_reminders?.message,
    ultaura_reminders: undefined, // Remove the nested object
  }));
}

// ============================================
// PAUSE / RESUME REMINDERS
// ============================================

/**
 * Pause a reminder indefinitely
 */
export async function pauseReminder(reminderId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  if (reminder.status !== 'scheduled') {
    return { success: false, error: 'Can only pause scheduled reminders' };
  }

  if (reminder.is_paused) {
    return { success: false, error: 'Reminder is already paused' };
  }

  const { error } = await client
    .from('ultaura_reminders')
    .update({
      is_paused: true,
      paused_at: new Date().toISOString(),
    })
    .eq('id', reminderId);

  if (error) {
    logger.error({ error }, 'Failed to pause reminder');
    return { success: false, error: 'Failed to pause reminder' };
  }

  // Log the pause event
  await logReminderEvent({
    accountId: reminder.account_id,
    reminderId: reminder.id,
    lineId: reminder.line_id,
    eventType: 'paused',
    triggeredBy: 'dashboard',
  });

  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}`, 'page');

  return { success: true };
}

/**
 * Resume a paused reminder
 */
export async function resumeReminder(reminderId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  if (!reminder.is_paused) {
    return { success: false, error: 'Reminder is not paused' };
  }

  // Reset snooze count when resuming
  const { error } = await client
    .from('ultaura_reminders')
    .update({
      is_paused: false,
      paused_at: null,
      current_snooze_count: 0,
    })
    .eq('id', reminderId);

  if (error) {
    logger.error({ error }, 'Failed to resume reminder');
    return { success: false, error: 'Failed to resume reminder' };
  }

  // Log the resume event
  await logReminderEvent({
    accountId: reminder.account_id,
    reminderId: reminder.id,
    lineId: reminder.line_id,
    eventType: 'resumed',
    triggeredBy: 'dashboard',
  });

  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}`, 'page');

  return { success: true };
}

// ============================================
// SNOOZE REMINDERS
// ============================================

const MAX_SNOOZE_COUNT = 3;
const VALID_SNOOZE_MINUTES = [15, 30, 60, 120, 1440]; // 15m, 30m, 1h, 2h, tomorrow

/**
 * Snooze a reminder for a specified duration
 */
export async function snoozeReminder(
  reminderId: string,
  minutes: number
): Promise<{ success: boolean; error?: string; newDueAt?: string }> {
  const client = getSupabaseServerComponentClient();

  if (!VALID_SNOOZE_MINUTES.includes(minutes)) {
    return { success: false, error: 'Invalid snooze duration' };
  }

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  if (reminder.status !== 'scheduled') {
    return { success: false, error: 'Can only snooze scheduled reminders' };
  }

  if (reminder.is_paused) {
    return { success: false, error: 'Cannot snooze a paused reminder' };
  }

  // Check snooze count limit
  if (reminder.current_snooze_count >= MAX_SNOOZE_COUNT) {
    return { success: false, error: `Maximum snooze limit (${MAX_SNOOZE_COUNT}) reached` };
  }

  const now = new Date();
  const newDueAt = new Date(now.getTime() + minutes * 60 * 1000);

  // Store original due_at if this is the first snooze
  const originalDueAt = reminder.original_due_at || reminder.due_at;

  const { error } = await client
    .from('ultaura_reminders')
    .update({
      due_at: newDueAt.toISOString(),
      original_due_at: originalDueAt,
      snoozed_until: newDueAt.toISOString(),
      current_snooze_count: reminder.current_snooze_count + 1,
    })
    .eq('id', reminderId);

  if (error) {
    logger.error({ error }, 'Failed to snooze reminder');
    return { success: false, error: 'Failed to snooze reminder' };
  }

  // Log the snooze event
  await logReminderEvent({
    accountId: reminder.account_id,
    reminderId: reminder.id,
    lineId: reminder.line_id,
    eventType: 'snoozed',
    triggeredBy: 'dashboard',
    metadata: {
      snoozeMinutes: minutes,
      snoozeCount: reminder.current_snooze_count + 1,
      originalDueAt,
      newDueAt: newDueAt.toISOString(),
    },
  });

  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}`, 'page');

  return { success: true, newDueAt: newDueAt.toISOString() };
}

// ============================================
// EDIT REMINDERS
// ============================================

export interface EditReminderInput {
  message?: string;
  dueAt?: string;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom' | 'once';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endsAt?: string;
  };
}

/**
 * Edit a reminder's message, time, or recurrence
 */
export async function editReminder(
  reminderId: string,
  input: EditReminderInput
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const trialStatus = getTrialStatus(account);
  if (trialStatus.isExpired) {
    return { success: false, error: 'Your trial has ended. Subscribe to continue.' };
  }

  if (reminder.status !== 'scheduled') {
    return { success: false, error: 'Can only edit scheduled reminders' };
  }

  // Build update object
  const updates: Record<string, unknown> = {};
  const oldValues: Record<string, unknown> = {};

  if (input.message !== undefined && input.message !== reminder.message) {
    if (!input.message.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }
    if (input.message.length > 500) {
      return { success: false, error: 'Message must be 500 characters or less' };
    }
    oldValues.message = reminder.message;
    updates.message = input.message.trim();
  }

  if (input.dueAt !== undefined) {
    const dueDate = new Date(input.dueAt);
    if (dueDate <= new Date()) {
      return { success: false, error: 'Due date must be in the future' };
    }
    oldValues.dueAt = reminder.due_at;
    updates.due_at = dueDate.toISOString();

    // Extract time for recurring reminders
    const hours = dueDate.getHours().toString().padStart(2, '0');
    const minutes = dueDate.getMinutes().toString().padStart(2, '0');
    updates.time_of_day = `${hours}:${minutes}`;
  }

  if (input.recurrence !== undefined) {
    oldValues.isRecurring = reminder.is_recurring;
    oldValues.rrule = reminder.rrule;

    if (input.recurrence.frequency === 'once') {
      // Convert to one-time reminder
      updates.is_recurring = false;
      updates.rrule = null;
      updates.interval_days = null;
      updates.days_of_week = null;
      updates.day_of_month = null;
      updates.ends_at = null;
    } else {
      // Set up recurrence
      updates.is_recurring = true;

      const { frequency, interval = 1, daysOfWeek, dayOfMonth, endsAt } = input.recurrence;
      let rrule = '';

      switch (frequency) {
        case 'daily':
          rrule = interval > 1 ? `FREQ=DAILY;INTERVAL=${interval}` : 'FREQ=DAILY';
          updates.interval_days = interval;
          break;
        case 'weekly':
          if (!daysOfWeek || daysOfWeek.length === 0) {
            return { success: false, error: 'Weekly reminders require at least one day' };
          }
          const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
          const byDay = daysOfWeek.map(d => dayMap[d]).join(',');
          rrule = interval > 1
            ? `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`
            : `FREQ=WEEKLY;BYDAY=${byDay}`;
          updates.days_of_week = daysOfWeek;
          break;
        case 'monthly':
          const day = dayOfMonth || 1;
          rrule = interval > 1
            ? `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${day}`
            : `FREQ=MONTHLY;BYMONTHDAY=${day}`;
          updates.day_of_month = day;
          break;
        case 'custom':
          rrule = `FREQ=DAILY;INTERVAL=${interval}`;
          updates.interval_days = interval;
          break;
      }

      updates.rrule = rrule;
      updates.ends_at = endsAt ? new Date(endsAt).toISOString() : null;
    }
  }

  // Check if there are any changes
  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'No changes to apply' };
  }

  const { error } = await client
    .from('ultaura_reminders')
    .update(updates)
    .eq('id', reminderId);

  if (error) {
    logger.error({ error }, 'Failed to edit reminder');
    return { success: false, error: 'Failed to edit reminder' };
  }

  // Log the edit event
  await logReminderEvent({
    accountId: reminder.account_id,
    reminderId: reminder.id,
    lineId: reminder.line_id,
    eventType: 'edited',
    triggeredBy: 'dashboard',
    metadata: { oldValues, newValues: updates },
  });

  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${getShortLineId(reminder.line_id)}`, 'page');

  return { success: true };
}

// Get pending reminder count for a line
export async function getPendingReminderCount(lineId: string): Promise<number> {
  const client = getSupabaseServerComponentClient();

  const { count, error } = await client
    .from('ultaura_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('line_id', lineId)
    .eq('status', 'scheduled');

  if (error) {
    logger.error({ error }, 'Failed to get pending reminder count');
    return 0;
  }

  return count || 0;
}

// Get next upcoming reminder for a line
export async function getNextReminder(lineId: string): Promise<ReminderRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminders')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'scheduled')
    .gte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error({ error }, 'Failed to get next reminder');
    }
    return null;
  }

  return data;
}

// Get upcoming reminders for an account (across all lines)
export async function getUpcomingReminders(accountId: string): Promise<{
  reminderId: string;
  lineId: string;
  displayName: string;
  message: string;
  dueAt: string;
  timezone: string;
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: reminders, error } = await client
    .from('ultaura_reminders')
    .select(`
      id,
      line_id,
      message,
      due_at,
      timezone,
      is_recurring,
      rrule,
      interval_days,
      days_of_week,
      day_of_month,
      ultaura_lines!inner (
        display_name
      )
    `)
    .eq('account_id', accountId)
    .eq('status', 'scheduled')
    .gte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(10);

  if (error) {
    logger.error({ error }, 'Failed to get upcoming reminders');
    return [];
  }

  return (reminders || []).map((reminder) => ({
    reminderId: reminder.id,
    lineId: reminder.line_id,
    displayName: (reminder.ultaura_lines as { display_name: string }).display_name,
    message: reminder.message,
    dueAt: reminder.due_at,
    timezone: reminder.timezone,
    isRecurring: reminder.is_recurring,
    rrule: reminder.rrule,
    intervalDays: reminder.interval_days,
    daysOfWeek: reminder.days_of_week,
    dayOfMonth: reminder.day_of_month,
  }));
}

// Get all reminders for an account (across all lines, all statuses)
export async function getAllReminders(accountId: string): Promise<{
  reminderId: string;
  lineId: string;
  displayName: string;
  message: string;
  dueAt: string;
  timezone: string;
  status: 'scheduled' | 'sent' | 'missed' | 'canceled';
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: reminders, error } = await client
    .from('ultaura_reminders')
    .select(`
      id,
      line_id,
      message,
      due_at,
      timezone,
      status,
      is_recurring,
      rrule,
      interval_days,
      days_of_week,
      day_of_month,
      ultaura_lines!inner (
        display_name
      )
    `)
    .eq('account_id', accountId)
    .order('due_at', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get all reminders');
    return [];
  }

  return (reminders || []).map((reminder) => ({
    reminderId: reminder.id,
    lineId: reminder.line_id,
    displayName: (reminder.ultaura_lines as { display_name: string }).display_name,
    message: reminder.message,
    dueAt: reminder.due_at,
    timezone: reminder.timezone,
    status: reminder.status as 'scheduled' | 'sent' | 'missed' | 'canceled',
    isRecurring: reminder.is_recurring,
    rrule: reminder.rrule,
    intervalDays: reminder.interval_days,
    daysOfWeek: reminder.days_of_week,
    dayOfMonth: reminder.day_of_month,
  }));
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUltauraAccountById(accountId: string): Promise<UltauraAccountRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) return null;
  return data;
}

function getTrialStatus(account: UltauraAccountRow): {
  isOnTrial: boolean;
  isExpired: boolean;
  trialPlanId: PlanId | null;
  trialEndsAt: string | null;
  daysRemaining: number;
} {
  const isOnTrial = account.status === 'trial';
  const trialEndsAt = isOnTrial
    ? (account.trial_ends_at ?? account.cycle_end ?? null)
    : null;

  const trialPlanId = isOnTrial
    ? ((account.trial_plan_id ?? account.plan_id) as PlanId)
    : null;

  if (!isOnTrial || !trialEndsAt) {
    return { isOnTrial, isExpired: false, trialPlanId, trialEndsAt, daysRemaining: 0 };
  }

  const msRemaining = new Date(trialEndsAt).getTime() - Date.now();
  const isExpired = msRemaining <= 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return { isOnTrial, isExpired, trialPlanId, trialEndsAt, daysRemaining };
}

async function getPlan(planId: string) {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) return null;
  return data;
}

// ============================================
// CHECKOUT ACTIONS
// ============================================

// Ultaura plan to Stripe price ID mapping
const ULTAURA_PRICE_IDS: Record<string, { monthly?: string; annual?: string }> = {
  care: {
    monthly: process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID,
  },
  comfort: {
    monthly: process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID,
  },
  family: {
    monthly: process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID,
  },
  payg: {
    monthly: process.env.STRIPE_ULTAURA_PAYG_PRICE_ID,
  },
};

// Create a Stripe checkout session for an Ultaura plan
export async function createUltauraCheckout(
  planId: string,
  billingInterval: 'monthly' | 'annual',
  organizationUid: string,
  returnUrl: string
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
  // Validate plan
  if (!['care', 'comfort', 'family', 'payg'].includes(planId)) {
    return { success: false, error: 'Invalid plan selected' };
  }

  // Get the price ID
  const priceConfig = ULTAURA_PRICE_IDS[planId];
  const priceId = billingInterval === 'annual' && priceConfig?.annual
    ? priceConfig.annual
    : priceConfig?.monthly;

  if (!priceId) {
    logger.error({ planId, billingInterval }, 'Missing Stripe price ID for Ultaura plan');
    return { success: false, error: 'Pricing configuration error. Please contact support.' };
  }

  try {
    // Import Stripe utilities
    const getStripeInstance = (await import('~/core/stripe/get-stripe')).default;
    const stripe = await getStripeInstance();

    // Get organization's Stripe customer ID if exists
    const client = getSupabaseServerComponentClient();
    const { data: org, error: orgError } = await client
      .from('organizations')
      .select('id')
      .eq('uuid', organizationUid)
      .single();

    if (orgError || !org) {
      logger.error({ orgError, organizationUid }, 'Failed to load organization for checkout');
      return { success: false, error: 'Unable to load organization details. Please try again.' };
    }

    const { data: orgSubscription, error: orgSubscriptionError } = await client
      .from('organizations_subscriptions')
      .select('customer_id')
      .eq('organization_id', org.id)
      .maybeSingle();

    if (orgSubscriptionError) {
      logger.error(
        { orgSubscriptionError, organizationUid },
        'Failed to load organization subscription for checkout',
      );
    }

    const customerId = orgSubscription?.customer_id ?? undefined;

    // Create checkout session
    const successUrl = `${returnUrl}?success=true&plan=${planId}`;
    const cancelUrl = `${returnUrl}?canceled=true`;

    const sessionParams: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: organizationUid,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          organization_uid: organizationUid,
          ultaura_plan_id: planId,
        },
      },
      metadata: {
        organization_uid: organizationUid,
        ultaura_plan_id: planId,
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return { success: false, error: 'Failed to create checkout session' };
    }

    return { success: true, checkoutUrl: session.url };

  } catch (error) {
    logger.error({ error, planId }, 'Failed to create Ultaura checkout session');
    return { success: false, error: 'Failed to create checkout session' };
  }
}

// Get the appropriate price ID for a plan
export async function getUltauraPriceId(
  planId: string,
  billingInterval: 'monthly' | 'annual'
): Promise<string | null> {
  const priceConfig = ULTAURA_PRICE_IDS[planId];
  if (!priceConfig) return null;

  if (billingInterval === 'annual' && priceConfig.annual) {
    return priceConfig.annual;
  }
  return priceConfig.monthly || null;
}
