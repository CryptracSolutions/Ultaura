// Distributed call scheduler
// Polls database for due scheduled calls and initiates them
// Supports horizontal scaling with lease-based coordination

import { v4 as uuidv4 } from 'uuid';
import { DateTime } from 'luxon';
import { getSupabaseClient, ScheduleRow, ReminderRow, LineRow } from '../utils/supabase.js';
import { logger } from '../utils/logger.js';
import { getBackendUrl, getInternalApiSecret } from '../utils/env.js';
import { isInQuietHours, checkLineAccess, getLineById } from '../services/line-lookup.js';
import { recalculateBaselinesForAllLines } from '../services/baseline.js';
import { runPersonaAnalyzerForAllLines } from '../services/persona-analyzer.js';
import { enforceRateLimit } from '../services/rate-limiter.js';
import { getNextOccurrence, getNextReminderOccurrence } from '../utils/timezone.js';
import { decryptReminderMessage } from '../utils/reminder-crypto.js';
import {
  sendSms,
  SMS_OPT_OUT_ERROR_MESSAGE,
  SMS_OPT_OUT_LOOKUP_UNAVAILABLE_ERROR_MESSAGE,
} from '../utils/twilio.js';
import {
  activeLeases,
  leaseAcquisitions,
  leaseHoldDuration,
  scheduleOutcomesTotal,
  reminderOutcomesTotal,
} from '../utils/metrics.js';

// Configuration
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const LEASE_DURATION_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = 20_000; // 20 seconds
const CLAIM_TTL_SECONDS = 120;
const BATCH_SIZE = 10;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
// SECURITY: Short retention period to minimize exposure window for debug data.
// Debug logs may contain operational metadata that could be sensitive.
const DEFAULT_DEBUG_LOG_RETENTION_DAYS = 3;
const MAX_DEBUG_LOG_RETENTION_DAYS = 30;

function resolveDebugLogRetentionDays(): number {
  const rawValue = process.env.DEBUG_LOG_RETENTION_DAYS;
  if (!rawValue) {
    return DEFAULT_DEBUG_LOG_RETENTION_DAYS;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn({
      rawValue,
      defaultDays: DEFAULT_DEBUG_LOG_RETENTION_DAYS,
    }, 'Invalid DEBUG_LOG_RETENTION_DAYS; falling back to default');
    return DEFAULT_DEBUG_LOG_RETENTION_DAYS;
  }

  if (parsed > MAX_DEBUG_LOG_RETENTION_DAYS) {
    logger.warn({
      rawValue,
      maxDays: MAX_DEBUG_LOG_RETENTION_DAYS,
    }, 'DEBUG_LOG_RETENTION_DAYS exceeds max; clamping');
    return MAX_DEBUG_LOG_RETENTION_DAYS;
  }

  return parsed;
}

const DEBUG_LOG_RETENTION_DAYS = resolveDebugLogRetentionDays();
const DEBUG_LOG_RETENTION_MS = DEBUG_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Worker identity (unique per instance)
const WORKER_ID = `${process.env.HOSTNAME || 'local'}-${uuidv4().slice(0, 8)}`;

// Scheduler state
let isRunning = false;
let heartbeatIntervals: ReturnType<typeof setInterval>[] = [];
let pollInterval: ReturnType<typeof setInterval> | null = null;
let shuttingDown = false;
let lastCleanupTimestamp = 0;
let lastBaselineRunDate: string | null = null;
let lastPersonaRunDate: string | null = null;
const leaseExistenceCache = new Map<string, boolean>();

type ReminderMetricMethod = 'call' | 'sms';
type SmsFailureClass =
  | 'opt_out'
  | 'opt_out_lookup_unavailable'
  | 'rate_limited'
  | 'config'
  | 'twilio_transient'
  | 'twilio_permanent'
  | 'content'
  | 'unknown';

type SmsFailurePolicy = {
  classification: SmsFailureClass;
  allowInlineRetry: boolean;
  allowDelayedRetry: boolean;
  fallbackEligible: boolean;
};

const SMS_INLINE_RETRY_DELAY_MS = 3_000;
const SMS_INLINE_MAX_RETRIES = 1;
const ONE_TIME_SMS_DELAYED_RETRY_OFFSETS_MS = [2 * 60 * 1000, 10 * 60 * 1000] as const;

