// Call scheduler
// Polls database for due scheduled calls and initiates them

import cron from 'node-cron';
import { getSupabaseClient, ScheduleRow } from '../utils/supabase.js';
import { logger } from '../server.js';
import { isInQuietHours, checkLineAccess, getLineById } from '../services/line-lookup.js';

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

  // Find due reminders
  const { data: dueReminders, error } = await supabase
    .from('ultaura_reminders')
    .select('*')
    .eq('status', 'scheduled')
    .lte('due_at', now)
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
async function processReminder(reminder: {
  id: string;
  account_id: string;
  line_id: string;
  message: string;
}): Promise<void> {
  const supabase = getSupabaseClient();

  logger.info({ reminderId: reminder.id, lineId: reminder.line_id }, 'Processing reminder');

  // Get line info
  const lineWithAccount = await getLineById(reminder.line_id);
  if (!lineWithAccount) {
    logger.error({ reminderId: reminder.id }, 'Line not found for reminder');
    await supabase
      .from('ultaura_reminders')
      .update({ status: 'missed' })
      .eq('id', reminder.id);
    return;
  }

  const { line, account } = lineWithAccount;

  // Check if line is opted out
  if (line.do_not_call) {
    logger.info({ reminderId: reminder.id }, 'Line opted out, marking reminder missed');
    await supabase
      .from('ultaura_reminders')
      .update({ status: 'missed' })
      .eq('id', reminder.id);
    return;
  }

  // Check access
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed) {
    logger.info({ reminderId: reminder.id, reason: accessCheck.reason }, 'Access denied for reminder');
    await supabase
      .from('ultaura_reminders')
      .update({ status: 'missed' })
      .eq('id', reminder.id);
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
        reminderMessage: reminder.message,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to initiate reminder call');
    }

    // Mark reminder as sent
    await supabase
      .from('ultaura_reminders')
      .update({ status: 'sent' })
      .eq('id', reminder.id);

    logger.info({ reminderId: reminder.id }, 'Reminder call initiated');

  } catch (error) {
    logger.error({ error, reminderId: reminder.id }, 'Failed to initiate reminder call');

    // Mark as missed
    await supabase
      .from('ultaura_reminders')
      .update({ status: 'missed' })
      .eq('id', reminder.id);
  }
}
