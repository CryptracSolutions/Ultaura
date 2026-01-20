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
import { getNextOccurrence, getNextReminderOccurrence } from '../utils/timezone.js';
import { activeLeases, leaseAcquisitions, leaseHoldDuration } from '../utils/metrics.js';

// Configuration
const POLL_INTERVAL_MS = 30_000; // 30 seconds
const LEASE_DURATION_SECONDS = 60;
const HEARTBEAT_INTERVAL_MS = 20_000; // 20 seconds
const CLAIM_TTL_SECONDS = 120;
const BATCH_SIZE = 10;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
// SECURITY: Short retention period to minimize exposure window for debug data.
// Debug logs may contain operational metadata that could be sensitive.
const DEBUG_LOG_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;

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

/**
 * Calculate the next occurrence for a recurring reminder.
 * Returns ISO string in UTC, or null if no next occurrence.
 */
function calculateNextReminderOccurrence(reminder: ReminderRow): string | null {
  const { rrule, interval_days, days_of_week, day_of_month, time_of_day, timezone, due_at } = reminder;

  if (!reminder.is_recurring || !rrule || !time_of_day) {
    return null;
  }

  try {
    const nextUtc = getNextReminderOccurrence({
      rrule,
      timezone,
      timeOfDay: time_of_day,
      currentDueAt: new Date(due_at),
      daysOfWeek: days_of_week,
      dayOfMonth: day_of_month,
      intervalDays: interval_days,
    });
    return nextUtc ? nextUtc.toISOString() : null;
  } catch (error) {
    logger.error({ error, reminderId: reminder.id, timezone }, 'Failed to calculate next reminder occurrence');
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
    leaseAcquisitions.labels(leaseId, WORKER_ID, 'held').inc();
    logger.debug({ leaseId, workerId: WORKER_ID }, 'Lease held by another worker');
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
    const nextRun = calculateNextRun(schedule);
    await completeScheduleWithResult(schedule, 'suppressed_vacation', nextRun, true);
    if (nextRun) {
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
    await completeScheduleWithResult(schedule, 'suppressed_quiet_hours', calculateNextRun(schedule), false);
    return;
  }

  // Check quiet hours
  if (isInQuietHours(line)) {
    logger.info({ scheduleId: schedule.id }, 'In quiet hours, skipping');
    await completeScheduleWithResult(schedule, 'suppressed_quiet_hours', calculateNextRun(schedule), false);
    return;
  }

  // Check access (minutes, status, etc.)
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed) {
    logger.info({ scheduleId: schedule.id, reason: accessCheck.reason }, 'Access denied, skipping');
    await completeScheduleWithResult(schedule, 'failed', calculateNextRun(schedule), false);
    return;
  }

  const localDate = schedule.next_run_at
    ? DateTime.fromISO(schedule.next_run_at).setZone(schedule.timezone).toISODate()
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
        const { error: updateError } = await supabase
          .from('ultaura_schedules')
          .update({
            next_run_at: exception.new_datetime,
            retry_count: 0,
            processing_claimed_by: null,
            processing_claimed_at: null,
          })
          .eq('id', schedule.id)
          .eq('processing_claimed_by', WORKER_ID);

        if (updateError) {
          logger.error({ error: updateError, scheduleId: schedule.id }, 'Failed to apply snooze exception');
        } else {
          await supabase
            .from('ultaura_lines')
            .update({ next_scheduled_call_at: exception.new_datetime })
            .eq('id', schedule.line_id);
        }
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
      const nextRun = calculateNextRun(schedule);
      await completeScheduleWithResult(schedule, 'skipped', nextRun, true);
      if (nextRun) {
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
        await completeScheduleWithResult(schedule, 'success', calculateNextRun(schedule), true);
        return;
      }

      throw new Error((errorData.error as string) || 'Failed to initiate call');
    }

    const result = (await response.json()) as Record<string, unknown>;
    logger.info({ scheduleId: schedule.id, sessionId: result.sessionId }, 'Scheduled call initiated');

    // Update schedule
    await completeScheduleWithResult(schedule, 'success', calculateNextRun(schedule), true);

    // Update line's next scheduled call
    const nextRun = calculateNextRun(schedule);
    if (nextRun) {
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
      await completeScheduleWithResult(schedule, 'failed', calculateNextRun(schedule), true);
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
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('complete_schedule_processing', {
    p_schedule_id: schedule.id,
    p_worker_id: WORKER_ID,
    p_result: result,
    p_next_run_at: nextRunAt,
    p_reset_retry_count: resetRetryCount,
  });

  if (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to complete schedule processing');
  }
}

