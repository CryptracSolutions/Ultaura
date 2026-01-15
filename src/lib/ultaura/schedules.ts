'use server';

import { DateTime } from 'luxon';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import {
  CreateScheduleInputSchema,
  UpdateScheduleInputSchema,
  createError,
  ErrorCodes,
  type ActionResult,
} from '@ultaura/schemas';
import { DAYS_OF_WEEK, TELEPHONY, formatTime } from './constants';
import { extractOriginalTimeOfDay, normalizeTimeOfDay } from './schedule-helpers';
import { getNextOccurrence } from './timezone';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import { logScheduleEvent } from './schedule-events';
import { parseVacationRanges } from './vacation-utils';
import type { ScheduleRow, UltauraAccountRow } from './types';

const logger = getLogger();

export async function getSchedules(lineId: string): Promise<ScheduleRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get schedules');
    return [];
  }

  return data || [];
}

export async function getSchedule(scheduleId: string): Promise<ScheduleRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (error) {
    logger.error({ error }, 'Failed to get schedule');
    return null;
  }

  return data;
}

function getNextRunAt(timeOfDay: string, timezone: string, daysOfWeek: number[]): Date {
  return getNextOccurrence({
    timeOfDay,
    timezone,
    daysOfWeek,
  });
}

async function updateLineNextScheduledCallAt(lineId: string): Promise<void> {
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

function formatDays(days: number[]): string {
  return days
    .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
    .filter(Boolean)
    .join(', ');
}

function buildEditMetadata(prev: ScheduleRow, updates: Record<string, unknown>): Record<string, unknown> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (updates.time_of_day !== undefined) {
    const oldTime = normalizeTimeOfDay(prev.time_of_day);
    const newTime = normalizeTimeOfDay(updates.time_of_day as string);
    if (oldTime !== newTime) {
      changes.time_of_day = { old: oldTime, new: newTime };
    }
  }

  if (updates.days_of_week !== undefined) {
    const oldDays = prev.days_of_week ?? [];
    const newDays = updates.days_of_week as number[];
    if (JSON.stringify(oldDays) !== JSON.stringify(newDays)) {
      changes.days_of_week = { old: oldDays, new: newDays };
    }
  }

  if (updates.timezone !== undefined) {
    const oldTz = prev.timezone;
    const newTz = updates.timezone as string;
    if (oldTz !== newTz) {
      changes.timezone = { old: oldTz, new: newTz };
    }
  }

  if (updates.retry_policy !== undefined) {
    const oldPolicy = prev.retry_policy;
    const newPolicy = updates.retry_policy as ScheduleRow['retry_policy'];
    if (JSON.stringify(oldPolicy) !== JSON.stringify(newPolicy)) {
      changes.retry_policy = { old: oldPolicy, new: newPolicy };
    }
  }

  if (Object.keys(changes).length === 0) {
    return null;
  }

  const summaryParts: string[] = [];
  if (changes.time_of_day) {
    const oldTime = formatTime(changes.time_of_day.old as string);
    const newTime = formatTime(changes.time_of_day.new as string);
    summaryParts.push(`time from ${oldTime} to ${newTime}`);
  }
  if (changes.days_of_week) {
    const oldDays = formatDays(changes.days_of_week.old as number[]);
    const newDays = formatDays(changes.days_of_week.new as number[]);
    summaryParts.push(`days from ${oldDays || 'none'} to ${newDays || 'none'}`);
  }
  if (changes.timezone) {
    summaryParts.push(`timezone from ${changes.timezone.old} to ${changes.timezone.new}`);
  }
  if (changes.retry_policy) {
    summaryParts.push('retry policy updated');
  }

  return {
    changes,
    summary: summaryParts.length > 0 ? `Changed ${summaryParts.join('; ')}` : 'Schedule updated',
  };
}

function formatRescheduledFrom(
  exceptionDate: string,
  timeOfDay: string | null,
  timezone: string
): string {
  const dayLabel = DateTime.fromISO(exceptionDate, { zone: timezone }).toFormat('cccc');
  if (timeOfDay) {
    return `Rescheduled from ${dayLabel} ${formatTime(timeOfDay)}`;
  }
  return `Rescheduled from ${dayLabel}`;
}

