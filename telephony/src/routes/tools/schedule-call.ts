// Schedule call tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getLineById } from '../../services/line-lookup.js';

export const scheduleCallRouter = Router();

interface ScheduleCallRequest {
  callSessionId: string;
  lineId: string;
  mode: 'one_off' | 'update_recurring';
  // For one-off
  when?: string; // ISO timestamp
  // For recurring
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  timeLocal?: string; // HH:mm format
  timezone?: string;
}

scheduleCallRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      mode,
      when,
      daysOfWeek,
      timeLocal,
      timezone,
    } = req.body as ScheduleCallRequest;

    logger.info({ callSessionId, lineId, mode }, 'Schedule call request');

    // Validate required fields
    if (!callSessionId || !lineId || !mode) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get call session
    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // Get line info
    const lineWithAccount = await getLineById(lineId);
    if (!lineWithAccount) {
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const { line } = lineWithAccount;

    // Check if line is opted out
    if (line.do_not_call) {
      res.status(400).json({
        error: 'Line has opted out of calls',
        message: 'I understand you\'ve opted out of calls. If you\'d like to receive calls again, please let your family member know.',
      });
      return;
    }

    const supabase = getSupabaseClient();
    const tz = timezone || line.timezone;

    if (mode === 'one_off') {
      // One-off scheduled call
      if (!when) {
        res.status(400).json({ error: 'Missing "when" for one-off schedule' });
        return;
      }

      const callTime = new Date(when);
      if (callTime.getTime() < Date.now()) {
        res.status(400).json({ error: 'Scheduled time is in the past' });
        return;
      }

      // Create a one-off schedule
      const { data: schedule, error } = await supabase
        .from('ultaura_schedules')
        .insert({
          account_id: session.account_id,
          line_id: lineId,
          enabled: true,
          timezone: tz,
          rrule: 'FREQ=DAILY;COUNT=1', // One-time
          days_of_week: [callTime.getDay()],
          time_of_day: callTime.toTimeString().slice(0, 5),
          next_run_at: callTime.toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error({ error }, 'Failed to create one-off schedule');
        res.status(500).json({ error: 'Failed to schedule call' });
        return;
      }

      // Record tool invocation
      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'schedule_call',
        mode: 'one_off',
        scheduleId: schedule.id,
        nextRunAt: schedule.next_run_at,
      });

      res.json({
        success: true,
        scheduleId: schedule.id,
        message: `I'll call you at ${callTime.toLocaleString()}`,
      });

    } else if (mode === 'update_recurring') {
      // Update recurring schedule
      if (!daysOfWeek || daysOfWeek.length === 0 || !timeLocal) {
        res.status(400).json({ error: 'Missing daysOfWeek or timeLocal for recurring schedule' });
        return;
      }

      // Validate days of week
      const validDays = daysOfWeek.filter(d => d >= 0 && d <= 6);
      if (validDays.length === 0) {
        res.status(400).json({ error: 'Invalid days of week' });
        return;
      }

      // Validate time format
      if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
        res.status(400).json({ error: 'Invalid time format (use HH:mm)' });
        return;
      }

      // Build RRULE
      const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const rruleDays = validDays.map(d => dayNames[d]).join(',');
      const rrule = `FREQ=WEEKLY;BYDAY=${rruleDays}`;

      // Calculate next run time
      const now = new Date();
      const [hours, minutes] = timeLocal.split(':').map(Number);

      // Find the next occurrence
      let nextRun = new Date();
      nextRun.setHours(hours, minutes, 0, 0);

      // If today's time has passed, start from tomorrow
      if (nextRun.getTime() <= now.getTime()) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      // Find the next matching day
      while (!validDays.includes(nextRun.getDay())) {
        nextRun.setDate(nextRun.getDate() + 1);
      }

      // Check for existing schedule and update or create
      const { data: existing } = await supabase
        .from('ultaura_schedules')
        .select('id')
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
            rrule,
            days_of_week: validDays,
            time_of_day: timeLocal,
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) {
          logger.error({ error }, 'Failed to update schedule');
          res.status(500).json({ error: 'Failed to update schedule' });
          return;
        }

        schedule = data;
      } else {
        // Create new schedule
        const { data, error } = await supabase
          .from('ultaura_schedules')
          .insert({
            account_id: session.account_id,
            line_id: lineId,
            enabled: true,
            timezone: tz,
            rrule,
            days_of_week: validDays,
            time_of_day: timeLocal,
            next_run_at: nextRun.toISOString(),
          })
          .select()
          .single();

        if (error) {
          logger.error({ error }, 'Failed to create schedule');
          res.status(500).json({ error: 'Failed to create schedule' });
          return;
        }

        schedule = data;
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
        mode: 'update_recurring',
        scheduleId: schedule.id,
        daysOfWeek: validDays,
        timeLocal,
      });

      // Format days for message
      const dayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const formattedDays = validDays.map(d => dayLabels[d]).join(', ');

      res.json({
        success: true,
        scheduleId: schedule.id,
        message: `I've updated your schedule. I'll call you on ${formattedDays} at ${timeLocal}`,
      });

    } else {
      res.status(400).json({ error: 'Invalid mode' });
    }

  } catch (error) {
    logger.error({ error }, 'Error scheduling call');
    res.status(500).json({ error: 'Internal server error' });
  }
});
