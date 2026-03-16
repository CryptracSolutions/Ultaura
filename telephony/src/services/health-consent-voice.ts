import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { getMemoryDEK } from './line-encryption.js';
import { encryptMemoryValue } from '../utils/encryption.js';

interface HealthConsentWriteOptions {
  skipPersist?: boolean;
  auditMetadata?: Record<string, unknown> | null;
}

export async function updateHealthConsentState(
  lineId: string,
  accountId: string,
  callSessionId: string,
  decision: 'granted' | 'denied' | 'revoked',
  options: HealthConsentWriteOptions = {}
): Promise<boolean> {
  if (options.skipPersist) {
    logger.info({ lineId, callSessionId, decision, skipPersist: true }, 'Health consent (skipped persist)');
    return true;
  }

  const supabase = getSupabaseClient();

  const { error: consentError } = await supabase
    .from('ultaura_health_line_consent')
    .update({
      health_consent: decision,
      health_consent_at: new Date().toISOString(),
      health_consent_call_session_id: callSessionId,
      health_last_prompted_at: new Date().toISOString(),
      health_last_prompt_call_session_id: callSessionId,
    })
    .eq('line_id', lineId);

  if (consentError) {
    logger.error({ error: consentError, lineId }, 'Failed to update health consent');
    return false;
  }

  // Encrypt consent history payload (columns are NOT NULL)
  let historyEncrypted: { ciphertext: Buffer; iv: Buffer; tag: Buffer } | null = null;
  try {
    const dek = await getMemoryDEK(supabase, accountId, lineId);
    const aad = Buffer.from(
      JSON.stringify({ account_id: accountId, line_id: lineId, type: 'health_payload' }),
      'utf8'
    );
    const historyPayload = {
      eventType: 'spoken_decision',
      consentStatus: decision,
      callSessionId,
    };
    historyEncrypted = encryptMemoryValue(dek, historyPayload, aad);
  } catch (encryptErr) {
    logger.error({ error: encryptErr, lineId }, 'Failed to encrypt consent history payload');
  }

  if (!historyEncrypted) {
    logger.error({ lineId }, 'Skipping consent history write — encryption failed');
  } else {
    const { error: historyError } = await supabase
      .from('ultaura_health_consent_history')
      .insert({
        line_id: lineId,
        account_id: accountId,
        event_type: 'spoken_decision',
        resulting_status: decision,
        actor_user_id: null,
        call_session_id: callSessionId,
        payload_ciphertext: `\\x${historyEncrypted.ciphertext.toString('hex')}`,
        payload_iv: `\\x${historyEncrypted.iv.toString('hex')}`,
        payload_tag: `\\x${historyEncrypted.tag.toString('hex')}`,
        payload_alg: 'aes-256-gcm',
        payload_kid: 'kek_v1',
      });

    if (historyError) {
      logger.error({ error: historyError, lineId }, 'Failed to write health consent history');
      // Don't fail the consent write for history failure
    }
  }

  return true;
}

export async function getHealthConsentState(lineId: string): Promise<{
  healthConsent: 'not_requested' | 'granted' | 'denied' | 'revoked';
  healthConsentRequestedAt: string | null;
  healthLastPromptedAt: string | null;
  selfExplanationRequestedAt: string | null;
  selfExplanationLastPromptedAt: string | null;
} | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_health_line_consent')
    .select('health_consent, health_consent_requested_at, health_last_prompted_at, self_explanation_requested_at, self_explanation_last_prompted_at')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to get health consent state');
    return null;
  }

  if (!data) return null;

  return {
    healthConsent: data.health_consent as 'not_requested' | 'granted' | 'denied' | 'revoked',
    healthConsentRequestedAt: data.health_consent_requested_at,
    healthLastPromptedAt: data.health_last_prompted_at,
    selfExplanationRequestedAt: data.self_explanation_requested_at,
    selfExplanationLastPromptedAt: data.self_explanation_last_prompted_at,
  };
}