async function getRescheduleSourceMap(
  client: ReturnType<typeof getSupabaseServerComponentClient>,
  scheduleIds: string[]
): Promise<Map<string, { exceptionDate: string; originalTimeOfDay: string | null }>> {
  const map = new Map<string, { exceptionDate: string; originalTimeOfDay: string | null }>();
  if (scheduleIds.length === 0) return map;

  const { data } = await client
    .from('ultaura_schedule_exceptions')
    .select('reschedule_schedule_id, exception_date, metadata')
    .in('reschedule_schedule_id', scheduleIds);

  (data || []).forEach((exception) => {
    if (!exception.reschedule_schedule_id) return;
    map.set(exception.reschedule_schedule_id, {
      exceptionDate: exception.exception_date,
      originalTimeOfDay: extractOriginalTimeOfDay(exception.metadata),
    });
  });

  return map;
}

const createScheduleWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: { accountId: string; schedule: unknown }
): Promise<ActionResult<{ scheduleId: string }>> => {
  const parsed = CreateScheduleInputSchema.safeParse(input.schedule);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  let next: Date;
  try {
    next = getNextRunAt(parsed.data.timeOfDay, parsed.data.timezone, parsed.data.daysOfWeek);
  } catch (error) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
    };
  }

  const client = getSupabaseServerComponentClient();

  const { data: schedule, error } = await client
    .from('ultaura_schedules')
    .insert({
      account_id: input.accountId,
      line_id: parsed.data.lineId,
      enabled: true,
      timezone: parsed.data.timezone,
      days_of_week: parsed.data.daysOfWeek,
      time_of_day: parsed.data.timeOfDay,
      next_run_at: next.toISOString(),
      retry_policy: parsed.data.retryPolicy || { max_retries: 2, retry_window_minutes: 30 },
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create schedule');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to create schedule'),
    };
  }

  await updateLineNextScheduledCallAt(parsed.data.lineId);

  await logScheduleEvent({
    accountId: input.accountId,
    scheduleId: schedule.id,
    lineId: parsed.data.lineId,
    eventType: 'created',
    triggeredBy: 'dashboard',
    metadata: {
      time_of_day: parsed.data.timeOfDay,
      days_of_week: parsed.data.daysOfWeek,
      timezone: parsed.data.timezone,
    },
  });

  await client.from('ultaura_consents').insert({
    account_id: input.accountId,
    line_id: parsed.data.lineId,
    type: 'outbound_calls',
    granted: true,
    granted_by: 'payer_ack',
    evidence: { timestamp: new Date().toISOString() },
  });

  revalidatePath('/dashboard/lines', 'page');
  revalidatePath('/dashboard/schedules', 'page');

  return { success: true, data: { scheduleId: schedule.id } };
});

export async function createSchedule(
  accountId: string,
  input: unknown
): Promise<ActionResult<{ scheduleId: string }>> {
  const account = await getUltauraAccountById(accountId);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return createScheduleWithTrial(account, { accountId, schedule: input });
}

const updateScheduleWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { scheduleId: string; updates: Record<string, unknown> }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const { data: current } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('id', input.scheduleId)
    .single();

  const { error } = await client
    .from('ultaura_schedules')
    .update(input.updates)
    .eq('id', input.scheduleId);

  if (error) {
    logger.error({ error }, 'Failed to update schedule');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update schedule'),
    };
  }

  revalidatePath('/dashboard/schedules', 'page');

  if (current) {
    const editMetadata = buildEditMetadata(current, input.updates);
    if (editMetadata) {
      await logScheduleEvent({
        accountId: current.account_id,
        scheduleId: current.id,
        lineId: current.line_id,
        eventType: 'edited',
        triggeredBy: 'dashboard',
        metadata: editMetadata,
      });
    }

    if (input.updates.enabled !== undefined && input.updates.enabled !== current.enabled) {
      await logScheduleEvent({
        accountId: current.account_id,
        scheduleId: current.id,
        lineId: current.line_id,
        eventType: input.updates.enabled ? 'enabled' : 'disabled',
        triggeredBy: 'dashboard',
        metadata: { previous_state: current.enabled },
      });
    }

    if (input.updates.next_run_at !== current.next_run_at) {
      await updateLineNextScheduledCallAt(current.line_id);
    }
  }

  return { success: true, data: undefined };
});

