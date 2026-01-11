import { getSupabaseClient } from '../utils/supabase.js';
import { getTwilioClient } from '../utils/twilio.js';
import { logger } from '../utils/logger.js';
import { processExportRequest } from '../services/exports.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const FETCH_LIMIT = 200;
const BATCH_LIMIT = 50;
const EXPORT_BATCH_LIMIT = 5;

let pollInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastExportCleanupAt = 0;

function getBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 15 * 60 * 1000;
  if (attempts === 2) return 60 * 60 * 1000;
  return Number.POSITIVE_INFINITY;
}

function canAttempt(record: {
  attempts: number;
  last_attempt_at: string | null;
}): boolean {
  const backoffMs = getBackoffMs(record.attempts);
  if (backoffMs === 0) return true;
  if (!record.last_attempt_at) return true;
  const lastAttemptMs = new Date(record.last_attempt_at).getTime();
  return Date.now() - lastAttemptMs >= backoffMs;
}

async function updatePendingDeletion(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_pending_recording_deletions')
    .update(updates)
    .eq('id', id);

  if (error) {
    logger.error({ error, id }, 'Failed to update pending recording deletion');
  }
}

async function markProcessed(id: string, updates: Record<string, unknown>) {
  await updatePendingDeletion(id, updates);
}

async function deleteTwilioRecording(recordingSid: string): Promise<void> {
  const client = getTwilioClient();
  await client.recordings(recordingSid).remove();
}

async function maybeCleanupExpiredExports(): Promise<void> {
  const now = Date.now();
  const cleanupIntervalMs = 24 * 60 * 60 * 1000;

  if (now - lastExportCleanupAt < cleanupIntervalMs) {
    return;
  }

  lastExportCleanupAt = now;

  const supabase = getSupabaseClient();
  const bucket = supabase.storage.from('ultaura-exports');
  const nowIso = new Date(now).toISOString();

  const { data: expiredReady, error: expiredError } = await supabase
    .from('ultaura_data_export_requests')
    .select('id, account_id, format')
    .eq('status', 'ready')
    .lt('expires_at', nowIso);

  if (expiredError) {
    logger.error({ error: expiredError }, 'Failed to load expired exports');
  } else if (expiredReady?.length) {
    for (const exportRequest of expiredReady) {
      const path = `${exportRequest.account_id}/${exportRequest.id}.${exportRequest.format}`;
      const { error: removeError } = await bucket.remove([path]);
      if (removeError) {
        logger.error({ error: removeError, path }, 'Failed to remove expired export file');
      }

      await supabase
        .from('ultaura_data_export_requests')
        .update({ status: 'expired', download_url: null })
        .eq('id', exportRequest.id);
    }
  }

  const failedCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: failedExports, error: failedError } = await supabase
    .from('ultaura_data_export_requests')
    .select('id, account_id, format')
    .eq('status', 'failed')
    .lt('created_at', failedCutoff);

  if (failedError) {
    logger.error({ error: failedError }, 'Failed to load old failed exports');
  } else if (failedExports?.length) {
    for (const exportRequest of failedExports) {
      const path = `${exportRequest.account_id}/${exportRequest.id}.${exportRequest.format}`;
      const { error: removeError } = await bucket.remove([path]);
      if (removeError) {
        logger.error({ error: removeError, path }, 'Failed to remove failed export file');
      }

      await supabase
        .from('ultaura_data_export_requests')
        .update({ status: 'expired', download_url: null })
        .eq('id', exportRequest.id);
    }
  }
}

async function processPendingExportRequests(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_data_export_requests')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(EXPORT_BATCH_LIMIT);

  if (error) {
    logger.error({ error }, 'Failed to load pending exports');
    return;
  }

  if (!data || data.length === 0) {
    return;
  }

  for (const request of data) {
    const result = await processExportRequest(request.id);
    if (!result.success && result.status !== 409) {
      logger.warn({ exportRequestId: request.id, error: result.error }, 'Export processing failed in scheduler');
    }
  }
}

export async function processPendingRecordingDeletions(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    await maybeCleanupExpiredExports();
    await processPendingExportRequests();
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ultaura_pending_recording_deletions')
      .select('*')
      .is('processed_at', null)
      .order('created_at', { ascending: true })
      .limit(FETCH_LIMIT);

    if (error) {
      logger.error({ error }, 'Failed to load pending recording deletions');
      return;
    }

    if (!data || data.length === 0) {
      return;
    }

    const eligible = data.filter((record) => {
      if (record.attempts >= record.max_attempts) {
        markProcessed(record.id, {
          processed_at: new Date().toISOString(),
          last_error: record.last_error || 'Max attempts reached',
        }).catch(() => undefined);
        return false;
      }

      return canAttempt(record);
    });

    const batch = eligible.slice(0, BATCH_LIMIT);
    if (batch.length === 0) {
      return;
    }

    for (const record of batch) {
      const now = new Date().toISOString();
      const nextAttempts = record.attempts + 1;

      try {
        await deleteTwilioRecording(record.recording_sid);

        await supabase
          .from('ultaura_call_sessions')
          .update({
            recording_deleted_at: now,
            recording_deletion_reason: record.reason,
          })
          .eq('recording_sid', record.recording_sid);

        await markProcessed(record.id, {
          attempts: nextAttempts,
          last_attempt_at: now,
          processed_at: now,
          last_error: null,
        });

        logger.info({ recordingSid: record.recording_sid }, 'Recording deleted via scheduler');
      } catch (error) {
        const errorMessage = (error as { message?: string }).message || 'Unknown error';
        const updates: Record<string, unknown> = {
          attempts: nextAttempts,
          last_attempt_at: now,
          last_error: errorMessage,
        };

        if (nextAttempts >= record.max_attempts) {
          updates.processed_at = now;
          logger.error({ recordingSid: record.recording_sid, error }, 'Recording deletion failed after max attempts');
        } else {
          logger.warn({ recordingSid: record.recording_sid, error }, 'Recording deletion failed; will retry');
        }

        await markProcessed(record.id, updates);
      }
    }
  } catch (error) {
    logger.error({ error }, 'Recording deletion scheduler error');
  } finally {
    isRunning = false;
  }
}

export function startRecordingDeletionScheduler(): void {
  if (process.env.RECORDING_DELETION_DISABLED === 'true') {
    logger.info('Recording deletion scheduler disabled via RECORDING_DELETION_DISABLED');
    return;
  }

  if (pollInterval) return;
  pollInterval = setInterval(processPendingRecordingDeletions, POLL_INTERVAL_MS);
  processPendingRecordingDeletions().catch((error) => {
    logger.error({ error }, 'Initial recording deletion run failed');
  });
}

export function stopRecordingDeletionScheduler(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}
