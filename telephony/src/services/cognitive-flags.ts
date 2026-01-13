import { DateTime } from 'luxon';
import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';

const OBSERVATION_WINDOW_DAYS = 14;

const CONFUSION_EQUIVALENTS = new Set([
  'confusion',
  'word_finding',
  'memory_lapse',
]);

function getWindowStartIso(): string | null {
  return DateTime.utc().minus({ days: OBSERVATION_WINDOW_DAYS }).toISO();
}

async function getObservationRows(lineId: string): Promise<Array<{
  call_session_id: string;
  observation_type: string;
}>> {
  const supabase = getSupabaseClient();
  const windowStart = getWindowStartIso();

  if (!windowStart) {
    return [];
  }

  const { data, error } = await supabase
    .from('ultaura_cognitive_observations')
    .select('call_session_id, observation_type')
    .eq('line_id', lineId)
    .gte('created_at', windowStart);

  if (error) {
    logger.error({ error, lineId }, 'Failed to load cognitive observations for window');
    return [];
  }

  return data ?? [];
}

async function getPreviousCallId(lineId: string, callCreatedAt: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .select('id')
    .eq('line_id', lineId)
    .lt('created_at', callCreatedAt)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch previous call session');
    return null;
  }

  return data?.id ?? null;
}

async function hasObservationForCall(callSessionId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from('ultaura_cognitive_observations')
    .select('id', { count: 'exact', head: true })
    .eq('call_session_id', callSessionId);

  if (error) {
    logger.error({ error, callSessionId }, 'Failed to check cognitive observations for call');
    return false;
  }

  return (count ?? 0) > 0;
}

export async function updateCognitiveFlagsFromObservation(options: {
  lineId: string;
  accountId: string;
  callSessionId: string;
  callSessionCreatedAt: string;
  severity: 'mild' | 'moderate' | 'significant';
  isFirstObservation: boolean;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const rows = await getObservationRows(options.lineId);
  const totalCalls = new Set<string>();
  const confusionCalls = new Set<string>();
  const repetitionCalls = new Set<string>();
  const orientationCalls = new Set<string>();

  for (const row of rows) {
    totalCalls.add(row.call_session_id);
    if (CONFUSION_EQUIVALENTS.has(row.observation_type)) {
      confusionCalls.add(row.call_session_id);
    }
    if (row.observation_type === 'repetition') {
      repetitionCalls.add(row.call_session_id);
    }
    if (row.observation_type === 'orientation') {
      orientationCalls.add(row.call_session_id);
    }
  }

  const { data: existing, error: existingError } = await supabase
    .from('ultaura_cognitive_flags')
    .select('concern_level, consecutive_calls_with_concern, flagged_at, family_notified_at')
    .eq('line_id', options.lineId)
    .maybeSingle();

  if (existingError) {
    logger.error({ error: existingError, lineId: options.lineId }, 'Failed to fetch cognitive flags');
  }

  let concernLevel = (existing?.concern_level ?? 'none') as 'none' | 'monitoring' | 'flagged';
  let flaggedAt = existing?.flagged_at ?? null;
  let consecutiveCalls = existing?.consecutive_calls_with_concern ?? 0;

  if (options.isFirstObservation) {
    const previousCallId = await getPreviousCallId(options.lineId, options.callSessionCreatedAt);
    const previousHadObservation = previousCallId
      ? await hasObservationForCall(previousCallId)
      : false;

    consecutiveCalls = previousHadObservation ? consecutiveCalls + 1 : 1;
  }

  const totalObservationCalls = totalCalls.size;

  if (options.severity === 'significant' || totalObservationCalls >= 5) {
    if (concernLevel !== 'flagged') {
      concernLevel = 'flagged';
      flaggedAt = flaggedAt ?? now;
    }
  } else if (totalObservationCalls >= 3 && concernLevel === 'none') {
    concernLevel = 'monitoring';
  }

  const { error: upsertError } = await supabase
    .from('ultaura_cognitive_flags')
    .upsert({
      line_id: options.lineId,
      updated_at: now,
      concern_level: concernLevel,
      confusion_count_14d: confusionCalls.size,
      repetition_count_14d: repetitionCalls.size,
      orientation_count_14d: orientationCalls.size,
      consecutive_calls_with_concern: consecutiveCalls,
      last_concern_at: now,
      flagged_at: flaggedAt,
      family_notified_at: existing?.family_notified_at ?? null,
    }, { onConflict: 'line_id' });

  if (upsertError) {
    logger.error({ error: upsertError, lineId: options.lineId }, 'Failed to update cognitive flags');
  }
}

export async function resetCognitiveStreakIfNoObservation(
  lineId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: existing, error } = await supabase
    .from('ultaura_cognitive_flags')
    .select('consecutive_calls_with_concern')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error || !existing) {
    return;
  }

  if ((existing.consecutive_calls_with_concern ?? 0) === 0) {
    return;
  }

  const { error: updateError } = await supabase
    .from('ultaura_cognitive_flags')
    .update({
      consecutive_calls_with_concern: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('line_id', lineId);

  if (updateError) {
    logger.error({ error: updateError, lineId }, 'Failed to reset cognitive streak');
  }
}

export async function callHasCognitiveObservations(callSessionId: string): Promise<boolean> {
  return hasObservationForCall(callSessionId);
}