function getReminderMetricMethod(reminder: ReminderRow): ReminderMetricMethod {
  return reminder.delivery_method === 'sms' ? 'sms' : 'call';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function getNumericErrorField(error: unknown, field: 'code' | 'status'): number | undefined {
  if (!error || typeof error !== 'object' || !(field in error)) {
    return undefined;
  }

  const value = (error as { code?: unknown; status?: unknown })[field];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function getNumericErrorCode(error: unknown): number | undefined {
  return getNumericErrorField(error, 'code');
}

function getNumericStatus(error: unknown): number | undefined {
  return getNumericErrorField(error, 'status');
}

function classifySmsFailure(error: unknown): SmsFailurePolicy {
  const message = getErrorMessage(error);
  const code = getNumericErrorCode(error);
  const status = getNumericStatus(error);

  if (message === SMS_OPT_OUT_ERROR_MESSAGE || code === 21610) {
    return {
      classification: 'opt_out',
      allowInlineRetry: false,
      allowDelayedRetry: false,
      fallbackEligible: true,
    };
  }

  if (message === SMS_OPT_OUT_LOOKUP_UNAVAILABLE_ERROR_MESSAGE) {
    return {
      classification: 'opt_out_lookup_unavailable',
      allowInlineRetry: true,
      allowDelayedRetry: true,
      fallbackEligible: true,
    };
  }

  if (message === 'Missing TWILIO_PHONE_NUMBER environment variable') {
    return {
      classification: 'config',
      allowInlineRetry: false,
      allowDelayedRetry: false,
      fallbackEligible: true,
    };
  }

  if (code === 20429 || status === 429) {
    return {
      classification: 'rate_limited',
      allowInlineRetry: false,
      allowDelayedRetry: true,
      fallbackEligible: true,
    };
  }

  if (code === 30007 || code === 30008 || code === 21617) {
    return {
      classification: 'content',
      allowInlineRetry: false,
      allowDelayedRetry: false,
      fallbackEligible: false,
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      classification: 'twilio_transient',
      allowInlineRetry: true,
      allowDelayedRetry: true,
      fallbackEligible: true,
    };
  }

  if (code !== undefined) {
    if (code >= 30001 && code <= 30006) {
      return {
        classification: 'twilio_transient',
        allowInlineRetry: true,
        allowDelayedRetry: true,
        fallbackEligible: true,
      };
    }

    if (code >= 21200 && code < 30000) {
      return {
        classification: 'twilio_permanent',
        allowInlineRetry: false,
        allowDelayedRetry: false,
        fallbackEligible: false,
      };
    }
  }

  return {
    classification: 'unknown',
    allowInlineRetry: true,
    allowDelayedRetry: true,
    fallbackEligible: false,
  };
}

async function scheduleOneTimeReminderSmsDelayedRetry(
  supabase: ReturnType<typeof getSupabaseClient>,
  reminder: ReminderRow,
  classification: SmsFailureClass
): Promise<boolean> {
  const retryIndex = Math.max(0, reminder.delivery_retry_count || 0);
  const retryOffsetMs = ONE_TIME_SMS_DELAYED_RETRY_OFFSETS_MS[retryIndex];
  if (retryOffsetMs === undefined) {
    return false;
  }

  const nextAttemptAt = new Date(new Date(reminder.due_at).getTime() + retryOffsetMs).toISOString();

  const { data: updated, error: updateError } = await supabase
    .from('ultaura_reminders')
    .update({
      status: 'scheduled',
      delivery_retry_count: retryIndex + 1,
      next_delivery_attempt_at: nextAttemptAt,
    })
    .eq('id', reminder.id)
    .eq('processing_claimed_by', WORKER_ID)
    .select('id')
    .maybeSingle();

  if (updateError) {
    logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to queue delayed SMS reminder retry');
    return false;
  }

  if (!updated) {
    logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost while queueing delayed SMS retry');
    return true;
  }

  logger.info({
    reminderId: reminder.id,
    classification,
    deliveryRetryCount: retryIndex + 1,
    nextAttemptAt,
  }, 'Queued delayed SMS reminder retry');

  await releaseReminderClaim(reminder.id);
  return true;
}

/**
 * Calculate the next occurrence for a recurring reminder.
 * Returns ISO string in UTC, or null if no next occurrence.
 */
function calculateNextReminderOccurrence(reminder: ReminderRow, timezone?: string): string | null {
  const { rrule, interval_days, days_of_week, day_of_month, due_at } = reminder;

  if (!reminder.is_recurring || !rrule) {
    return null;
  }

  const effectiveTimezone = timezone || reminder.timezone || 'UTC';

  try {
    const timeOfDay = DateTime.fromISO(due_at).setZone(effectiveTimezone).toFormat('HH:mm');
    const nextUtc = getNextReminderOccurrence({
      rrule,
      timezone: effectiveTimezone,
      timeOfDay,
      currentDueAt: new Date(due_at),
      daysOfWeek: days_of_week,
      dayOfMonth: day_of_month,
      intervalDays: interval_days,
    });
    return nextUtc ? nextUtc.toISOString() : null;
  } catch (error) {
    logger.error({ error, reminderId: reminder.id, timezone: effectiveTimezone }, 'Failed to calculate next reminder occurrence');
    return null;
  }
}

function isDateWithinVacation(dateIso: string, line: LineRow): boolean {
  const localDate = DateTime.fromISO(dateIso).setZone(line.timezone).toISODate();
  if (!localDate) return false;
  const ranges = line.vacation_ranges || [];
  return ranges.some((range) => localDate >= range.start && localDate <= range.end);
}

/**
 * Start the distributed scheduler.
 * Uses lease-based coordination to ensure only one instance processes at a time.
 */
export function startScheduler(): void {
  // Check if scheduler is disabled
  if (process.env.SCHEDULER_DISABLED === 'true') {
    logger.info('Scheduler disabled via SCHEDULER_DISABLED env var');
    return;
  }

  logger.info({ workerId: WORKER_ID }, 'Starting distributed call scheduler');

  // Start the poll loop
  pollInterval = setInterval(runSchedulerCycle, POLL_INTERVAL_MS);

  // Run immediately on start
  runSchedulerCycle();

  logger.info({
    workerId: WORKER_ID,
    pollIntervalMs: POLL_INTERVAL_MS,
    leaseSeconds: LEASE_DURATION_SECONDS,
  }, 'Distributed scheduler started');
}

/**
 * Stop the scheduler gracefully.
 * Releases all leases and cancels timers.
 */
export function stopScheduler(): void {
  shuttingDown = true;

  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  heartbeatIntervals.forEach(interval => clearInterval(interval));
  heartbeatIntervals = [];

  // Release any held leases
  releaseAllLeases().catch(err =>
    logger.error({ err }, 'Error releasing leases during shutdown')
  );

  logger.info({ workerId: WORKER_ID }, 'Scheduler stopped');
}

/**
 * Run a single scheduler cycle.
 * Processes schedules and reminders in parallel with separate leases.
 */
async function runSchedulerCycle(): Promise<void> {
  if (isRunning || shuttingDown) {
    logger.debug('Scheduler cycle skipped (already running or shutting down)');
    return;
  }

  isRunning = true;

  try {
    await maybeCleanupDebugLogs();
    // Process schedules and reminders in parallel with separate leases
    await Promise.all([
      processWithLease('schedules', processScheduledCalls),
      processWithLease('reminders', processReminders),
    ]);
  } catch (error) {
    logger.error({ error, workerId: WORKER_ID }, 'Scheduler cycle error');
  } finally {
    isRunning = false;
  }
}

async function maybeCleanupDebugLogs(): Promise<void> {
  const now = Date.now();
  if (now - lastCleanupTimestamp < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupTimestamp = now;

  const supabase = getSupabaseClient();
  const cutoff = new Date(now - DEBUG_LOG_RETENTION_MS).toISOString();

  const { error, count } = await supabase
    .from('ultaura_debug_logs')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff);

  if (error) {
    logger.error({ error }, 'Failed to cleanup debug logs');
    return;
  }

  logger.info({ deletedCount: count ?? 0 }, 'Cleaned up old debug logs');
}

async function maybeRecalculateBaselines(): Promise<void> {
  const now = DateTime.utc();
  const today = now.toISODate();

  if (!today || lastBaselineRunDate === today) {
    return;
  }

  const targetTime = now.set({ hour: 10, minute: 0, second: 0, millisecond: 0 });
  if (now < targetTime) {
    return;
  }

  logger.info({ runDate: today }, 'Running baseline recalculation');
  await recalculateBaselinesForAllLines();
  lastBaselineRunDate = today;
}

async function maybeRunPersonaAnalyzer(): Promise<void> {
  const now = DateTime.utc();
  const today = now.toISODate();

  if (!today || lastPersonaRunDate === today) {
    return;
  }

  const targetTime = now.set({ hour: 11, minute: 0, second: 0, millisecond: 0 });
  if (now < targetTime) {
    return;
  }

  logger.info({ runDate: today }, 'Running persona analyzer rollups');
  await runPersonaAnalyzerForAllLines();
  lastPersonaRunDate = today;
}

/**
 * Execute a processor function while holding a lease.
 * Handles lease acquisition, heartbeat, and release.
 */
async function processWithLease(
  leaseId: 'schedules' | 'reminders',
  processor: () => Promise<void>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Try to acquire the lease
  const { data: acquired, error: leaseError } = await supabase.rpc(
    'try_acquire_scheduler_lease',
    {
      p_lease_id: leaseId,
      p_worker_id: WORKER_ID,
      p_lease_duration_seconds: LEASE_DURATION_SECONDS,
    }
  );

  if (leaseError) {
    leaseAcquisitions.labels(leaseId, WORKER_ID, 'error').inc();
    logger.error({ error: leaseError, leaseId }, 'Failed to acquire lease');
    return;
  }

  if (!acquired) {
    if (!leaseExistenceCache.has(leaseId)) {
      const { data: leaseExists, error: existsError } = await supabase
        .from('ultaura_scheduler_leases')
        .select('id')
        .eq('id', leaseId)
        .maybeSingle();

      if (existsError) {
        logger.warn({ leaseId, error: existsError }, 'Lease existence check failed');
        leaseAcquisitions.labels(leaseId, WORKER_ID, 'held').inc();
        return;
      }

      leaseExistenceCache.set(leaseId, !!leaseExists);
    }

    const exists = leaseExistenceCache.get(leaseId);
    if (!exists) {
      logger.error({ leaseId }, 'Lease row missing - check migrations/seed data');
      leaseAcquisitions.labels(leaseId, WORKER_ID, 'missing').inc();
    } else {
      leaseAcquisitions.labels(leaseId, WORKER_ID, 'held').inc();
      logger.debug({ leaseId, workerId: WORKER_ID }, 'Lease held by another worker');
    }
    return;
  }

  leaseAcquisitions.labels(leaseId, WORKER_ID, 'acquired').inc();
  activeLeases.labels(leaseId).set(1);
  const leaseStart = Date.now();

  logger.debug({ leaseId, workerId: WORKER_ID }, 'Acquired scheduler lease');

  // Start heartbeat for this lease
  const heartbeat = setInterval(async () => {
    if (shuttingDown) return;

    const { error } = await supabase.rpc('heartbeat_scheduler_lease', {
      p_lease_id: leaseId,
      p_worker_id: WORKER_ID,
      p_extend_seconds: LEASE_DURATION_SECONDS,
    });

    if (error) {
      logger.warn({ error, leaseId }, 'Heartbeat failed');
    }
  }, HEARTBEAT_INTERVAL_MS);

  heartbeatIntervals.push(heartbeat);

  try {
    await processor();
  } finally {
    // Stop heartbeat
    clearInterval(heartbeat);
    heartbeatIntervals = heartbeatIntervals.filter(h => h !== heartbeat);

    activeLeases.labels(leaseId).set(0);
    leaseHoldDuration.labels(leaseId).observe((Date.now() - leaseStart) / 1000);

    // Release lease
    const { error: releaseError } = await supabase.rpc('release_scheduler_lease', {
      p_lease_id: leaseId,
      p_worker_id: WORKER_ID,
    });

    if (releaseError) {
      logger.warn({ error: releaseError, leaseId }, 'Failed to release lease');
    } else {
      logger.debug({ leaseId, workerId: WORKER_ID }, 'Released scheduler lease');
    }
  }
}

/**
 * Release all held leases during shutdown.
 */
async function releaseAllLeases(): Promise<void> {
  const supabase = getSupabaseClient();

  await Promise.all([
    supabase.rpc('release_scheduler_lease', { p_lease_id: 'schedules', p_worker_id: WORKER_ID }),
    supabase.rpc('release_scheduler_lease', { p_lease_id: 'reminders', p_worker_id: WORKER_ID }),
  ]);

  activeLeases.labels('schedules').set(0);
  activeLeases.labels('reminders').set(0);
}

/**
 * Process due scheduled calls using atomic claim.
 */
async function processScheduledCalls(): Promise<void> {
  const supabase = getSupabaseClient();

  // Claim a batch of due schedules atomically
  const { data: claimedSchedules, error } = await supabase.rpc('claim_due_schedules', {
    p_worker_id: WORKER_ID,
    p_batch_size: BATCH_SIZE,
    p_claim_ttl_seconds: CLAIM_TTL_SECONDS,
  });

  if (error) {
    logger.error({ error }, 'Failed to claim schedules');
    return;
  }

  if (!claimedSchedules || claimedSchedules.length === 0) {
    await maybeRecalculateBaselines();
    await maybeRunPersonaAnalyzer();
    return;
  }

  logger.info({
    count: claimedSchedules.length,
    workerId: WORKER_ID,
  }, 'Processing claimed schedules');

  for (const schedule of claimedSchedules) {
    await processSchedule(schedule as ScheduleRow);
  }

  await maybeRecalculateBaselines();
  await maybeRunPersonaAnalyzer();
}

/**
 * Process a single schedule with idempotency.
 */
async function processSchedule(schedule: ScheduleRow): Promise<void> {
  const supabase = getSupabaseClient();

  // Generate idempotency key for this specific scheduled occurrence
  const idempotencyKey = `schedule:${schedule.id}:${schedule.next_run_at}`;

  logger.info({
    scheduleId: schedule.id,
    lineId: schedule.line_id,
    idempotencyKey,
    workerId: WORKER_ID,
  }, 'Processing schedule');

  // Get line info
  const lineWithAccount = await getLineById(schedule.line_id);
  if (!lineWithAccount) {
    logger.error({ scheduleId: schedule.id, lineId: schedule.line_id }, 'Line not found');
    await completeScheduleWithResult(schedule, 'failed', null, false);
    return;
  }

  const { line, account } = lineWithAccount;

  // Check if line is on vacation for this occurrence
  if (schedule.next_run_at && isDateWithinVacation(schedule.next_run_at, line)) {
    logger.info({ scheduleId: schedule.id, lineId: schedule.line_id }, 'Line on vacation, suppressing call');
    const nextRun = calculateNextRun(schedule, line.timezone);
    const completed = await completeScheduleWithResult(schedule, 'suppressed_vacation', nextRun, true);
    if (completed && nextRun) {
      await supabase
        .from('ultaura_lines')
        .update({ next_scheduled_call_at: nextRun })
        .eq('id', schedule.line_id);
    }
    return;
  }

  // Check if line is opted out
  if (line.do_not_call) {
    logger.info({ scheduleId: schedule.id }, 'Line opted out, skipping');
    await completeScheduleWithResult(schedule, 'suppressed_quiet_hours', calculateNextRun(schedule, line.timezone), false);
    return;
  }

  // Check quiet hours
  if (isInQuietHours(line)) {
    logger.info({ scheduleId: schedule.id }, 'In quiet hours, skipping');
    await completeScheduleWithResult(schedule, 'suppressed_quiet_hours', calculateNextRun(schedule, line.timezone), false);
    return;
  }

  // Check access (minutes, status, etc.)
  const accessCheck = await checkLineAccess(line, account, 'outbound', {
    skipTrialReservation: true,
  });
  if (!accessCheck.allowed) {
    logger.info({ scheduleId: schedule.id, reason: accessCheck.reason }, 'Access denied, skipping');
    await completeScheduleWithResult(schedule, 'failed', calculateNextRun(schedule, line.timezone), false);
    return;
  }

  const localDate = schedule.next_run_at
    ? DateTime.fromISO(schedule.next_run_at).setZone(line.timezone).toISODate()
    : null;

  if (localDate) {
    const { data: exception } = await supabase
      .from('ultaura_schedule_exceptions')
      .select('*')
      .eq('schedule_id', schedule.id)
      .eq('exception_date', localDate)
      .eq('exception_type', 'snooze')
      .maybeSingle();

    if (exception?.new_datetime) {
      const snoozeTime = DateTime.fromISO(exception.new_datetime);
      if (DateTime.utc() < snoozeTime) {
        const { data: updatedSchedule, error: updateError } = await supabase
          .from('ultaura_schedules')
          .update({
            next_run_at: exception.new_datetime,
            retry_count: 0,
            processing_claimed_by: null,
            processing_claimed_at: null,
          })
          .eq('id', schedule.id)
          .eq('processing_claimed_by', WORKER_ID)
          .select('id')
          .maybeSingle();

        if (updateError) {
          logger.error({ error: updateError, scheduleId: schedule.id }, 'Failed to apply snooze exception');
          return;
        }
        if (!updatedSchedule) {
          logger.warn({ scheduleId: schedule.id, workerId: WORKER_ID }, 'Schedule claim lost while applying snooze');
          return;
        }

        await supabase
          .from('ultaura_lines')
          .update({ next_scheduled_call_at: exception.new_datetime })
          .eq('id', schedule.line_id);
        return;
      }
    }

    const { data: blockException } = await supabase
      .from('ultaura_schedule_exceptions')
      .select('exception_type')
      .eq('schedule_id', schedule.id)
      .eq('exception_date', localDate)
      .in('exception_type', ['skip', 'reschedule'])
      .maybeSingle();

    if (blockException) {
      logger.info({ scheduleId: schedule.id, exceptionType: blockException.exception_type }, 'Schedule exception blocked call');
      const nextRun = calculateNextRun(schedule, line.timezone);
      const completed = await completeScheduleWithResult(schedule, 'skipped', nextRun, true);
      if (completed && nextRun) {
        await supabase
          .from('ultaura_lines')
          .update({ next_scheduled_call_at: nextRun })
          .eq('id', schedule.line_id);
      }
      return;
    }
  }

  // Initiate the call
  try {
    const baseUrl = getBackendUrl();

    const response = await fetch(`${baseUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        lineId: schedule.line_id,
        reason: 'scheduled',
        schedulerIdempotencyKey: idempotencyKey,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as Record<string, unknown>;

      // Check for idempotency conflict (already processed)
      if (errorData.code === 'DUPLICATE_SCHEDULED_CALL') {
        logger.warn({ scheduleId: schedule.id, idempotencyKey }, 'Duplicate scheduled call, already processed');
        const nextRun = calculateNextRun(schedule, line.timezone);
        const completed = await completeScheduleWithResult(schedule, 'success', nextRun, true);
        if (completed && nextRun) {
          await supabase
            .from('ultaura_lines')
            .update({ next_scheduled_call_at: nextRun })
            .eq('id', schedule.line_id);
        }
        return;
      }

      throw new Error((errorData.error as string) || 'Failed to initiate call');
    }

    const result = (await response.json()) as Record<string, unknown>;
    logger.info({ scheduleId: schedule.id, sessionId: result.sessionId }, 'Scheduled call initiated');

    // Update schedule
    const nextRun = calculateNextRun(schedule, line.timezone);
    const completed = await completeScheduleWithResult(schedule, 'success', nextRun, true);

    // Update line's next scheduled call
    if (completed && nextRun) {
      await supabase
        .from('ultaura_lines')
        .update({ next_scheduled_call_at: nextRun })
        .eq('id', schedule.line_id);
    }

  } catch (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to initiate scheduled call');

    const retryPolicy = schedule.retry_policy || { max_retries: 2, retry_window_minutes: 30 };
    const currentRetries = schedule.retry_count || 0;

    if (currentRetries < retryPolicy.max_retries) {
      // Schedule a retry
      const retryAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes

      const { error: retryError } = await supabase.rpc('increment_schedule_retry', {
        p_schedule_id: schedule.id,
        p_worker_id: WORKER_ID,
        p_next_run_at: retryAt.toISOString(),
      });

      if (retryError) {
        logger.error({ error: retryError, scheduleId: schedule.id }, 'Failed to schedule retry');
      } else {
        logger.info({ scheduleId: schedule.id, retryAt, attempt: currentRetries + 1 }, 'Scheduled retry');
      }
    } else {
      // Max retries exceeded, move to next scheduled time
      await completeScheduleWithResult(schedule, 'failed', calculateNextRun(schedule, line.timezone), true);
      logger.warn({ scheduleId: schedule.id }, 'Max retries exceeded for scheduled call');
    }
  }
}

/**
 * Complete schedule processing via RPC.
 */
async function completeScheduleWithResult(
  schedule: ScheduleRow,
  result: 'success' | 'missed' | 'suppressed_quiet_hours' | 'skipped' | 'suppressed_vacation' | 'failed',
  nextRunAt: string | null,
  resetRetryCount: boolean
): Promise<boolean> {
  const supabase = getSupabaseClient();
  scheduleOutcomesTotal.inc({ outcome: result });

  const { data: completed, error } = await supabase.rpc('complete_schedule_processing', {
    p_schedule_id: schedule.id,
    p_worker_id: WORKER_ID,
    p_result: result,
    p_next_run_at: nextRunAt,
    p_reset_retry_count: resetRetryCount,
  });

  if (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to complete schedule processing');
    return false;
  }

  if (!completed) {
    logger.warn({ scheduleId: schedule.id, workerId: WORKER_ID }, 'Claim lost during processing');
    return false;
  }

  return true;
}

/**
 * Calculate next run time based on schedule settings.
 */
function calculateNextRun(schedule: ScheduleRow, timezone: string): string | null {
  const { days_of_week, time_of_day } = schedule;

  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  try {
    const nextRun = getNextOccurrence({
      timeOfDay: time_of_day,
      timezone,
      daysOfWeek: days_of_week,
    });

    logger.debug({
      scheduleId: schedule.id,
      lineId: schedule.line_id,
      timezone,
      timeOfDay: time_of_day,
      daysOfWeek: days_of_week,
      resultUtc: nextRun.toISOString(),
      previousNextRunAt: schedule.next_run_at,
    }, 'Calculated next_run_at');

    return nextRun.toISOString();
  } catch (error) {
    logger.error({ error, scheduleId: schedule.id, timezone }, 'Failed to calculate next run');
    return null;
  }
}

/**
 * Process due reminders using atomic claim.
 */
async function processReminders(): Promise<void> {
  const supabase = getSupabaseClient();

  // Claim a batch of due reminders atomically
  const { data: claimedReminders, error } = await supabase.rpc('claim_due_reminders', {
    p_worker_id: WORKER_ID,
    p_batch_size: BATCH_SIZE,
    p_claim_ttl_seconds: CLAIM_TTL_SECONDS,
  });

  if (error) {
    logger.error({ error }, 'Failed to claim reminders');
    return;
  }

  if (!claimedReminders || claimedReminders.length === 0) {
    return;
  }

  logger.info({
    count: claimedReminders.length,
    workerId: WORKER_ID,
  }, 'Processing claimed reminders');

  for (const reminder of claimedReminders) {
    await processReminder(reminder as ReminderRow);
  }
}

/**
 * Process a single reminder with idempotency.
 */
async function processReminder(reminder: ReminderRow): Promise<void> {
  const supabase = getSupabaseClient();
  const configuredMethod = getReminderMetricMethod(reminder);

  // Generate idempotency key for this specific reminder occurrence
  const idempotencyKey = `reminder:${reminder.id}:${reminder.due_at}`;

  logger.info({
    reminderId: reminder.id,
    lineId: reminder.line_id,
    isRecurring: reminder.is_recurring,
    idempotencyKey,
    workerId: WORKER_ID,
  }, 'Processing reminder');

  // Get line info
  const lineWithAccount = await getLineById(reminder.line_id);
  if (!lineWithAccount) {
    logger.error({ reminderId: reminder.id }, 'Line not found for reminder');
    await handleReminderFailure(supabase, reminder, 'missed');
    return;
  }

  const { line, account } = lineWithAccount;

  if (isDateWithinVacation(reminder.due_at, line)) {
    logger.info({ reminderId: reminder.id, lineId: reminder.line_id }, 'Line on vacation, skipping reminder');
    reminderOutcomesTotal.inc({ outcome: 'suppressed_vacation', method: configuredMethod });

    if (reminder.is_recurring) {
      const nextDueAt = calculateNextReminderOccurrence(reminder, line.timezone);

      if (nextDueAt && (!reminder.ends_at || new Date(nextDueAt) <= new Date(reminder.ends_at))) {
        const { data: updated, error: updateError } = await supabase
          .from('ultaura_reminders')
          .update({
            due_at: nextDueAt,
            status: 'scheduled',
            occurrence_count: (reminder.occurrence_count || 0) + 1,
            current_snooze_count: 0,
            snoozed_until: null,
            original_due_at: null,
            delivery_retry_count: 0,
            next_delivery_attempt_at: null,
          })
          .eq('id', reminder.id)
          .eq('processing_claimed_by', WORKER_ID)
          .select('id')
          .maybeSingle();

        if (updateError) {
          logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
          await releaseReminderClaim(reminder.id);
          return;
        }

        if (!updated) {
          logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
          return;
        }

        await supabase.from('ultaura_reminder_events').insert({
          account_id: reminder.account_id,
          reminder_id: reminder.id,
          line_id: reminder.line_id,
          event_type: 'skipped',
          triggered_by: 'system',
          metadata: { reason: 'vacation', nextDueAt },
        });

        await releaseReminderClaim(reminder.id);
        return;
      }

      const { data: updated, error: updateError } = await supabase
        .from('ultaura_reminders')
        .update({
          status: 'missed',
          occurrence_count: (reminder.occurrence_count || 0) + 1,
          last_delivery_status: 'no_answer',
          current_snooze_count: 0,
          snoozed_until: null,
          original_due_at: null,
          delivery_retry_count: 0,
          next_delivery_attempt_at: null,
        })
        .eq('id', reminder.id)
        .eq('processing_claimed_by', WORKER_ID)
        .select('id')
        .maybeSingle();

      if (updateError) {
        logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
        await releaseReminderClaim(reminder.id);
        return;
      }

      if (!updated) {
        logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
        return;
      }

      await supabase.from('ultaura_reminder_events').insert({
        account_id: reminder.account_id,
        reminder_id: reminder.id,
        line_id: reminder.line_id,
        event_type: 'skipped',
        triggered_by: 'system',
        metadata: { reason: 'vacation' },
      });

      await releaseReminderClaim(reminder.id);
      return;
    }

    const { data: updated, error: updateError } = await supabase
      .from('ultaura_reminders')
      .update({
        status: 'missed',
        last_delivery_status: 'no_answer',
        current_snooze_count: 0,
        snoozed_until: null,
        original_due_at: null,
        delivery_retry_count: 0,
        next_delivery_attempt_at: null,
      })
      .eq('id', reminder.id)
      .eq('processing_claimed_by', WORKER_ID)
      .select('id')
      .maybeSingle();

    if (updateError) {
      logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update reminder');
      await releaseReminderClaim(reminder.id);
      return;
    }

    if (!updated) {
      logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
      return;
    }

    await supabase.from('ultaura_reminder_events').insert({
      account_id: reminder.account_id,
      reminder_id: reminder.id,
      line_id: reminder.line_id,
      event_type: 'skipped',
      triggered_by: 'system',
      metadata: { reason: 'vacation' },
    });

    await releaseReminderClaim(reminder.id);
    return;
  }

  if (configuredMethod === 'sms') {
    let smsBody: string | null = null;
    let smsFailurePolicy: SmsFailurePolicy | null = null;
    let lastSmsError: unknown = null;

    try {
      const rateLimitResult = await enforceRateLimit({
        action: 'sms',
        accountId: reminder.account_id,
        phoneNumber: line.phone_e164,
      });

      if (!rateLimitResult.allowed) {
        logger.warn(
          { reminderId: reminder.id, lineId: reminder.line_id, limitType: rateLimitResult.limitType },
          'SMS reminder rate limited'
        );
        reminderOutcomesTotal.inc({ outcome: 'rate_limited', method: 'sms' });
        smsFailurePolicy = {
          classification: 'rate_limited',
          allowInlineRetry: false,
          allowDelayedRetry: true,
          fallbackEligible: true,
        };
      } else {
        try {
          smsBody = await getReminderSmsBody(reminder, line.display_name);
        } catch (error) {
          lastSmsError = error;
          smsFailurePolicy = {
            classification: 'content',
            allowInlineRetry: false,
            allowDelayedRetry: false,
            fallbackEligible: false,
          };
        }

        if (smsBody) {
          let sendAttempt = 0;
          while (true) {
            try {
              await sendSms({
                to: line.phone_e164,
                body: smsBody,
              });

              reminderOutcomesTotal.inc({ outcome: 'success', method: 'sms' });
              logger.info({ reminderId: reminder.id, sendAttempt }, 'Reminder SMS sent');

              const updated = await handleReminderSuccess(supabase, reminder, line.timezone);
              if (!updated) {
                return;
              }

              await releaseReminderClaim(reminder.id);
              return;
            } catch (error) {
              lastSmsError = error;
              smsFailurePolicy = classifySmsFailure(error);

              if (smsFailurePolicy.classification === 'opt_out') {
                logger.info({ reminderId: reminder.id, lineId: reminder.line_id }, 'SMS opt-out detected, falling back to reminder call');
                break;
              }

              if (
                smsFailurePolicy.allowInlineRetry &&
                sendAttempt < SMS_INLINE_MAX_RETRIES
              ) {
                sendAttempt += 1;
                logger.warn(
                  {
                    reminderId: reminder.id,
                    lineId: reminder.line_id,
                    classification: smsFailurePolicy.classification,
                    sendAttempt,
                    delayMs: SMS_INLINE_RETRY_DELAY_MS,
                  },
                  'Retrying reminder SMS inline after send failure'
                );
                await delay(SMS_INLINE_RETRY_DELAY_MS);
                continue;
              }

              break;
            }
          }
        }
      }
    } catch (error) {
      lastSmsError = error;
      smsFailurePolicy = classifySmsFailure(error);
    }

    if (smsFailurePolicy) {
      const shouldQueueDelayedRetry =
        !reminder.is_recurring &&
        smsFailurePolicy.allowDelayedRetry;

      if (shouldQueueDelayedRetry) {
        const queued = await scheduleOneTimeReminderSmsDelayedRetry(
          supabase,
          reminder,
          smsFailurePolicy.classification
        );
        if (queued) {
          return;
        }
      }

      if (!smsFailurePolicy.fallbackEligible) {
        logger.error({
          error: lastSmsError,
          reminderId: reminder.id,
          classification: smsFailurePolicy.classification,
        }, 'Failed to send reminder SMS (no call fallback)');
        await handleReminderFailure(supabase, reminder, 'missed', line.timezone, 'sms');
        return;
      }

      if (!shouldQueueDelayedRetry) {
        if (
          smsFailurePolicy.classification !== 'opt_out' &&
          smsFailurePolicy.classification !== 'opt_out_lookup_unavailable'
        ) {
          logger.warn({
            reminderId: reminder.id,
            classification: smsFailurePolicy.classification,
            deliveryRetryCount: reminder.delivery_retry_count,
          }, 'SMS reminder retries exhausted, falling back to call');
        }
      }
    }
  }

  // Call-only checks (intentionally after SMS path so SMS reminders can bypass these unless falling back to call)
  if (line.do_not_call) {
    logger.info({ reminderId: reminder.id }, 'Line opted out, marking reminder missed');
    await handleReminderFailure(supabase, reminder, 'missed', line.timezone, 'call');
    return;
  }

  const accessCheck = await checkLineAccess(line, account, 'outbound', {
    skipTrialReservation: true,
  });
  if (!accessCheck.allowed) {
    logger.info({ reminderId: reminder.id, reason: accessCheck.reason }, 'Access denied for reminder');
    await handleReminderFailure(supabase, reminder, 'missed', line.timezone, 'call');
    return;
  }

  // Initiate reminder call
  try {
    const baseUrl = getBackendUrl();

    const response = await fetch(`${baseUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        lineId: reminder.line_id,
        reason: 'reminder',
        reminderId: reminder.id,
        schedulerIdempotencyKey: idempotencyKey,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as Record<string, unknown>;

      // Check for idempotency conflict
      if (errorData.code === 'DUPLICATE_SCHEDULED_CALL') {
        logger.warn({ reminderId: reminder.id, idempotencyKey }, 'Duplicate reminder call, already processed');
        reminderOutcomesTotal.inc({ outcome: 'success', method: 'call' });
        const updated = await handleReminderSuccess(supabase, reminder, line.timezone);
        if (updated) {
          await releaseReminderClaim(reminder.id);
        }
        return;
      }

      throw new Error('Failed to initiate reminder call');
    }

    reminderOutcomesTotal.inc({ outcome: 'success', method: 'call' });
    logger.info({ reminderId: reminder.id }, 'Reminder call initiated');

    const updated = await handleReminderSuccess(supabase, reminder, line.timezone);
    if (!updated) {
      return;
    }

    // Release the claim
    await releaseReminderClaim(reminder.id);

  } catch (error) {
    logger.error({ error, reminderId: reminder.id }, 'Failed to initiate reminder call');
    await handleReminderFailure(supabase, reminder, 'missed', line.timezone, 'call');
  }
}

/**
 * Release a reminder processing claim.
 */
async function releaseReminderClaim(reminderId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data: released, error } = await supabase.rpc('complete_reminder_processing', {
    p_reminder_id: reminderId,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.error({ error, reminderId }, 'Failed to release reminder claim');
    return false;
  }

  if (!released) {
    logger.warn({ reminderId, workerId: WORKER_ID }, 'Reminder claim already released or lost');
    return false;
  }

  return true;
}

/**
 * Handle successful delivery of a recurring reminder.
 * Calculates next occurrence and reschedules, or marks complete if past end date.
 */
async function handleRecurringReminderSuccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  reminder: ReminderRow,
  timezone: string
): Promise<boolean> {
  const nextDueAt = calculateNextReminderOccurrence(reminder, timezone);

  // Check if series should end (past end date or no next occurrence)
  if (!nextDueAt) {
    logger.info({ reminderId: reminder.id }, 'Recurring reminder has no next occurrence, marking sent');
    const { data: updated, error: updateError } = await supabase
      .from('ultaura_reminders')
      .update({
        status: 'sent',
        occurrence_count: (reminder.occurrence_count || 0) + 1,
        last_delivery_status: 'completed',
        delivery_retry_count: 0,
        next_delivery_attempt_at: null,
        current_snooze_count: 0,
        snoozed_until: null,
        original_due_at: null,
      })
      .eq('id', reminder.id)
      .eq('processing_claimed_by', WORKER_ID)
      .select('id')
      .maybeSingle();

    if (updateError) {
      logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
      await releaseReminderClaim(reminder.id);
      return false;
    }

    if (!updated) {
      logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
      return false;
    }

    // Log delivery event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: reminder.account_id,
      reminder_id: reminder.id,
      line_id: reminder.line_id,
      event_type: 'delivered',
      triggered_by: 'system',
    });
    return true;
  }

  if (reminder.ends_at && new Date(nextDueAt) > new Date(reminder.ends_at)) {
    logger.info({ reminderId: reminder.id, endsAt: reminder.ends_at }, 'Recurring reminder series complete');
    const { data: updated, error: updateError } = await supabase
      .from('ultaura_reminders')
      .update({
        status: 'sent',
        occurrence_count: (reminder.occurrence_count || 0) + 1,
        last_delivery_status: 'completed',
        delivery_retry_count: 0,
        next_delivery_attempt_at: null,
        current_snooze_count: 0,
        snoozed_until: null,
        original_due_at: null,
      })
      .eq('id', reminder.id)
      .eq('processing_claimed_by', WORKER_ID)
      .select('id')
      .maybeSingle();

    if (updateError) {
      logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
      await releaseReminderClaim(reminder.id);
      return false;
    }

    if (!updated) {
      logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
      return false;
    }

    // Log delivery event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: reminder.account_id,
      reminder_id: reminder.id,
      line_id: reminder.line_id,
      event_type: 'delivered',
      triggered_by: 'system',
    });
    return true;
  }

  // Reschedule for next occurrence - reset snooze state
  const { data: updated, error: updateError } = await supabase
    .from('ultaura_reminders')
    .update({
      due_at: nextDueAt,
      status: 'scheduled',
      occurrence_count: (reminder.occurrence_count || 0) + 1,
      last_delivery_status: 'completed',
      delivery_retry_count: 0,
      next_delivery_attempt_at: null,
      current_snooze_count: 0,
      snoozed_until: null,
      original_due_at: null,
    })
    .eq('id', reminder.id)
    .eq('processing_claimed_by', WORKER_ID)
    .select('id')
    .maybeSingle();

  if (updateError) {
    logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
    await releaseReminderClaim(reminder.id);
    return false;
  }

  if (!updated) {
    logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
    return false;
  }

  // Log delivery event
  await supabase.from('ultaura_reminder_events').insert({
    account_id: reminder.account_id,
    reminder_id: reminder.id,
    line_id: reminder.line_id,
    event_type: 'delivered',
    triggered_by: 'system',
    metadata: { nextDueAt },
  });

  logger.info({
    reminderId: reminder.id,
    nextDueAt,
    occurrenceCount: (reminder.occurrence_count || 0) + 1,
  }, 'Recurring reminder rescheduled');
  return true;
}

