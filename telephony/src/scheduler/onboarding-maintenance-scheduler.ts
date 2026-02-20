import { v4 as uuidv4 } from 'uuid';
import { getSupabaseClient } from '../utils/supabase.js';
import { getInternalApiSecret } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import {
  activeLeases,
  leaseAcquisitions,
  leaseHoldDuration,
  onboardingMaintenanceRunsTotal,
} from '../utils/metrics.js';

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly
const LEASE_DURATION_SECONDS = 300;
const HEARTBEAT_INTERVAL_MS = 60_000;
const LEASE_ID = 'onboarding-maintenance';
const CONSECUTIVE_FAILURE_ALERT_THRESHOLD = 3;
const CRYPTO_HEALTH_TASK_KEY = 'crypto_health';

const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;

const TASKS = [
  {
    key: 'reconcile',
    path: '/api/internal/reconcile-onboarding-subscriptions',
    method: 'POST',
  },
  {
    key: 'cleanup',
    path: '/api/internal/cleanup-onboarding-state',
    method: 'POST',
  },
  {
    key: CRYPTO_HEALTH_TASK_KEY,
    path: '/api/internal/crypto-health',
    method: 'GET',
  },
] as const;

type MaintenanceTask = (typeof TASKS)[number];

let isRunning = false;
let shuttingDown = false;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let alignTimeout: ReturnType<typeof setTimeout> | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;
const consecutiveFailuresByTask = new Map<string, number>();

export function startOnboardingMaintenanceScheduler(): void {
  if (process.env.SCHEDULER_DISABLED === 'true') {
    logger.info('Onboarding maintenance scheduler disabled via SCHEDULER_DISABLED env var');
    return;
  }

  logger.info({
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    leaseDurationSeconds: LEASE_DURATION_SECONDS,
  }, 'Starting onboarding maintenance scheduler');

  void runOnboardingMaintenanceCycle();

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  const delayMs = Math.max(0, nextHour.getTime() - now.getTime());

  alignTimeout = setTimeout(() => {
    void runOnboardingMaintenanceCycle();
    pollInterval = setInterval(() => {
      void runOnboardingMaintenanceCycle();
    }, POLL_INTERVAL_MS);
  }, delayMs);
}

export function stopOnboardingMaintenanceScheduler(): void {
  shuttingDown = true;

  if (alignTimeout) {
    clearTimeout(alignTimeout);
    alignTimeout = null;
  }

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  void releaseLease().catch((error) => {
    logger.error({ error, leaseId: LEASE_ID }, 'Error releasing onboarding maintenance lease during shutdown');
  });

  logger.info({ workerId: WORKER_ID }, 'Onboarding maintenance scheduler stopped');
}

export async function runOnboardingMaintenanceCycle(): Promise<void> {
  if (isRunning || shuttingDown) {
    logger.debug('Onboarding maintenance cycle skipped (already running or shutting down)');
    return;
  }

  isRunning = true;

  try {
    await processWithLease();
  } catch (error) {
    logger.error({ error, workerId: WORKER_ID }, 'Onboarding maintenance scheduler cycle error');
  } finally {
    isRunning = false;
  }
}

