import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { processPendingEmbeddings } from '../services/embedding-queue.js';
import { activeLeases, leaseAcquisitions, leaseHoldDuration } from '../utils/metrics.js';

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const SEMANTIC_SEARCH_ENABLED = process.env.ULTAURA_SEMANTIC_SEARCH_ENABLED !== 'false';
const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;
const LEASE_ID = 'embeddings';
const LEASE_TTL_SECONDS = 60 * 10;

let interval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function withLease(task: () => Promise<void>): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: acquired, error } = await supabase.rpc('try_acquire_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
    p_lease_duration_seconds: LEASE_TTL_SECONDS,
  });

  if (error) {
    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'error').inc();
    logger.error({ error }, 'Failed to acquire embedding lease');
    return;
  }

  if (!acquired) {
    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'held').inc();
    return;
  }

  leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'acquired').inc();
  activeLeases.labels(LEASE_ID).set(1);
  const leaseStart = Date.now();

  try {
    await task();
  } finally {
    activeLeases.labels(LEASE_ID).set(0);
    leaseHoldDuration.labels(LEASE_ID).observe((Date.now() - leaseStart) / 1000);
    await supabase.rpc('release_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
    });
  }
}

async function runEmbeddingCycle(): Promise<void> {
  if (isRunning || !SEMANTIC_SEARCH_ENABLED) {
    return;
  }

  isRunning = true;

  try {
    await withLease(async () => {
      const processed = await processPendingEmbeddings();
      if (processed > 0) {
        logger.info({ processed }, 'Processed pending embeddings');
      }
    });
  } catch (error) {
    logger.error({ error }, 'Embedding job cycle failed');
  } finally {
    isRunning = false;
  }
}

export function startEmbeddingJob(): void {
  if (!SEMANTIC_SEARCH_ENABLED) {
    logger.info('Embedding job disabled via ULTAURA_SEMANTIC_SEARCH_ENABLED');
    return;
  }

  if (interval) return;
  interval = setInterval(runEmbeddingCycle, POLL_INTERVAL_MS);
  runEmbeddingCycle().catch((error) => {
    logger.error({ error }, 'Initial embedding job run failed');
  });
}

export function stopEmbeddingJob(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
