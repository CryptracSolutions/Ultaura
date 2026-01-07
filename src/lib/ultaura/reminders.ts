'use server';

import { DateTime } from 'luxon';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import {
  CreateReminderInputSchema,
  EditReminderInputSchema as EditReminderInputSchemaZod,
  SnoozeInputSchema,
  VALID_SNOOZE_MINUTES,
  MAX_SNOOZE_COUNT,
  createError,
  ErrorCodes,
  type ActionResult,
} from '@ultaura/schemas';
import { localToUtc, getNextReminderOccurrence } from './timezone';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import { logReminderEvent } from './reminder-events';
import type { ReminderRow, UltauraAccountRow } from './types';

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

function getLocalTimeOfDay(utcDate: Date, timezone: string): string {
  const local = DateTime.fromJSDate(utcDate).setZone(timezone);
  return local.toFormat('HH:mm');
}

export async function getReminders(lineId: string): Promise<ReminderRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminders')
    .select('*')
    .eq('line_id', lineId)
    .order('due_at', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get reminders');
    return [];
  }

  return data || [];
}

export async function getReminder(reminderId: string): Promise<ReminderRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminders')
    .select('*')
    .eq('id', reminderId)
    .single();

  if (error) {
    logger.error({ error }, 'Failed to get reminder');
    return null;
  }

  return data;
}

const createReminderWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: unknown
): Promise<ActionResult<ReminderRow>> => {
  const parsed = CreateReminderInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const line = await getLine(parsed.data.lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const lineShortId = line.short_id;
  const timezone = parsed.data.timezone || line.timezone;

  let dueAtUtc: Date;
  try {
    dueAtUtc = parseInputDateTime(parsed.data.dueAt, timezone);
  } catch (error) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
    };
  }

  if (dueAtUtc.getTime() < Date.now()) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Reminder time must be in the future'),
    };
  }

  let isRecurring = false;
  let rrule: string | null = null;
  let intervalDays: number | null = null;
  let daysOfWeek: number[] | null = null;
  let dayOfMonth: number | null = null;
  let timeOfDay: string | null = null;
  let endsAt: string | null = null;

  if (parsed.data.recurrence) {
    isRecurring = true;
    const { frequency, interval, daysOfWeek: dow, dayOfMonth: dom, endsAt: ends } = parsed.data.recurrence;

    timeOfDay = getLocalTimeOfDay(dueAtUtc, timezone);

    const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

    switch (frequency) {
      case 'daily':
        {
          const dailyInterval = interval || 1;
          intervalDays = dailyInterval;
          rrule = dailyInterval > 1 ? `FREQ=DAILY;INTERVAL=${dailyInterval}` : 'FREQ=DAILY';
        }
        break;

      case 'weekly':
        {
          const daysOfWeekValue: number[] = dow && dow.length > 0
            ? dow
            : [DateTime.fromJSDate(dueAtUtc).setZone(timezone).weekday % 7];
          daysOfWeek = daysOfWeekValue;
          const byDay = daysOfWeekValue.map((day) => dayNames[day]).join(',');
          rrule = interval && interval > 1
            ? `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`
            : `FREQ=WEEKLY;BYDAY=${byDay}`;
        }
        break;

      case 'monthly':
        dayOfMonth = dom || DateTime.fromJSDate(dueAtUtc).setZone(timezone).day;
        rrule = interval && interval > 1
          ? `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${dayOfMonth}`
          : `FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth}`;
        break;

      case 'custom':
        {
          const customInterval = interval || 1;
          intervalDays = customInterval;
          rrule = `FREQ=DAILY;INTERVAL=${customInterval}`;
        }
        break;
    }

    if (ends) {
      try {
        const endsAtUtc = parseInputDateTime(ends, timezone);
        endsAt = endsAtUtc.toISOString();
      } catch (error) {
        return {
          success: false,
          error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
        };
      }
    }
  }

  const client = getSupabaseServerComponentClient();

  const { data: reminder, error } = await client
    .from('ultaura_reminders')
    .insert({
      account_id: account.id,
      line_id: parsed.data.lineId,
      due_at: dueAtUtc.toISOString(),
      timezone,
      message: parsed.data.message.trim(),
      delivery_method: 'outbound_call',
      status: 'scheduled',
      privacy_scope: 'line_only',
      is_recurring: isRecurring,
      rrule,
      interval_days: intervalDays,
      days_of_week: daysOfWeek,
      day_of_month: dayOfMonth,
      time_of_day: timeOfDay,
      ends_at: endsAt,
    })
    .select()
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create reminder');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to create reminder'),
    };
  }

  revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
  revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

  return { success: true, data: reminder };
});

