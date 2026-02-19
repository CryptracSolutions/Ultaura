import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';

// Nullify encrypted raw payloads older than 14 days.
// payload_redacted is kept indefinitely for debugging trends.
const RETENTION_DAYS = 14;
const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const BATCH_SIZE = 500;

let timer: ReturnType<typeof setInterval> | null = null;

async function purgeExpiredPayloads(): Promise<void> {
  const client = getSupabaseClient();
  const cutoff = new Date(
    Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    // Use RPC for reliable batched updates (PostgREST may ignore LIMIT on UPDATE)
    const { data, error } = await client.rpc(
      'purge_expired_payload_ciphertexts',
      { cutoff_ts: cutoff, batch_limit: BATCH_SIZE },
    );

    if (error) {
      logger.error({ error }, 'Payload retention: purge RPC failed');
      return;
    }

    const count = typeof data === 'number' ? data : 0;
    if (count > 0) {
      logger.info(
        { purgedCount: count, cutoff },
        'Payload retention: purged expired ciphertexts',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Payload retention: exception during purge');
  }
}

export function startPayloadRetentionJob(): void {
  logger.info(
    { retentionDays: RETENTION_DAYS, pollIntervalMs: POLL_INTERVAL_MS },
    'Payload retention job started',
  );

  // Run once immediately on startup, then on interval
  purgeExpiredPayloads().catch(() => {});
  timer = setInterval(() => {
    purgeExpiredPayloads().catch(() => {});
  }, POLL_INTERVAL_MS);
}

export function stopPayloadRetentionJob(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Payload retention job stopped');
  }
}
