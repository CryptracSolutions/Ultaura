// Snooze schedule tool handler

import { Router, Request, Response } from 'express';
import { DateTime } from 'luxon';
import { ErrorCodes } from '@ultaura/schemas';
import {
  SnoozeScheduleInputSchema,
  type SnoozeScheduleInput,
} from '@ultaura/schemas/telephony';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import {
  getScheduleForTool,
  normalizeTimeOfDay,
  updateLineNextScheduledCallAt,
} from '../../utils/schedule-helpers.js';

export const snoozeScheduleRouter = Router();

 

snoozeScheduleRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<SnoozeScheduleInput>;
    const parsed = SnoozeScheduleInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const missingRequired = issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const snoozeIssue = issues.find((issue) => issue.path[0] === 'snoozeMinutes');
      if (snoozeIssue) {
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: 'Please choose a time between 5 minutes and 24 hours from now.',
        });
        return;
      }

      res.status(400).json({ error: issues[0]?.message || 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, scheduleId, snoozeMinutes } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'snooze_schedule',
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
        message: "I couldn't find any upcoming scheduled calls to snooze.",
      });
      return;
    }

    const localDate = DateTime.fromISO(schedule.next_run_at).setZone(schedule.timezone).toISODate();
    if (!localDate) {
      await recordFailure();
      res.status(400).json({ error: 'Invalid schedule date' });
      return;
    }

    const snoozedAt = DateTime.utc().plus({ minutes: snoozeMinutes });
    const snoozedIso = snoozedAt.toISO();
    if (!snoozedIso) {
      await recordFailure();
      res.status(500).json({ error: 'Failed to calculate snooze time' });
      return;
    }

    const createdAtLocal = DateTime.now().setZone(line.timezone).toISO({ suppressMilliseconds: true });
    const metadata = {
      original_time_of_day: normalizeTimeOfDay(schedule.time_of_day),
      created_at_local: createdAtLocal,
      snooze_minutes: snoozeMinutes,
      call_session_id: callSessionId,
    };

    const { data: exception, error: insertError } = await supabase
      .from('ultaura_schedule_exceptions')
      .insert({
        account_id: session.account_id,
        schedule_id: schedule.id,
        line_id: lineId,
        exception_date: localDate,
        exception_type: 'snooze',
        new_datetime: snoozedIso,
        created_by: 'voice',
        call_session_id: callSessionId,
        metadata,
      })
      .select('id')
      .single();

    if (insertError || !exception) {
      await recordFailure(insertError?.code);
      const duplicate = insertError?.code === '23505';
      res.json({
        success: false,
        code: duplicate ? ErrorCodes.ALREADY_EXISTS : ErrorCodes.DATABASE_ERROR,
        message: duplicate
          ? "There's already a change for that call."
          : 'Failed to snooze the schedule. Please try again.',
      });
      return;
    }

    const shouldAdvance = localDate === DateTime.fromISO(schedule.next_run_at).setZone(schedule.timezone).toISODate();
    if (shouldAdvance) {
      await supabase
        .from('ultaura_schedules')
        .update({ next_run_at: snoozedIso, retry_count: 0 })
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
        exception_type: 'snooze',
        exception_date: localDate,
        new_datetime: snoozedIso,
      },
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'snooze_schedule',
      success: true,
      scheduleId: schedule.id,
      snoozeMinutes,
    }, { skipDebugLog: true });

    const localTimeLabel = snoozedAt.setZone(line.timezone).toLocaleString(DateTime.TIME_SIMPLE);
    const durationLabel = snoozeMinutes >= 60
      ? `${Math.round(snoozeMinutes / 60)} hour${snoozeMinutes >= 120 ? 's' : ''}`
      : `${snoozeMinutes} minutes`;

    res.json({
      success: true,
      newDatetime: snoozedIso,
      message: `Got it! I'll call you back in ${durationLabel}, around ${localTimeLabel}.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error snoozing schedule');
    res.status(500).json({ error: 'Failed to snooze schedule' });
  }
});