export async function createReminder(input: unknown): Promise<ActionResult<ReminderRow>> {
  const parsed = CreateReminderInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const line = await getLine(parsed.data.lineId);
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

  return createReminderWithTrial(account, parsed.data);
}

export async function cancelReminder(reminderId: string, lineShortId: string): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Reminder not found'),
    };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const cancelWithTrial = withTrialCheck(async (
    _account: UltauraAccountRow,
    input: { reminder: ReminderRow }
  ): Promise<ActionResult<void>> => {
    if (input.reminder.status !== 'scheduled') {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Can only cancel scheduled reminders'),
      };
    }

    const { error } = await client
      .from('ultaura_reminders')
      .update({ status: 'canceled' })
      .eq('id', input.reminder.id);

    if (error) {
      logger.error({ error }, 'Failed to cancel reminder');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to cancel reminder'),
      };
    }

    await logReminderEvent({
      accountId: input.reminder.account_id,
      reminderId: input.reminder.id,
      lineId: input.reminder.line_id,
      eventType: 'canceled',
      triggeredBy: 'dashboard',
    });

    revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
    revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

    return { success: true, data: undefined };
  });

  return cancelWithTrial(account, { reminder });
}

function calculateNextReminderOccurrence(reminder: ReminderRow): string | null {
  if (!reminder.is_recurring || !reminder.rrule || !reminder.time_of_day) {
    return null;
  }

  try {
    const next = getNextReminderOccurrence({
      rrule: reminder.rrule,
      timezone: reminder.timezone,
      timeOfDay: reminder.time_of_day,
      currentDueAt: new Date(reminder.due_at),
      daysOfWeek: reminder.days_of_week,
      dayOfMonth: reminder.day_of_month,
      intervalDays: reminder.interval_days,
    });

    return next ? next.toISOString() : null;
  } catch (error) {
    logger.error({ error, reminderId: reminder.id }, 'Failed to calculate next reminder occurrence');
    return null;
  }
}

export async function skipNextOccurrence(reminderId: string, lineShortId: string): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Reminder not found'),
    };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const skipWithTrial = withTrialCheck(async (
    _account: UltauraAccountRow,
    input: { reminder: ReminderRow }
  ): Promise<ActionResult<void>> => {
    if (!input.reminder.is_recurring) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Can only skip recurring reminders'),
      };
    }

    if (input.reminder.status !== 'scheduled') {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Reminder is not scheduled'),
      };
    }

    const nextDueAt = calculateNextReminderOccurrence(input.reminder);

    if (!nextDueAt) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Could not calculate next occurrence'),
      };
    }

    if (input.reminder.ends_at && new Date(nextDueAt) > new Date(input.reminder.ends_at)) {
      return cancelReminder(reminderId, lineShortId);
    }

    const { error } = await client
      .from('ultaura_reminders')
      .update({
        due_at: nextDueAt,
      })
      .eq('id', input.reminder.id);

    if (error) {
      logger.error({ error }, 'Failed to skip reminder occurrence');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to skip occurrence'),
      };
    }

    revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
    revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

    await logReminderEvent({
      accountId: input.reminder.account_id,
      reminderId: input.reminder.id,
      lineId: input.reminder.line_id,
      eventType: 'skipped',
      triggeredBy: 'dashboard',
      metadata: { skippedDueAt: input.reminder.due_at, nextDueAt },
    });

    return { success: true, data: undefined };
  });

  return skipWithTrial(account, { reminder });
}

