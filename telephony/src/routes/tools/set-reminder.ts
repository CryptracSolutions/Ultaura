// Set reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

/**
 * Convert a local datetime string to UTC Date, respecting the given timezone.
 *
 * @param localDateTimeStr - ISO-like string without timezone (e.g., "2025-12-27T14:00:00")
 * @param timezone - IANA timezone name (e.g., "America/New_York")
 * @returns Date object in UTC
 */
function localToUtc(localDateTimeStr: string, timezone: string): Date {
  // Parse the local datetime components
  const match = localDateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error('Invalid datetime format');
  }

  const [, year, month, day, hour, minute, second = '00'] = match;

  // Create a formatter that will tell us the offset for this timezone at this datetime
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

  // Create a rough UTC estimate first
  const roughUtc = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);

  // Get the timezone offset by comparing formatted local time with UTC
  const parts = formatter.formatToParts(roughUtc);
  const formatted: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      formatted[part.type] = part.value;
    }
  }

  // Calculate offset: what time does the timezone show when it's roughUtc in UTC?
  const localInTz = new Date(
    `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}:${formatted.second}Z`
  );
  const offsetMs = localInTz.getTime() - roughUtc.getTime();

  // The actual UTC time is: local time minus the offset
  const targetLocalMs = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
  return new Date(targetLocalMs - offsetMs);
}

export const setReminderRouter = Router();

interface SetReminderRequest {
  callSessionId: string;
  lineId: string;
  dueAtLocal: string; // ISO datetime in local time
  timezone: string;
  message: string;
  privacyScope?: 'line_only' | 'shareable_with_payer';
  // Recurrence fields
  isRecurring?: boolean;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  endsAtLocal?: string;
}

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

/**
 * Build RRULE string and related fields from recurrence parameters.
 */
function buildRecurrenceFields(
  frequency: RecurrenceFrequency,
  interval: number | undefined,
  daysOfWeek: number[] | undefined,
  dayOfMonth: number | undefined,
  dueAt: Date
): {
  rrule: string;
  intervalDays: number | null;
  daysOfWeekVal: number[] | null;
  dayOfMonthVal: number | null;
} {
  const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  let rrule: string;
  let intervalDays: number | null = null;
  let daysOfWeekVal: number[] | null = null;
  let dayOfMonthVal: number | null = null;

  switch (frequency) {
    case 'daily':
      intervalDays = interval || 1;
      rrule = intervalDays > 1 ? `FREQ=DAILY;INTERVAL=${intervalDays}` : 'FREQ=DAILY';
      break;

    case 'weekly':
      daysOfWeekVal = daysOfWeek && daysOfWeek.length > 0 ? daysOfWeek : [dueAt.getDay()];
      const byDay = daysOfWeekVal.map(d => dayNames[d]).join(',');
      if (interval && interval > 1) {
        rrule = `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`;
      } else {
        rrule = `FREQ=WEEKLY;BYDAY=${byDay}`;
      }
      break;

    case 'monthly':
      dayOfMonthVal = dayOfMonth || dueAt.getDate();
      if (interval && interval > 1) {
        rrule = `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${dayOfMonthVal}`;
      } else {
        rrule = `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonthVal}`;
      }
      break;

    case 'custom':
      intervalDays = interval || 1;
      rrule = `FREQ=DAILY;INTERVAL=${intervalDays}`;
      break;

    default:
      rrule = 'FREQ=DAILY';
      intervalDays = 1;
  }

  return { rrule, intervalDays, daysOfWeekVal, dayOfMonthVal };
}

setReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      dueAtLocal,
      timezone,
      message,
      privacyScope = 'line_only',
      // Recurrence fields
      isRecurring = false,
      frequency,
      interval,
      daysOfWeek,
      dayOfMonth,
      endsAtLocal,
    } = req.body as SetReminderRequest;

    logger.info({
      callSessionId,
      lineId,
      dueAtLocal,
      message,
      isRecurring,
      frequency,
    }, 'Set reminder request');

    // Validate required fields
    if (!callSessionId || !lineId || !dueAtLocal || !message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get call session to verify and get account ID
    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // Parse the due date, converting from user's local time to UTC
    let dueAt: Date;
    try {
      const tz = timezone || 'America/Los_Angeles';
      dueAt = localToUtc(dueAtLocal, tz);
      logger.info({ dueAtLocal, timezone: tz, dueAtUtc: dueAt.toISOString() }, 'Parsed reminder due date');
    } catch (parseError) {
      logger.error({ parseError, dueAtLocal, timezone }, 'Failed to parse reminder due date');
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    // Check if due date is in the past
    if (dueAt.getTime() < Date.now()) {
      logger.warn({
        dueAtLocal,
        dueAtUtc: dueAt.toISOString(),
        now: new Date().toISOString(),
        diffMs: dueAt.getTime() - Date.now(),
        timezone,
        callSessionId,
      }, 'Reminder rejected: due date is in the past');
      res.status(400).json({ error: 'Due date is in the past' });
      return;
    }

    const supabase = getSupabaseClient();
    const tz = timezone || 'America/Los_Angeles';

    // Build recurrence fields if this is a recurring reminder
    let rrule: string | null = null;
    let intervalDays: number | null = null;
    let daysOfWeekVal: number[] | null = null;
    let dayOfMonthVal: number | null = null;
    let timeOfDay: string | null = null;
    let endsAt: string | null = null;

    if (isRecurring && frequency) {
      const recurrenceFields = buildRecurrenceFields(frequency, interval, daysOfWeek, dayOfMonth, dueAt);
      rrule = recurrenceFields.rrule;
      intervalDays = recurrenceFields.intervalDays;
      daysOfWeekVal = recurrenceFields.daysOfWeekVal;
      dayOfMonthVal = recurrenceFields.dayOfMonthVal;

      // Extract time from dueAtLocal for recurring reminders
      const timeMatch = dueAtLocal.match(/T(\d{2}:\d{2})/);
      timeOfDay = timeMatch ? timeMatch[1] : '09:00';

      // Convert end date if provided
      if (endsAtLocal) {
        try {
          endsAt = localToUtc(endsAtLocal, tz).toISOString();
        } catch {
          logger.warn({ endsAtLocal }, 'Failed to parse end date, ignoring');
        }
      }

      logger.info({
        rrule,
        intervalDays,
        daysOfWeekVal,
        dayOfMonthVal,
        timeOfDay,
        endsAt,
      }, 'Built recurrence fields');
    }

    // Create the reminder
    const { data: reminder, error } = await supabase
      .from('ultaura_reminders')
      .insert({
        account_id: session.account_id,
        line_id: lineId,
        due_at: dueAt.toISOString(),
        timezone: tz,
        message: message.slice(0, 500), // Limit message length
        delivery_method: 'outbound_call',
        status: 'scheduled',
        privacy_scope: privacyScope,
        created_by_call_session_id: callSessionId,
        // Recurrence fields
        is_recurring: isRecurring,
        rrule,
        interval_days: intervalDays,
        days_of_week: daysOfWeekVal,
        day_of_month: dayOfMonthVal,
        time_of_day: timeOfDay,
        ends_at: endsAt,
      })
      .select()
      .single();

    if (error) {
      logger.error({
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        insertData: {
          account_id: session.account_id,
          line_id: lineId,
          due_at: dueAt.toISOString(),
          timezone: timezone || 'America/Los_Angeles',
          message: message.slice(0, 50) + '...', // Truncate for logging
          created_by_call_session_id: callSessionId,
        },
      }, 'Failed to create reminder');
      res.status(500).json({ error: 'Failed to create reminder', details: error.message });
      return;
    }

    // Record tool invocation
    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_reminder',
      reminderId: reminder.id,
      dueAt: reminder.due_at,
    });

    logger.info({ reminderId: reminder.id, dueAt: reminder.due_at }, 'Reminder created');

    // Build response message
    let responseMessage = `Reminder set for ${dueAt.toLocaleString()}`;
    if (isRecurring && rrule) {
      if (frequency === 'daily') {
        responseMessage = intervalDays && intervalDays > 1
          ? `Recurring reminder set: every ${intervalDays} days starting ${dueAt.toLocaleString()}`
          : `Recurring reminder set: daily starting ${dueAt.toLocaleString()}`;
      } else if (frequency === 'weekly') {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const days = daysOfWeekVal?.map(d => dayNames[d]).join(', ') || '';
        responseMessage = `Recurring reminder set: every ${days} starting ${dueAt.toLocaleString()}`;
      } else if (frequency === 'monthly') {
        responseMessage = `Recurring reminder set: monthly on day ${dayOfMonthVal} starting ${dueAt.toLocaleString()}`;
      } else if (frequency === 'custom') {
        responseMessage = `Recurring reminder set: every ${intervalDays} days starting ${dueAt.toLocaleString()}`;
      }
    }

    res.json({
      success: true,
      reminderId: reminder.id,
      dueAt: reminder.due_at,
      isRecurring,
      rrule,
      message: responseMessage,
    });
  } catch (error) {
    logger.error({ error }, 'Error setting reminder');
    res.status(500).json({ error: 'Internal server error' });
  }
});