/**
 * Calculate next run time based on schedule settings.
 */
function calculateNextRun(schedule: ScheduleRow): string | null {
  const { days_of_week, time_of_day, timezone } = schedule;

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

  // Check if line is opted out
  if (line.do_not_call) {
    logger.info({ reminderId: reminder.id }, 'Line opted out, marking reminder missed');
    await handleReminderFailure(supabase, reminder, 'missed');
    return;
  }

  if (isDateWithinVacation(reminder.due_at, line)) {
    logger.info({ reminderId: reminder.id, lineId: reminder.line_id }, 'Line on vacation, skipping reminder');

    if (reminder.is_recurring) {
      const nextDueAt = calculateNextReminderOccurrence(reminder);

      if (nextDueAt && (!reminder.ends_at || new Date(nextDueAt) <= new Date(reminder.ends_at))) {
        await supabase
          .from('ultaura_reminders')
          .update({
            due_at: nextDueAt,
            status: 'scheduled',
            occurrence_count: (reminder.occurrence_count || 0) + 1,
            current_snooze_count: 0,
            snoozed_until: null,
            original_due_at: null,
          })
          .eq('id', reminder.id);

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

      await supabase
        .from('ultaura_reminders')
        .update({
          status: 'missed',
          occurrence_count: (reminder.occurrence_count || 0) + 1,
          last_delivery_status: 'no_answer',
          current_snooze_count: 0,
          snoozed_until: null,
          original_due_at: null,
        })
        .eq('id', reminder.id);

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

    await supabase
      .from('ultaura_reminders')
      .update({
        status: 'missed',
        last_delivery_status: 'no_answer',
        current_snooze_count: 0,
        snoozed_until: null,
        original_due_at: null,
      })
      .eq('id', reminder.id);

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

  // Check access
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed) {
    logger.info({ reminderId: reminder.id, reason: accessCheck.reason }, 'Access denied for reminder');
    await handleReminderFailure(supabase, reminder, 'missed');
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
        // Still need to handle recurring logic
        if (reminder.is_recurring) {
          await handleRecurringReminderSuccess(supabase, reminder);
        } else {
          await supabase
            .from('ultaura_reminders')
            .update({ status: 'sent', last_delivery_status: 'completed' })
            .eq('id', reminder.id);
        }
        await releaseReminderClaim(reminder.id);
        return;
      }

      throw new Error('Failed to initiate reminder call');
    }

    logger.info({ reminderId: reminder.id }, 'Reminder call initiated');

    // Handle recurring vs one-time reminders
    if (reminder.is_recurring) {
      await handleRecurringReminderSuccess(supabase, reminder);
    } else {
      // One-time reminder: mark as sent
      await supabase
        .from('ultaura_reminders')
        .update({
          status: 'sent',
          last_delivery_status: 'completed',
          current_snooze_count: 0,
          snoozed_until: null,
          original_due_at: null,
        })
        .eq('id', reminder.id);

      // Log delivery event
      await supabase.from('ultaura_reminder_events').insert({
        account_id: reminder.account_id,
        reminder_id: reminder.id,
        line_id: reminder.line_id,
        event_type: 'delivered',
        triggered_by: 'system',
      });
    }

    // Release the claim
    await releaseReminderClaim(reminder.id);

  } catch (error) {
    logger.error({ error, reminderId: reminder.id }, 'Failed to initiate reminder call');
    await handleReminderFailure(supabase, reminder, 'missed');
  }
}

