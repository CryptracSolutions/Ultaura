// Call scheduler
// Polls database for due scheduled calls and initiates them

import cron from 'node-cron';
import { getSupabaseClient, ScheduleRow, ReminderRow } from '../utils/supabase.js';
import { logger } from '../server.js';
import { isInQuietHours, checkLineAccess, getLineById } from '../services/line-lookup.js';
import { getNextOccurrence, getNextReminderOccurrence } from '../utils/timezone.js';

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

const POLL_INTERVAL_SECONDS = 30;
const BATCH_SIZE = 10;

let isRunning = false;

// Start the scheduler
export function startScheduler(): void {
  logger.info('Starting call scheduler');

  // Run every 30 seconds
  cron.schedule(`*/${POLL_INTERVAL_SECONDS} * * * * *`, async () => {
    if (isRunning) {
      logger.debug('Scheduler already running, skipping');
      return;
    }

    isRunning = true;
    try {
      await processScheduledCalls();
      await processReminders();
    } catch (error) {
      logger.error({ error }, 'Scheduler error');
    } finally {
      isRunning = false;
    }
  });

  logger.info({ interval: POLL_INTERVAL_SECONDS }, 'Call scheduler started');
}

// Process due scheduled calls
async function processScheduledCalls(): Promise<void> {
  const supabase = getSupabaseClient();

  // Get due schedules with FOR UPDATE SKIP LOCKED pattern
  // Note: Supabase doesn't directly support FOR UPDATE SKIP LOCKED,
  // so we use a transaction-like approach with status updates

  const now = new Date().toISOString();

  // Find due schedules
  const { data: dueSchedules, error } = await supabase
    .from('ultaura_schedules')
    .select('*')
    .eq('enabled', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error({ error }, 'Failed to fetch due schedules');
    return;
  }

  if (!dueSchedules || dueSchedules.length === 0) {
    return;
  }

  logger.info({ count: dueSchedules.length }, 'Processing due schedules');

  for (const schedule of dueSchedules) {
    await processSchedule(schedule);
  }
}

