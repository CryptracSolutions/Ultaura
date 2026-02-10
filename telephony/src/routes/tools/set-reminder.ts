// Set reminder tool handler

import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import crypto from 'crypto';
import {
  SetReminderInputSchema,
  type SetReminderInput,
} from '@ultaura/schemas/telephony';
import { ErrorCodes } from '@ultaura/schemas';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getLineById } from '../../services/line-lookup.js';
import { RATE_LIMITS } from '../../services/rate-limit-config.js';
import { localToUtc, validateTimezone } from '../../utils/timezone.js';
import { encryptReminderMessage } from '../../utils/reminder-crypto.js';
import { encodeBytea } from '../../utils/bytea.js';
import { buildReminderSearchTokens } from '../../utils/search-tokens.js';
import { enforceSessionLineMatch, formatReminderSchedule } from './reminder-tool-helpers.js';

export const setReminderRouter = Router();

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';
type SupabaseError = { code?: string; message?: string; details?: string } | null;

const REMINDER_LIMIT_ERROR_PREFIX = 'REMINDER_LIMIT_REACHED';
const REMINDER_LIMIT_ERROR_MESSAGE = "You've reached the reminder limit for this line. Ask your caregiver to cancel existing reminders or upgrade the plan.";

function isReminderLimitReachedError(error: SupabaseError): boolean {
  if (!error) return false;
  if (error.code === 'U0001') return true;
  return typeof error.message === 'string'
    && error.message.startsWith(REMINDER_LIMIT_ERROR_PREFIX);
}

/**
 * Build RRULE string and related fields from recurrence parameters.
 */
