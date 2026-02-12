'use server';

import { DateTime } from 'luxon';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import {
  CreateScheduleExceptionInputSchema,
  createError,
  ErrorCodes,
  type ActionResult,
} from '@ultaura/schemas';
import type { Json } from '~/database.types';
import { getNextOccurrence, localToUtc } from './timezone';
import { normalizeTimeOfDay } from './schedule-helpers';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import { logScheduleEvent } from './schedule-events';
import type { ScheduleExceptionRow, ScheduleRow, UltauraAccountRow } from './types';

const logger = getLogger();
const OFFSET_REGEX = /[zZ]|[+-]\d{2}:\d{2}$/;

function parseInputDateTime(value: string, timezone: string): Date {
  if (OFFSET_REGEX.test(value)) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Invalid datetime');
    }
    return parsed;
  }

  return localToUtc(value, timezone);
}

async function getScheduleForException(scheduleId: string) {
  const client = getSupabaseServerComponentClient();
  const { data, error } = await client
    .from('ultaura_schedules')
    .select('id, account_id, line_id, time_of_day, days_of_week, timezone, next_run_at, retry_policy, enabled, is_one_time')
    .eq('id', scheduleId)
    .single();

  if (error || !data) {
    return { schedule: null, error };
  }

  return { schedule: data as ScheduleRow, error: null };
}

async function updateLineNextScheduledCallAt(
  lineId: string
): Promise<void> {
  const client = getSupabaseServerComponentClient();
  const { data: nextSchedule } = await client
    .from('ultaura_schedules')
    .select('next_run_at')
    .eq('line_id', lineId)
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .order('next_run_at', { ascending: true })
    .limit(1)
    .single();

  await client
    .from('ultaura_lines')
    .update({ next_scheduled_call_at: nextSchedule?.next_run_at ?? null })
    .eq('id', lineId);
}

function calculateNextRun(schedule: ScheduleRow, timezone: string): string | null {
  const { days_of_week, time_of_day, next_run_at } = schedule;
  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  try {
    const next = getNextOccurrence({
      timeOfDay: time_of_day,
      timezone,
      daysOfWeek: days_of_week,
      afterDate: next_run_at ? new Date(next_run_at) : undefined,
    });
    return next.toISOString();
  } catch (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to calculate next occurrence');
    return null;
  }
}

function isExceptionDateInPast(exceptionDate: string, timezone: string): boolean {
  const today = DateTime.now().setZone(timezone).toISODate();
  if (!today) return false;
  return exceptionDate < today;
}

function getScheduleLocalDate(isoDate: string, timezone: string): string | null {
  const local = DateTime.fromISO(isoDate).setZone(timezone);
  if (!local.isValid) return null;
  return local.toISODate();
}

export async function getScheduleExceptions(scheduleId: string): Promise<ScheduleExceptionRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedule_exceptions')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('exception_date', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get schedule exceptions');
    return [];
  }

  return data || [];
}

export async function getScheduleException(
  exceptionId: string
): Promise<ScheduleExceptionRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedule_exceptions')
    .select('*')
    .eq('id', exceptionId)
    .single();

  if (error) {
    logger.error({ error }, 'Failed to get schedule exception');
    return null;
  }

  return data || null;
}

export async function getUpcomingExceptions(lineId: string): Promise<ScheduleExceptionRow[]> {
  const client = getSupabaseServerComponentClient();
  const line = await getLine(lineId);
  if (!line) return [];

  const today = DateTime.now().setZone(line.timezone).toISODate();
  if (!today) return [];

  const { data, error } = await client
    .from('ultaura_schedule_exceptions')
    .select('*')
    .eq('line_id', line.id)
    .gte('exception_date', today)
    .order('exception_date', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get upcoming schedule exceptions');
    return [];
  }

  return data || [];
}

const createScheduleExceptionWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: { scheduleException: unknown; lineShortId: string }
): Promise<ActionResult<{ exceptionId: string }>> => {
  const parsed = CreateScheduleExceptionInputSchema.safeParse(input.scheduleException);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const { scheduleId, exceptionDate, exceptionType, snoozeMinutes, newDatetime } = parsed.data;
  const { schedule, error: scheduleError } = await getScheduleForException(scheduleId);

  if (scheduleError || !schedule) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Schedule not found'),
    };
  }

  const line = await getLine(schedule.line_id);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const lineTimezone = line.timezone;

  if (line.account_id !== account.id) {
    return {
      success: false,
      error: createError(ErrorCodes.UNAUTHORIZED, 'Access denied'),
    };
  }

  if (isExceptionDateInPast(exceptionDate, lineTimezone)) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Cannot create exception for past dates'),
    };
  }

  const client = getSupabaseServerComponentClient();

  const { data: existing } = await client
    .from('ultaura_schedule_exceptions')
    .select('id')
    .eq('schedule_id', schedule.id)
    .eq('exception_date', exceptionDate)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      error: createError(ErrorCodes.ALREADY_EXISTS, 'An exception already exists for this date'),
    };
  }

  const createdAtLocal = DateTime.now().setZone(lineTimezone).toISO({ suppressMilliseconds: true });
  const originalTimeOfDay = normalizeTimeOfDay(schedule.time_of_day);
  const baseMetadata: Record<string, unknown> = {
    original_time_of_day: originalTimeOfDay,
    created_at_local: createdAtLocal,
  };

  let exceptionNewDatetime: string | null = null;
  let rescheduleScheduleId: string | null = null;
  let rescheduledTo: string | null = null;
  let snoozeMinutesValue: number | null = null;

  if (exceptionType === 'snooze') {
    const nowUtc = DateTime.utc();
    if (newDatetime) {
      let parsedNew: Date;
      try {
        parsedNew = parseInputDateTime(newDatetime, lineTimezone);
      } catch (error) {
        return {
          success: false,
          error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
        };
      }

      const diffMs = parsedNew.getTime() - nowUtc.toMillis();
      const minMs = 5 * 60 * 1000;
      const maxMs = 1440 * 60 * 1000;
      if (diffMs < minMs || diffMs > maxMs) {
        return {
          success: false,
          error: createError(
            ErrorCodes.INVALID_INPUT,
            'Snooze must be between 5 minutes and 24 hours from now'
          ),
        };
      }

      exceptionNewDatetime = parsedNew.toISOString();
      snoozeMinutesValue = Math.round(diffMs / 60000);
    } else if (typeof snoozeMinutes === 'number') {
      if (snoozeMinutes < 5 || snoozeMinutes > 1440) {
        return {
          success: false,
          error: createError(
            ErrorCodes.INVALID_INPUT,
            'Snooze must be between 5 minutes and 24 hours'
          ),
        };
      }

      const snoozedUtc = nowUtc.plus({ minutes: snoozeMinutes });
      exceptionNewDatetime = snoozedUtc.toISO();
      snoozeMinutesValue = snoozeMinutes;
    } else {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Snooze time is required'),
      };
    }

    if (exceptionNewDatetime) {
      baseMetadata.snooze_minutes = snoozeMinutesValue ?? undefined;
    }
  }

  if (exceptionType === 'reschedule') {
    if (!newDatetime) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'New datetime is required'),
      };
    }

    let parsedNew: Date;
    try {
      parsedNew = parseInputDateTime(newDatetime, lineTimezone);
    } catch (error) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
      };
    }

    if (parsedNew.getTime() <= Date.now()) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Rescheduled time must be in the future'),
      };
    }

    exceptionNewDatetime = parsedNew.toISOString();
    rescheduledTo = exceptionNewDatetime;
  }

  if (exceptionType === 'skip' && (newDatetime || snoozeMinutes)) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Skip exceptions cannot include new times'),
    };
  }

  const shouldAdvanceNextRun =
    schedule.next_run_at &&
    getScheduleLocalDate(schedule.next_run_at, lineTimezone) === exceptionDate;

  let updatedNextRunAt: string | null = schedule.next_run_at;

  if (shouldAdvanceNextRun) {
    if (exceptionType === 'snooze' && exceptionNewDatetime) {
      updatedNextRunAt = exceptionNewDatetime;
    } else {
      updatedNextRunAt = calculateNextRun(schedule, lineTimezone);
    }
  }

  if (exceptionType === 'reschedule' && exceptionNewDatetime) {
    const newLocal = DateTime.fromISO(exceptionNewDatetime).setZone(lineTimezone);
    const timeOfDay = newLocal.toFormat('HH:mm');

    const { data: oneTimeSchedule, error: oneTimeError } = await client
      .from('ultaura_schedules')
      .insert({
        account_id: schedule.account_id,
        line_id: schedule.line_id,
        enabled: true,
        timezone: lineTimezone,
        days_of_week: [],
        time_of_day: timeOfDay,
        next_run_at: exceptionNewDatetime,
        retry_policy: schedule.retry_policy ?? { max_retries: 2, retry_window_minutes: 30 },
        is_one_time: true,
      })
      .select('id')
      .single();

    if (oneTimeError || !oneTimeSchedule) {
      logger.error({ error: oneTimeError }, 'Failed to create one-time schedule for reschedule');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to create one-time schedule'),
      };
    }

    rescheduleScheduleId = oneTimeSchedule.id;
  }

  const metadata: Record<string, unknown> = { ...baseMetadata };

  if (snoozeMinutesValue) {
    metadata.snooze_minutes = snoozeMinutesValue;
  }
  if (rescheduledTo) {
    metadata.rescheduled_to = rescheduledTo;
  }
  if (rescheduleScheduleId) {
    metadata.reschedule_schedule_id = rescheduleScheduleId;
  }

  const { data: exception, error: insertError } = await client
    .from('ultaura_schedule_exceptions')
    .insert({
      account_id: schedule.account_id,
      schedule_id: schedule.id,
      line_id: schedule.line_id,
      exception_date: exceptionDate,
      exception_type: exceptionType,
      new_datetime: exceptionNewDatetime,
      reschedule_schedule_id: rescheduleScheduleId,
      created_by: 'dashboard',
      metadata: metadata as Json,
    })
    .select('id')
    .single();

  if (insertError || !exception) {
    logger.error({ error: insertError }, 'Failed to create schedule exception');

    if (rescheduleScheduleId) {
      await client
        .from('ultaura_schedules')
        .delete()
        .eq('id', rescheduleScheduleId);
    }

    const duplicate = (insertError as { code?: string } | null)?.code === '23505';
    return {
      success: false,
      error: createError(
        duplicate ? ErrorCodes.ALREADY_EXISTS : ErrorCodes.DATABASE_ERROR,
        duplicate ? 'An exception already exists for this date' : 'Failed to create exception'
      ),
    };
  }

  if (shouldAdvanceNextRun && updatedNextRunAt !== schedule.next_run_at) {
    const { error: updateError } = await client
      .from('ultaura_schedules')
      .update({ next_run_at: updatedNextRunAt })
      .eq('id', schedule.id);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to update schedule next_run_at');
    } else {
      await updateLineNextScheduledCallAt(schedule.line_id);
    }
  }

  await logScheduleEvent({
    accountId: schedule.account_id,
    scheduleId: schedule.id,
    lineId: schedule.line_id,
    eventType: 'exception_added',
    triggeredBy: 'dashboard',
    metadata: {
      exception_type: exceptionType,
      exception_date: exceptionDate,
      reschedule_schedule_id: rescheduleScheduleId ?? undefined,
      new_datetime: exceptionNewDatetime ?? undefined,
    },
  });

  if (rescheduleScheduleId) {
    await logScheduleEvent({
      accountId: schedule.account_id,
      scheduleId: rescheduleScheduleId,
      lineId: schedule.line_id,
      eventType: 'created',
      triggeredBy: 'dashboard',
      metadata: {
        source: 'reschedule',
        original_schedule_id: schedule.id,
        exception_id: exception.id,
      },
    });
  }

  const targetShortId = input.lineShortId || line.short_id;
  revalidatePath(`/dashboard/lines/${targetShortId}`, 'page');
  revalidatePath('/dashboard', 'page');
  revalidatePath('/dashboard/calls', 'page');

  return { success: true, data: { exceptionId: exception.id } };
});

