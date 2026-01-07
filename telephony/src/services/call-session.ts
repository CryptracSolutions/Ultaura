// Call session service
// Manages call session lifecycle

import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, CallSessionRow } from '../utils/supabase.js';
import { logger } from '../server.js';
import { recordUsage } from './metering.js';
import { updateLineLastCall } from './line-lookup.js';
import { clearSafetyState, getSafetySummary, markSafetySummaryLogged } from './safety-state.js';
import { sanitizePayload, getStrippedFieldsInfo, CallEventType } from '../utils/event-sanitizer.js';

export type CallStatus = 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled';
export type CallDirection = 'inbound' | 'outbound';
export type CallEndReason = 'hangup' | 'no_answer' | 'busy' | 'trial_cap' | 'minutes_cap' | 'error';
export type CallAnsweredBy =
  | 'human'
  | 'machine_start'
  | 'machine_end_beep'
  | 'machine_end_silence'
  | 'machine_end_other'
  | 'fax'
  | 'unknown';

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
  // Scheduler idempotency key for preventing duplicate scheduled calls
  schedulerIdempotencyKey?: string;
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
      scheduler_idempotency_key: options.schedulerIdempotencyKey || null,
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation on idempotency key (duplicate scheduled call)
    if (error.code === '23505' && options.schedulerIdempotencyKey) {
      logger.warn(
        { idempotencyKey: options.schedulerIdempotencyKey },
        'Duplicate call session prevented by idempotency key'
      );
      return null;
    }
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

// Get call session by scheduler idempotency key
export async function getCallSessionByIdempotencyKey(
  idempotencyKey: string
): Promise<CallSessionRow | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .select('*')
    .eq('scheduler_idempotency_key', idempotencyKey)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // Not found is expected
      logger.error({ error, idempotencyKey }, 'Failed to get call session by idempotency key');
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
    answeredBy?: CallAnsweredBy;
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

  if (options?.answeredBy) {
    updates.answered_by = options.answeredBy;
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

// Update call session metadata without changing status
export async function updateCallSession(
  sessionId: string,
  options: {
    answeredBy?: CallAnsweredBy;
    endReason?: CallEndReason;
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  const updates: Record<string, unknown> = {};

  if (options.answeredBy !== undefined) {
    updates.answered_by = options.answeredBy;
  }

  if (options.endReason !== undefined) {
    updates.end_reason = options.endReason;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId }, 'Failed to update call session');
    return;
  }
}

// Update call session recording metadata
export async function updateCallSessionRecording(
  sessionId: string,
  recordingSid: string
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update({ recording_sid: recordingSid })
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId }, 'Failed to update recording SID');
  }
}

// Complete a call session and record usage
export async function completeCallSession(
  sessionId: string,
  options: {
    endReason: CallEndReason;
    endedAt?: string;
    languageDetected?: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();

  // Get the session
  const session = await getCallSession(sessionId);
  if (!session) {
    logger.error({ sessionId }, 'Session not found for completion');
    return;
  }

  if (session.status === 'completed' || session.status === 'failed') {
    logger.info({ sessionId, status: session.status }, 'Session already finalized, skipping completion');
    return;
  }

  const endedAt = options.endedAt || new Date().toISOString();
  const endReason = session.end_reason ?? options.endReason;

  // Calculate seconds connected
  let secondsConnected = 0;
  if (session.connected_at) {
    const connectedTime = new Date(session.connected_at).getTime();
    const endedTime = new Date(endedAt).getTime();
    secondsConnected = Math.floor((endedTime - connectedTime) / 1000);
  }

  const updates: Record<string, unknown> = {
    status: 'completed',
    ended_at: endedAt,
    end_reason: endReason,
    seconds_connected: secondsConnected,
  };

  if (options.languageDetected) {
    updates.language_detected = options.languageDetected;
  }

  // Update the session
  const { error } = await supabase
    .from('ultaura_call_sessions')
    .update(updates)
    .eq('id', sessionId);

  if (error) {
    logger.error({ error, sessionId }, 'Failed to complete call session');
    return;
  }

  logger.info({ sessionId, secondsConnected, endReason, isReminderCall: session.is_reminder_call }, 'Call session completed');

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

  if (markSafetySummaryLogged(sessionId)) {
    const safetySummary = getSafetySummary(sessionId);
    logger.info({
      event: 'safety_call_summary',
      callSessionId: sessionId,
      lineId: session.line_id,
      accountId: session.account_id,
      backstopTiersTriggered: safetySummary.backstopTiersTriggered,
      modelTiersLogged: safetySummary.modelTiersLogged,
      potentialFalsePositives: safetySummary.potentialFalsePositives,
    }, 'Safety detection summary for call');
  }

  clearSafetyState(sessionId);
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
  type: CallEventType,
  payload?: Record<string, unknown>,
  options?: { skipDebugLog?: boolean }
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!payload) {
    const { error } = await supabase.from('ultaura_call_events').insert({
      call_session_id: sessionId,
      type,
      payload: null,
    });

    if (error) {
      logger.error({ error, sessionId, type }, 'Failed to record call event');
    }
    return;
  }

  const { sanitized, stripped } = sanitizePayload(type, payload);
  const { hasStripped, fieldNames } = getStrippedFieldsInfo(stripped);

  if (hasStripped) {
    logger.warn({
      sessionId,
      type,
      strippedFields: fieldNames,
      metric: 'call_event_fields_stripped',
      metricValue: fieldNames.length,
    }, 'Fields stripped from call event payload');
  }

  const { error } = await supabase.from('ultaura_call_events').insert({
    call_session_id: sessionId,
    type,
    payload: Object.keys(sanitized).length > 0 ? sanitized : null,
  });

  if (error) {
    logger.error({ error, sessionId, type }, 'Failed to record call event');
  }

  if (!options?.skipDebugLog) {
    await recordDebugEvent(sessionId, type, payload);
  }
}

export async function recordDebugEvent(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>,
  metadata?: Record<string, unknown>,
  options?: { accountId?: string | null; toolName?: string | null }
): Promise<void> {
  const supabase = getSupabaseClient();

  let accountId = options?.accountId ?? null;
  const toolName =
    options?.toolName ??
    (typeof payload.tool === 'string' ? payload.tool : null);

  if (!accountId) {
    try {
      const { data: session } = await supabase
        .from('ultaura_call_sessions')
        .select('account_id')
        .eq('id', sessionId)
        .single();

      accountId = session?.account_id ?? null;
    } catch {
      accountId = null;
    }
  }

  const { error } = await supabase.from('ultaura_debug_logs').insert({
    call_session_id: sessionId,
    account_id: accountId,
    event_type: eventType,
    tool_name: toolName,
    payload,
    metadata: metadata || null,
  });

  if (error) {
    logger.error({ error, sessionId, eventType }, 'Failed to record debug event');
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
  }, { skipDebugLog: true });

  logger.warn({ ...options }, 'Safety event recorded');
}