/**
 * Release a reminder processing claim.
 */
async function releaseReminderClaim(reminderId: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.rpc('complete_reminder_processing', {
    p_reminder_id: reminderId,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.error({ error, reminderId }, 'Failed to release reminder claim');
  }
}

/**
 * Handle successful delivery of a recurring reminder.
 * Calculates next occurrence and reschedules, or marks complete if past end date.
 */
async function handleRecurringReminderSuccess(
  supabase: ReturnType<typeof getSupabaseClient>,
  reminder: ReminderRow
): Promise<void> {
  const nextDueAt = calculateNextReminderOccurrence(reminder);

  // Check if series should end (past end date or no next occurrence)
  if (!nextDueAt) {
    logger.info({ reminderId: reminder.id }, 'Recurring reminder has no next occurrence, marking sent');
    await supabase
      .from('ultaura_reminders')
      .update({
        status: 'sent',
        occurrence_count: (reminder.occurrence_count || 0) + 1,
        last_delivery_status: 'completed',
        current_snooze_count: 0,
        snoozed_until: null,
        original_due_at: null,
      })
      .eq('id', reminder.id);

    // Log delivery event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: reminder.account_id,
      reminder_id: reminder.id,
      line_id: reminder.line_id,
      event_type: 'delivered',
      triggered_by: 'system',
    });
    return;
  }

  if (reminder.ends_at && new Date(nextDueAt) > new Date(reminder.ends_at)) {
    logger.info({ reminderId: reminder.id, endsAt: reminder.ends_at }, 'Recurring reminder series complete');
    await supabase
      .from('ultaura_reminders')
      .update({
        status: 'sent',
        occurrence_count: (reminder.occurrence_count || 0) + 1,
        last_delivery_status: 'completed',
        current_snooze_count: 0,
        snoozed_until: null,
        original_due_at: null,
      })
      .eq('id', reminder.id);

    // Log delivery event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: reminder.account_id,
      reminder_id: reminder.id,
      line_id: reminder.line_id,
      event_type: 'delivered',
      triggered_by: 'system',
    });
    return;
  }

  // Reschedule for next occurrence - reset snooze state
  await supabase
    .from('ultaura_reminders')
    .update({
      due_at: nextDueAt,
      status: 'scheduled',
      occurrence_count: (reminder.occurrence_count || 0) + 1,
      last_delivery_status: 'completed',
      current_snooze_count: 0,
      snoozed_until: null,
      original_due_at: null,
    })
    .eq('id', reminder.id);

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
}

/**
 * Handle reminder failure (missed or error).
 * For recurring reminders, still advances to next occurrence.
 */
async function handleReminderFailure(
  supabase: ReturnType<typeof getSupabaseClient>,
  reminder: ReminderRow,
  status: 'missed' | 'canceled'
): Promise<void> {
  const eventType = status === 'missed' ? 'no_answer' : 'failed';

  if (reminder.is_recurring) {
    // For recurring reminders that fail, still advance to next occurrence
    const nextDueAt = calculateNextReminderOccurrence(reminder);

    if (nextDueAt && (!reminder.ends_at || new Date(nextDueAt) <= new Date(reminder.ends_at))) {
      await supabase
        .from('ultaura_reminders')
        .update({
          due_at: nextDueAt,
          status: 'scheduled',
          last_delivery_status: 'no_answer',
          current_snooze_count: 0,
          snoozed_until: null,
          original_due_at: null,
        })
        .eq('id', reminder.id);

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
  await supabase
    .from('ultaura_reminders')
    .update({
      status,
      last_delivery_status: status === 'missed' ? 'no_answer' : 'failed',
    })
    .eq('id', reminder.id);

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
