import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../server.js';
import type { AccountPrivacySettings, LineVoiceConsent } from '@ultaura/types';

export async function getAccountPrivacySettings(
  accountId: string
): Promise<AccountPrivacySettings | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_account_privacy_settings')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (error) {
    logger.error({ error, accountId }, 'Failed to get privacy settings');
    return null;
  }

  return {
    id: data.id,
    accountId: data.account_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    recordingEnabled: data.recording_enabled,
    aiSummarizationEnabled: data.ai_summarization_enabled,
    retentionPeriod: data.retention_period,
    vendorDisclosureAcknowledgedAt: data.vendor_disclosure_acknowledged_at,
    vendorDisclosureAcknowledgedBy: data.vendor_disclosure_acknowledged_by,
  };
}

export async function getLineVoiceConsent(
  lineId: string
): Promise<LineVoiceConsent | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_line_voice_consent')
    .select('*')
    .eq('line_id', lineId)
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to get voice consent');
    return null;
  }

  return {
    id: data.id,
    lineId: data.line_id,
    accountId: data.account_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    memoryConsent: data.memory_consent,
    memoryConsentAt: data.memory_consent_at,
    memoryConsentCallSessionId: data.memory_consent_call_session_id,
    lastConsentPromptAt: data.last_consent_prompt_at,
  };
}

export async function updateLineVoiceConsent(
  lineId: string,
  accountId: string,
  callSessionId: string,
  updates: {
    memoryConsent?: 'granted' | 'denied';
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const dbUpdates: Record<string, unknown> = {
    updated_at: now,
  };

  if (updates.memoryConsent) {
    dbUpdates.memory_consent = updates.memoryConsent;
    dbUpdates.memory_consent_at = now;
    dbUpdates.memory_consent_call_session_id = callSessionId;

    if (updates.memoryConsent === 'denied') {
      dbUpdates.last_consent_prompt_at = now;
    }
  }

  const { error } = await supabase
    .from('ultaura_line_voice_consent')
    .update(dbUpdates)
    .eq('line_id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to update voice consent');
    return;
  }

  await supabase
    .from('ultaura_consent_audit_log')
    .insert({
      account_id: accountId,
      line_id: lineId,
      actor_type: 'line_voice',
      action: updates.memoryConsent === 'granted' ? 'voice_consent_given' : 'voice_consent_denied',
      consent_type: 'audio_processing',
      new_value: updates.memoryConsent,
      call_session_id: callSessionId,
    });
}
