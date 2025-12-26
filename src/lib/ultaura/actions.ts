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
  UltauraAccountRow,
  LineRow,
  ScheduleRow,
  CallSessionRow,
} from './types';

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
  const { data: account, error } = await client
    .from('ultaura_accounts')
    .insert({
      organization_id: organizationId,
      name,
      billing_email: email,
      created_by_user_id: userId,
      status: 'trial',
      plan_id: 'free_trial',
      minutes_included: 20,
      cycle_start: new Date().toISOString(),
      cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

  // Check line limit
  const account = await getUltauraAccountById(input.accountId);
  if (!account) {
    return { success: false, error: 'Account not found' };
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

export async function removeTrustedContact(contactId: string): Promise<{ success: boolean }> {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('line_id')
    .eq('id', contactId)
    .single();

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
  const [targetHours, targetMinutes] = timeOfDay.split(':').map(Number);

  // Get current time in the target timezone
  const now = new Date();
  const tzFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  // Parse current local time in target timezone
  const parts = tzFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value || '0';
  const currentHours = parseInt(getPart('hour'));
  const currentMinutes = parseInt(getPart('minute'));
  const currentDay = parseInt(getPart('day'));
  const currentMonth = parseInt(getPart('month'));
  const currentYear = parseInt(getPart('year'));

  // Map weekday name to day number (0=Sun, 1=Mon, etc.)
  const weekdayMap: Record<string, number> = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
  };
  const currentDayOfWeek = weekdayMap[getPart('weekday')] ?? 0;

  // Calculate if time has passed today in the target timezone
  const currentTimeMinutes = currentHours * 60 + currentMinutes;
  const targetTimeMinutes = targetHours * 60 + targetMinutes;

  // Start from today and find the next valid day
  let daysToAdd = 0;

  // If time has already passed today, start from tomorrow
  if (targetTimeMinutes <= currentTimeMinutes) {
    daysToAdd = 1;
  }

  // Find the next day that matches the schedule
  let candidateDayOfWeek = (currentDayOfWeek + daysToAdd) % 7;
  while (!daysOfWeek.includes(candidateDayOfWeek)) {
    daysToAdd++;
    candidateDayOfWeek = (currentDayOfWeek + daysToAdd) % 7;
    if (daysToAdd > 7) break; // Safety limit
  }

  // Calculate the target date in the target timezone
  const targetDate = new Date(Date.UTC(currentYear, currentMonth - 1, currentDay));
  targetDate.setUTCDate(targetDate.getUTCDate() + daysToAdd);

  // Create the target datetime string in the target timezone
  const targetDateStr = `${targetDate.getUTCFullYear()}-${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}-${String(targetDate.getUTCDate()).padStart(2, '0')}`;
  const targetTimeStr = `${String(targetHours).padStart(2, '0')}:${String(targetMinutes).padStart(2, '0')}:00`;

  // Convert local time in target timezone to UTC
  // We create a date string and use the formatter to find the UTC offset
  const localDateTime = new Date(`${targetDateStr}T${targetTimeStr}`);

  // Get the UTC offset for the target timezone at that specific date/time
  // by comparing the formatted time in UTC vs the target timezone
  const utcFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const tzFormatterForOffset = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  // Use a reference point to calculate offset
  const refTime = new Date(`${targetDateStr}T12:00:00Z`);
  const utcParts = utcFormatter.formatToParts(refTime);
  const tzParts = tzFormatterForOffset.formatToParts(refTime);

  const getPartValue = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parseInt(parts.find(p => p.type === type)?.value || '0');

  const utcHour = getPartValue(utcParts, 'hour');
  const tzHour = getPartValue(tzParts, 'hour');
  const utcDay = getPartValue(utcParts, 'day');
  const tzDay = getPartValue(tzParts, 'day');

  // Calculate offset in hours (timezone hour - UTC hour, adjusted for day boundary)
  let offsetHours = tzHour - utcHour;
  if (tzDay > utcDay) offsetHours += 24;
  if (tzDay < utcDay) offsetHours -= 24;

  // The target time in UTC is the local time minus the offset
  const utcTargetHours = targetHours - offsetHours;

  // Create the final UTC date
  const result = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate(),
    utcTargetHours,
    targetMinutes,
    0,
    0
  ));

  // Handle day rollover if UTC hours went negative or over 24
  if (utcTargetHours < 0) {
    result.setUTCDate(result.getUTCDate() - 1);
    result.setUTCHours(24 + utcTargetHours);
  } else if (utcTargetHours >= 24) {
    result.setUTCDate(result.getUTCDate() + 1);
    result.setUTCHours(utcTargetHours - 24);
  }

  return result;
}

