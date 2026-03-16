import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';

/**
 * Check if health-adjacent suppression is active for a call session.
 */
export async function isHealthSuppressionActive(callSessionId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_call_sessions')
    .select('health_private_disclosure_suppressed_at')
    .eq('id', callSessionId)
    .maybeSingle();

  if (error) {
    logger.error({ error, callSessionId }, 'Failed to check health suppression state');
    return false; // fail-open for reads only; writes should fail-closed
  }

  return data?.health_private_disclosure_suppressed_at != null;
}

/**
 * Activate whole-call health-adjacent suppression.
 * 1. Marks the call session as suppressed
 * 2. Retroactively suppresses same-call health mentions
 * 3. Retroactively suppresses same-call health suggestions
 */
export async function activateHealthSuppression(
  callSessionId: string,
  lineId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  // 1. Mark session
  const { error: sessionError } = await supabase
    .from('ultaura_call_sessions')
    .update({
      health_private_disclosure_suppressed_at: now,
      health_private_disclosure_suppression_reason: 'owner_private_disclosure',
    })
    .eq('id', callSessionId);

  if (sessionError) {
    logger.error({ error: sessionError, callSessionId }, 'Failed to mark session for health suppression');
  }

  // 2. Retroactively suppress same-call health mentions
  const { error: mentionsError } = await supabase
    .from('ultaura_health_mentions')
    .update({
      suppressed_at: now,
      suppression_reason: 'owner_private_disclosure',
      suppressed_by_call_session_id: callSessionId,
    })
    .eq('call_session_id', callSessionId)
    .eq('line_id', lineId)
    .is('suppressed_at', null);

  if (mentionsError) {
    logger.error({ error: mentionsError, callSessionId }, 'Failed to suppress health mentions');
  }

  // 3. Retroactively suppress same-call health suggestions
  const { error: suggestionsError } = await supabase
    .from('ultaura_health_suggestions')
    .update({
      suppressed_at: now,
      suppression_reason: 'owner_private_disclosure',
      suppressed_by_call_session_id: callSessionId,
    })
    .eq('source_call_session_id', callSessionId)
    .is('suppressed_at', null);

  if (suggestionsError) {
    logger.error({ error: suggestionsError, callSessionId }, 'Failed to suppress health suggestions');
  }

  logger.info({ callSessionId, lineId }, 'Health suppression activated');
}