export async function updateSchedule(
  scheduleId: string,
  input: unknown
): Promise<ActionResult<void>> {
  const parsed = UpdateScheduleInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const client = getSupabaseServerComponentClient();

  const { data: schedule, error: scheduleError } = await client
    .from('ultaura_schedules')
    .select('*')
    .eq('id', scheduleId)
    .single();

  if (scheduleError || !schedule) {
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

  const updates: Record<string, unknown> = {};

  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
  if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
  if (parsed.data.daysOfWeek !== undefined) updates.days_of_week = parsed.data.daysOfWeek;
  if (parsed.data.timeOfDay !== undefined) updates.time_of_day = parsed.data.timeOfDay;
  if (parsed.data.retryPolicy !== undefined) updates.retry_policy = parsed.data.retryPolicy;

  if (parsed.data.daysOfWeek || parsed.data.timeOfDay || parsed.data.timezone) {
    const daysOfWeek = parsed.data.daysOfWeek || schedule.days_of_week || [];
    const timeOfDay = parsed.data.timeOfDay || schedule.time_of_day || '18:00';
    const timezone = parsed.data.timezone || schedule.timezone || TELEPHONY.DEFAULT_TIMEZONE;

    try {
      const next = getNextRunAt(timeOfDay, timezone, daysOfWeek);
      updates.next_run_at = next.toISOString();
    } catch (error) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
      };
    }
  }

  return updateScheduleWithTrial(account, { scheduleId, updates });
}

const deleteScheduleWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { scheduleId: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_schedules')
    .delete()
    .eq('id', input.scheduleId);

  if (error) {
    logger.error({ error }, 'Failed to delete schedule');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to delete schedule'),
    };
  }

  revalidatePath('/dashboard/schedules', 'page');

  return { success: true, data: undefined };
});

export async function deleteSchedule(scheduleId: string): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const { data: schedule, error: scheduleError } = await client
    .from('ultaura_schedules')
    .select('account_id')
    .eq('id', scheduleId)
    .single();

  if (scheduleError || !schedule) {
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

  return deleteScheduleWithTrial(account, { scheduleId });
}

