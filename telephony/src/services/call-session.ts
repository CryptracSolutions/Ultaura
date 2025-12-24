// Call session service
// Manages call session lifecycle

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, CallSessionRow } from '../utils/supabase.js';
import { logger } from '../server.js';
import { recordUsage } from './metering.js';
import { updateLineLastCall } from './line-lookup.js';

export type CallStatus = 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled';
export type CallDirection = 'inbound' | 'outbound';
export type CallEndReason = 'hangup' | 'no_answer' | 'busy' | 'trial_cap' | 'minutes_cap' | 'error';

// Create a new call session
export async function createCallSession(options: {
  accountId: string;
  lineId: string;
  direction: CallDirection;
  twilioCallSid?: string;
  twilioFrom?: string;
  twilioTo?: string;
  // Reminder call fields
  isReminderCall?: boolean;
  reminderId?: string;
  reminderMessage?: string;
}): Promise<CallSessionRow | null> {
  const supabase = getSupabaseClient();

  const sessionId = uuidv4();

  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .insert({
      id: sessionId,
      account_id: options.accountId,
      line_id: options.lineId,
      direction: options.direction,
      status: 'created',
      twilio_call_sid: options.twilioCallSid,
      twilio_from: options.twilioFrom,
      twilio_to: options.twilioTo,
      is_reminder_call: options.isReminderCall || false,
      reminder_id: options.reminderId || null,
      reminder_message: options.reminderMessage || null,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error, options }, 'Failed to create call session');
    return null;
  }

  logger.info({ sessionId, direction: options.direction }, 'Call session created');

  return data;
}

// Get call session by ID
export async function getCallSession(sessionId: string): Promise<CallSessionRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    logger.error({ error, sessionId }, 'Failed to get call session');
    return null;
  }

  return data;
}

// Get call session by Twilio Call SID
export async function getCallSessionByTwilioSid(twilioCallSid: string): Promise<CallSessionRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .select('*')
    .eq('twilio_call_sid', twilioCallSid)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is expected
      logger.error({ error, twilioCallSid }, 'Failed to get call session by Twilio SID');
    }
    return null;
  }

  return data;
}

// Update call session status
export async function updateCallStatus(
  sessionId: string,
  status: CallStatus,
  options?: {
    twilioCallSid?: string;
    connectedAt?: string;
    endedAt?: string;
    endReason?: CallEndReason;
    languageDetected?: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = { status };

  if (options?.twilioCallSid) {
    updates.twilio_call_sid = options.twilioCallSid;
  }

  if (status === 'in_progress' && !options?.connectedAt) {
    updates.connected_at = new Date().toISOString();
  } else if (options?.connectedAt) {
    updates.connected_at = options.connectedAt;
  }

  if (options?.endedAt) {
    updates.ended_at = options.endedAt;
  }

  if (options?.endReason) {
    updates.end_reason = options.endReason;
  }

  if (options?.languageDetected) {
    updates.language_detected = options.languageDetected;
  }

  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId, status }, 'Failed to update call status');
    return;
  }

  logger.info({ sessionId, status, endReason: options?.endReason }, 'Call status updated');
}

// Complete a call session and record usage
export async function completeCallSession(
  sessionId: string,
  options: {
    endReason: CallEndReason;
    endedAt?: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  // Get the session
  const session = await getCallSession(sessionId);
  if (!session) {
    logger.error({ sessionId }, 'Session not found for completion');
    return;
  }

  const endedAt = options.endedAt || new Date().toISOString();

  // Calculate seconds connected
  let secondsConnected = 0;
  if (session.connected_at) {
    const connectedTime = new Date(session.connected_at).getTime();
    const endedTime = new Date(endedAt).getTime();
    secondsConnected = Math.floor((endedTime - connectedTime) / 1000);
  }

  // Update the session
  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update({
      status: 'completed',
      ended_at: endedAt,
      end_reason: options.endReason,
      seconds_connected: secondsConnected,
    })
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId }, 'Failed to complete call session');
    return;
  }

  logger.info({ sessionId, secondsConnected, endReason: options.endReason, isReminderCall: session.is_reminder_call }, 'Call session completed');

  // Record usage if call was long enough (or if it's a reminder call - always bill at least 1 min)
  const shouldRecordUsage = secondsConnected >= 30 || session.is_reminder_call;
  if (shouldRecordUsage) {
    await recordUsage({
      accountId: session.account_id,
      lineId: session.line_id,
      callSessionId: sessionId,
      secondsConnected,
      direction: session.direction as 'inbound' | 'outbound',
      isReminderCall: session.is_reminder_call,
    });

    // Update line's last successful call
    await updateLineLastCall(session.line_id);
  }
}

// Fail a call session
export async function failCallSession(
  sessionId: string,
  endReason: CallEndReason
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update({
      status: 'failed',
      ended_at: new Date().toISOString(),
      end_reason: endReason,
    })
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId }, 'Failed to fail call session');
    return;
  }

  logger.info({ sessionId, endReason }, 'Call session failed');
}

// Cancel a call session
export async function cancelCallSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update({
      status: 'canceled',
      ended_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId }, 'Failed to cancel call session');
    return;
  }

  logger.info({ sessionId }, 'Call session canceled');
}

// Record a call event
export async function recordCallEvent(
  sessionId: string,
  type: 'dtmf' | 'tool_call' | 'state_change' | 'error' | 'safety_tier',
  payload?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('ultaura_call_events').insert({
    call_session_id: sessionId,
    type,
    payload: payload || null,
  });

  if (error) {
    logger.error({ error, sessionId, type }, 'Failed to record call event');
  }
}

// Increment tool invocation count
export async function incrementToolInvocations(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('increment_tool_invocations', {
    p_session_id: sessionId,
  });

  // If RPC doesn't exist, do it manually
  if (error) {
    const session = await getCallSession(sessionId);
    if (session) {
      await supabase
        .from('ultaura_call_sessions')
        .update({ tool_invocations: session.tool_invocations + 1 })
        .eq('id', sessionId);
    }
  }
}

// Record a safety event
export async function recordSafetyEvent(options: {
  accountId: string;
  lineId: string;
  callSessionId: string;
  tier: 'low' | 'medium' | 'high';
  signals?: Record<string, unknown>;
  actionTaken?: 'none' | 'suggested_988' | 'suggested_911' | 'notified_contact' | 'transferred_call';
}): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('ultaura_safety_events').insert({
    account_id: options.accountId,
    line_id: options.lineId,
    call_session_id: options.callSessionId,
    tier: options.tier,
    signals: options.signals || null,
    action_taken: options.actionTaken || 'none',
  });

  if (error) {
    logger.error({ error, options }, 'Failed to record safety event');
    return;
  }

  // Also record as call event
  await recordCallEvent(options.callSessionId, 'safety_tier', {
    tier: options.tier,
    actionTaken: options.actionTaken,
  });

  logger.warn({ ...options }, 'Safety event recorded');
}
