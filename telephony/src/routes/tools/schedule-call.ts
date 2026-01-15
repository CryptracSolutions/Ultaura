// Schedule call tool handler

import { Router, Request, Response } from 'express';
import { ErrorCodes } from '@ultaura/schemas';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getLineById } from '../../services/line-lookup.js';
import { getNextOccurrence, validateTimezone } from '../../utils/timezone.js';

export const scheduleCallRouter = Router();

interface ScheduleCallRequest {
  callSessionId: string;
  lineId: string;
  mode: 'one_off' | 'update_recurring';
  // For recurring
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  timeLocal?: string; // HH:mm format
  timezone?: string;
}

function buildEditMetadata(prev: {
  days_of_week: number[];
  time_of_day: string;
  timezone: string;
}, next: {
  days_of_week: number[];
  time_of_day: string;
  timezone: string;
}): Record<string, unknown> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  if (JSON.stringify(prev.days_of_week) !== JSON.stringify(next.days_of_week)) {
    changes.days_of_week = { old: prev.days_of_week, new: next.days_of_week };
  }
  if (prev.time_of_day !== next.time_of_day) {
    changes.time_of_day = { old: prev.time_of_day, new: next.time_of_day };
  }
  if (prev.timezone !== next.timezone) {
    changes.timezone = { old: prev.timezone, new: next.timezone };
  }

  if (Object.keys(changes).length === 0) return null;

  return {
    changes,
    summary: 'Updated schedule by phone',
  };
}

scheduleCallRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      mode,
      daysOfWeek,
      timeLocal,
      timezone,
    } = req.body as ScheduleCallRequest;

    logger.info({ callSessionId, lineId, mode }, 'Schedule call request');

    // Validate required fields
    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get call session
    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'schedule_call',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (mode === 'one_off') {
      await recordFailure();
      res.status(400).json({
        error: 'One-time calls should use the set_reminder tool',
        suggestion: 'Use set_reminder with dueAt and message parameters',
      });
      return;
    }

    if (!mode || mode !== 'update_recurring') {
      await recordFailure();
      res.status(400).json({ error: 'Invalid or missing mode' });
      return;
    }

    // Get line info
    const lineWithAccount = await getLineById(lineId);
    if (!lineWithAccount) {
      await recordFailure();
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const { line } = lineWithAccount;

    if (!line.allow_voice_schedule_control) {
      await recordFailure();
      res.json({
        success: false,
        code: ErrorCodes.UNAUTHORIZED,
        message: "I'm sorry, but your caregiver has disabled schedule changes by phone. Please ask them to make changes through the app.",
      });
      return;
    }

    // Check if line is opted out
    if (line.do_not_call) {
      await recordFailure();
      res.status(400).json({
        error: 'Line has opted out of calls',
        message: 'I understand you\'ve opted out of calls. If you\'d like to receive calls again, please let your family member know.',
      });
      return;
    }

    const supabase = getSupabaseClient();
    const tz = timezone || line.timezone;
    try {
      validateTimezone(tz);
    } catch (error) {
      await recordFailure();
      res.status(400).json({ error: (error as Error).message });
      return;
    }

    if (mode === 'update_recurring') {
      // Update recurring schedule
      if (!daysOfWeek || daysOfWeek.length === 0 || !timeLocal) {
        await recordFailure();
        res.status(400).json({ error: 'Missing daysOfWeek or timeLocal for recurring schedule' });
        return;
      }

      // Validate days of week
      const validDays = daysOfWeek.filter(d => d >= 0 && d <= 6);
      if (validDays.length === 0) {
        await recordFailure();
        res.status(400).json({ error: 'Invalid days of week' });
        return;
      }

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
        await recordFailure();
        res.status(400).json({ error: 'Invalid time format (use HH:mm)' });
        return;
      }
      const [hours, minutes] = timeLocal.split(':').map(Number);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        await recordFailure();
        res.status(400).json({ error: 'Invalid time value (use HH:mm)' });
        return;
      }

      const nextRun = getNextOccurrence({
        timeOfDay: timeLocal,
        timezone: tz,
        daysOfWeek: validDays,
      });

      // Check for existing schedule and update or create
      const { data: existing } = await supabase
        .from('ultaura_schedules')
        .select('id, days_of_week, time_of_day, timezone')
        .eq('line_id', lineId)
        .eq('enabled', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let schedule;

      if (existing) {
        // Update existing schedule
        const { data, error } = await supabase
          .from('ultaura_schedules')
          .update({
            timezone: tz,
            days_of_week: validDays,
            time_of_day: timeLocal,
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          logger.error({ error }, 'Failed to update schedule');
          await recordFailure(error.code);
          res.status(500).json({ error: 'Failed to update schedule' });
          return;
        }

        schedule = data;

        const editMetadata = buildEditMetadata(existing, {
          days_of_week: validDays,
          time_of_day: timeLocal,
          timezone: tz,
        });

        if (editMetadata) {
          await supabase.from('ultaura_schedule_events').insert({
            account_id: session.account_id,
            schedule_id: existing.id,
            line_id: lineId,
            event_type: 'edited',
            triggered_by: 'voice',
            call_session_id: callSessionId,
            metadata: editMetadata,
          });
        }
      } else {
        // Create new schedule
        const { data, error } = await supabase
          .from('ultaura_schedules')
          .insert({
            account_id: session.account_id,
            line_id: lineId,
            enabled: true,
            timezone: tz,
            days_of_week: validDays,
            time_of_day: timeLocal,
            next_run_at: nextRun.toISOString(),
          })
          .select()
          .single();

        if (error) {
          logger.error({ error }, 'Failed to create schedule');
          await recordFailure(error.code);
          res.status(500).json({ error: 'Failed to create schedule' });
          return;
        }

        schedule = data;

        await supabase.from('ultaura_schedule_events').insert({
          account_id: session.account_id,
          schedule_id: schedule.id,
          line_id: lineId,
          event_type: 'created',
          triggered_by: 'voice',
          call_session_id: callSessionId,
          metadata: {
            source: 'voice',
            days_of_week: validDays,
            time_of_day: timeLocal,
            timezone: tz,
          },
        });
      }

      // Update line's next scheduled call
      await supabase
        .from('ultaura_lines')
        .update({ next_scheduled_call_at: nextRun.toISOString() })
        .eq('id', lineId);

      // Record tool invocation
      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'schedule_call',
        success: true,
        mode: 'update_recurring',
        scheduleId: schedule.id,
      }, { skipDebugLog: true });

      // Format days for message
      const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const formattedDays = validDays.map(d => dayLabels[d]).join(', ');

      res.json({
        success: true,
        scheduleId: schedule.id,
        message: `I've updated your schedule. I'll call you on ${formattedDays} at ${timeLocal}`,
      });
    }

  } catch (error) {
    logger.error({ error }, 'Error scheduling call');
    res.status(500).json({ error: 'Internal server error' });
  }
});
