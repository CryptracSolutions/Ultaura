'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import getLogger from '~/core/logger';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { Database } from '~/database.types';
import requireSession from '~/lib/user/require-session';
import type {
  AccountPrivacySettings,
  ConsentAuditEntry,
  DataExportRequest,
  LineVoiceConsent,
  RetentionPeriod,
} from './types';

const logger = getLogger();
const DEV_TELEPHONY_BACKEND_URL = 'http://localhost:3001';

type ConsentAuditLogInput = {
  accountId: string;
  action: ConsentAuditEntry['action'];
  actorType: ConsentAuditEntry['actorType'];
  lineId?: string | null;
  actorUserId?: string | null;
  consentType?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  callSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
};
type RecordingDeletionReason = 'retention_policy' | 'user_request' | 'account_deletion';

function getTelephonyBackendUrl(): string {
  const backendUrl = process.env.ULTAURA_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? '' : DEV_TELEPHONY_BACKEND_URL);

  if (!backendUrl) {
    throw new Error('ULTAURA_BACKEND_URL is required in production');
  }

  return backendUrl;
}

function getInternalApiSecret(): string {
  const secret = process.env.ULTAURA_INTERNAL_API_SECRET;

  if (!secret) {
    throw new Error('Missing ULTAURA_INTERNAL_API_SECRET');
  }

  return secret;
}

function getRequestMetadata(
  headersList: Awaited<ReturnType<typeof headers>>
): { ipAddress: string | null; userAgent: string | null } {
  return {
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  };
}

async function getAuthenticatedUserId(
  clientOverride?: ReturnType<typeof getSupabaseServerActionClient>
): Promise<string | null> {
  const client = clientOverride ?? getSupabaseServerComponentClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
}

type AuthorizedOwnerContext = {
  userClient: ReturnType<typeof getSupabaseServerActionClient>;
  adminClient: ReturnType<typeof getSupabaseServerActionClient>;
  actorUserId: string;
};

async function requireAccountOwnerContext(
  accountId: string
): Promise<{ ok: true; context: AuthorizedOwnerContext } | { ok: false; error: string }> {
  const userClient = getSupabaseServerActionClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  await requireSession(userClient);

  const actorUserId = await getAuthenticatedUserId(userClient);
  if (!actorUserId) {
    return { ok: false, error: 'User not authenticated' };
  }

  const { data: account, error: accountError } = await userClient
    .from('ultaura_accounts')
    .select('id, created_by_user_id')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    return { ok: false, error: 'Account not found' };
  }

  if (account.created_by_user_id !== actorUserId) {
    return { ok: false, error: 'Access denied' };
  }

  return {
    ok: true,
    context: {
      userClient,
      adminClient,
      actorUserId,
    },
  };
}

async function requireLineOwnerContext(
  lineId: string
): Promise<
  | { ok: true; context: AuthorizedOwnerContext & { accountId: string; accountUserType: string } }
  | { ok: false; error: string }
> {
  const userClient = getSupabaseServerActionClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  await requireSession(userClient);

  const actorUserId = await getAuthenticatedUserId(userClient);
  if (!actorUserId) {
    return { ok: false, error: 'User not authenticated' };
  }

  const { data: line, error: lineError } = await userClient
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return { ok: false, error: 'Line not found' };
  }

  const { data: account, error: accountError } = await userClient
    .from('ultaura_accounts')
    .select('id, created_by_user_id, user_type')
    .eq('id', line.account_id)
    .single();

  if (accountError || !account) {
    return { ok: false, error: 'Account not found' };
  }

  if (account.created_by_user_id !== actorUserId) {
    return { ok: false, error: 'Access denied' };
  }

  return {
    ok: true,
    context: {
      userClient,
      adminClient,
      actorUserId,
      accountId: line.account_id,
      accountUserType: account.user_type,
    },
  };
}

// ============================================
// PRIVACY SETTINGS
// ============================================

export async function getAccountPrivacySettings(
  accountId: string
): Promise<AccountPrivacySettings | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
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