// Process a single schedule
async function processSchedule(schedule: ScheduleRow): Promise<void> {
  const supabase = getSupabaseClient();

  logger.info({ scheduleId: schedule.id, lineId: schedule.line_id }, 'Processing schedule');

  // Get line info
  const lineWithAccount = await getLineById(schedule.line_id);
  if (!lineWithAccount) {
    logger.error({ scheduleId: schedule.id, lineId: schedule.line_id }, 'Line not found');
    await updateScheduleResult(schedule.id, 'failed', null);
    return;
  }

  const { line, account } = lineWithAccount;

  // Check if line is opted out
  if (line.do_not_call) {
    logger.info({ scheduleId: schedule.id }, 'Line opted out, skipping');
    await updateScheduleResult(schedule.id, 'suppressed_quiet_hours', calculateNextRun(schedule));
    return;
  }

  // Check quiet hours
  if (isInQuietHours(line)) {
    logger.info({ scheduleId: schedule.id }, 'In quiet hours, skipping');
    await updateScheduleResult(schedule.id, 'suppressed_quiet_hours', calculateNextRun(schedule));
    return;
  }

  // Check access (minutes, status, etc.)
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed) {
    logger.info({ scheduleId: schedule.id, reason: accessCheck.reason }, 'Access denied, skipping');
    await updateScheduleResult(schedule.id, 'failed', calculateNextRun(schedule));
    return;
  }

  // Initiate the call
  try {
    const baseUrl = process.env.TELEPHONY_BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

    const response = await fetch(`${baseUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        lineId: schedule.line_id,
        reason: 'scheduled',
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json();
      throw new Error(errorData.error || 'Failed to initiate call');
    }

    const result: any = await response.json();
    logger.info({ scheduleId: schedule.id, sessionId: result.sessionId }, 'Scheduled call initiated');

    // Update schedule
    await updateScheduleResult(schedule.id, 'success', calculateNextRun(schedule));

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

    // Check if we should retry
    const currentRetries = schedule.retry_count || 0;

    if (currentRetries < retryPolicy.max_retries) {
      // Schedule a retry
      const retryAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes

      await supabase
        .from('ultaura_schedules')
        .update({
          last_run_at: new Date().toISOString(),
          last_result: 'failed',
          next_run_at: retryAt.toISOString(),
          retry_count: currentRetries + 1,
        })
        .eq('id', schedule.id);

      logger.info({ scheduleId: schedule.id, retryAt, attempt: currentRetries + 1 }, 'Scheduled retry');
    } else {
      // Max retries exceeded, move to next scheduled time
      await updateScheduleResult(schedule.id, 'failed', calculateNextRun(schedule));

      // Reset retry count
      await supabase
        .from('ultaura_schedules')
        .update({ retry_count: 0 })
        .eq('id', schedule.id);

      logger.warn({ scheduleId: schedule.id }, 'Max retries exceeded for scheduled call');
    }
  }
}

// Update schedule after processing
async function updateScheduleResult(
  scheduleId: string,
  result: 'success' | 'missed' | 'suppressed_quiet_hours' | 'failed',
  nextRunAt: string | null
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('ultaura_schedules')
    .update({
      last_run_at: new Date().toISOString(),
      last_result: result,
      next_run_at: nextRunAt,
    })
    .eq('id', scheduleId);

  if (error) {
    logger.error({ error, scheduleId }, 'Failed to update schedule result');
  }
}

// Calculate next run time based on RRULE
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

    logger.debug(
      {
        scheduleId: schedule.id,
        lineId: schedule.line_id,
        timezone,
        timeOfDay: time_of_day,
        daysOfWeek: days_of_week,
        resultUtc: nextRun.toISOString(),
        previousNextRunAt: schedule.next_run_at,
      },
      'Calculated next_run_at'
    );

    return nextRun.toISOString();
  } catch (error) {
    logger.error({ error, scheduleId: schedule.id, timezone }, 'Failed to calculate next run');
    return null;
  }
}

// Process due reminders
async function processReminders(): Promise<void> {
  const supabase = getSupabaseClient();

  const now = new Date().toISOString();

  // Find due reminders (not paused, not snoozed)
  const { data: dueReminders, error } = await supabase
    .from('ultaura_reminders')
    .select('*')
    .eq('status', 'scheduled')
    .eq('is_paused', false)
    .lte('due_at', now)
    .or(`snoozed_until.is.null,snoozed_until.lte.${now}`)
    .limit(BATCH_SIZE);

  if (error) {
    logger.error({ error }, 'Failed to fetch due reminders');
    return;
  }

  if (!dueReminders || dueReminders.length === 0) {
    return;
  }

  logger.info({ count: dueReminders.length }, 'Processing due reminders');

  for (const reminder of dueReminders) {
    await processReminder(reminder);
  }
}

// Process a single reminder
async function processReminder(reminder: ReminderRow): Promise<void> {
  const supabase = getSupabaseClient();

  logger.info({
    reminderId: reminder.id,
    lineId: reminder.line_id,
    isRecurring: reminder.is_recurring,
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

  // Check access
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed) {
    logger.info({ reminderId: reminder.id, reason: accessCheck.reason }, 'Access denied for reminder');
    await handleReminderFailure(supabase, reminder, 'missed');
    return;
  }

  // Initiate reminder call
  try {
    const baseUrl = process.env.TELEPHONY_BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

    const response = await fetch(`${baseUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        lineId: reminder.line_id,
        reason: 'reminder',
        reminderId: reminder.id,
        reminderMessage: reminder.message,
      }),
    });

    if (!response.ok) {
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

  } catch (error) {
    logger.error({ error, reminderId: reminder.id }, 'Failed to initiate reminder call');
    await handleReminderFailure(supabase, reminder, 'missed');
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
    // so we don't keep trying the same failed occurrence
    const nextDueAt = calculateNextReminderOccurrence(reminder);

    if (nextDueAt && (!reminder.ends_at || new Date(nextDueAt) <= new Date(reminder.ends_at))) {
      await supabase
        .from('ultaura_reminders')
        .update({
          due_at: nextDueAt,
          status: 'scheduled',
          last_delivery_status: 'no_answer',
          // Don't increment occurrence_count since this one was missed
          // Reset snooze count for next occurrence
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
}
