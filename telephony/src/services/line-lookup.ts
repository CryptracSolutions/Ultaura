// Line lookup service
// Finds lines by phone number and validates access

import { getSupabaseClient, LineRow, UltauraAccountRow } from '../utils/supabase.js';
import { logger } from '../server.js';

export interface LineWithAccount {
  line: LineRow;
  account: UltauraAccountRow;
}

// Find a line by phone number (for inbound calls)
export async function findLineByPhone(phoneE164: string): Promise<LineWithAccount | null> {
  const supabase = getSupabaseClient();

  // Look up the line
  const { data: line, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('*')
    .eq('phone_e164', phoneE164)
    .single();

  if (lineError || !line) {
    logger.info({ phone: phoneE164 }, 'Line not found for phone number');
    return null;
  }

  // Look up the account
  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('*')
    .eq('id', line.account_id)
    .single();

  if (accountError || !account) {
    logger.error({ lineId: line.id }, 'Account not found for line');
    return null;
  }

  return { line, account };
}

// Get a line by ID
export async function getLineById(lineId: string): Promise<LineWithAccount | null> {
  const supabase = getSupabaseClient();

  const { data: line, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('*')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    logger.error({ lineId }, 'Line not found by ID');
    return null;
  }

  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('*')
    .eq('id', line.account_id)
    .single();

  if (accountError || !account) {
    logger.error({ lineId }, 'Account not found for line');
    return null;
  }

  return { line, account };
}

// Check if a line can make/receive calls
export interface LineAccessCheck {
  allowed: boolean;
  reason?: 'disabled' | 'inbound_blocked' | 'do_not_call' | 'not_verified' | 'minutes_exhausted' | 'account_canceled';
  minutesRemaining?: number;
}

export async function checkLineAccess(
  line: LineRow,
  account: UltauraAccountRow,
  direction: 'inbound' | 'outbound'
): Promise<LineAccessCheck> {
  // Check line status
  if (line.status === 'disabled') {
    return { allowed: false, reason: 'disabled' };
  }

  // Check account status
  if (account.status === 'canceled') {
    return { allowed: false, reason: 'account_canceled' };
  }

  // Check inbound/outbound specific
  if (direction === 'inbound' && !line.inbound_allowed) {
    return { allowed: false, reason: 'inbound_blocked' };
  }

  if (direction === 'outbound' && line.do_not_call) {
    return { allowed: false, reason: 'do_not_call' };
  }

  // Check if phone is verified
  if (!line.phone_verified_at) {
    return { allowed: false, reason: 'not_verified' };
  }

  // Check minutes
  const minutesRemaining = await getMinutesRemaining(account.id);

  // For trial accounts, enforce hard stop
  if (account.status === 'trial' && minutesRemaining <= 0) {
    return { allowed: false, reason: 'minutes_exhausted', minutesRemaining: 0 };
  }

  return { allowed: true, minutesRemaining };
}

// Get minutes remaining for an account
export async function getMinutesRemaining(accountId: string): Promise<number> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc('get_ultaura_minutes_remaining', {
    p_account_id: accountId,
  });

  if (error) {
    logger.error({ error, accountId }, 'Failed to get minutes remaining');
    return 0;
  }

  return data ?? 0;
}

// Check if we're in quiet hours
export function isInQuietHours(line: LineRow): boolean {
  const now = new Date();

  // Convert to line's timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: line.timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const timeStr = formatter.format(now);
  const [hourStr, minuteStr] = timeStr.split(':');
  const currentMinutes = parseInt(hourStr) * 60 + parseInt(minuteStr);

  // Parse quiet hours
  const [startHour, startMinute] = line.quiet_hours_start.split(':').map(Number);
  const [endHour, endMinute] = line.quiet_hours_end.split(':').map(Number);

  const quietStart = startHour * 60 + startMinute;
  const quietEnd = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 21:00 to 09:00)
  if (quietStart > quietEnd) {
    // Quiet hours span midnight
    return currentMinutes >= quietStart || currentMinutes < quietEnd;
  } else {
    // Normal range
    return currentMinutes >= quietStart && currentMinutes < quietEnd;
  }
}

// Update line's last successful call
export async function updateLineLastCall(lineId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('ultaura_lines')
    .update({ last_successful_call_at: new Date().toISOString() })
    .eq('id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to update line last call');
  }
}

// Set do_not_call flag (opt-out)
export async function setDoNotCall(lineId: string, value: boolean): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('ultaura_lines')
    .update({ do_not_call: value })
    .eq('id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to update do_not_call');
    throw new Error('Failed to update opt-out status');
  }

  logger.info({ lineId, doNotCall: value }, 'Updated do_not_call status');
}

// Record opt-out event
export async function recordOptOut(
  accountId: string,
  lineId: string,
  callSessionId: string | null,
  source: 'dtmf' | 'voice' | 'dashboard',
  reason?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('ultaura_opt_outs').insert({
    account_id: accountId,
    line_id: lineId,
    channel: 'outbound_calls',
    source,
    reason,
    call_session_id: callSessionId,
  });

  if (error) {
    logger.error({ error, lineId }, 'Failed to record opt-out');
  }

  // Also set the do_not_call flag
  await setDoNotCall(lineId, true);
}
