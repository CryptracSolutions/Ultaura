'use server';

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
import { TELEPHONY } from './constants';
import { getNextOccurrence } from './timezone';
import { getUltauraAccountById, withTrialCheck } from './helpers';
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

  await client
    .from('ultaura_lines')
    .update({ next_scheduled_call_at: next.toISOString() })
    .eq('id', parsed.data.lineId);

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

  const updates: Record<string, unknown> = {};

  if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled;
  if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
  if (parsed.data.daysOfWeek !== undefined) updates.days_of_week = parsed.data.daysOfWeek;
  if (parsed.data.timeOfDay !== undefined) updates.time_of_day = parsed.data.timeOfDay;
  if (parsed.data.retryPolicy !== undefined) updates.retry_policy = parsed.data.retryPolicy;

  if (parsed.data.daysOfWeek || parsed.data.timeOfDay || parsed.data.timezone) {
    const { data: current } = await client
      .from('ultaura_schedules')
      .select('days_of_week, time_of_day, timezone')
      .eq('id', scheduleId)
      .single();

    const daysOfWeek = parsed.data.daysOfWeek || current?.days_of_week || [];
    const timeOfDay = parsed.data.timeOfDay || current?.time_of_day || '18:00';
    const timezone = parsed.data.timezone || current?.timezone || TELEPHONY.DEFAULT_TIMEZONE;

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
  displayName: string;
  nextRunAt: string;
  timeOfDay: string;
  daysOfWeek: number[];
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
      enabled,
      ultaura_lines!inner (
        display_name
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

  return (schedules || []).map((schedule) => ({
    scheduleId: schedule.id,
    lineId: schedule.line_id,
    displayName: (schedule.ultaura_lines as { display_name: string }).display_name,
    nextRunAt: schedule.next_run_at!,
    timeOfDay: schedule.time_of_day,
    daysOfWeek: schedule.days_of_week,
  }));
}

export async function getAllSchedules(accountId: string): Promise<{
  scheduleId: string;
  lineId: string;
  displayName: string;
  enabled: boolean;
  nextRunAt: string | null;
  timeOfDay: string;
  daysOfWeek: number[];
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
      ultaura_lines!inner (
        display_name
      )
    `)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get all schedules');
    return [];
  }

  return (schedules || []).map((schedule) => ({
    scheduleId: schedule.id,
    lineId: schedule.line_id,
    displayName: (schedule.ultaura_lines as { display_name: string }).display_name,
    enabled: schedule.enabled,
    nextRunAt: schedule.next_run_at,
    timeOfDay: schedule.time_of_day,
    daysOfWeek: schedule.days_of_week,
  }));
}