async function handleReminderSuccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  reminder: ReminderRow,
  timezone: string
): Promise<boolean> {
  if (reminder.is_recurring) {
    return handleRecurringReminderSuccess(supabase, reminder, timezone);
  }

  const { data: updated, error: updateError } = await supabase
    .from('ultaura_reminders')
    .update({
      status: 'sent',
      last_delivery_status: 'completed',
      delivery_retry_count: 0,
      next_delivery_attempt_at: null,
      current_snooze_count: 0,
      snoozed_until: null,
      original_due_at: null,
    })
    .eq('id', reminder.id)
    .eq('processing_claimed_by', WORKER_ID)
    .select('id')
    .maybeSingle();

  if (updateError) {
    logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update reminder');
    await releaseReminderClaim(reminder.id);
    return false;
  }

  if (!updated) {
    logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
    return false;
  }

  await supabase.from('ultaura_reminder_events').insert({
    account_id: reminder.account_id,
    reminder_id: reminder.id,
    line_id: reminder.line_id,
    event_type: 'delivered',
    triggered_by: 'system',
  });

  return true;
}

async function getReminderSmsBody(reminder: ReminderRow, recipientName?: string | null): Promise<string> {
  let messageText: string | null = null;

  if (reminder.message_ciphertext && reminder.message_iv && reminder.message_tag) {
    const decrypted = await decryptReminderMessage(
      reminder.account_id,
      reminder.line_id,
      reminder.id,
      {
        ciphertext: reminder.message_ciphertext,
        iv: reminder.message_iv,
        tag: reminder.message_tag,
      }
    );

    const trimmed = decrypted.trim();
    if (trimmed) {
      messageText = trimmed;
    }
  }

  if (!messageText) {
    const plaintext = reminder.message?.trim();
    if (plaintext) {
      messageText = plaintext;
    }
  }

  if (!messageText) {
    throw new Error('No message for SMS reminder');
  }

  const trimmedRecipientName = typeof recipientName === 'string' ? recipientName.trim() : '';
  const name = trimmedRecipientName || 'there';

  return `Hi ${name}, this is a reminder to ${messageText}. - Ultaura`;
}

