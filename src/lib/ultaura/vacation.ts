'use server';

import { DateTime } from 'luxon';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { Json } from '~/database.types';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import { logScheduleEvent } from './schedule-events';
import type { UltauraAccountRow } from './types';

const logger = getLogger();

export interface VacationRange {
  start: string;
  end: string;
}

export function parseVacationRanges(value: unknown): VacationRange[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((range) => {
      if (!range || typeof range !== 'object') return null;
      const start = (range as { start?: unknown }).start;
      const end = (range as { end?: unknown }).end;
      if (typeof start !== 'string' || typeof end !== 'string') return null;
      return { start, end };
    })
    .filter((range): range is VacationRange => Boolean(range));
}

function isRangeOverlap(a: VacationRange, b: VacationRange): boolean {
  return a.start <= b.end && a.end >= b.start;
}

function getTodayInTimezone(timezone: string): string | null {
  return DateTime.now().setZone(timezone).toISODate();
}

export async function getVacationRanges(lineId: string): Promise<VacationRange[]> {
  const line = await getLine(lineId);
  if (!line) return [];
  return parseVacationRanges(line.vacation_ranges);
}

export async function isLineOnVacation(lineId: string): Promise<boolean> {
  const line = await getLine(lineId);
  if (!line) return false;

  const today = getTodayInTimezone(line.timezone);
  if (!today) return false;

  const ranges = parseVacationRanges(line.vacation_ranges);
  return ranges.some((range) => today >= range.start && today <= range.end);
}

const addVacationRangeWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string; range: VacationRange }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();
  const line = await getLine(input.lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const { start, end } = input.range;
  if (start > end) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Start date must be before end date'),
    };
  }

  const today = getTodayInTimezone(line.timezone);
  if (today && start < today) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Vacation start date must be today or later'),
    };
  }

  const existing = parseVacationRanges(line.vacation_ranges);
  const overlaps = existing.some((range) => isRangeOverlap(range, input.range));
  if (overlaps) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Vacation range overlaps an existing range'),
    };
  }

  const updated = [...existing, input.range].sort((a, b) => a.start.localeCompare(b.start));

  const { error: updateError } = await client
    .from('ultaura_lines')
    .update({ vacation_ranges: updated as unknown as Json })
    .eq('id', line.id);

  if (updateError) {
    logger.error({ error: updateError }, 'Failed to update vacation ranges');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update vacation ranges'),
    };
  }

  const { data: schedules } = await client
    .from('ultaura_schedules')
    .select('id, account_id, line_id')
    .eq('line_id', line.id);

  if (schedules && schedules.length > 0) {
    await Promise.all(
      schedules.map((schedule) =>
        logScheduleEvent({
          accountId: schedule.account_id,
          scheduleId: schedule.id,
          lineId: schedule.line_id,
          eventType: 'vacation_started',
          triggeredBy: 'dashboard',
          metadata: { start, end },
        })
      )
    );
  }

  revalidatePath(`/dashboard/lines/${line.short_id}/settings`, 'page');
  revalidatePath(`/dashboard/lines/${line.short_id}`, 'page');
  revalidatePath('/dashboard', 'page');

  return { success: true, data: undefined };
});

export async function addVacationRange(
  lineId: string,
  range: VacationRange
): Promise<ActionResult<void>> {
  const line = await getLine(lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return addVacationRangeWithTrial(account, { lineId, range });
}

const removeVacationRangeWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string; start: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();
  const line = await getLine(input.lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const ranges = parseVacationRanges(line.vacation_ranges);
  const target = ranges.find((range) => range.start === input.start);
  if (!target) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Vacation range not found'),
    };
  }

  const today = getTodayInTimezone(line.timezone);
  // Allow removing active or upcoming ranges to end vacation early; only block fully past ranges.
  if (today && target.end < today) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Past vacation ranges cannot be removed'),
    };
  }

  const updated = ranges.filter((range) => range.start !== input.start);

  const { error: updateError } = await client
    .from('ultaura_lines')
    .update({ vacation_ranges: updated as unknown as Json })
    .eq('id', line.id);

  if (updateError) {
    logger.error({ error: updateError }, 'Failed to remove vacation range');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove vacation range'),
    };
  }

  const { data: schedules } = await client
    .from('ultaura_schedules')
    .select('id, account_id, line_id')
    .eq('line_id', line.id);

  if (schedules && schedules.length > 0) {
    await Promise.all(
      schedules.map((schedule) =>
        logScheduleEvent({
          accountId: schedule.account_id,
          scheduleId: schedule.id,
          lineId: schedule.line_id,
          eventType: 'vacation_ended',
          triggeredBy: 'dashboard',
          metadata: { start: target.start, end: target.end },
        })
      )
    );
  }

  revalidatePath(`/dashboard/lines/${line.short_id}/settings`, 'page');
  revalidatePath(`/dashboard/lines/${line.short_id}`, 'page');
  revalidatePath('/dashboard', 'page');

  return { success: true, data: undefined };
});

export async function removeVacationRange(
  lineId: string,
  start: string
): Promise<ActionResult<void>> {
  const line = await getLine(lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return removeVacationRangeWithTrial(account, { lineId, start });
}
