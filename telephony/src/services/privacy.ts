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
    recordingConsent: data.recording_consent,
    recordingConsentAt: data.recording_consent_at,
    recordingConsentCallSessionId: data.recording_consent_call_session_id,
    recordingPreferencePermanent: data.recording_preference_permanent,
    recordingReenableRequestedAt: data.recording_reenable_requested_at,
    sharingConsent: data.sharing_consent,
    sharingTier: data.sharing_tier,
    sharingConsentAt: data.sharing_consent_at,
    sharingConsentCallSessionId: data.sharing_consent_call_session_id,
    sharingLastPromptAt: data.sharing_last_prompt_at,
    sharingRePromptRequestedAt: data.sharing_reprompt_requested_at,
    onboardingCompletedAt: data.onboarding_completed_at,
  };
}

export async function updateLineVoiceConsent(
  lineId: string,
  accountId: string,
  callSessionId: string,
  updates: {
    memoryConsent?: 'granted' | 'denied';
    recordingConsent?: 'pending' | 'granted' | 'denied';
    recordingPreferencePermanent?: boolean;
    recordingReenableRequestedAt?: string | null;
    sharingConsent?: 'pending' | 'granted' | 'denied';
    sharingTier?: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
    sharingLastPromptAt?: string | null;
    sharingRePromptRequestedAt?: string | null;
    onboardingCompletedAt?: string | null;
  },
  options?: {
    skipPersist?: boolean;
    auditMetadata?: Record<string, unknown> | null;
  }
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from('ultaura_line_voice_consent')
    .select('memory_consent, recording_consent, recording_preference_permanent, recording_reenable_requested_at, sharing_consent, sharing_tier, sharing_reprompt_requested_at, onboarding_completed_at')
    .eq('line_id', lineId)
    .single();

  if (existingError || !existing) {
    logger.error({ error: existingError, lineId }, 'Failed to load voice consent for update');
    return false;
  }

  const dbUpdates: Record<string, unknown> = {
    updated_at: now,
  };

  const auditEntries: Array<{
    action: string;
    consentType?: string | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
  }> = [];

  if (updates.memoryConsent) {
    dbUpdates.memory_consent = updates.memoryConsent;
    dbUpdates.memory_consent_at = now;
    dbUpdates.memory_consent_call_session_id = callSessionId;

    if (updates.memoryConsent === 'denied') {
      dbUpdates.last_consent_prompt_at = now;
    }

    auditEntries.push({
      action: updates.memoryConsent === 'granted' ? 'voice_consent_given' : 'voice_consent_denied',
      consentType: 'audio_processing',
      oldValue: { consent: existing.memory_consent },
      newValue: { consent: updates.memoryConsent },
    });
  }

  if (updates.recordingConsent) {
    dbUpdates.recording_consent = updates.recordingConsent;
    if (updates.recordingConsent === 'pending') {
      dbUpdates.recording_consent_at = null;
      dbUpdates.recording_consent_call_session_id = null;
    } else {
      dbUpdates.recording_consent_at = now;
      dbUpdates.recording_consent_call_session_id = callSessionId;
    }

    if (existing.recording_reenable_requested_at) {
      dbUpdates.recording_reenable_requested_at = null;
    }
  }

  if (updates.recordingPreferencePermanent !== undefined) {
    dbUpdates.recording_preference_permanent = updates.recordingPreferencePermanent;
  }

  if (updates.recordingReenableRequestedAt !== undefined) {
    dbUpdates.recording_reenable_requested_at = updates.recordingReenableRequestedAt;
  }

  if (updates.recordingConsent || updates.recordingPreferencePermanent !== undefined) {
    auditEntries.push({
      action: 'recording_consent_updated',
      consentType: 'recording',
      oldValue: {
        consent: existing.recording_consent,
        permanent: existing.recording_preference_permanent,
      },
      newValue: {
        consent: updates.recordingConsent ?? existing.recording_consent,
        permanent: updates.recordingPreferencePermanent ?? existing.recording_preference_permanent,
      },
    });
  }

  if (updates.sharingConsent) {
    dbUpdates.sharing_consent = updates.sharingConsent;
    if (updates.sharingConsent === 'pending') {
      dbUpdates.sharing_consent_at = null;
      dbUpdates.sharing_consent_call_session_id = null;
    } else {
      dbUpdates.sharing_consent_at = now;
      dbUpdates.sharing_consent_call_session_id = callSessionId;

      if (updates.sharingLastPromptAt === undefined) {
        dbUpdates.sharing_last_prompt_at = now;
      }
    }
  }

  if (updates.sharingTier) {
    dbUpdates.sharing_tier = updates.sharingTier;
  }

  if (updates.sharingLastPromptAt !== undefined) {
    dbUpdates.sharing_last_prompt_at = updates.sharingLastPromptAt;
  }

  if (updates.sharingRePromptRequestedAt !== undefined) {
    dbUpdates.sharing_reprompt_requested_at = updates.sharingRePromptRequestedAt;
  }

  if ((updates.sharingConsent || updates.sharingTier) && updates.sharingRePromptRequestedAt === undefined) {
    dbUpdates.sharing_reprompt_requested_at = null;
  }

  if (updates.sharingConsent || updates.sharingTier) {
    auditEntries.push({
      action: 'sharing_consent_updated',
      consentType: 'data_sharing',
      oldValue: {
        consent: existing.sharing_consent,
        tier: existing.sharing_tier,
      },
      newValue: {
        consent: updates.sharingConsent ?? existing.sharing_consent,
        tier: updates.sharingTier ?? existing.sharing_tier,
      },
    });
  }

  if (updates.onboardingCompletedAt !== undefined) {
    dbUpdates.onboarding_completed_at = updates.onboardingCompletedAt;
    auditEntries.push({
      action: 'onboarding_completed',
      consentType: null,
      oldValue: { completed_at: existing.onboarding_completed_at },
      newValue: { completed_at: updates.onboardingCompletedAt },
    });
  }

  let persisted = true;
  if (!options?.skipPersist) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { error } = await supabase
        .from('ultaura_line_voice_consent')
        .update(dbUpdates)
        .eq('line_id', lineId);

      if (!error) {
        persisted = true;
        break;
      }

      persisted = false;
      logger.error({ error, lineId, attempt }, 'Failed to update voice consent');

      if (attempt < 3) {
        await new Promise((resolve) => {
          setTimeout(resolve, 200 * (2 ** (attempt - 1)));
        });
      }
    }
  }

  if (!persisted && !options?.skipPersist) {
    return false;
  }

  const metadata = options?.auditMetadata ?? null;

  for (const entry of auditEntries) {
    const { error } = await supabase
      .from('ultaura_consent_audit_log')
      .insert({
        account_id: accountId,
        line_id: lineId,
        actor_type: 'line_voice',
        action: entry.action,
        consent_type: entry.consentType ?? null,
        old_value: entry.oldValue,
        new_value: entry.newValue,
        call_session_id: callSessionId,
        metadata,
      });

    if (error) {
      logger.error({ error, lineId, action: entry.action }, 'Failed to log consent audit');
    }
  }

  return true;
}

export async function logConsentAuditEvent(options: {
  accountId: string;
  lineId: string;
  callSessionId: string | null;
  action: string;
  consentType?: string | null;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_consent_audit_log')
    .insert({
      account_id: options.accountId,
      line_id: options.lineId,
      actor_type: 'line_voice',
      action: options.action,
      consent_type: options.consentType ?? null,
      old_value: options.oldValue ?? null,
      new_value: options.newValue ?? null,
      call_session_id: options.callSessionId ?? null,
      metadata: options.metadata ?? null,
    });

  if (error) {
    logger.error({ error, action: options.action, lineId: options.lineId }, 'Failed to log consent audit');
  }
}
