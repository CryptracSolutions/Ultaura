import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { applyMemoryDecayForAllLines } from '../services/memory-decay.js';

const DECAY_CRON = process.env.ULTAURA_DECAY_CRON || '0 3 * * *';
const MEMORY_DECAY_ENABLED = process.env.ULTAURA_MEMORY_DECAY_ENABLED !== 'false';
const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;
const LEASE_ID = 'decay-job';
const LEASE_TTL_SECONDS = 60 * 60;

let started = false;
let scheduledTask: cron.ScheduledTask | null = null;

async function withLease(task: () => Promise<void>): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: acquired, error } = await supabase.rpc('try_acquire_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
    p_lease_duration_seconds: LEASE_TTL_SECONDS,
  });

  if (error) {
    logger.error({ error }, 'Failed to acquire decay job lease');
    return;
  }

  if (!acquired) {
    return;
  }

  try {
    await task();
  } finally {
    await supabase.rpc('release_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
    });
  }
}

export function startMemoryDecayJob(): void {
  if (started) return;

  if (!MEMORY_DECAY_ENABLED) {
    logger.info('Memory decay job disabled via ULTAURA_MEMORY_DECAY_ENABLED');
    started = true;
    return;
  }

  if (!cron.validate(DECAY_CRON)) {
    logger.warn({ cron: DECAY_CRON }, 'Invalid decay cron expression; skipping scheduler start');
    started = true;
    return;
  }

  scheduledTask = cron.schedule(DECAY_CRON, async () => {
    await withLease(async () => {
      logger.info('Running memory decay job');
      await applyMemoryDecayForAllLines();
    });
  });

  started = true;
  logger.info({ cron: DECAY_CRON }, 'Memory decay job scheduled');
}

export function stopMemoryDecayJob(): void {
  scheduledTask?.stop();
  scheduledTask = null;
  started = false;
}