export async function updatePrivacySettings(
  accountId: string,
  updates: {
    recordingEnabled?: boolean;
    aiSummarizationEnabled?: boolean;
    retentionPeriod?: RetentionPeriod;
  }
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAccountOwnerContext(accountId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { userClient, adminClient, actorUserId } = auth.context;
  const headersList = await headers();

  const current = await getAccountPrivacySettings(accountId);
  if (!current) {
    return { success: false, error: 'Privacy settings not found' };
  }

  const nowIso = new Date().toISOString();
  const dbUpdates: Record<string, unknown> = {
    updated_at: nowIso,
  };

  if (updates.recordingEnabled !== undefined) {
    dbUpdates.recording_enabled = updates.recordingEnabled;
  }
  if (updates.aiSummarizationEnabled !== undefined) {
    dbUpdates.ai_summarization_enabled = updates.aiSummarizationEnabled;
  }
  if (updates.retentionPeriod !== undefined) {
    dbUpdates.retention_period = updates.retentionPeriod;
  }

  const { error } = await userClient
    .from('ultaura_account_privacy_settings')
    .update(dbUpdates)
    .eq('account_id', accountId);

  if (error) {
    logger.error({ error, accountId }, 'Failed to update privacy settings');
    return { success: false, error: 'Failed to update settings' };
  }

  const { ipAddress, userAgent } = getRequestMetadata(headersList);

  const logChange = async (
    entry: Omit<
      ConsentAuditLogInput,
      'accountId' | 'actorType' | 'actorUserId' | 'ipAddress' | 'userAgent'
    >,
  ) => {
    return logRequiredConsentAudit({
      accountId,
      actorUserId,
      actorType: 'payer',
      ipAddress,
      userAgent,
      ...entry,
    }, adminClient);
  };

  if (updates.recordingEnabled !== undefined && updates.recordingEnabled !== current.recordingEnabled) {
    const logged = await logChange({
      action: 'recording_toggled',
      consentType: 'recording',
      oldValue: current.recordingEnabled,
      newValue: updates.recordingEnabled,
    });
    if (!logged) {
      return { success: false, error: 'Failed to record required audit entry' };
    }
  }

  if (updates.aiSummarizationEnabled !== undefined && updates.aiSummarizationEnabled !== current.aiSummarizationEnabled) {
    let linesReset = 0;

    if (current.aiSummarizationEnabled === false && updates.aiSummarizationEnabled === true) {
      const { data: resetLines, error: resetError } = await adminClient
        .from('ultaura_line_voice_consent')
        .update({
          memory_consent: 'pending',
          memory_consent_at: null,
          last_consent_prompt_at: null,
          updated_at: nowIso,
        })
        .eq('account_id', accountId)
        .eq('memory_consent', 'denied')
        .select('line_id');

      if (resetError) {
        logger.error({ error: resetError, accountId }, 'Failed to reset voice consent after summarization re-enabled');
      } else {
        linesReset = resetLines?.length ?? 0;
      }
    }

    const logged = await logChange({
      action: 'summarization_toggled',
      consentType: 'audio_processing',
      oldValue: current.aiSummarizationEnabled,
      newValue: updates.aiSummarizationEnabled,
      metadata: updates.aiSummarizationEnabled === true ? { lines_reset: linesReset } : null,
    });
    if (!logged) {
      return { success: false, error: 'Failed to record required audit entry' };
    }
  }

  if (updates.retentionPeriod !== undefined && updates.retentionPeriod !== current.retentionPeriod) {
    const logged = await logChange({
      action: 'retention_changed',
      consentType: 'data_retention',
      oldValue: current.retentionPeriod,
      newValue: updates.retentionPeriod,
    });
    if (!logged) {
      return { success: false, error: 'Failed to record required audit entry' };
    }
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}

export async function acknowledgeVendorDisclosure(
  accountId: string
): Promise<{ success: boolean; error?: string; alreadyAcknowledged?: boolean }> {
  const auth = await requireAccountOwnerContext(accountId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { userClient, adminClient, actorUserId } = auth.context;
  const headersList = await headers();

  const { data: existing, error: existingError } = await userClient
    .from('ultaura_account_privacy_settings')
    .select('vendor_disclosure_acknowledged_at')
    .eq('account_id', accountId)
    .single();

  if (existingError) {
    logger.error({ error: existingError, accountId }, 'Failed to load vendor disclosure status');
    return { success: false, error: 'Failed to load disclosure status' };
  }

  if (existing?.vendor_disclosure_acknowledged_at) {
    return { success: true, alreadyAcknowledged: true };
  }

  const nowIso = new Date().toISOString();
  const { error, data: updatedRows } = await userClient
    .from('ultaura_account_privacy_settings')
    .update({
      vendor_disclosure_acknowledged_at: nowIso,
      vendor_disclosure_acknowledged_by: actorUserId,
      updated_at: nowIso,
    })
    .eq('account_id', accountId)
    .is('vendor_disclosure_acknowledged_at', null)
    .select('account_id');

  if (error) {
    logger.error({ error, accountId }, 'Failed to acknowledge vendor disclosure');
    return { success: false, error: 'Failed to acknowledge disclosure' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { success: true, alreadyAcknowledged: true };
  }

  const requestMetadata = getRequestMetadata(headersList);
  const logged = await logRequiredConsentAudit({
    accountId,
    actorUserId,
    actorType: 'payer',
    action: 'vendor_acknowledged',
    ...requestMetadata,
  }, adminClient);
  if (!logged) {
    return { success: false, error: 'Failed to record required audit entry' };
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}

// ============================================
// VOICE CONSENT
// ============================================

export async function getLineVoiceConsent(
  lineId: string
): Promise<LineVoiceConsent | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_line_voice_consent')
    .select('*')
    .eq('line_id', lineId)
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to get voice consent');
    return null;
  }

  return mapLineVoiceConsentRow(data);
}

export async function getLineVoiceConsents(
  accountId: string
): Promise<LineVoiceConsent[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_line_voice_consent')
    .select('*')
    .eq('account_id', accountId);

  if (error) {
    logger.error({ error, accountId }, 'Failed to get line voice consents');
    return [];
  }

  return (data || []).map((row) => mapLineVoiceConsentRow(row));
}

function mapLineVoiceConsentRow(
  data: Database['public']['Tables']['ultaura_line_voice_consent']['Row']
): LineVoiceConsent {
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
    recordingReenableDeclineCount: data.recording_reenable_decline_count ?? 0,
    recordingReenableBlockedAt: data.recording_reenable_blocked_at,
    sharingConsent: data.sharing_consent,
    sharingTier: data.sharing_tier as LineVoiceConsent['sharingTier'],
    sharingConsentAt: data.sharing_consent_at,
    sharingConsentCallSessionId: data.sharing_consent_call_session_id,
    sharingLastPromptAt: data.sharing_last_prompt_at,
    sharingRePromptRequestedAt: data.sharing_reprompt_requested_at,
    insightsRepromptRequestedAt: data.insights_reprompt_requested_at,
    onboardingCompletedAt: data.onboarding_completed_at,
  };
}

export async function requestRecordingReenable(
  lineId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireLineOwnerContext(lineId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { adminClient, actorUserId, accountId, accountUserType } = auth.context;
  const headersList = await headers();

  if (accountUserType !== 'family_managed') {
    return { success: false, error: 'Recording changes are managed by the senior' };
  }

  const { data: consent, error: consentError } = await adminClient
    .from('ultaura_line_voice_consent')
    .select('recording_consent, recording_preference_permanent, recording_reenable_requested_at, recording_reenable_decline_count, recording_reenable_blocked_at')
    .eq('line_id', lineId)
    .single();

  if (consentError || !consent) {
    logger.error({ error: consentError, lineId }, 'Failed to load recording consent for re-enable');
    return { success: false, error: 'Consent record not found' };
  }

  if (consent.recording_reenable_blocked_at || (consent.recording_reenable_decline_count ?? 0) >= 1) {
    return { success: false, error: 'Recording re-enable requests are blocked' };
  }

  if (consent.recording_reenable_requested_at) {
    return { success: false, error: 'Recording re-enable already requested' };
  }

  const { data: lastRequest, error: lastRequestError } = await adminClient
    .from('ultaura_consent_audit_log')
    .select('created_at')
    .eq('line_id', lineId)
    .eq('action', 'recording_reenable_requested')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRequestError) {
    logger.error({ error: lastRequestError, lineId }, 'Failed to check recording re-enable cooldown');
    return { success: false, error: 'Failed to verify recording re-enable cooldown' };
  }

  if (lastRequest?.created_at) {
    const lastRequestMs = new Date(lastRequest.created_at).getTime();
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastRequestMs < cooldownMs) {
      return { success: false, error: 'Recording re-enable is limited to once every 30 days' };
    }
  }

  const now = new Date().toISOString();
  const { error, data: updatedRows } = await adminClient
    .from('ultaura_line_voice_consent')
    .update({
      recording_reenable_requested_at: now,
      updated_at: now,
    })
    .eq('line_id', lineId)
    .eq('recording_consent', 'denied')
    .eq('recording_preference_permanent', true)
    .is('recording_reenable_requested_at', null)
    .is('recording_reenable_blocked_at', null)
    .lt('recording_reenable_decline_count', 1)
    .select('line_id');

  if (error || !updatedRows || updatedRows.length === 0) {
    logger.error({ error, lineId }, 'Failed to request recording re-enable');
    return { success: false, error: 'Failed to update recording consent' };
  }

  const requestMetadata = getRequestMetadata(headersList);
  const logged = await logRequiredConsentAudit({
    accountId,
    lineId,
    actorUserId,
    actorType: 'payer',
    action: 'recording_reenable_requested',
    consentType: 'recording',
    oldValue: {
      consent: consent.recording_consent,
      permanent: consent.recording_preference_permanent,
    },
    newValue: {
      consent: consent.recording_consent,
      permanent: consent.recording_preference_permanent,
      recording_reenable_requested_at: now,
    },
    ...requestMetadata,
  }, adminClient);
  if (!logged) {
    return { success: false, error: 'Failed to record required audit entry' };
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}

export async function requestSharingRePrompt(
  lineId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireLineOwnerContext(lineId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { adminClient, actorUserId, accountId, accountUserType } = auth.context;
  const headersList = await headers();

  if (accountUserType !== 'family_managed') {
    return { success: false, error: 'Sharing changes are managed directly for self accounts' };
  }

  const { data: consent, error: consentError } = await adminClient
    .from('ultaura_line_voice_consent')
    .select('sharing_consent, sharing_tier, sharing_reprompt_requested_at')
    .eq('line_id', lineId)
    .single();

  if (consentError || !consent) {
    logger.error({ error: consentError, lineId }, 'Failed to load sharing consent for re-prompt');
    return { success: false, error: 'Consent record not found' };
  }

  if (consent.sharing_reprompt_requested_at) {
    return { success: false, error: 'Sharing change already requested' };
  }
  if (consent.sharing_consent === 'pending') {
    return { success: false, error: 'Sharing preference has not been set yet' };
  }

  const { data: lastRequest, error: lastRequestError } = await adminClient
    .from('ultaura_consent_audit_log')
    .select('created_at')
    .eq('line_id', lineId)
    .eq('actor_type', 'payer')
    .eq('action', 'sharing_reprompt_requested')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRequestError) {
    logger.error({ error: lastRequestError, lineId }, 'Failed to check sharing re-prompt cooldown');
    return { success: false, error: 'Failed to verify sharing re-prompt cooldown' };
  }

  if (lastRequest?.created_at) {
    const lastPromptMs = new Date(lastRequest.created_at).getTime();
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastPromptMs < cooldownMs) {
      return { success: false, error: 'Sharing re-prompt is limited to once every 30 days' };
    }
  }

  const now = new Date().toISOString();
  const { error, data: updatedRows } = await adminClient
    .from('ultaura_line_voice_consent')
    .update({
      sharing_reprompt_requested_at: now,
      updated_at: now,
    })
    .eq('line_id', lineId)
    .is('sharing_reprompt_requested_at', null)
    .neq('sharing_consent', 'pending')
    .select('line_id');

  if (error || !updatedRows || updatedRows.length === 0) {
    logger.error({ error, lineId }, 'Failed to request sharing re-prompt');
    return { success: false, error: 'Failed to update sharing consent' };
  }

  const requestMetadata = getRequestMetadata(headersList);
  const logged = await logRequiredConsentAudit({
    accountId,
    lineId,
    actorUserId,
    actorType: 'payer',
    action: 'sharing_reprompt_requested',
    consentType: 'data_sharing',
    oldValue: {
      consent: consent.sharing_consent,
      tier: consent.sharing_tier,
    },
    newValue: {
      consent: consent.sharing_consent,
      tier: consent.sharing_tier,
      sharing_reprompt_requested_at: now,
    },
    ...requestMetadata,
  }, adminClient);
  if (!logged) {
    return { success: false, error: 'Failed to record sharing re-prompt audit entry' };
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}

export async function requestInsightsRePrompt(
  lineId: string
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireLineOwnerContext(lineId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { adminClient, actorUserId, accountId, accountUserType } = auth.context;
  const headersList = await headers();

  if (accountUserType !== 'family_managed') {
    return { success: false, error: 'Insights changes are managed directly for self accounts' };
  }

  const { data: consent, error: consentError } = await adminClient
    .from('ultaura_line_voice_consent')
    .select('insights_reprompt_requested_at')
    .eq('line_id', lineId)
    .single();

  if (consentError || !consent) {
    logger.error({ error: consentError, lineId }, 'Failed to load insights consent for re-prompt');
    return { success: false, error: 'Consent record not found' };
  }

  if (consent.insights_reprompt_requested_at) {
    return { success: false, error: 'Insights change already requested' };
  }

  const { data: lastRequest, error: lastRequestError } = await adminClient
    .from('ultaura_consent_audit_log')
    .select('created_at')
    .eq('line_id', lineId)
    .eq('action', 'insights_reprompt_requested')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRequestError) {
    logger.error({ error: lastRequestError, lineId }, 'Failed to check insights re-prompt cooldown');
    return { success: false, error: 'Failed to verify insights re-prompt cooldown' };
  }

  if (lastRequest?.created_at) {
    const lastRequestMs = new Date(lastRequest.created_at).getTime();
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastRequestMs < cooldownMs) {
      return { success: false, error: 'Insights re-prompt is limited to once every 30 days' };
    }
  }

  const now = new Date().toISOString();
  const { error, data: updatedRows } = await adminClient
    .from('ultaura_line_voice_consent')
    .update({
      insights_reprompt_requested_at: now,
      updated_at: now,
    })
    .eq('line_id', lineId)
    .is('insights_reprompt_requested_at', null)
    .select('line_id');

  if (error) {
    logger.error({ error, lineId }, 'Failed to request insights re-prompt');
    return { success: false, error: 'Failed to update insights preference' };
  }

  if (!updatedRows || updatedRows.length === 0) {
    return { success: false, error: 'Insights change already requested' };
  }

  const requestMetadata = getRequestMetadata(headersList);
  const logged = await logRequiredConsentAudit({
    accountId,
    lineId,
    actorUserId,
    actorType: 'payer',
    action: 'insights_reprompt_requested',
    consentType: 'insights',
    oldValue: {
      insights_reprompt_requested_at: consent.insights_reprompt_requested_at,
    },
    newValue: {
      insights_reprompt_requested_at: now,
    },
    ...requestMetadata,
  }, adminClient);
  if (!logged) {
    return { success: false, error: 'Failed to record insights re-prompt audit entry' };
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}

// ============================================
// AUDIT LOGGING
// ============================================

export async function logConsentAudit(
  entry: ConsentAuditLogInput,
  clientOverride?: ReturnType<typeof getSupabaseServerActionClient>
): Promise<boolean> {
  const client = clientOverride || getSupabaseServerActionClient({ admin: true });

  const { error } = await client
    .from('ultaura_consent_audit_log')
    .insert({
      account_id: entry.accountId,
      line_id: entry.lineId || null,
      actor_user_id: entry.actorUserId || null,
      actor_type: entry.actorType || 'system',
      action: entry.action,
      consent_type: entry.consentType || null,
      old_value: entry.oldValue || null,
      new_value: entry.newValue || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      call_session_id: entry.callSessionId || null,
      metadata: entry.metadata || null,
    } as Database['public']['Tables']['ultaura_consent_audit_log']['Insert']);

  if (error) {
    logger.error({ error, entry }, 'Failed to log consent audit');
    return false;
  }

  return true;
}

export async function logRequiredConsentAudit(
  entry: ConsentAuditLogInput,
  clientOverride?: ReturnType<typeof getSupabaseServerActionClient>
): Promise<boolean> {
  return logConsentAudit(entry, clientOverride);
}

export async function getConsentAuditLog(
  accountId: string,
  options?: { limit?: number; offset?: number }
): Promise<ConsentAuditEntry[]> {
  const client = getSupabaseServerComponentClient();
  const normalizedLimit = Math.max(0, Math.trunc(options?.limit ?? 50));
  const normalizedOffset = Math.max(0, Math.trunc(options?.offset ?? 0));

  if (normalizedLimit === 0) {
    return [];
  }

  const query = client
    .from('ultaura_consent_audit_log')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(normalizedOffset, normalizedOffset + normalizedLimit - 1);

  const { data, error } = await query;

  if (error) {
    logger.error({ error, accountId }, 'Failed to get audit log');
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    createdAt: row.created_at,
    accountId: row.account_id,
    lineId: row.line_id,
    actorUserId: row.actor_user_id,
    actorType: row.actor_type as ConsentAuditEntry['actorType'],
    action: row.action,
    consentType: row.consent_type,
    oldValue: row.old_value,
    newValue: row.new_value,
    // Intentional privacy redaction: dashboard views never expose stored IP/user-agent values.
    ipAddress: null,
    userAgent: null,
    callSessionId: row.call_session_id,
    metadata: row.metadata as Record<string, unknown> | null,
  }));
}

