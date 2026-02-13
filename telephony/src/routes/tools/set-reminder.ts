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
type ReminderLimitReason = 'session_cap' | 'line_cap';
type ReminderRpcResult = {
  success?: boolean;
  code?: string | null;
  blocked?: boolean;
  block_reason?: string | null;
  reason?: string | null;
  message?: string | null;
  current_count?: number | null;
  limit?: number | null;
  remaining_allowance?: number | null;
  next_action?: {
    reason?: string | null;
    guidance?: string | null;
  } | null;
  next_action_guidance?: string | null;
  reminder?: {
    id?: string | null;
    due_at?: string | null;
  } | null;
  reminder_id?: string | null;
  due_at?: string | null;
};

const REMINDER_LIMIT_ERROR_PREFIX = 'REMINDER_LIMIT_REACHED';
const REMINDER_LIMIT_ERROR_MESSAGE = "You've reached the reminder limit for this line. Ask your caregiver to cancel existing reminders or upgrade the plan.";
const SESSION_REMINDER_LIMIT_ERROR_MESSAGE = "You've reached the reminder limit for this call. You can set more reminders in your next call.";

function normalizeReminderRpcResult(data: unknown): ReminderRpcResult | null {
  if (Array.isArray(data)) {
    return (data[0] as ReminderRpcResult) ?? null;
  }
  return (data as ReminderRpcResult) ?? null;
}

function parseReminderLimitReason(result: ReminderRpcResult | null): ReminderLimitReason | null {
  const reason = result?.next_action?.reason ?? result?.block_reason ?? result?.reason ?? result?.code;
  if (reason === 'session_cap' || reason === 'session_limit' || reason === 'session_limit_reached') {
    return 'session_cap';
  }
  if (reason === 'line_cap' || reason === 'line_limit' || reason === 'line_limit_reached') {
    return 'line_cap';
  }
  return null;
}

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

    if (session.status !== 'in_progress') {
      await recordFailure('session_not_in_progress');
      res.status(409).json({
        success: false,
        code: ErrorCodes.FORBIDDEN,
        error: 'Call session must be active',
        message: 'Reminders can only be changed while the call is in progress.',
      });
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
    const nowMs = Date.now();
    if (dueAt.getTime() < nowMs) {
      logger.warn({
        dueAtLocal,
        dueAtUtc: dueAt.toISOString(),
        now: new Date(nowMs).toISOString(),
        diffMs: dueAt.getTime() - nowMs,
        timezone,
        callSessionId,
      }, 'Reminder rejected: due date is in the past');
      await recordFailure();
      res.status(400).json({ error: 'Due date is in the past' });
      return;
    }

    const minBufferMs = 5 * 60 * 1000;
    const bufferThreshold = nowMs + minBufferMs;
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

    let reminder: { id: string; due_at: string } | null = null;
    let error: SupabaseError = null;
    let rpcData: ReminderRpcResult | ReminderRpcResult[] | null = null;
    let rpcResult: ReminderRpcResult | null = null;

    ({
      data: rpcData,
      error,
    } = await supabase.rpc('create_ultaura_call_reminder', {
      p_call_session_id: callSessionId,
      p_session_limit: reminderLimit,
      p_account_id: session.account_id,
      p_line_id: effectiveLineId,
      p_due_at: dueAt.toISOString(),
      p_timezone: tz,
      p_message: null,
      p_delivery_method: 'outbound_call',
      p_status: 'scheduled',
      p_privacy_scope: privacyScope,
      p_message_ciphertext: encodeBytea(encryptedMessage.ciphertext),
      p_message_iv: encodeBytea(encryptedMessage.iv),
      p_message_tag: encodeBytea(encryptedMessage.tag),
      p_message_alg: encryptedMessage.alg,
      p_message_kid: encryptedMessage.kid,
      p_search_tokens: searchTokens,
      p_is_recurring: isRecurring,
      p_rrule: rrule,
      p_interval_days: intervalDays,
      p_days_of_week: daysOfWeekVal,
      p_day_of_month: dayOfMonthVal,
      p_time_of_day: timeOfDay,
      p_ends_at: endsAt,
    }) as unknown as { data: ReminderRpcResult | ReminderRpcResult[] | null; error: SupabaseError });
    rpcResult = normalizeReminderRpcResult(rpcData);

    if (error && error.code === '23502') {
      logger.warn({ error }, 'Reminder message column is still NOT NULL; falling back to plaintext (apply migrations to disable plaintext storage)');
      ({
        data: rpcData,
        error,
      } = await supabase.rpc('create_ultaura_call_reminder', {
        p_call_session_id: callSessionId,
        p_session_limit: reminderLimit,
        p_account_id: session.account_id,
        p_line_id: effectiveLineId,
        p_due_at: dueAt.toISOString(),
        p_timezone: tz,
        p_message: messageForStorage,
        p_delivery_method: 'outbound_call',
        p_status: 'scheduled',
        p_privacy_scope: privacyScope,
        p_message_ciphertext: encodeBytea(encryptedMessage.ciphertext),
        p_message_iv: encodeBytea(encryptedMessage.iv),
        p_message_tag: encodeBytea(encryptedMessage.tag),
        p_message_alg: encryptedMessage.alg,
        p_message_kid: encryptedMessage.kid,
        p_search_tokens: searchTokens,
        p_is_recurring: isRecurring,
        p_rrule: rrule,
        p_interval_days: intervalDays,
        p_days_of_week: daysOfWeekVal,
        p_day_of_month: dayOfMonthVal,
        p_time_of_day: timeOfDay,
        p_ends_at: endsAt,
      }) as unknown as { data: ReminderRpcResult | ReminderRpcResult[] | null; error: SupabaseError });
      rpcResult = normalizeReminderRpcResult(rpcData);
    }

    const limitReason = parseReminderLimitReason(rpcResult);
    if (limitReason) {
      await recordFailure(limitReason === 'session_cap' ? 'session_reminder_limit_exceeded' : 'plan_reminder_limit_exceeded');
      const guidance = rpcResult?.next_action?.guidance
        ?? rpcResult?.next_action_guidance
        ?? (limitReason === 'session_cap'
          ? 'You can set more reminders in your next call.'
          : 'Ask your caregiver to cancel existing reminders or upgrade the plan.');
      const message = rpcResult?.message
        ?? (limitReason === 'session_cap'
          ? SESSION_REMINDER_LIMIT_ERROR_MESSAGE
          : REMINDER_LIMIT_ERROR_MESSAGE);
      res.status(limitReason === 'session_cap' ? 429 : 403).json({
        success: false,
        code: ErrorCodes.REMINDER_LIMIT_REACHED,
        message,
        current_count: rpcResult?.current_count ?? 0,
        limit: rpcResult?.limit ?? reminderLimit,
        remaining_allowance: rpcResult?.remaining_allowance ?? 0,
        next_action: {
          reason: limitReason,
          guidance,
        },
      });
      return;
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

    reminder = rpcResult?.reminder?.id && rpcResult?.reminder?.due_at
      ? { id: rpcResult.reminder.id, due_at: rpcResult.reminder.due_at }
      : rpcResult?.reminder_id && rpcResult?.due_at
        ? { id: rpcResult.reminder_id, due_at: rpcResult.due_at }
        : null;

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