async function processWithLease(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: acquired, error: leaseError } = await supabase.rpc('try_acquire_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
    p_lease_duration_seconds: LEASE_DURATION_SECONDS,
  });

  if (leaseError) {
    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'error').inc();
    logger.error({ error: leaseError, leaseId: LEASE_ID }, 'Failed to acquire onboarding maintenance lease');
    return;
  }

  if (!acquired) {
    const { data: leaseRow, error: leaseExistsError } = await supabase
      .from('ultaura_scheduler_leases')
      .select('id')
      .eq('id', LEASE_ID)
      .maybeSingle();

    if (leaseExistsError) {
      leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'error').inc();
      logger.warn({ error: leaseExistsError, leaseId: LEASE_ID }, 'Failed to verify onboarding maintenance lease row');
      return;
    }

    if (!leaseRow) {
      leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'missing').inc();
      logger.error({ leaseId: LEASE_ID }, 'Onboarding maintenance lease row missing');
      return;
    }

    leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'held').inc();
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Onboarding maintenance lease held by another worker');
    return;
  }

  leaseAcquisitions.labels(LEASE_ID, WORKER_ID, 'acquired').inc();
  activeLeases.labels(LEASE_ID).set(1);
  const leaseStart = Date.now();

  logger.info({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Acquired onboarding maintenance lease');

  heartbeatInterval = setInterval(async () => {
    if (shuttingDown) return;

    const { error } = await supabase.rpc('heartbeat_scheduler_lease', {
      p_lease_id: LEASE_ID,
      p_worker_id: WORKER_ID,
      p_extend_seconds: LEASE_DURATION_SECONDS,
    });

    if (error) {
      logger.warn({ error, leaseId: LEASE_ID }, 'Onboarding maintenance heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await processOnboardingMaintenanceRun();
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

async function processOnboardingMaintenanceRun(): Promise<void> {
  let appBaseUrl: string;
  let webhookSecret: string;
  try {
    appBaseUrl = resolveAppBaseUrl();
    webhookSecret = getInternalApiSecret();
  } catch (error) {
    for (const task of TASKS) {
      onboardingMaintenanceRunsTotal.labels(task.key, 'failure').inc();
    }
    consecutiveFailures += 1;
    logger.error({ error, workerId: WORKER_ID }, 'Onboarding maintenance configuration error');
    if (consecutiveFailures >= CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
      logger.error({
        consecutiveFailures,
        alertThreshold: CONSECUTIVE_FAILURE_ALERT_THRESHOLD,
        workerId: WORKER_ID,
        event: 'onboarding_maintenance_consecutive_failures',
      }, 'Onboarding maintenance has failed repeatedly');
    }
    return;
  }

  logger.info({ appBaseUrl, workerId: WORKER_ID }, 'Running onboarding maintenance tasks');

  let failedTasks = 0;
  const failedTaskKeys: string[] = [];

  for (const task of TASKS) {
    if (shuttingDown) {
      logger.info({ workerId: WORKER_ID }, 'Onboarding maintenance interrupted due to shutdown');
      return;
    }

    const success = await runMaintenanceTask(task, appBaseUrl, webhookSecret);
    if (!success) {
      failedTasks += 1;
      failedTaskKeys.push(task.key);
    }
  }

  for (const task of TASKS) {
    if (failedTaskKeys.includes(task.key)) {
      const nextCount = (consecutiveFailuresByTask.get(task.key) ?? 0) + 1;
      consecutiveFailuresByTask.set(task.key, nextCount);
    } else {
      consecutiveFailuresByTask.set(task.key, 0);
    }
  }

  if (failedTasks === 0) {
    consecutiveFailures = 0;
    for (const task of TASKS) {
      consecutiveFailuresByTask.set(task.key, 0);
    }
    logger.info({ workerId: WORKER_ID }, 'Onboarding maintenance run completed successfully');
    return;
  }

  consecutiveFailures += 1;
  logger.warn({
    failedTasks,
    failedTaskKeys,
    consecutiveFailures,
    workerId: WORKER_ID,
  }, 'Onboarding maintenance run completed with failures');

  if (consecutiveFailures >= CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
    logger.error({
      consecutiveFailures,
      alertThreshold: CONSECUTIVE_FAILURE_ALERT_THRESHOLD,
      workerId: WORKER_ID,
      event: 'onboarding_maintenance_consecutive_failures',
    }, 'Onboarding maintenance has failed repeatedly');
  }

  const cryptoHealthConsecutiveFailures =
    consecutiveFailuresByTask.get(CRYPTO_HEALTH_TASK_KEY) ?? 0;
  if (cryptoHealthConsecutiveFailures >= CONSECUTIVE_FAILURE_ALERT_THRESHOLD) {
    logger.error({
      task: CRYPTO_HEALTH_TASK_KEY,
      consecutiveFailures: cryptoHealthConsecutiveFailures,
      alertThreshold: CONSECUTIVE_FAILURE_ALERT_THRESHOLD,
      workerId: WORKER_ID,
      event: 'crypto_health_consecutive_failures',
      endpoint: '/api/internal/crypto-health',
    }, 'Crypto health check has failed repeatedly');
  }
}

async function runMaintenanceTask(
  task: MaintenanceTask,
  appBaseUrl: string,
  webhookSecret: string
): Promise<boolean> {
  const url = `${appBaseUrl}${task.path}`;

  try {
    const response = await fetch(url, {
      method: task.method,
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhookSecret,
      },
    });

    if (!response.ok) {
      const bodyText = await response.text();
      onboardingMaintenanceRunsTotal.labels(task.key, 'failure').inc();
      logger.error({
        task: task.key,
        url,
        status: response.status,
        body: bodyText.slice(0, 500),
      }, 'Onboarding maintenance task failed');
      return false;
    }

    onboardingMaintenanceRunsTotal.labels(task.key, 'success').inc();
    logger.info({ task: task.key, url, status: response.status }, 'Onboarding maintenance task succeeded');
    return true;
  } catch (error) {
    onboardingMaintenanceRunsTotal.labels(task.key, 'failure').inc();
    logger.error({ error, task: task.key, url }, 'Onboarding maintenance task request failed');
    return false;
  }
}

async function releaseLease(): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('release_scheduler_lease', {
    p_lease_id: LEASE_ID,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.warn({ error, leaseId: LEASE_ID }, 'Failed to release onboarding maintenance lease');
  } else {
    logger.debug({ leaseId: LEASE_ID, workerId: WORKER_ID }, 'Released onboarding maintenance lease');
  }
}

function resolveAppBaseUrl(): string {
  const value =
    process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.ULTAURA_PUBLIC_URL ||
    (process.env.NODE_ENV === 'production' ? null : 'http://localhost:3000');

  if (!value) {
    throw new Error('Missing app base URL (set ULTAURA_APP_URL or NEXT_PUBLIC_SITE_URL)');
  }

  return value.replace(/\/$/, '');
}
