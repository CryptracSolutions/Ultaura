import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../utils/supabase.js';
import { getTwilioClient } from '../utils/twilio.js';
import { logger } from '../utils/logger.js';
import { processExportRequest } from '../services/exports.js';
import { activeLeases, leaseAcquisitions, leaseHoldDuration, recordingDeletionsProcessed } from '../utils/metrics.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const LEASE_DURATION_SECONDS = 300;
const HEARTBEAT_INTERVAL_MS = 60_000;
const LEASE_ID = 'recording-deletions';
const FETCH_LIMIT = 200;
const BATCH_LIMIT = 50;
const EXPORT_BATCH_LIMIT = 5;

const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;

let pollInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastExportCleanupAt = 0;
let shuttingDown = false;

export function getBackoffMs(attempts: number): number {
  if (attempts <= 0) return 0;
  if (attempts === 1) return 15 * 60 * 1000;
  if (attempts === 2) return 60 * 60 * 1000;
  return Number.POSITIVE_INFINITY;
}

export function canAttempt(record: {
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

async function deleteTwilioRecording(recordingSid: string): Promise<void> {
  const client = getTwilioClient();
  await client.recordings(recordingSid).remove();
}

export function startRecordingDeletionScheduler(): void {
  if (process.env.RECORDING_DELETION_DISABLED === 'true') {
    logger.info('Recording deletion scheduler disabled via RECORDING_DELETION_DISABLED');
    return;
  }

  if (pollInterval) return;

  logger.info({
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    leaseDurationSeconds: LEASE_DURATION_SECONDS,
  }, 'Starting recording deletion scheduler');

  pollInterval = setInterval(processPendingRecordingDeletions, POLL_INTERVAL_MS);
  processPendingRecordingDeletions().catch((error) => {
    logger.error({ error }, 'Initial recording deletion run failed');
  });
}

export function stopRecordingDeletionScheduler(): void {
  shuttingDown = true;

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  releaseLease().catch(err =>
    logger.error({ err, leaseId: LEASE_ID }, 'Error releasing recording deletion lease during shutdown')
  );

  logger.info({ workerId: WORKER_ID }, 'Recording deletion scheduler stopped');
}

export async function processPendingRecordingDeletions(): Promise<void> {
  if (isRunning || shuttingDown) return;
  isRunning = true;

  try {
    await processWithLease();
  } catch (error) {
    logger.error({ error, workerId: WORKER_ID }, 'Recording deletion scheduler error');
  } finally {
    isRunning = false;
  }
}

async function processWithLease(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: acquired, error: leaseError } = await supabase.rpc(
    'try_acquire_scheduler_lease',
    {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_lease_duration_seconds: LEASE_DURATION_SECONDS,
    }
  );

  if (leaseError) {
    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'error').inc();
    logger.error({ error: leaseError, leaseId: LEASE_ID }, 'Failed to acquire recording deletion lease');
    return;
  }

  if (!acquired) {
    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'held').inc();
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Recording deletion lease held by another worker');
    return;
  }

  leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'acquired').inc();
  activeLeases.labels(LEASE_ID).set(1);
  const leaseStart = Date.now();

  logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Acquired recording deletion lease');

  heartbeatInterval = setInterval(async () => {
    if (shuttingDown) return;

    const { error } = await supabase.rpc('heartbeat_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_extend_seconds: LEASE_DURATION_SECONDS,
    });

    if (error) {
      logger.warn({ error, leaseId: LEASE_ID }, 'Recording deletion heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await maybeCleanupExpiredExports();
    await processPendingExportRequests();
    await processPendingDeletions();
    if (!shuttingDown) await cleanupStaleDocumentUploads();
    if (!shuttingDown) await cleanupFailedDocuments();
    if (!shuttingDown) await cleanupExpiredDocumentTokens();
  } finally {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    activeLeases.labels(LEASE_ID).set(0);
    leaseHoldDuration.labels(LEASE_ID).observe((Date.now() - leaseStart) / 1000);
    await releaseLease();
  }
}

async function releaseLease(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('release_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.warn({ error, leaseId: LEASE_ID }, 'Failed to release recording deletion lease');
  } else {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Released recording deletion lease');
  }
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

  // Health-bearing exports expire after 24 hours. Use artifact_storage_path
  // for cleanup so we never infer the path from requestedFormat.
  const healthCutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const { data: healthExpired, error: healthExpiredError } = await supabase
    .from('ultaura_data_export_requests')
    .select('id, artifact_storage_path')
    .eq('status', 'ready')
    .eq('visibility_scope', 'health_owner_only')
    .lt('processed_at', healthCutoff) as { data: Array<{ id: string; artifact_storage_path: string | null }> | null; error: unknown };

  if (healthExpiredError) {
    logger.error({ error: healthExpiredError }, 'Failed to load expired Health exports');
  } else if (healthExpired?.length) {
    for (const exportRequest of healthExpired) {
      if (shuttingDown) break;

      if (exportRequest.artifact_storage_path) {
        const { error: removeError } = await bucket.remove([exportRequest.artifact_storage_path]);
        if (removeError) {
          logger.error(
            { error: removeError, path: exportRequest.artifact_storage_path },
            'Failed to remove expired Health export artifact'
          );
        }
      }

      await supabase
        .from('ultaura_data_export_requests')
        .update({ status: 'expired', download_url: null })
        .eq('id', exportRequest.id);
    }
  }

  // Standard exports expire after 48 hours (existing behavior, using expires_at).
  const { data: expiredReady, error: expiredError } = await supabase
    .from('ultaura_data_export_requests')
    .select('id, artifact_storage_path, account_id, format')
    .eq('status', 'ready')
    .neq('visibility_scope', 'health_owner_only')
    .lt('expires_at', nowIso) as { data: Array<{ id: string; artifact_storage_path: string | null; account_id: string; format: string }> | null; error: unknown };

  if (expiredError) {
    logger.error({ error: expiredError }, 'Failed to load expired exports');
  } else if (expiredReady?.length) {
    for (const exportRequest of expiredReady) {
      if (shuttingDown) break;

      // Use persisted artifact_storage_path when available; fall back to inferred path.
      const path = exportRequest.artifact_storage_path
        ?? `${exportRequest.account_id}/${exportRequest.id}.${exportRequest.format}`;
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
    .select('id, artifact_storage_path, account_id, format')
    .eq('status', 'failed')
    .lt('created_at', failedCutoff) as { data: Array<{ id: string; artifact_storage_path: string | null; account_id: string; format: string }> | null; error: unknown };

  if (failedError) {
    logger.error({ error: failedError }, 'Failed to load old failed exports');
  } else if (failedExports?.length) {
    for (const exportRequest of failedExports) {
      if (shuttingDown) break;

      const path = exportRequest.artifact_storage_path
        ?? `${exportRequest.account_id}/${exportRequest.id}.${exportRequest.format}`;
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

  logger.info({ count: data.length, workerId: WORKER_ID }, 'Processing pending exports');

  for (const request of data) {
    if (shuttingDown) break;

    const result = await processExportRequest(request.id);
    if (!result.success && result.status !== 409) {
      logger.warn({ exportRequestId: request.id, error: result.error }, 'Export processing failed');
    }
  }
}

async function processPendingDeletions(): Promise<void> {
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
      updatePendingDeletion(record.id, {
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

  logger.info({ count: batch.length, workerId: WORKER_ID }, 'Processing recording deletions');

  for (const record of batch) {
    if (shuttingDown) break;

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

      await updatePendingDeletion(record.id, {
        attempts: nextAttempts,
        last_attempt_at: now,
        processed_at: now,
        last_error: null,
      });

      recordingDeletionsProcessed.labels('success').inc();
      logger.info({ recordingSid: record.recording_sid }, 'Recording deleted via scheduler');
    } catch (error) {
      recordingDeletionsProcessed.labels('error').inc();
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

      await updatePendingDeletion(record.id, updates);
    }
  }
}

async function cleanupStaleDocumentUploads(): Promise<void> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('ultaura_health_documents')
    .select('id, storage_object_key')
    .eq('status', 'uploading')
    .lt('created_at', cutoff) as { data: Array<{ id: string; storage_object_key: string | null }> | null; error: unknown };

  if (error) {
    logger.error({ error }, 'Failed to load stale document uploads');
    return;
  }

  if (!data || data.length === 0) return;

  logger.info({ count: data.length }, 'Cleaning up stale document uploads');

  const bucket = supabase.storage.from('ultaura-health-documents');

  for (const doc of data) {
    if (shuttingDown) break;

    if (doc.storage_object_key) {
      const { error: removeError } = await bucket.remove([doc.storage_object_key]);
      if (removeError) {
        logger.error({ error: removeError, documentId: doc.id, key: doc.storage_object_key }, 'Failed to remove stale upload blob');
      }
    }

    const { error: updateError } = await supabase
      .from('ultaura_health_documents')
      .update({ status: 'failed', upload_failed_at: new Date().toISOString() })
      .eq('id', doc.id);

    if (updateError) {
      logger.error({ error: updateError, documentId: doc.id }, 'Failed to mark stale upload as failed');
    } else {
      logger.info({ documentId: doc.id }, 'Marked stale document upload as failed');
    }
  }
}

async function cleanupFailedDocuments(): Promise<void> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('ultaura_health_documents')
    .select('id, storage_object_key')
    .eq('status', 'failed')
    .or(`upload_failed_at.lt.${cutoff},and(upload_failed_at.is.null,created_at.lt.${cutoff})`) as { data: Array<{ id: string; storage_object_key: string | null }> | null; error: unknown };

  if (error) {
    logger.error({ error }, 'Failed to load old failed documents');
    return;
  }

  if (!data || data.length === 0) return;

  logger.info({ count: data.length }, 'Cleaning up old failed documents');

  const bucket = supabase.storage.from('ultaura-health-documents');

  for (const doc of data) {
    if (shuttingDown) break;

    if (doc.storage_object_key) {
      const { error: removeError } = await bucket.remove([doc.storage_object_key]);
      if (removeError) {
        logger.error({ error: removeError, documentId: doc.id, key: doc.storage_object_key }, 'Failed to remove failed document blob');
      }
    }

    const { error: deleteError } = await supabase
      .from('ultaura_health_documents')
      .delete()
      .eq('id', doc.id);

    if (deleteError) {
      logger.error({ error: deleteError, documentId: doc.id }, 'Failed to hard-delete old failed document');
    } else {
      logger.info({ documentId: doc.id }, 'Hard-deleted old failed document');
    }
  }
}

async function cleanupExpiredDocumentTokens(): Promise<void> {
  const supabase = getSupabaseClient();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('ultaura_health_document_access_tokens')
    .delete({ count: 'exact' })
    .lt('expires_at', cutoff);

  if (error) {
    logger.error({ error }, 'Failed to delete expired document access tokens');
    return;
  }

  if (count && count > 0) {
    logger.info({ count }, 'Deleted expired document access tokens');
  }
}