// Create a schedule
export async function createSchedule(
  accountId: string,
  input: CreateScheduleInput
): Promise<{ success: boolean; scheduleId?: string; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Build RRULE
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const rruleDays = input.daysOfWeek.map(d => dayNames[d]).join(',');
  const rrule = `FREQ=WEEKLY;BYDAY=${rruleDays}`;

  // Calculate next run using timezone-aware helper
  const next = getNextRunAt(input.timeOfDay, input.timezone, input.daysOfWeek);

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

    // Use timezone-aware helper to calculate next run
    const next = getNextRunAt(timeOfDay, timezone, daysOfWeek);
    updates.next_run_at = next.toISOString();
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

  const currentDueAt = new Date(reminder.due_at);

  // Parse RRULE to determine frequency
  const freqMatch = reminder.rrule.match(/FREQ=(\w+)/);
  const intervalMatch = reminder.rrule.match(/INTERVAL=(\d+)/);

  const freq = freqMatch?.[1] || 'DAILY';
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : (reminder.interval_days || 1);

  let nextDate = new Date(currentDueAt);

  switch (freq) {
    case 'DAILY':
      nextDate.setDate(nextDate.getDate() + interval);
      break;

    case 'WEEKLY':
      if (reminder.days_of_week && reminder.days_of_week.length > 0) {
        nextDate.setDate(nextDate.getDate() + 1);
        let attempts = 0;
        while (!reminder.days_of_week.includes(nextDate.getDay()) && attempts < 14) {
          nextDate.setDate(nextDate.getDate() + 1);
          attempts++;
        }
        if (interval > 1) {
          nextDate.setDate(nextDate.getDate() + (interval - 1) * 7);
        }
      } else {
        nextDate.setDate(nextDate.getDate() + 7 * interval);
      }
      break;

    case 'MONTHLY':
      nextDate.setMonth(nextDate.getMonth() + interval);
      if (reminder.day_of_month) {
        const maxDays = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(reminder.day_of_month, maxDays));
      }
      break;

    default:
      return null;
  }

  // Set the time from time_of_day
  const [hours, minutes] = reminder.time_of_day.split(':').map(Number);
  nextDate.setHours(hours, minutes, 0, 0);

  return nextDate.toISOString();
}

// Skip the next occurrence of a recurring reminder
export async function skipNextOccurrence(reminderId: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get reminder
  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return { success: false, error: 'Reminder not found' };
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
    const { data: org } = await client
      .from('organizations')
      .select('subscription_id')
      .eq('uuid', organizationUid)
      .single();

    let customerId: string | undefined;
    if (org?.subscription_id) {
      const { data: sub } = await client
        .from('subscriptions')
        .select('customer_id')
        .eq('id', org.subscription_id)
        .single();
      customerId = sub?.customer_id;
    }

    // Determine trial period (7 days for new customers)
    const trialPeriodDays = customerId ? undefined : 7;

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
        trial_period_days: trialPeriodDays,
        metadata: {
          organizationUid,
          ultauraPlanId: planId,
        },
      },
      metadata: {
        ultauraPlanId: planId,
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
