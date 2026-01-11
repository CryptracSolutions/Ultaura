import JSZip from 'jszip';
import { logger } from '../utils/logger.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { fetchDecryptedMemories } from '../utils/encryption.js';

const EXPORT_VERSION = '1.0';
const EXPORT_BUCKET = 'ultaura-exports';
const SIGNED_URL_TTL_SECONDS = 48 * 60 * 60;

export type ExportProcessResult =
  | { success: true }
  | { success: false; status: number; error: string };

export async function processExportRequest(
  exportRequestId: string
): Promise<ExportProcessResult> {
  const supabase = getSupabaseClient();

  const { data: request, error: requestError } = await supabase
    .from('ultaura_data_export_requests')
    .select('*')
    .eq('id', exportRequestId)
    .single();

  if (requestError || !request) {
    return { success: false, status: 404, error: 'Export request not found' };
  }

  if (request.status !== 'pending') {
    return { success: false, status: 409, error: 'Export request already processed' };
  }

  const { data: locked, error: lockError } = await supabase
    .from('ultaura_data_export_requests')
    .update({ status: 'processing' })
    .eq('id', exportRequestId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (lockError) {
    logger.error({ error: lockError, exportRequestId }, 'Failed to lock export request');
    return { success: false, status: 500, error: 'Failed to start export' };
  }

  if (!locked) {
    return { success: false, status: 409, error: 'Export request already processed' };
  }

  try {
    const nowIso = new Date().toISOString();

    const { data: account, error: accountError } = await supabase
      .from('ultaura_accounts')
      .select('id, created_at, plan_id, status')
      .eq('id', request.account_id)
      .single();

    if (accountError || !account) {
      throw new Error('Account not found for export');
    }

    const { data: privacySettings } = await supabase
      .from('ultaura_account_privacy_settings')
      .select('retention_period')
      .eq('account_id', request.account_id)
      .single();

    const { data: lines, error: linesError } = await supabase
      .from('ultaura_lines')
      .select('id, display_name, phone_e164, timezone, created_at, voicemail_behavior, inbound_allowed, do_not_call')
      .eq('account_id', request.account_id)
      .order('created_at', { ascending: true });

    if (linesError) {
      throw new Error('Failed to load lines for export');
    }

    const { data: auditLog } = await supabase
      .from('ultaura_consent_audit_log')
      .select('created_at, action, consent_type, actor_type, old_value, new_value')
      .eq('account_id', request.account_id)
      .order('created_at', { ascending: false });

    const retentionDays = getRetentionDays(privacySettings?.retention_period || null);
    const windowDays = retentionDays ? Math.min(365, retentionDays) : 365;
    const callCutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    let callSessions: Array<{
      lineId: string;
      startedAt: string;
      duration: number | null;
      endReason: string | null;
      language: string | null;
    }> = [];

    if (request.include_call_metadata) {
      const { data: sessions, error: sessionsError } = await supabase
        .from('ultaura_call_sessions')
        .select('line_id, started_at, created_at, seconds_connected, end_reason, language_detected')
        .eq('account_id', request.account_id)
        .gte('created_at', callCutoff)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        throw new Error('Failed to load call sessions for export');
      }

      callSessions = (sessions || []).map((session) => ({
        lineId: session.line_id,
        startedAt: session.started_at || session.created_at,
        duration: session.seconds_connected ?? null,
        endReason: session.end_reason ?? null,
        language: session.language_detected ?? null,
      }));
    }

    let reminders: Array<{
      lineId: string;
      title: string;
      recurrence: string | null;
      nextOccurrence: string | null;
      status: string;
    }> = [];

    if (request.include_reminders) {
      const { data: reminderRows, error: remindersError } = await supabase
        .from('ultaura_reminders')
        .select('line_id, message, rrule, due_at, status, created_at')
        .eq('account_id', request.account_id);

      if (remindersError) {
        throw new Error('Failed to load reminders for export');
      }

      const reminderCutoffMs = Date.now() - 90 * 24 * 60 * 60 * 1000;

      reminders = (reminderRows || [])
        .filter((reminder) =>
          reminder.status === 'scheduled' ||
          (reminder.created_at && new Date(reminder.created_at).getTime() >= reminderCutoffMs)
        )
        .map((reminder) => ({
          lineId: reminder.line_id,
          title: reminder.message,
          recurrence: reminder.rrule ?? null,
          nextOccurrence: reminder.due_at ?? null,
          status: reminder.status,
        }));
    }

    let memories: Array<{
      lineId: string;
      type: string;
      key: string;
      value: unknown;
      createdAt: string;
      privacyScope: string;
    }> = [];

    if (request.include_memories && lines) {
      for (const line of lines) {
        const decrypted = await fetchDecryptedMemories(supabase, request.account_id, line.id, {
          active: true,
        });

        for (const memory of decrypted) {
          memories.push({
            lineId: memory.lineId,
            type: memory.type,
            key: memory.key,
            value: memory.value,
            createdAt: memory.createdAt,
            privacyScope: memory.privacyScope,
          });
        }
      }
    }

    const exportData = {
      exportVersion: EXPORT_VERSION,
      exportedAt: nowIso,
      account: {
        id: account.id,
        createdAt: account.created_at,
        plan: account.plan_id,
        status: account.status,
      },
      lines: (lines || []).map((line) => ({
        id: line.id,
        displayName: line.display_name,
        phoneNumber: line.phone_e164,
        timezone: line.timezone,
        createdAt: line.created_at,
        preferences: {
          voicemailBehavior: line.voicemail_behavior,
          inboundAllowed: line.inbound_allowed,
          doNotCall: line.do_not_call,
        },
      })),
      memories: request.include_memories ? memories : [],
      callSessions: request.include_call_metadata ? callSessions : [],
      reminders: request.include_reminders ? reminders : [],
      auditLog: (auditLog || []).map((entry) => ({
        createdAt: entry.created_at,
        action: entry.action,
        consentType: entry.consent_type,
        actorType: entry.actor_type,
        oldValue: entry.old_value,
        newValue: entry.new_value,
      })),
    };

    const payload = request.format === 'csv'
      ? await buildCsvZip(exportData)
      : Buffer.from(JSON.stringify(exportData, null, 2));

    const extension = request.format === 'csv' ? 'zip' : 'json';
    const path = `${request.account_id}/${request.id}.${extension}`;

    const { error: uploadError } = await supabase
      .storage
      .from(EXPORT_BUCKET)
      .upload(path, payload, {
        contentType: request.format === 'csv' ? 'application/zip' : 'application/json',
        upsert: true,
      });

    if (uploadError) {
      throw new Error('Failed to upload export file');
    }

    const { data: signed, error: signedError } = await supabase
      .storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      throw new Error('Failed to create signed URL');
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

    await supabase
      .from('ultaura_data_export_requests')
      .update({
        status: 'ready',
        processed_at: nowIso,
        expires_at: expiresAt,
        download_url: signed.signedUrl,
        file_size_bytes: payload.length,
        error_message: null,
      })
      .eq('id', exportRequestId);

    return { success: true };
  } catch (error) {
    const message = (error as { message?: string }).message || 'Export failed';
    logger.error({ error, exportRequestId }, 'Export processing failed');

    await supabase
      .from('ultaura_data_export_requests')
      .update({
        status: 'failed',
        processed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq('id', exportRequestId);

    return { success: false, status: 500, error: message };
  }
}

function getRetentionDays(retentionPeriod: string | null): number | null {
  switch (retentionPeriod) {
    case '30_days':
      return 30;
    case '90_days':
      return 90;
    case '365_days':
      return 365;
    case 'indefinite':
      return null;
    default:
      return null;
  }
}

function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  if (raw.includes(',') || raw.includes('\n') || raw.includes('"')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }

  return raw;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const lines = [columns.join(',')];
  for (const row of rows) {
    const line = columns.map((column) => formatCsvValue(row[column])).join(',');
    lines.push(line);
  }
  return lines.join('\n');
}

async function buildCsvZip(exportData: {
  account: Record<string, unknown>;
  lines: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
  callSessions: Array<Record<string, unknown>>;
  reminders: Array<Record<string, unknown>>;
  auditLog: Array<Record<string, unknown>>;
}): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('account.csv', toCsv([exportData.account], ['id', 'createdAt', 'plan', 'status']));
  zip.file('lines.csv', toCsv(exportData.lines, [
    'id',
    'displayName',
    'phoneNumber',
    'timezone',
    'createdAt',
    'preferences',
  ]));
  zip.file('memories.csv', toCsv(exportData.memories, [
    'lineId',
    'type',
    'key',
    'value',
    'createdAt',
    'privacyScope',
  ]));
  zip.file('call_sessions.csv', toCsv(exportData.callSessions, [
    'lineId',
    'startedAt',
    'duration',
    'endReason',
    'language',
  ]));
  zip.file('reminders.csv', toCsv(exportData.reminders, [
    'lineId',
    'title',
    'recurrence',
    'nextOccurrence',
    'status',
  ]));
  zip.file('audit_log.csv', toCsv(exportData.auditLog, [
    'createdAt',
    'action',
    'consentType',
    'actorType',
    'oldValue',
    'newValue',
  ]));

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