export async function pauseReminder(reminderId: string, lineShortId: string): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Reminder not found'),
    };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const pauseWithTrial = withTrialCheck(async (
    _account: UltauraAccountRow,
    input: { reminder: ReminderRow }
  ): Promise<ActionResult<void>> => {
    if (input.reminder.status !== 'scheduled') {
      return {
        success: false,
        error: createError(ErrorCodes.REMINDER_NOT_PAUSABLE, 'Can only pause scheduled reminders'),
      };
    }

    if (input.reminder.is_paused) {
      return {
        success: false,
        error: createError(ErrorCodes.REMINDER_NOT_PAUSABLE, 'Reminder is already paused'),
      };
    }

    const { error } = await client
      .from('ultaura_reminders')
      .update({
        is_paused: true,
        paused_at: new Date().toISOString(),
      })
      .eq('id', input.reminder.id);

    if (error) {
      logger.error({ error }, 'Failed to pause reminder');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to pause reminder'),
      };
    }

    await logReminderEvent({
      accountId: input.reminder.account_id,
      reminderId: input.reminder.id,
      lineId: input.reminder.line_id,
      eventType: 'paused',
      triggeredBy: 'dashboard',
    });

    revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
    revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

    return { success: true, data: undefined };
  });

  return pauseWithTrial(account, { reminder });
}

export async function resumeReminder(reminderId: string, lineShortId: string): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Reminder not found'),
    };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const resumeWithTrial = withTrialCheck(async (
    _account: UltauraAccountRow,
    input: { reminder: ReminderRow }
  ): Promise<ActionResult<void>> => {
    if (!input.reminder.is_paused) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Reminder is not paused'),
      };
    }

    const { error } = await client
      .from('ultaura_reminders')
      .update({
        is_paused: false,
        paused_at: null,
        current_snooze_count: 0,
      })
      .eq('id', input.reminder.id);

    if (error) {
      logger.error({ error }, 'Failed to resume reminder');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to resume reminder'),
      };
    }

    await logReminderEvent({
      accountId: input.reminder.account_id,
      reminderId: input.reminder.id,
      lineId: input.reminder.line_id,
      eventType: 'resumed',
      triggeredBy: 'dashboard',
    });

    revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
    revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

    return { success: true, data: undefined };
  });

  return resumeWithTrial(account, { reminder });
}

export async function snoozeReminder(
  reminderId: string,
  minutes: number,
  lineShortId: string
): Promise<ActionResult<{ newDueAt: string }>> {
  const parsed = SnoozeInputSchema.safeParse({ reminderId, minutes });
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

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Reminder not found'),
    };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const snoozeWithTrial = withTrialCheck(async (
    _account: UltauraAccountRow,
    input: { reminder: ReminderRow; minutes: number }
  ): Promise<ActionResult<{ newDueAt: string }>> => {
    if (!VALID_SNOOZE_MINUTES.includes(input.minutes as (typeof VALID_SNOOZE_MINUTES)[number])) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Invalid snooze duration'),
      };
    }

    if (input.reminder.status !== 'scheduled') {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Can only snooze scheduled reminders'),
      };
    }

    if (input.reminder.is_paused) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Cannot snooze a paused reminder'),
      };
    }

    if (input.reminder.current_snooze_count >= MAX_SNOOZE_COUNT) {
      return {
        success: false,
        error: createError(ErrorCodes.SNOOZE_LIMIT_REACHED, `Maximum snooze limit (${MAX_SNOOZE_COUNT}) reached`),
      };
    }

    const now = new Date();
    const newDueAt = new Date(now.getTime() + input.minutes * 60 * 1000);
    const originalDueAt = input.reminder.original_due_at || input.reminder.due_at;

    const { error } = await client
      .from('ultaura_reminders')
      .update({
        due_at: newDueAt.toISOString(),
        original_due_at: originalDueAt,
        snoozed_until: newDueAt.toISOString(),
        current_snooze_count: input.reminder.current_snooze_count + 1,
      })
      .eq('id', input.reminder.id);

    if (error) {
      logger.error({ error }, 'Failed to snooze reminder');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to snooze reminder'),
      };
    }

    await logReminderEvent({
      accountId: input.reminder.account_id,
      reminderId: input.reminder.id,
      lineId: input.reminder.line_id,
      eventType: 'snoozed',
      triggeredBy: 'dashboard',
      metadata: {
        snoozeMinutes: input.minutes,
        snoozeCount: input.reminder.current_snooze_count + 1,
        originalDueAt,
        newDueAt: newDueAt.toISOString(),
      },
    });

    revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
    revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

    return { success: true, data: { newDueAt: newDueAt.toISOString() } };
  });

  return snoozeWithTrial(account, { reminder, minutes });
}

