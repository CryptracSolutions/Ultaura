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
    const { data, error } = await client
      .from('ultaura_telephony_event_log' as any)
      .update({ payload_ciphertext: null })
      .not('payload_ciphertext', 'is', null)
      .lt('created_at', cutoff)
      .select('id')
      .limit(BATCH_SIZE);

    if (error) {
      logger.error({ error }, 'Payload retention: purge query failed');
      return;
    }

    const count = data?.length ?? 0;
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