function buildRecurrenceFields(
  frequency: RecurrenceFrequency,
  interval: number | undefined,
  daysOfWeek: number[] | undefined,
  dayOfMonth: number | undefined,
  dueAt: Date,
  timezone: string
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
      if (daysOfWeek && daysOfWeek.length > 0) {
        daysOfWeekVal = daysOfWeek;
      } else {
        const dueAtLocal = DateTime.fromJSDate(dueAt).setZone(timezone);
        daysOfWeekVal = [dueAtLocal.weekday % 7];
      }
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
    const rawBody = req.body as Partial<SetReminderInput>;
    const sanitizedBody = {
      ...rawBody,
      message: typeof rawBody.message === 'string'
        ? rawBody.message.slice(0, 500)
        : rawBody.message,
    };
    const parsed = SetReminderInputSchema.safeParse(sanitizedBody);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const missingRequired = issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const dueAtIssue = issues.find((issue) => issue.path[0] === 'dueAtLocal');
      if (dueAtIssue) {
        res.status(400).json({ error: 'Invalid date format' });
        return;
      }

      const timezoneIssue = issues.find((issue) => issue.path[0] === 'timezone');
      if (timezoneIssue && typeof rawBody.timezone === 'string') {
        try {
          validateTimezone(rawBody.timezone);
        } catch (error) {
          res.status(400).json({ error: (error as Error).message });
          return;
        }
      }

      res.status(400).json({ error: issues[0]?.message || 'Invalid input' });
      return;
    }

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
    } = parsed.data;

    logger.info({
      callSessionId,
      lineId,
      dueAtLocal,
      messageLength: typeof message === 'string' ? message.length : null,
      isRecurring,
      frequency,
    }, 'Set reminder request');

    // Get call session to verify and get account ID
    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_reminder',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (!await enforceSessionLineMatch({ session, lineId, recordFailure })) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const effectiveLineId = session.line_id;
    const lineWithAccount = await getLineById(effectiveLineId);
    if (!lineWithAccount) {
      await recordFailure();
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const { line, account } = lineWithAccount;
    if (line.account_id !== session.account_id || account.id !== session.account_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }
    if (!line.allow_voice_reminder_control) {
      await recordFailure('unauthorized');
      res.status(403).json({
        success: false,
        code: ErrorCodes.UNAUTHORIZED,
        message: "I'm sorry, but your caregiver has disabled reminder management by phone. Please ask them to make changes through the app.",
      });
      return;
    }

    const defaultTimezone = process.env.ULTAURA_DEFAULT_TIMEZONE || 'America/Los_Angeles';
    const lineTimezone = line.timezone || defaultTimezone;
    if (timezone && timezone !== lineTimezone) {
      logger.warn(
        { callSessionId, lineId, inputTimezone: timezone, lineTimezone },
        'Reminder timezone overridden by line timezone'
      );
    }
    const tz = lineTimezone;

    let finalMessage = message?.trim() || '';
    let messageDefaulted = false;
    if (!finalMessage) {
      finalMessage = 'Check-in call';
      messageDefaulted = true;
      logger.info({ callSessionId, lineId }, 'Reminder message defaulted');
    }

    try {
      validateTimezone(tz);
    } catch (error) {
      await recordFailure();
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    // Parse the due date, converting from user's local time to UTC
    let dueAt: Date;
    try {
      dueAt = localToUtc(dueAtLocal, tz);
      logger.info({ dueAtLocal, timezone: tz, dueAtUtc: dueAt.toISOString() }, 'Parsed reminder due date');
    } catch (parseError) {
      logger.error({ parseError, dueAtLocal, timezone }, 'Failed to parse reminder due date');
      await recordFailure();
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
      await recordFailure();
      res.status(400).json({ error: 'Due date is in the past' });
      return;
    }

    const minBufferMs = 5 * 60 * 1000;
    const bufferThreshold = Date.now() + minBufferMs;
    if (dueAt.getTime() < bufferThreshold) {
      await recordFailure();
      res.status(400).json({
        error: 'Reminders must be scheduled at least 5 minutes in the future',
        earliestAllowed: new Date(bufferThreshold).toISOString(),
      });
      return;
    }

    const supabase = getSupabaseClient();

    const reminderLimit = RATE_LIMITS.remindersPerSession;
    const { count, error: countError } = await supabase
      .from('ultaura_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('created_by_call_session_id', callSessionId);

    if (countError) {
      logger.error({ error: countError, callSessionId }, 'Failed to check reminder count for session');
      await recordFailure('reminder_count_failed');
      res.status(500).json({ error: 'Failed to validate reminder limit' });
      return;
    }

    if ((count ?? 0) >= reminderLimit) {
      await recordFailure('reminder_limit_exceeded');
      res.status(429).json({
        error: 'Maximum reminders per call reached',
        limit: reminderLimit,
        suggestion: 'You can set more reminders in your next call',
      });
      return;
    }

    // Build recurrence fields if this is a recurring reminder
    let rrule: string | null = null;
    let intervalDays: number | null = null;
    let daysOfWeekVal: number[] | null = null;
    let dayOfMonthVal: number | null = null;
    let timeOfDay: string | null = null;
    let endsAt: string | null = null;

    if (isRecurring && frequency) {
      const recurrenceFields = buildRecurrenceFields(frequency, interval, daysOfWeek, dayOfMonth, dueAt, tz);
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
    const reminderId = crypto.randomUUID();
    const messageForStorage = finalMessage.slice(0, 500);
    const encryptedMessage = await encryptReminderMessage(
      session.account_id,
      effectiveLineId,
      reminderId,
      messageForStorage
    );

    let searchTokens: string[] = [];
    try {
      searchTokens = await buildReminderSearchTokens(
        supabase,
        session.account_id,
        messageForStorage
      );
    } catch (error) {
      logger.error({ error, reminderId }, 'Failed to build reminder search tokens');
    }

    const insertPayload: Record<string, unknown> = {
      id: reminderId,
      account_id: session.account_id,
      line_id: effectiveLineId,
      due_at: dueAt.toISOString(),
      timezone: tz,
      message: null,
      message_ciphertext: encodeBytea(encryptedMessage.ciphertext),
      message_iv: encodeBytea(encryptedMessage.iv),
      message_tag: encodeBytea(encryptedMessage.tag),
      message_alg: encryptedMessage.alg,
      message_kid: encryptedMessage.kid,
      delivery_method: 'outbound_call',
      status: 'scheduled',
      privacy_scope: privacyScope,
      search_tokens: searchTokens,
      created_by_call_session_id: callSessionId,
      // Recurrence fields
      is_recurring: isRecurring,
      rrule,
      interval_days: intervalDays,
      days_of_week: daysOfWeekVal,
      day_of_month: dayOfMonthVal,
      time_of_day: timeOfDay,
      ends_at: endsAt,
    };

    type ReminderInsertRow = { id: string; due_at: string };

    let reminder: ReminderInsertRow | null = null;
    let error: SupabaseError = null;

    ({ data: reminder, error } = await supabase
      .from('ultaura_reminders')
      .insert(insertPayload)
      .select()
      .single() as unknown as { data: ReminderInsertRow | null; error: SupabaseError });

    if (error && error.code === '23502') {
      logger.warn({ error }, 'Reminder message column is still NOT NULL; falling back to plaintext (apply migrations to disable plaintext storage)');
      ({ data: reminder, error } = await supabase
        .from('ultaura_reminders')
        .insert({
          ...insertPayload,
          message: finalMessage.slice(0, 500),
        })
        .select()
        .single() as unknown as { data: ReminderInsertRow | null; error: SupabaseError });
    }

    if (isReminderLimitReachedError(error)) {
      await recordFailure('plan_reminder_limit_exceeded');
      res.status(403).json({
        success: false,
        code: ErrorCodes.REMINDER_LIMIT_REACHED,
        message: REMINDER_LIMIT_ERROR_MESSAGE,
      });
      return;
    }

    if (error) {
      logger.error({
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        insertData: {
          account_id: session.account_id,
          line_id: effectiveLineId,
          due_at: dueAt.toISOString(),
          timezone: tz,
          messageLength: finalMessage.length,
          created_by_call_session_id: callSessionId,
        },
      }, 'Failed to create reminder');
      await recordFailure(error.code);
      res.status(500).json({ error: 'Failed to create reminder', details: error.message });
      return;
    }

    if (!reminder) {
      await recordFailure('reminder_insert_no_row');
      res.status(500).json({ error: 'Failed to create reminder' });
      return;
    }

    // Record tool invocation
    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_reminder',
      success: true,
      reminderId: reminder.id,
      messageDefaulted,
    }, { skipDebugLog: true });

    logger.info({ reminderId: reminder.id, dueAt: reminder.due_at }, 'Reminder created');

    // Build response message
    const scheduleInfo = formatReminderSchedule(dueAt, tz);
    let responseMessage = `Reminder set for ${scheduleInfo}`;
    if (isRecurring && rrule) {
      if (frequency === 'daily') {
        responseMessage = intervalDays && intervalDays > 1
          ? `Recurring reminder set: every ${intervalDays} days starting ${scheduleInfo}`
          : `Recurring reminder set: daily starting ${scheduleInfo}`;
      } else if (frequency === 'weekly') {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const days = daysOfWeekVal?.map(d => dayNames[d]).join(', ') || '';
        responseMessage = `Recurring reminder set: every ${days} starting ${scheduleInfo}`;
      } else if (frequency === 'monthly') {
        responseMessage = `Recurring reminder set: monthly on day ${dayOfMonthVal} starting ${scheduleInfo}`;
      } else if (frequency === 'custom') {
        responseMessage = `Recurring reminder set: every ${intervalDays} days starting ${scheduleInfo}`;
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
