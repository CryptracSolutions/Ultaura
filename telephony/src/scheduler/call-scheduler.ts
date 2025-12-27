// Call scheduler
// Polls database for due scheduled calls and initiates them

import cron from 'node-cron';
import { getSupabaseClient, ScheduleRow, ReminderRow } from '../utils/supabase.js';
import { logger } from '../server.js';
import { isInQuietHours, checkLineAccess, getLineById } from '../services/line-lookup.js';

/**
 * Convert a local datetime string to UTC Date, respecting the given timezone.
 * Used for calculating next reminder occurrences in the correct timezone.
 */
function localToUtc(localDateTimeStr: string, timezone: string): Date {
  const match = localDateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error('Invalid datetime format');
  }

  const [, year, month, day, hour, minute, second = '00'] = match;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const roughUtc = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  const parts = formatter.formatToParts(roughUtc);
  const formatted: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      formatted[part.type] = part.value;
    }
  }

  const localInTz = new Date(
    `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}:${formatted.second}Z`
  );
  const offsetMs = localInTz.getTime() - roughUtc.getTime();

  const targetLocalMs = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
  return new Date(targetLocalMs - offsetMs);
}

/**
 * Get the number of days in a given month.
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Calculate the next occurrence for a recurring reminder.
 * Returns ISO string in UTC, or null if no next occurrence.
 */
function calculateNextReminderOccurrence(reminder: ReminderRow): string | null {
  const { rrule, interval_days, days_of_week, day_of_month, time_of_day, timezone, due_at } = reminder;

  if (!reminder.is_recurring || !rrule || !time_of_day) {
    return null;
  }

  // Parse current due_at to get a reference date
  const currentDueAt = new Date(due_at);

  // Parse RRULE to determine frequency
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);

  const freq = freqMatch?.[1] || 'DAILY';
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : (interval_days || 1);

  // Get current date in the reminder's timezone for calculations
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });

  const parts = formatter.formatToParts(currentDueAt);
  const dateParts: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      dateParts[part.type] = part.value;
    }
  }

  let nextYear = parseInt(dateParts.year);
  let nextMonth = parseInt(dateParts.month) - 1; // 0-indexed
  let nextDay = parseInt(dateParts.day);

  switch (freq) {
    case 'DAILY':
      // Add interval days
      {
        const nextDate = new Date(nextYear, nextMonth, nextDay + interval);
        nextYear = nextDate.getFullYear();
        nextMonth = nextDate.getMonth();
        nextDay = nextDate.getDate();
      }
      break;

    case 'WEEKLY':
      if (days_of_week && days_of_week.length > 0) {
        // Start from tomorrow and find next matching day
        let tempDate = new Date(nextYear, nextMonth, nextDay + 1);
        let attempts = 0;

        while (!days_of_week.includes(tempDate.getDay()) && attempts < 14) {
          tempDate.setDate(tempDate.getDate() + 1);
          attempts++;
        }

        // If interval > 1, skip additional weeks
        if (interval > 1) {
          tempDate.setDate(tempDate.getDate() + (interval - 1) * 7);
        }

        nextYear = tempDate.getFullYear();
        nextMonth = tempDate.getMonth();
        nextDay = tempDate.getDate();
      } else {
        // Simple weekly: add 7 * interval days
        const nextDate = new Date(nextYear, nextMonth, nextDay + 7 * interval);
        nextYear = nextDate.getFullYear();
        nextMonth = nextDate.getMonth();
        nextDay = nextDate.getDate();
      }
      break;

    case 'MONTHLY':
      {
        // Move to next month (or N months if interval > 1)
        nextMonth += interval;
        while (nextMonth > 11) {
          nextMonth -= 12;
          nextYear++;
        }

        // Use specified day_of_month or current day
        const targetDay = day_of_month || parseInt(dateParts.day);
        const maxDays = getDaysInMonth(nextYear, nextMonth);
        nextDay = Math.min(targetDay, maxDays);
      }
      break;

    default:
      logger.warn({ freq, rrule }, 'Unknown frequency in RRULE');
      return null;
  }

  // Build the local datetime string and convert to UTC
  const localDateTimeStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}T${time_of_day}:00`;

  try {
    const nextUtc = localToUtc(localDateTimeStr, timezone);
    return nextUtc.toISOString();
  } catch (error) {
    logger.error({ error, localDateTimeStr, timezone }, 'Failed to calculate next reminder occurrence');
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
  const { days_of_week, time_of_day } = schedule;

  // Simple implementation for weekly schedules
  // In production, use a proper RRULE parser like rrule.js

  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  const [hours, minutes] = time_of_day.split(':').map(Number);

  // Start from tomorrow
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(hours, minutes, 0, 0);

  // Find the next matching day
  let attempts = 0;
  while (!days_of_week.includes(next.getDay()) && attempts < 7) {
    next.setDate(next.getDate() + 1);
    attempts++;
  }

  if (attempts >= 7) {
    return null;
  }

  return next.toISOString();
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
