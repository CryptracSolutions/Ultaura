'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import getLogger from '~/core/logger';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { Database } from '~/database.types';
import type {
  AccountPrivacySettings,
  ConsentAuditEntry,
  DataExportRequest,
  LineVoiceConsent,
  RetentionPeriod,
} from './types';

const logger = getLogger();
const DEV_TELEPHONY_BACKEND_URL = 'http://localhost:3001';

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

async function getAuthenticatedUserId(): Promise<string | null> {
  const client = getSupabaseServerComponentClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return data.user.id;
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
  const client = getSupabaseServerComponentClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const headersList = await headers();

  const current = await getAccountPrivacySettings(accountId);
  if (!current) {
    return { success: false, error: 'Privacy settings not found' };
  }

  const dbUpdates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
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

  const { error } = await client
    .from('ultaura_account_privacy_settings')
    .update(dbUpdates)
    .eq('account_id', accountId);

  if (error) {
    logger.error({ error, accountId }, 'Failed to update privacy settings');
    return { success: false, error: 'Failed to update settings' };
  }

  const actorUserId = await getAuthenticatedUserId();
  const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] || null;
  const userAgent = headersList.get('user-agent') || null;

  const logChange = async (entry: Partial<ConsentAuditEntry>) => {
    await logConsentAudit({
      accountId,
      actorUserId,
      actorType: 'payer',
      ipAddress,
      userAgent,
      ...entry,
    });
  };

  if (updates.recordingEnabled !== undefined && updates.recordingEnabled !== current.recordingEnabled) {
    await logChange({
      action: 'recording_toggled',
      consentType: 'recording',
      oldValue: current.recordingEnabled,
      newValue: updates.recordingEnabled,
    });
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
          updated_at: new Date().toISOString(),
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

    await logChange({
      action: 'summarization_toggled',
      consentType: 'audio_processing',
      oldValue: current.aiSummarizationEnabled,
      newValue: updates.aiSummarizationEnabled,
      metadata: updates.aiSummarizationEnabled === true ? { lines_reset: linesReset } : null,
    });
  }

  if (updates.retentionPeriod !== undefined && updates.retentionPeriod !== current.retentionPeriod) {
    await logChange({
      action: 'retention_changed',
      consentType: 'data_retention',
      oldValue: current.retentionPeriod,
      newValue: updates.retentionPeriod,
    });
  }

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}

export async function acknowledgeVendorDisclosure(
  accountId: string
): Promise<{ success: boolean; error?: string; alreadyAcknowledged?: boolean }> {
  const client = getSupabaseServerComponentClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const headersList = await headers();

  const actorUserId = await getAuthenticatedUserId();
  if (!actorUserId) {
    return { success: false, error: 'User not authenticated' };
  }

  const { data: existing, error: existingError } = await client
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

  const { error } = await client
    .from('ultaura_account_privacy_settings')
    .update({
      vendor_disclosure_acknowledged_at: new Date().toISOString(),
      vendor_disclosure_acknowledged_by: actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .is('vendor_disclosure_acknowledged_at', null);

  if (error) {
    logger.error({ error, accountId }, 'Failed to acknowledge vendor disclosure');
    return { success: false, error: 'Failed to acknowledge disclosure' };
  }

  await logConsentAudit({
    accountId,
    actorUserId,
    actorType: 'payer',
    action: 'vendor_acknowledged',
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  }, adminClient);

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

// ============================================
// AUDIT LOGGING
// ============================================

export async function logConsentAudit(
  entry: Partial<ConsentAuditEntry>,
  clientOverride?: ReturnType<typeof getSupabaseServerActionClient>
): Promise<void> {
  const client = clientOverride || getSupabaseServerActionClient({ admin: true });

  const { error } = await client
    .from('ultaura_consent_audit_log')
    .insert({
      account_id: entry.accountId!,
      line_id: entry.lineId || null,
      actor_user_id: entry.actorUserId || null,
      actor_type: entry.actorType || 'system',
      action: entry.action!,
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
  }
}

export async function getConsentAuditLog(
  accountId: string,
  options?: { limit?: number; offset?: number }
): Promise<ConsentAuditEntry[]> {
  const client = getSupabaseServerComponentClient();

  let query = client
    .from('ultaura_consent_audit_log')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset !== undefined) {
    const limit = options.limit || 50;
    query = query.range(options.offset, options.offset + limit - 1);
  }

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
  const client = getSupabaseServerComponentClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const headersList = await headers();

  const actorUserId = await getAuthenticatedUserId();
  if (!actorUserId) {
    return { success: false, error: 'User not authenticated' };
  }

  const { data: pending } = await client
    .from('ultaura_data_export_requests')
    .select('id')
    .eq('account_id', accountId)
    .in('status', ['pending', 'processing'])
    .limit(1)
    .maybeSingle();

  if (pending?.id) {
    return { success: false, error: 'An export is already in progress' };
  }

  const { data, error } = await client
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
    logger.error({ error, accountId }, 'Failed to create export request');
    return { success: false, error: 'Failed to create export request' };
  }

  await logConsentAudit({
    accountId,
    actorUserId,
    actorType: 'payer',
    action: 'data_export_requested',
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  }, adminClient);

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
      const payload = await response.json().catch(() => ({}));
      const message = payload?.error || 'Failed to start export job';

      await adminClient
        .from('ultaura_data_export_requests')
        .update({
          status: 'failed',
          processed_at: new Date().toISOString(),
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
        processed_at: new Date().toISOString(),
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
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const headersList = await headers();

  const actorUserId = await getAuthenticatedUserId();
  if (!actorUserId) {
    return { success: false, error: 'User not authenticated' };
  }

  const { data: recordings } = await adminClient
    .from('ultaura_call_sessions')
    .select('id, recording_sid')
    .eq('account_id', accountId)
    .not('recording_sid', 'is', null)
    .is('recording_deleted_at', null);

  const deletionReason = reason === 'consent_revoked' ? 'user_request' : reason;

  if (recordings && recordings.length > 0) {
    const recordingSids = recordings
      .map(recording => recording.recording_sid)
      .filter(Boolean) as string[];

    if (recordingSids.length > 0) {
      const telephonyUrl = getTelephonyBackendUrl();

      try {
        await fetch(`${telephonyUrl}/internal/recordings/delete`, {
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
      } catch (error) {
        logger.error({ error, accountId }, 'Failed to trigger recording deletion');
      }
    }
  }

  await adminClient
    .from('ultaura_memories')
    .delete()
    .eq('account_id', accountId);

  await adminClient
    .from('ultaura_call_insights')
    .delete()
    .eq('account_id', accountId);

  await logConsentAudit({
    accountId,
    actorUserId,
    actorType: 'payer',
    action: 'data_deletion_requested',
    metadata: {
      reason,
      recordingsToDelete: recordings?.length || 0,
    },
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  }, adminClient);

  revalidatePath('/dashboard/privacy', 'page');

  return { success: true };
}
