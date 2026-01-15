// Reschedule schedule tool handler

import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { ErrorCodes } from '@ultaura/schemas';
import {
  RescheduleScheduleInputSchema,
  type RescheduleScheduleInput,
} from '@ultaura/schemas/telephony';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { localToUtc } from '../../utils/timezone.js';
import {
  calculateNextRun,
  getScheduleForTool,
  normalizeTimeOfDay,
  updateLineNextScheduledCallAt,
} from '../../utils/schedule-helpers.js';

export const rescheduleScheduleRouter = Router();

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

rescheduleScheduleRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<RescheduleScheduleInput>;
    const parsed = RescheduleScheduleInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const missingRequired = issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      res.status(400).json({ error: issues[0]?.message || 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, scheduleId, newDatetime } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'reschedule_schedule',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    const supabase = getSupabaseClient();

    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('allow_voice_schedule_control, timezone')
      .eq('id', lineId)
      .single();

    if (lineError || !line) {
      await recordFailure(lineError?.code);
      res.status(500).json({ error: 'Failed to get line info' });
      return;
    }

    if (!line.allow_voice_schedule_control) {
      await recordFailure();
      res.json({
        success: false,
        code: ErrorCodes.UNAUTHORIZED,
        message: "I'm sorry, but your caregiver has disabled schedule changes by phone. Please ask them to make changes through the app.",
      });
      return;
    }

    const { schedule, error: scheduleError } = await getScheduleForTool({
      lineId,
      scheduleId,
      supabase,
    });

    if (scheduleError || !schedule || !schedule.next_run_at) {
      await recordFailure(scheduleError?.code);
      res.json({
        success: false,
        code: ErrorCodes.NOT_FOUND,
        message: "I couldn't find any upcoming scheduled calls to move.",
      });
      return;
    }

    let newUtc: Date;
    try {
      newUtc = parseInputDateTime(newDatetime, line.timezone);
    } catch (error) {
      await recordFailure();
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (newUtc.getTime() <= Date.now()) {
      await recordFailure();
      res.json({
        success: false,
        code: ErrorCodes.INVALID_INPUT,
        message: 'The new time needs to be in the future.',
      });
      return;
    }

    const newIso = newUtc.toISOString();
    const localDate = DateTime.fromISO(schedule.next_run_at).setZone(schedule.timezone).toISODate();
    if (!localDate) {
      await recordFailure();
      res.status(400).json({ error: 'Invalid schedule date' });
      return;
    }

    const oneTimeLocal = DateTime.fromJSDate(newUtc).setZone(schedule.timezone);
    const timeOfDay = oneTimeLocal.toFormat('HH:mm');

    const { data: oneTimeSchedule, error: oneTimeError } = await supabase
      .from('ultaura_schedules')
      .insert({
        account_id: session.account_id,
        line_id: lineId,
        enabled: true,
        timezone: schedule.timezone,
        days_of_week: [],
        time_of_day: timeOfDay,
        next_run_at: newIso,
        retry_policy: schedule.retry_policy ?? { max_retries: 2, retry_window_minutes: 30 },
        is_one_time: true,
      })
      .select('id')
      .single();

    if (oneTimeError || !oneTimeSchedule) {
      await recordFailure(oneTimeError?.code);
      res.status(500).json({ error: 'Failed to create one-time schedule' });
      return;
    }

    const createdAtLocal = DateTime.now().setZone(line.timezone).toISO({ suppressMilliseconds: true });
    const metadata = {
      original_time_of_day: normalizeTimeOfDay(schedule.time_of_day),
      created_at_local: createdAtLocal,
      rescheduled_to: newIso,
      reschedule_schedule_id: oneTimeSchedule.id,
      call_session_id: callSessionId,
    };

    const { data: exception, error: insertError } = await supabase
      .from('ultaura_schedule_exceptions')
      .insert({
        account_id: session.account_id,
        schedule_id: schedule.id,
        line_id: lineId,
        exception_date: localDate,
        exception_type: 'reschedule',
        new_datetime: newIso,
        reschedule_schedule_id: oneTimeSchedule.id,
        created_by: 'voice',
        call_session_id: callSessionId,
        metadata,
      })
      .select('id')
      .single();

    if (insertError || !exception) {
      await recordFailure(insertError?.code);
      const duplicate = insertError?.code === '23505';
      if (duplicate) {
        await supabase.from('ultaura_schedules').delete().eq('id', oneTimeSchedule.id);
      }
      res.json({
        success: false,
        code: duplicate ? ErrorCodes.ALREADY_EXISTS : ErrorCodes.DATABASE_ERROR,
        message: duplicate
          ? "There's already a change for that call."
          : 'Failed to reschedule the call. Please try again.',
      });
      return;
    }

    const shouldAdvance = localDate === DateTime.fromISO(schedule.next_run_at).setZone(schedule.timezone).toISODate();
    if (shouldAdvance) {
      const nextRun = calculateNextRun(schedule);
      await supabase
        .from('ultaura_schedules')
        .update({ next_run_at: nextRun, retry_count: 0 })
        .eq('id', schedule.id);
      await updateLineNextScheduledCallAt(lineId);
    }

    await supabase.from('ultaura_schedule_events').insert({
      account_id: session.account_id,
      schedule_id: schedule.id,
      line_id: lineId,
      event_type: 'exception_added',
      triggered_by: 'voice',
      call_session_id: callSessionId,
      metadata: {
        exception_type: 'reschedule',
        exception_date: localDate,
        new_datetime: newIso,
        reschedule_schedule_id: oneTimeSchedule.id,
      },
    });

    await supabase.from('ultaura_schedule_events').insert({
      account_id: session.account_id,
      schedule_id: oneTimeSchedule.id,
      line_id: lineId,
      event_type: 'created',
      triggered_by: 'voice',
      call_session_id: callSessionId,
      metadata: {
        source: 'reschedule',
        original_schedule_id: schedule.id,
        exception_id: exception.id,
      },
    });

    await updateLineNextScheduledCallAt(lineId);

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'reschedule_schedule',
      success: true,
      scheduleId: schedule.id,
      rescheduleScheduleId: oneTimeSchedule.id,
    }, { skipDebugLog: true });

    const formattedDate = DateTime.fromJSDate(newUtc)
      .setZone(line.timezone)
      .toLocaleString(DateTime.DATETIME_FULL);

    res.json({
      success: true,
      newDatetime: newIso,
      message: `Okay, I've moved your call to ${formattedDate}.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error rescheduling schedule');
    res.status(500).json({ error: 'Failed to reschedule schedule' });
  }
});