export async function editReminder(
  reminderId: string,
  input: unknown,
  lineShortId: string
): Promise<ActionResult<void>> {
  const parsed = EditReminderInputSchemaZod.safeParse(input);
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

  const reminder = await getReminder(reminderId);
  if (!reminder) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Reminder not found'),
    };
  }

  const account = await getUltauraAccountById(reminder.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const editWithTrial = withTrialCheck(async (
    _account: UltauraAccountRow,
    inputData: { reminder: ReminderRow; updates: typeof parsed.data }
  ): Promise<ActionResult<void>> => {
    if (inputData.reminder.status !== 'scheduled') {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Can only edit scheduled reminders'),
      };
    }

    const updates: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};

    if (inputData.updates.message !== undefined && inputData.updates.message !== inputData.reminder.message) {
      if (!inputData.updates.message.trim()) {
        return {
          success: false,
          error: createError(ErrorCodes.INVALID_INPUT, 'Message cannot be empty'),
        };
      }
      oldValues.message = inputData.reminder.message;
      updates.message = inputData.updates.message.trim();
    }

    if (inputData.updates.dueAt !== undefined) {
      let dueAtUtc: Date;
      try {
        dueAtUtc = parseInputDateTime(inputData.updates.dueAt, inputData.reminder.timezone);
      } catch (error) {
        return {
          success: false,
          error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
        };
      }

      if (dueAtUtc <= new Date()) {
        return {
          success: false,
          error: createError(ErrorCodes.INVALID_INPUT, 'Due date must be in the future'),
        };
      }

      oldValues.dueAt = inputData.reminder.due_at;
      updates.due_at = dueAtUtc.toISOString();

      if (inputData.reminder.is_recurring) {
        updates.time_of_day = getLocalTimeOfDay(dueAtUtc, inputData.reminder.timezone);
      }
    }

    if (inputData.updates.recurrence !== undefined) {
      oldValues.isRecurring = inputData.reminder.is_recurring;
      oldValues.rrule = inputData.reminder.rrule;

      if (inputData.updates.recurrence.frequency === 'once') {
        updates.is_recurring = false;
        updates.rrule = null;
        updates.interval_days = null;
        updates.days_of_week = null;
        updates.day_of_month = null;
        updates.ends_at = null;
      } else {
        updates.is_recurring = true;

        const { frequency, interval = 1, daysOfWeek, dayOfMonth, endsAt } = inputData.updates.recurrence;
        let rrule = '';

        switch (frequency) {
          case 'daily':
            rrule = interval > 1 ? `FREQ=DAILY;INTERVAL=${interval}` : 'FREQ=DAILY';
            updates.interval_days = interval;
            break;
          case 'weekly':
            if (!daysOfWeek || daysOfWeek.length === 0) {
              return {
                success: false,
                error: createError(ErrorCodes.INVALID_INPUT, 'Weekly reminders require at least one day'),
              };
            }
            const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
            const byDay = daysOfWeek.map((day: number) => dayMap[day]).join(',');
            rrule = interval > 1
              ? `FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`
              : `FREQ=WEEKLY;BYDAY=${byDay}`;
            updates.days_of_week = daysOfWeek;
            break;
          case 'monthly':
            const day = dayOfMonth || 1;
            rrule = interval > 1
              ? `FREQ=MONTHLY;INTERVAL=${interval};BYMONTHDAY=${day}`
              : `FREQ=MONTHLY;BYMONTHDAY=${day}`;
            updates.day_of_month = day;
            break;
          case 'custom':
            rrule = `FREQ=DAILY;INTERVAL=${interval}`;
            updates.interval_days = interval;
            break;
        }

        updates.rrule = rrule;

        if (endsAt !== undefined) {
          if (endsAt === null) {
            updates.ends_at = null;
          } else {
            try {
              const endsAtUtc = parseInputDateTime(endsAt, inputData.reminder.timezone);
              updates.ends_at = endsAtUtc.toISOString();
            } catch (error) {
              return {
                success: false,
                error: createError(ErrorCodes.INVALID_INPUT, (error as Error).message),
              };
            }
          }
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'No changes to apply'),
      };
    }

    const { error } = await client
      .from('ultaura_reminders')
      .update(updates)
      .eq('id', inputData.reminder.id);

    if (error) {
      logger.error({ error }, 'Failed to edit reminder');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to edit reminder'),
      };
    }

    await logReminderEvent({
      accountId: inputData.reminder.account_id,
      reminderId: inputData.reminder.id,
      lineId: inputData.reminder.line_id,
      eventType: 'edited',
      triggeredBy: 'dashboard',
      metadata: { oldValues, newValues: updates },
    });

    revalidatePath(`/dashboard/lines/${lineShortId}/reminders`, 'page');
    revalidatePath(`/dashboard/lines/${lineShortId}`, 'page');

    return { success: true, data: undefined };
  });

  return editWithTrial(account, { reminder, updates: parsed.data });
}

