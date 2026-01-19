import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient, LineRow } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { generateWeeklySummaryForLine } from '../services/weekly-summary.js';
import { activeLeases, leaseAcquisitions, leaseHoldDuration, weeklySummariesProcessed } from '../utils/metrics.js';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const LEASE_DURATION_SECONDS = 300; // 5 minutes
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute
const LEASE_ID = 'weekly-summaries';

const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;

let isRunning = false;
let interval: ReturnType<typeof setInterval> | null = null;
let timeout: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;

export function startWeeklySummaryScheduler(): void {
  if (process.env.SCHEDULER_DISABLED === 'true') {
    logger.info('Weekly summary scheduler disabled via SCHEDULER_DISABLED env var');
    return;
  }

  logger.info({
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    leaseDurationSeconds: LEASE_DURATION_SECONDS,
  }, 'Starting weekly summary scheduler');

  runWeeklySummaryCycle();

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  const delayMs = Math.max(0, nextHour.getTime() - now.getTime());

  timeout = setTimeout(() => {
    runWeeklySummaryCycle();
    interval = setInterval(runWeeklySummaryCycle, POLL_INTERVAL_MS);
  }, delayMs);
}

export function stopWeeklySummaryScheduler(): void {
  shuttingDown = true;

  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  if (interval) {
    clearInterval(interval);
    interval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  releaseLease().catch(err =>
    logger.error({ err, leaseId: LEASE_ID }, 'Error releasing weekly summary lease during shutdown')
  );

  logger.info({ workerId: WORKER_ID }, 'Weekly summary scheduler stopped');
}

export async function runWeeklySummaryCycle(): Promise<void> {
  if (isRunning || shuttingDown) {
    logger.debug('Weekly summary cycle skipped (already running or shutting down)');
    return;
  }

  isRunning = true;

  try {
    await processWithLease();
  } catch (error) {
    logger.error({ error, workerId: WORKER_ID }, 'Weekly summary scheduler cycle error');
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
    logger.error({ error: leaseError, leaseId: LEASE_ID }, 'Failed to acquire weekly summary lease');
    return;
  }

  if (!acquired) {
    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'held').inc();
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Weekly summary lease held by another worker');
    return;
  }

  leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'acquired').inc();
  activeLeases.labels(LEASE_ID).set(1);
  const leaseStart = Date.now();

  logger.info({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Acquired weekly summary lease');

  heartbeatInterval = setInterval(async () => {
    if (shuttingDown) return;

    const { error } = await supabase.rpc('heartbeat_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_extend_seconds: LEASE_DURATION_SECONDS,
    });

    if (error) {
      logger.warn({ error, leaseId: LEASE_ID }, 'Weekly summary heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await processAllLines();
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
    logger.warn({ error, leaseId: LEASE_ID }, 'Failed to release weekly summary lease');
  } else {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Released weekly summary lease');
  }
}

async function processAllLines(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: lines, error } = await supabase
    .from('ultaura_lines')
    .select('id, account_id, display_name, timezone, short_id, last_weekly_summary_at');

  if (error) {
    logger.error({ error }, 'Failed to fetch lines for weekly summaries');
    return;
  }

  logger.info({ lineCount: lines?.length ?? 0, workerId: WORKER_ID }, 'Processing lines for weekly summaries');

  for (const line of (lines || []) as LineRow[]) {
    if (shuttingDown) {
      logger.info({ workerId: WORKER_ID }, 'Shutting down, stopping weekly summary processing');
      break;
    }

    try {
      await generateWeeklySummaryForLine(line);
      weeklySummariesProcessed.labels('success').inc();
    } catch (error) {
      weeklySummariesProcessed.labels('error').inc();
      logger.error({ error, lineId: line.id }, 'Failed to generate weekly summary');
    }
  }
}