/**
 * Handle reminder failure (missed or error).
 * For recurring reminders, still advances to next occurrence.
 */
async function handleReminderFailure(
  supabase: ReturnType<typeof getSupabaseClient>,
  reminder: ReminderRow,
  status: 'missed' | 'canceled',
  timezone?: string,
  method: ReminderMetricMethod = getReminderMetricMethod(reminder),
  options?: { skipOutcomeMetric?: boolean }
): Promise<void> {
  const eventType = status === 'missed' ? 'no_answer' : 'failed';
  const outcome = status === 'missed' ? 'missed' : 'failed';
  if (!options?.skipOutcomeMetric) {
    reminderOutcomesTotal.inc({ outcome, method });
  }

  if (reminder.is_recurring) {
    // For recurring reminders that fail, still advance to next occurrence
    const nextDueAt = calculateNextReminderOccurrence(reminder, timezone);

    if (nextDueAt && (!reminder.ends_at || new Date(nextDueAt) <= new Date(reminder.ends_at))) {
      const { data: updated, error: updateError } = await supabase
        .from('ultaura_reminders')
        .update({
          due_at: nextDueAt,
          status: 'scheduled',
          last_delivery_status: 'no_answer',
          delivery_retry_count: 0,
          next_delivery_attempt_at: null,
          current_snooze_count: 0,
          snoozed_until: null,
          original_due_at: null,
        })
        .eq('id', reminder.id)
        .eq('processing_claimed_by', WORKER_ID)
        .select('id')
        .maybeSingle();

      if (updateError) {
        logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
        await releaseReminderClaim(reminder.id);
        return;
      }

      if (!updated) {
        logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
        return;
      }

      // Log the failure event
      await supabase.from('ultaura_reminder_events').insert({
        account_id: reminder.account_id,
        reminder_id: reminder.id,
        line_id: reminder.line_id,
        event_type: eventType,
        triggered_by: 'system',
        metadata: { nextDueAt },
      });

      // Release the claim
      await releaseReminderClaim(reminder.id);

      logger.info({ reminderId: reminder.id, nextDueAt }, 'Recurring reminder missed, rescheduled for next occurrence');
      return;
    }
  }

  // One-time reminder or recurring with no next occurrence: mark as missed
  const { data: updated, error: updateError } = await supabase
    .from('ultaura_reminders')
    .update({
      status,
      last_delivery_status: status === 'missed' ? 'no_answer' : 'failed',
      delivery_retry_count: 0,
      next_delivery_attempt_at: null,
    })
    .eq('id', reminder.id)
    .eq('processing_claimed_by', WORKER_ID)
    .select('id')
    .maybeSingle();

  if (updateError) {
    logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update reminder');
    await releaseReminderClaim(reminder.id);
    return;
  }

  if (!updated) {
    logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
    return;
  }

  // Log the failure event
  await supabase.from('ultaura_reminder_events').insert({
    account_id: reminder.account_id,
    reminder_id: reminder.id,
    line_id: reminder.line_id,
    event_type: eventType,
    triggered_by: 'system',
  });

  // Release the claim
  await releaseReminderClaim(reminder.id);
}

// Test exports - only used by tests
export const __test__ = {
  runSchedulerCycle,
  processWithLease,
  processScheduledCalls,
  processReminders,
  processSchedule,
  processReminder,
  completeScheduleWithResult,
  releaseReminderClaim,
  handleRecurringReminderSuccess,
  handleReminderSuccess,
  handleReminderFailure,
  getReminderSmsBody,
  calculateNextRun,
  WORKER_ID,
  resetState: () => {
    heartbeatIntervals.forEach(interval => clearInterval(interval));
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    isRunning = false;
    shuttingDown = false;
    heartbeatIntervals = [];
    lastCleanupTimestamp = 0;
    lastBaselineRunDate = null;
    lastPersonaRunDate = null;
  },
  setShuttingDown: (value: boolean) => { shuttingDown = value; },
  setIsRunning: (value: boolean) => { isRunning = value; },
  clearLeaseExistenceCache: () => { leaseExistenceCache.clear(); },
  HEARTBEAT_INTERVAL_MS,
  LEASE_DURATION_SECONDS,
};