export async function createScheduleException(
  scheduleException: unknown,
  lineShortId: string
): Promise<ActionResult<{ exceptionId: string }>> {
  const parsed = CreateScheduleExceptionInputSchema.safeParse(scheduleException);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const { scheduleId } = parsed.data;
  const { schedule } = await getScheduleForException(scheduleId);
  if (!schedule) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Schedule not found'),
    };
  }

  const account = await getUltauraAccountById(schedule.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return createScheduleExceptionWithTrial(account, { scheduleException, lineShortId });
}

const deleteScheduleExceptionWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { exceptionId: string; lineShortId: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const { data: exception, error: fetchError } = await client
    .from('ultaura_schedule_exceptions')
    .select('*')
    .eq('id', input.exceptionId)
    .single();

  if (fetchError || !exception) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Exception not found'),
    };
  }

  const { error: deleteError } = await client
    .from('ultaura_schedule_exceptions')
    .delete()
    .eq('id', input.exceptionId);

  if (deleteError) {
    logger.error({ error: deleteError }, 'Failed to delete schedule exception');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to delete exception'),
    };
  }

  await logScheduleEvent({
    accountId: exception.account_id,
    scheduleId: exception.schedule_id,
    lineId: exception.line_id,
    eventType: 'exception_removed',
    triggeredBy: 'dashboard',
    metadata: {
      exception_type: exception.exception_type,
      exception_date: exception.exception_date,
    },
  });

  revalidatePath(`/dashboard/lines/${input.lineShortId}`, 'page');
  revalidatePath('/dashboard', 'page');
  revalidatePath('/dashboard/calls', 'page');

  return { success: true, data: undefined };
});

export async function deleteScheduleException(
  exceptionId: string,
  lineShortId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const { data: exception, error: exceptionError } = await client
    .from('ultaura_schedule_exceptions')
    .select('account_id')
    .eq('id', exceptionId)
    .single();

  if (exceptionError || !exception) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Exception not found'),
    };
  }

  const account = await getUltauraAccountById(exception.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return deleteScheduleExceptionWithTrial(account, { exceptionId, lineShortId });
}