export async function getPendingReminderCount(lineId: string): Promise<number> {
  const client = getSupabaseServerComponentClient();

  const { count, error } = await client
    .from('ultaura_reminders')
    .select('*', { count: 'exact', head: true })
    .eq('line_id', lineId)
    .eq('status', 'scheduled');

  if (error) {
    logger.error({ error }, 'Failed to get pending reminder count');
    return 0;
  }

  return count || 0;
}

export async function getNextReminder(lineId: string): Promise<ReminderRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminders')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'scheduled')
    .gte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(1)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error({ error }, 'Failed to get next reminder');
    }
    return null;
  }

  return data;
}

export async function getUpcomingReminders(accountId: string): Promise<{
  reminderId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
  message: string;
  dueAt: string;
  timezone: string;
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: reminders, error } = await client
    .from('ultaura_reminders')
    .select(`
      id,
      line_id,
      message,
      due_at,
      timezone,
      is_recurring,
      rrule,
      interval_days,
      days_of_week,
      day_of_month,
      ultaura_lines!inner (
        display_name,
        short_id
      )
    `)
    .eq('account_id', accountId)
    .eq('status', 'scheduled')
    .gte('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(10);

  if (error) {
    logger.error({ error }, 'Failed to get upcoming reminders');
    return [];
  }

  return (reminders || []).map((reminder) => ({
    reminderId: reminder.id,
    lineId: reminder.line_id,
    lineShortId: (reminder.ultaura_lines as { short_id: string }).short_id,
    displayName: (reminder.ultaura_lines as { display_name: string }).display_name,
    message: reminder.message,
    dueAt: reminder.due_at,
    timezone: reminder.timezone,
    isRecurring: reminder.is_recurring,
    rrule: reminder.rrule,
    intervalDays: reminder.interval_days,
    daysOfWeek: reminder.days_of_week,
    dayOfMonth: reminder.day_of_month,
  }));
}

export async function getAllReminders(accountId: string): Promise<{
  reminderId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
  message: string;
  dueAt: string;
  timezone: string;
  status: 'scheduled' | 'sent' | 'missed' | 'canceled';
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
}[]> {
  const client = getSupabaseServerComponentClient();

  const { data: reminders, error } = await client
    .from('ultaura_reminders')
    .select(`
      id,
      line_id,
      message,
      due_at,
      timezone,
      status,
      is_recurring,
      rrule,
      interval_days,
      days_of_week,
      day_of_month,
      ultaura_lines!inner (
        display_name,
        short_id
      )
    `)
    .eq('account_id', accountId)
    .order('due_at', { ascending: true });

  if (error) {
    logger.error({ error }, 'Failed to get all reminders');
    return [];
  }

  return (reminders || []).map((reminder) => ({
    reminderId: reminder.id,
    lineId: reminder.line_id,
    lineShortId: (reminder.ultaura_lines as { short_id: string }).short_id,
    displayName: (reminder.ultaura_lines as { display_name: string }).display_name,
    message: reminder.message,
    dueAt: reminder.due_at,
    timezone: reminder.timezone,
    status: reminder.status as 'scheduled' | 'sent' | 'missed' | 'canceled',
    isRecurring: reminder.is_recurring,
    rrule: reminder.rrule,
    intervalDays: reminder.interval_days,
    daysOfWeek: reminder.days_of_week,
    dayOfMonth: reminder.day_of_month,
  }));
}