// ============================================
// DATA EXPORT
// ============================================

export async function requestDataExport(
  accountId: string,
  options?: {
    format?: 'json' | 'csv';
    includeMemories?: boolean;
    includeCallMetadata?: boolean;
    includeReminders?: boolean;
  }
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  const auth = await requireAccountOwnerContext(accountId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { userClient, adminClient, actorUserId } = auth.context;
  const headersList = await headers();
  const nowIso = new Date().toISOString();

  const { data, error } = await userClient
    .from('ultaura_data_export_requests')
    .insert({
      account_id: accountId,
      requested_by: actorUserId,
      format: options?.format || 'json',
      include_memories: options?.includeMemories ?? true,
      include_call_metadata: options?.includeCallMetadata ?? true,
      include_reminders: options?.includeReminders ?? true,
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    const uniqueViolation =
      error?.code === '23505' ||
      error?.message?.toLowerCase().includes('unique');
    if (uniqueViolation) {
      return { success: false, error: 'An export is already in progress' };
    }
    logger.error({ error, accountId }, 'Failed to create export request');
    return { success: false, error: 'Failed to create export request' };
  }

  const requestMetadata = getRequestMetadata(headersList);
  const logged = await logRequiredConsentAudit({
    accountId,
    actorUserId,
    actorType: 'payer',
    action: 'data_export_requested',
    ...requestMetadata,
  }, adminClient);
  if (!logged) {
    await adminClient
      .from('ultaura_data_export_requests')
      .update({
        status: 'failed',
        processed_at: nowIso,
        error_message: 'Failed to record required audit entry',
      })
      .eq('id', data.id);

    return { success: false, error: 'Failed to record required audit entry' };
  }

  const telephonyUrl = getTelephonyBackendUrl();

  try {
    const response = await fetch(`${telephonyUrl}/internal/exports/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({ exportRequestId: data.id }),
    });

    if (!response.ok) {
      const message = 'Failed to start export job';

      await adminClient
        .from('ultaura_data_export_requests')
        .update({
          status: 'failed',
          processed_at: nowIso,
          error_message: message,
        })
        .eq('id', data.id);

      return { success: false, error: message };
    }
  } catch (error) {
    logger.error({ error, accountId }, 'Failed to trigger export job');

    await adminClient
      .from('ultaura_data_export_requests')
      .update({
        status: 'failed',
        processed_at: nowIso,
        error_message: 'Failed to trigger export job',
      })
      .eq('id', data.id);

    return { success: false, error: 'Failed to trigger export job' };
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true, requestId: data.id };
}

export async function getDataExportRequests(
  accountId: string
): Promise<DataExportRequest[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_data_export_requests')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    logger.error({ error, accountId }, 'Failed to get export requests');
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    accountId: row.account_id,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    format: row.format,
    includeMemories: row.include_memories,
    includeCallMetadata: row.include_call_metadata,
    includeReminders: row.include_reminders,
    status: row.status,
    processedAt: row.processed_at,
    expiresAt: row.expires_at,
    downloadUrl: row.download_url,
    fileSizeBytes: row.file_size_bytes,
    errorMessage: row.error_message,
  }));
}

// ============================================
// DATA DELETION
// ============================================

export async function requestAccountDataDeletion(
  accountId: string,
  reason: 'user_request' | 'consent_revoked'
): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAccountOwnerContext(accountId);
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  const { userClient, adminClient, actorUserId } = auth.context;
  const headersList = await headers();
  const requestId = randomUUID();
  const { ipAddress, userAgent } = getRequestMetadata(headersList);
  const auditBase = {
    accountId,
    actorUserId,
    actorType: 'payer' as const,
    action: 'data_deletion_requested' as const,
    ipAddress,
    userAgent,
  };

  const failDeletion = async (
    stage: string,
    userError: string,
    metadata?: Record<string, unknown>,
  ): Promise<{ success: false; error: string }> => {
    const logged = await logRequiredConsentAudit({
      ...auditBase,
      metadata: {
        phase: 'failed',
        requestId,
        reason,
        stage,
        ...metadata,
      },
    }, adminClient);
    if (!logged) {
      return { success: false, error: 'Failed to record required deletion audit entry' };
    }
    return { success: false, error: userError };
  };

  const attemptLogged = await logRequiredConsentAudit({
    ...auditBase,
    metadata: {
      phase: 'attempt',
      requestId,
      reason,
    },
  }, adminClient);
  if (!attemptLogged) {
    return { success: false, error: 'Failed to record required deletion audit entry' };
  }

  const { data: recordings, error: recordingsError } = await adminClient
    .from('ultaura_call_sessions')
    .select('id, recording_sid')
    .eq('account_id', accountId)
    .not('recording_sid', 'is', null)
    .is('recording_deleted_at', null);

  if (recordingsError) {
    logger.error({ error: recordingsError, accountId }, 'Failed to load recordings for deletion');
    return failDeletion('load_recordings', 'Failed to delete account data');
  }

  // Telephony recording deletion endpoint accepts:
  // retention_policy | user_request | account_deletion
  // Map consent-revoked account deletions to account_deletion so recording cleanup
  // does not fail with a 400.
  const deletionReason: RecordingDeletionReason =
    reason === 'consent_revoked' ? 'account_deletion' : 'user_request';

  if (recordings && recordings.length > 0) {
    const recordingSids = recordings
      .map(recording => recording.recording_sid)
      .filter(Boolean) as string[];

    if (recordingSids.length > 0) {
      const telephonyUrl = getTelephonyBackendUrl();

      try {
        const response = await fetch(`${telephonyUrl}/internal/recordings/delete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Secret': getInternalApiSecret(),
          },
          body: JSON.stringify({
            recording_sids: recordingSids,
            reason: deletionReason,
          }),
        });
        if (!response.ok) {
          logger.error(
            { accountId, status: response.status },
            'Recording deletion backend returned non-OK status',
          );
          return failDeletion('delete_recordings_backend_non_ok', 'Failed to delete recordings', {
            status: response.status,
          });
        }
      } catch (error) {
        logger.error({ error, accountId }, 'Failed to trigger recording deletion');
        return failDeletion('delete_recordings_trigger', 'Failed to delete recordings');
      }
    }
  }

  const { data: memories, error: memoryFetchError } = await adminClient
    .from('ultaura_memories')
    .select('id, key, line_id, account_id, confidence')
    .eq('account_id', accountId);

  if (memoryFetchError) {
    logger.error({ error: memoryFetchError, accountId }, 'Failed to load memories for deletion log');
    return failDeletion('load_memories', 'Failed to delete account data');
  } else if (memories && memories.length > 0) {
    const deactivationReason: Database['public']['Enums']['ultaura_deactivation_reason'] = 'payer_deletion';
    const rows: Database['public']['Tables']['ultaura_memory_deactivation_log']['Insert'][] = memories.map((memory) => ({
      memory_id: memory.id,
      memory_key: memory.key,
      line_id: memory.line_id,
      account_id: memory.account_id,
      reason: deactivationReason,
      confidence_at_deactivation: memory.confidence,
      metadata: { requestId, requestedBy: actorUserId, reason },
    }));

    const { error: logError } = await adminClient
      .from('ultaura_memory_deactivation_log')
      .insert(rows);

    if (logError) {
      logger.error({ error: logError, accountId }, 'Failed to log payer memory deletions');
      return failDeletion('log_memory_deactivation', 'Failed to delete account data');
    }
  }

  const { data: accountLines, error: lineFetchError } = await userClient
    .from('ultaura_lines')
    .select('id')
    .eq('account_id', accountId);

  if (lineFetchError) {
    logger.error({ error: lineFetchError, accountId }, 'Failed to load lines for deletion');
    return failDeletion('load_lines', 'Failed to delete account data');
  }

  const lineIds = (accountLines || []).map((line) => line.id);

  const { error: remindersError } = await adminClient
    .from('ultaura_reminders')
    .delete()
    .eq('account_id', accountId);
  if (remindersError) {
    logger.error({ error: remindersError, accountId }, 'Failed to delete reminders');
    return failDeletion('delete_reminders', 'Failed to delete account data');
  }

  const { error: reminderEventsError } = await adminClient
    .from('ultaura_reminder_events')
    .delete()
    .eq('account_id', accountId);
  if (reminderEventsError) {
    logger.error({ error: reminderEventsError, accountId }, 'Failed to delete reminder events');
    return failDeletion('delete_reminder_events', 'Failed to delete account data');
  }

  const { error: moodError } = await adminClient
    .from('ultaura_mood_snapshots')
    .delete()
    .eq('account_id', accountId);
  if (moodError) {
    logger.error({ error: moodError, accountId }, 'Failed to delete mood snapshots');
    return failDeletion('delete_mood_snapshots', 'Failed to delete account data');
  }

  const { error: healthError } = await adminClient
    .from('ultaura_health_mentions')
    .delete()
    .eq('account_id', accountId);
  if (healthError) {
    logger.error({ error: healthError, accountId }, 'Failed to delete health mentions');
    return failDeletion('delete_health_mentions', 'Failed to delete account data');
  }

  const { error: milestonesError } = await adminClient
    .from('ultaura_milestones')
    .delete()
    .eq('account_id', accountId);
  if (milestonesError) {
    logger.error({ error: milestonesError, accountId }, 'Failed to delete milestones');
    return failDeletion('delete_milestones', 'Failed to delete account data');
  }

  const { error: relationshipsError } = await adminClient
    .from('ultaura_relationships')
    .delete()
    .eq('account_id', accountId);
  if (relationshipsError) {
    logger.error({ error: relationshipsError, accountId }, 'Failed to delete relationships');
    return failDeletion('delete_relationships', 'Failed to delete account data');
  }

  const { error: weeklySummariesError } = await adminClient
    .from('ultaura_weekly_summaries')
    .delete()
    .eq('account_id', accountId);
  if (weeklySummariesError) {
    logger.error({ error: weeklySummariesError, accountId }, 'Failed to delete weekly summaries');
    return failDeletion('delete_weekly_summaries', 'Failed to delete account data');
  }

  const { error: memoryEmbeddingsError } = await adminClient
    .from('ultaura_memory_embeddings')
    .delete()
    .eq('account_id', accountId);
  if (memoryEmbeddingsError) {
    logger.error({ error: memoryEmbeddingsError, accountId }, 'Failed to delete memory embeddings');
    return failDeletion('delete_memory_embeddings', 'Failed to delete account data');
  }

  const { error: trustedContactsError } = await adminClient
    .from('ultaura_trusted_contacts')
    .delete()
    .eq('account_id', accountId);
  if (trustedContactsError) {
    logger.error({ error: trustedContactsError, accountId }, 'Failed to delete trusted contacts');
    return failDeletion('delete_trusted_contacts', 'Failed to delete account data');
  }

  const { error: recipientsError } = await adminClient
    .from('ultaura_notification_recipients')
    .delete()
    .eq('account_id', accountId);
  if (recipientsError) {
    logger.error({ error: recipientsError, accountId }, 'Failed to delete notification recipients');
    return failDeletion('delete_notification_recipients', 'Failed to delete account data');
  }

  const { error: accountNotificationPreferencesError } = await adminClient
    .from('ultaura_notification_preferences')
    .delete()
    .eq('account_id', accountId);
  if (accountNotificationPreferencesError) {
    logger.error({ error: accountNotificationPreferencesError, accountId }, 'Failed to delete notification preferences');
    return failDeletion('delete_notification_preferences', 'Failed to delete account data');
  }

  const { error: storyArcsError } = await adminClient
    .from('ultaura_story_arcs')
    .delete()
    .eq('account_id', accountId);
  if (storyArcsError) {
    logger.error({ error: storyArcsError, accountId }, 'Failed to delete story arcs');
    return failDeletion('delete_story_arcs', 'Failed to delete account data');
  }

  const { error: segmentEngagementError } = await adminClient
    .from('ultaura_segment_engagement')
    .delete()
    .eq('account_id', accountId);
  if (segmentEngagementError) {
    logger.error({ error: segmentEngagementError, accountId }, 'Failed to delete segment engagement');
    return failDeletion('delete_segment_engagement', 'Failed to delete account data');
  }

  const { error: callPreviewsError } = await adminClient
    .from('ultaura_call_previews')
    .delete()
    .eq('account_id', accountId);
  if (callPreviewsError) {
    logger.error({ error: callPreviewsError, accountId }, 'Failed to delete call previews');
    return failDeletion('delete_call_previews', 'Failed to delete account data');
  }

  const { error: scheduleEventsError } = await adminClient
    .from('ultaura_schedule_events')
    .delete()
    .eq('account_id', accountId);
  if (scheduleEventsError) {
    logger.error({ error: scheduleEventsError, accountId }, 'Failed to delete schedule events');
    return failDeletion('delete_schedule_events', 'Failed to delete account data');
  }

  const { error: scheduleExceptionsError } = await adminClient
    .from('ultaura_schedule_exceptions')
    .delete()
    .eq('account_id', accountId);
  if (scheduleExceptionsError) {
    logger.error({ error: scheduleExceptionsError, accountId }, 'Failed to delete schedule exceptions');
    return failDeletion('delete_schedule_exceptions', 'Failed to delete account data');
  }

  const { error: voiceConsentError } = await adminClient
    .from('ultaura_line_voice_consent')
    .delete()
    .eq('account_id', accountId);
  if (voiceConsentError) {
    logger.error({ error: voiceConsentError, accountId }, 'Failed to delete line voice consent');
    return failDeletion('delete_line_voice_consent', 'Failed to delete account data');
  }

  const { error: consentsError } = await adminClient
    .from('ultaura_consents')
    .delete()
    .eq('account_id', accountId);
  if (consentsError) {
    logger.error({ error: consentsError, accountId }, 'Failed to delete consents');
    return failDeletion('delete_consents', 'Failed to delete account data');
  }

  const { error: exportRequestsError } = await adminClient
    .from('ultaura_data_export_requests')
    .delete()
    .eq('account_id', accountId);
  if (exportRequestsError) {
    logger.error({ error: exportRequestsError, accountId }, 'Failed to delete export requests');
    return failDeletion('delete_export_requests', 'Failed to delete account data');
  }

  const { error: lifeChaptersError } = await adminClient
    .from('ultaura_life_chapters')
    .delete()
    .eq('account_id', accountId);
  if (lifeChaptersError) {
    logger.error({ error: lifeChaptersError, accountId }, 'Failed to delete life chapters');
    return failDeletion('delete_life_chapters', 'Failed to delete account data');
  }

  if (lineIds.length > 0) {
    const { error: emotionalPatternsError } = await adminClient
      .from('ultaura_emotional_patterns')
      .delete()
      .in('line_id', lineIds);
    if (emotionalPatternsError) {
      logger.error({ error: emotionalPatternsError, accountId }, 'Failed to delete emotional patterns');
      return failDeletion('delete_emotional_patterns', 'Failed to delete account data');
    }

    const { error: contentPreferencesError } = await adminClient
      .from('ultaura_content_preferences')
      .delete()
      .in('line_id', lineIds);
    if (contentPreferencesError) {
      logger.error({ error: contentPreferencesError, accountId }, 'Failed to delete content preferences');
      return failDeletion('delete_content_preferences', 'Failed to delete account data');
    }

    const { error: dailyRhythmsError } = await adminClient
      .from('ultaura_daily_rhythms')
      .delete()
      .in('line_id', lineIds);
    if (dailyRhythmsError) {
      logger.error({ error: dailyRhythmsError, accountId }, 'Failed to delete daily rhythms');
      return failDeletion('delete_daily_rhythms', 'Failed to delete account data');
    }

    const { error: accessibilitySettingsError } = await adminClient
      .from('ultaura_accessibility_settings')
      .delete()
      .in('line_id', lineIds);
    if (accessibilitySettingsError) {
      logger.error({ error: accessibilitySettingsError, accountId }, 'Failed to delete accessibility settings');
      return failDeletion('delete_accessibility_settings', 'Failed to delete account data');
    }

    const { error: lineBaselinesError } = await adminClient
      .from('ultaura_line_baselines')
      .delete()
      .in('line_id', lineIds);
    if (lineBaselinesError) {
      logger.error({ error: lineBaselinesError, accountId }, 'Failed to delete line baselines');
      return failDeletion('delete_line_baselines', 'Failed to delete account data');
    }

    const { error: personaError } = await adminClient
      .from('ultaura_persona_adaptations')
      .delete()
      .in('line_id', lineIds);
    if (personaError) {
      logger.error({ error: personaError, accountId }, 'Failed to delete persona adaptations');
      return failDeletion('delete_persona_adaptations', 'Failed to delete account data');
    }

    const { error: insightsPrivacyError } = await adminClient
      .from('ultaura_insight_privacy')
      .delete()
      .in('line_id', lineIds);
    if (insightsPrivacyError) {
      logger.error({ error: insightsPrivacyError, accountId }, 'Failed to delete insight privacy rows');
      return failDeletion('delete_insight_privacy', 'Failed to delete account data');
    }

    const { error: cognitiveFlagsError } = await adminClient
      .from('ultaura_cognitive_flags')
      .delete()
      .in('line_id', lineIds);
    if (cognitiveFlagsError) {
      logger.error({ error: cognitiveFlagsError, accountId }, 'Failed to delete cognitive flags');
      return failDeletion('delete_cognitive_flags', 'Failed to delete account data');
    }

    const { error: cognitiveObsError } = await adminClient
      .from('ultaura_cognitive_observations')
      .delete()
      .in('line_id', lineIds);
    if (cognitiveObsError) {
      logger.error({ error: cognitiveObsError, accountId }, 'Failed to delete cognitive observations');
      return failDeletion('delete_cognitive_observations', 'Failed to delete account data');
    }

    const { error: griefInteractionsError } = await adminClient
      .from('ultaura_grief_interactions')
      .delete()
      .in('line_id', lineIds);
    if (griefInteractionsError) {
      logger.error({ error: griefInteractionsError, accountId }, 'Failed to delete grief interactions');
      return failDeletion('delete_grief_interactions', 'Failed to delete account data');
    }
  }

  const { error: accountPrivacySettingsError } = await adminClient
    .from('ultaura_account_privacy_settings')
    .delete()
    .eq('account_id', accountId);
  if (accountPrivacySettingsError) {
    logger.error({ error: accountPrivacySettingsError, accountId }, 'Failed to delete account privacy settings');
    return failDeletion('delete_account_privacy_settings', 'Failed to delete account data');
  }

  const { error: accountCryptoKeysError } = await adminClient
    .from('ultaura_account_crypto_keys')
    .delete()
    .eq('account_id', accountId);
  if (accountCryptoKeysError) {
    logger.error({ error: accountCryptoKeysError, accountId }, 'Failed to delete account crypto keys');
    return failDeletion('delete_account_crypto_keys', 'Failed to delete account data');
  }

  const { error: safetyEventsError } = await adminClient
    .from('ultaura_safety_events')
    .delete()
    .eq('account_id', accountId);
  if (safetyEventsError) {
    logger.error({ error: safetyEventsError, accountId }, 'Failed to delete safety events');
    return failDeletion('delete_safety_events', 'Failed to delete account data');
  }

  const { error: wellnessAlertsError } = await adminClient
    .from('ultaura_wellness_alerts')
    .delete()
    .eq('account_id', accountId);
  if (wellnessAlertsError) {
    logger.error({ error: wellnessAlertsError, accountId }, 'Failed to delete wellness alerts');
    return failDeletion('delete_wellness_alerts', 'Failed to delete account data');
  }

  const { error: insightsError } = await adminClient
    .from('ultaura_call_insights')
    .delete()
    .eq('account_id', accountId);
  if (insightsError) {
    logger.error({ error: insightsError, accountId }, 'Failed to delete call insights');
    return failDeletion('delete_call_insights', 'Failed to delete account data');
  }

  const { error: memoriesError } = await adminClient
    .from('ultaura_memories')
    .delete()
    .eq('account_id', accountId);
  if (memoriesError) {
    logger.error({ error: memoriesError, accountId }, 'Failed to delete memories');
    return failDeletion('delete_memories', 'Failed to delete account data');
  }

  const { error: schedulesError } = await adminClient
    .from('ultaura_schedules')
    .delete()
    .eq('account_id', accountId);
  if (schedulesError) {
    logger.error({ error: schedulesError, accountId }, 'Failed to delete schedules');
    return failDeletion('delete_schedules', 'Failed to delete account data');
  }

  const { error: subscriptionsError } = await adminClient
    .from('ultaura_subscriptions')
    .delete()
    .eq('account_id', accountId);
  if (subscriptionsError) {
    logger.error({ error: subscriptionsError, accountId }, 'Failed to delete subscriptions');
    return failDeletion('delete_subscriptions', 'Failed to delete account data');
  }

  const { error: minuteLedgerError } = await adminClient
    .from('ultaura_minute_ledger')
    .delete()
    .eq('account_id', accountId);
  if (minuteLedgerError) {
    logger.error({ error: minuteLedgerError, accountId }, 'Failed to delete minute ledger rows');
    return failDeletion('delete_minute_ledger', 'Failed to delete account data');
  }

  const { error: optOutsError } = await adminClient
    .from('ultaura_opt_outs')
    .delete()
    .eq('account_id', accountId);
  if (optOutsError) {
    logger.error({ error: optOutsError, accountId }, 'Failed to delete opt-outs');
    return failDeletion('delete_opt_outs', 'Failed to delete account data');
  }

  const { error: debugLogsError } = await adminClient
    .from('ultaura_debug_logs')
    .delete()
    .eq('account_id', accountId);
  if (debugLogsError) {
    logger.error({ error: debugLogsError, accountId }, 'Failed to delete debug logs');
    return failDeletion('delete_debug_logs', 'Failed to delete account data');
  }

  const { error: topicExclusionsError } = await adminClient
    .from('ultaura_topic_exclusions')
    .delete()
    .eq('account_id', accountId);
  if (topicExclusionsError) {
    logger.error({ error: topicExclusionsError, accountId }, 'Failed to delete topic exclusions');
    return failDeletion('delete_topic_exclusions', 'Failed to delete account data');
  }

  const { error: lineCryptoKeysError } = await adminClient
    .from('ultaura_line_crypto_keys')
    .delete()
    .eq('account_id', accountId);
  if (lineCryptoKeysError) {
    logger.error({ error: lineCryptoKeysError, accountId }, 'Failed to delete line crypto keys');
    return failDeletion('delete_line_crypto_keys', 'Failed to delete account data');
  }

  if (lineIds.length > 0) {
    const { error: phoneVerificationsError } = await adminClient
      .from('ultaura_phone_verifications')
      .delete()
      .in('line_id', lineIds);
    if (phoneVerificationsError) {
      logger.error({ error: phoneVerificationsError, accountId }, 'Failed to delete phone verifications');
      return failDeletion('delete_phone_verifications', 'Failed to delete account data');
    }
  }

  const { error: pendingRecordingDeletionsError } = await adminClient
    .from('ultaura_pending_recording_deletions')
    .delete()
    .eq('account_id', accountId);
  if (pendingRecordingDeletionsError) {
    logger.error({ error: pendingRecordingDeletionsError, accountId }, 'Failed to delete pending recording deletions');
    return failDeletion('delete_pending_recording_deletions', 'Failed to delete account data');
  }

  const { error: telephonyEventLogError } = await adminClient
    .from('ultaura_telephony_event_log')
    .delete()
    .eq('account_id', accountId);
  if (telephonyEventLogError) {
    logger.error({ error: telephonyEventLogError, accountId }, 'Failed to delete telephony event log');
    return failDeletion('delete_telephony_event_log', 'Failed to delete account data');
  }

  const { error: sessionsError } = await adminClient
    .from('ultaura_call_sessions')
    .delete()
    .eq('account_id', accountId);
  if (sessionsError) {
    logger.error({ error: sessionsError, accountId }, 'Failed to delete call sessions');
    return failDeletion('delete_call_sessions', 'Failed to delete account data');
  }

  const completedLogged = await logRequiredConsentAudit({
    ...auditBase,
    metadata: {
      phase: 'completed',
      requestId,
      reason,
      recordingsToDelete: recordings?.length || 0,
    },
  }, adminClient);
  if (!completedLogged) {
    return { success: false, error: 'Failed to record required deletion audit entry' };
  }

  // Explicitly deleted in this workflow (non-exhaustive notable list; see delete stages above for full coverage):
  // - ultaura_call_sessions and additional line/account-scoped privacy tables deleted in ordered stages
  // - ultaura_schedules
  // - ultaura_subscriptions
  // - ultaura_minute_ledger
  // - ultaura_opt_outs
  // - ultaura_debug_logs
  // - ultaura_topic_exclusions
  // - ultaura_line_crypto_keys
  // - ultaura_phone_verifications
  // - ultaura_pending_recording_deletions
  // - ultaura_telephony_event_log
  // Cascade-covered via ultaura_call_sessions FK cleanup:
  // - ultaura_call_events
  // - ultaura_trial_daily_cap_reservations
  // Intentionally retained for compliance/audit trace:
  // - ultaura_rate_limit_events (operational abuse/security telemetry)
  // - ultaura_accounts (skeleton row preserved)
  // - ultaura_lines (skeleton rows preserved)
  // - ultaura_memory_deactivation_log
  // - ultaura_consent_audit_log

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}