export async function getUpcomingScheduledCalls(accountId: string): Promise<{
  scheduleId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
  nextRunAt: string;
  timeOfDay: string;
  daysOfWeek: number[];
  isOneTime: boolean;
  rescheduledFrom?: string | null;
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: schedules, error } = await client
    .from('ultaura_schedules')
    .select(`
      id,
      line_id,
      next_run_at,
      time_of_day,
      days_of_week,
      timezone,
      is_one_time,
      enabled,
      ultaura_lines!inner (
        display_name,
        short_id,
        vacation_ranges,
        timezone
      )
    `)
    .eq('account_id', accountId)
    .eq('enabled', true)
    .not('next_run_at', 'is', null)
    .order('next_run_at', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get upcoming scheduled calls');
    return [];
  }

  const scheduleList = schedules || [];
  if (scheduleList.length === 0) return [];

  const scheduleIds = scheduleList.map((schedule) => schedule.id);
  const oneTimeScheduleIds = scheduleList
    .filter((schedule) => schedule.is_one_time || schedule.days_of_week.length === 0)
    .map((schedule) => schedule.id);
  const rescheduleSourceMap = await getRescheduleSourceMap(client, oneTimeScheduleIds);

  const { data: exceptions } = await client
    .from('ultaura_schedule_exceptions')
    .select('schedule_id, exception_date, exception_type')
    .in('schedule_id', scheduleIds)
    .in('exception_type', ['skip', 'reschedule']);

  const exceptionMap = new Map<string, Set<string>>();
  (exceptions || []).forEach((exception) => {
    const key = exception.schedule_id;
    const set = exceptionMap.get(key) ?? new Set<string>();
    set.add(exception.exception_date);
    exceptionMap.set(key, set);
  });

  return scheduleList
    .filter((schedule) => {
      if (!schedule.next_run_at) return false;
      const line = schedule.ultaura_lines as {
        vacation_ranges?: unknown;
        timezone?: string;
      };
      const timezone = schedule.timezone || line?.timezone || TELEPHONY.DEFAULT_TIMEZONE;
      const localDate = DateTime.fromISO(schedule.next_run_at).setZone(timezone).toISODate();
      if (!localDate) return false;

      const ranges = parseVacationRanges(line?.vacation_ranges);
      const isOnVacation = ranges.some((range) => localDate >= range.start && localDate <= range.end);
      if (isOnVacation) return false;

      const exceptionsForSchedule = exceptionMap.get(schedule.id);
      if (exceptionsForSchedule?.has(localDate)) {
        return false;
      }

      return true;
    })
    .map((schedule) => {
      const line = schedule.ultaura_lines as { short_id: string; display_name: string; timezone?: string };
      const timezone = schedule.timezone || line?.timezone || TELEPHONY.DEFAULT_TIMEZONE;
      const isOneTime = schedule.is_one_time || schedule.days_of_week.length === 0;
      const rescheduleSource = isOneTime ? rescheduleSourceMap.get(schedule.id) : null;
      const rescheduledFrom = rescheduleSource
        ? formatRescheduledFrom(
          rescheduleSource.exceptionDate,
          rescheduleSource.originalTimeOfDay,
          timezone
        )
        : null;

      return {
        scheduleId: schedule.id,
        lineId: schedule.line_id,
        lineShortId: line.short_id,
        displayName: line.display_name,
        nextRunAt: schedule.next_run_at!,
        timeOfDay: schedule.time_of_day,
        daysOfWeek: schedule.days_of_week,
        isOneTime,
        rescheduledFrom,
      };
    });
}

export async function getAllSchedules(accountId: string): Promise<{
  scheduleId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
  enabled: boolean;
  nextRunAt: string | null;
  timeOfDay: string;
  daysOfWeek: number[];
  isOneTime: boolean;
  rescheduledFrom?: string | null;
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: schedules, error } = await client
    .from('ultaura_schedules')
    .select(`
      id,
      line_id,
      enabled,
      next_run_at,
      time_of_day,
      days_of_week,
      timezone,
      is_one_time,
      ultaura_lines!inner (
        display_name,
        short_id
      )
    `)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get all schedules');
    return [];
  }

  const scheduleList = schedules || [];
  if (scheduleList.length === 0) return [];

  const oneTimeScheduleIds = scheduleList
    .filter((schedule) => schedule.is_one_time || schedule.days_of_week.length === 0)
    .map((schedule) => schedule.id);
  const rescheduleSourceMap = await getRescheduleSourceMap(client, oneTimeScheduleIds);

  return scheduleList.map((schedule) => {
    const isOneTime = schedule.is_one_time || schedule.days_of_week.length === 0;
    const rescheduleSource = isOneTime ? rescheduleSourceMap.get(schedule.id) : null;
    const rescheduledFrom = rescheduleSource
      ? formatRescheduledFrom(
        rescheduleSource.exceptionDate,
        rescheduleSource.originalTimeOfDay,
        schedule.timezone || TELEPHONY.DEFAULT_TIMEZONE
      )
      : null;

    return {
      scheduleId: schedule.id,
      lineId: schedule.line_id,
      lineShortId: (schedule.ultaura_lines as { short_id: string }).short_id,
      displayName: (schedule.ultaura_lines as { display_name: string }).display_name,
      enabled: schedule.enabled,
      nextRunAt: schedule.next_run_at,
      timeOfDay: schedule.time_of_day,
      daysOfWeek: schedule.days_of_week,
      isOneTime,
      rescheduledFrom,
    };
  });
}
