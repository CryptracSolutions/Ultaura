// Edit reminder tool handler

import { Router, Request, Response } from 'express';
import { ErrorCodes } from '@ultaura/schemas';
import {
  EditReminderInputSchema,
  type EditReminderInput,
} from '@ultaura/schemas/telephony';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { localToUtc, validateTimezone } from '../../utils/timezone.js';

export const editReminderRouter = Router();

const LOCAL_TIME_REGEX = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/;

editReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<EditReminderInput>;
    const parsed = EditReminderInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const missingRequired = issues.some((issue) =>
        issue.code === 'invalid_type' && issue.received === 'undefined'
      );
      if (missingRequired) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      const missingUpdate = issues.some((issue) => issue.message === 'Provide a message or time update');
      if (missingUpdate) {
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: 'What would you like to change? I can update the message or the time.',
        });
        return;
      }

      const messageTooLong = issues.find((issue) => issue.path[0] === 'newMessage' && issue.code === 'too_big');
      if (messageTooLong) {
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: 'That message is too long. Please keep it under 500 characters.',
        });
        return;
      }

      const timeIssue = issues.find((issue) => issue.path[0] === 'newTimeLocal');
      if (timeIssue) {
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: "I didn't understand that time. Please use HH:mm format.",
        });
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

    const { callSessionId, lineId, reminderId, newMessage, newTimeLocal, timezone } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'edit_reminder',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    const supabase = getSupabaseClient();

    // Check if voice reminder control is allowed
    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('allow_voice_reminder_control, timezone')
      .eq('id', lineId)
      .single();

    if (lineError || !line) {
      await recordFailure(lineError?.code);
      res.status(500).json({ error: 'Failed to get line info' });
      return;
    }

    if (!line.allow_voice_reminder_control) {
      await recordFailure();
      res.json({
        success: false,
        code: ErrorCodes.UNAUTHORIZED,
        message: "I'm sorry, but your caregiver has disabled reminder management by phone. Please ask them to make changes through the app.",
      });
      return;
    }

    // Get the reminder
    const { data: reminder, error: reminderError } = await supabase
      .from('ultaura_reminders')
      .select('*')
      .eq('id', reminderId)
      .eq('line_id', lineId)
      .single();

    if (reminderError || !reminder) {
      await recordFailure(reminderError?.code);
      res.json({
        success: false,
        code: ErrorCodes.NOT_FOUND,
        message: "I couldn't find that reminder. Would you like me to list your reminders?",
      });
      return;
    }

    if (reminder.status !== 'scheduled') {
      await recordFailure();
      res.json({
        success: false,
        code: ErrorCodes.INVALID_INPUT,
        message: 'This reminder is no longer active and cannot be edited.',
      });
      return;
    }

    // Build updates
    const updates: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};
    const changes: string[] = [];

    if (newMessage && newMessage.trim() !== reminder.message) {
      if (newMessage.length > 500) {
        await recordFailure();
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: 'That message is too long. Please keep it under 500 characters.',
        });
        return;
      }
      oldValues.message = reminder.message;
      updates.message = newMessage.trim();
      changes.push('message');
    }

    if (newTimeLocal) {
      const tz = timezone || line.timezone || reminder.timezone;
      try {
        validateTimezone(tz);
      } catch (error) {
        await recordFailure();
        res.status(400).json({ error: (error as Error).message });
        return;
      }

      const timeMatch = newTimeLocal.match(LOCAL_TIME_REGEX);
      if (!timeMatch) {
        await recordFailure();
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: "I didn't understand that time. Please use HH:mm format.",
        });
        return;
      }

      try {
        const newDueAt = localToUtc(newTimeLocal, tz);

        if (newDueAt <= new Date()) {
          await recordFailure();
          res.json({
            success: false,
            code: ErrorCodes.INVALID_INPUT,
            message: 'That time is in the past. Please choose a future time.',
          });
          return;
        }

        oldValues.dueAt = reminder.due_at;
        updates.due_at = newDueAt.toISOString();

        if (reminder.is_recurring) {
          const [, , hourStr, minuteStr] = timeMatch;
          updates.time_of_day = `${hourStr}:${minuteStr}`;
        }

        changes.push('time');
      } catch (err) {
        logger.error({ err }, 'Failed to parse time');
        await recordFailure();
        res.json({
          success: false,
          code: ErrorCodes.INVALID_INPUT,
          message: "I didn't understand that time. Could you say it differently?",
        });
        return;
      }
    }

    if (Object.keys(updates).length === 0) {
      await recordFailure();
      res.json({
        success: false,
        code: ErrorCodes.INVALID_INPUT,
        message: "Nothing seems to have changed. What would you like to update?",
      });
      return;
    }

    // Update the reminder
    const { error: updateError } = await supabase
      .from('ultaura_reminders')
      .update(updates)
      .eq('id', reminderId);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to edit reminder');
      await recordFailure(updateError.code);
      res.status(500).json({ error: 'Failed to edit reminder' });
      return;
    }

    // Log the event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: session.account_id,
      reminder_id: reminderId,
      line_id: lineId,
      event_type: 'edited',
      triggered_by: 'voice',
      call_session_id: callSessionId,
      metadata: { oldValues, newValues: updates },
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'edit_reminder',
      reminderId,
      success: true,
    }, { skipDebugLog: true });

    // Build response message
    const changesStr = changes.join(' and ');
    const finalMessage = updates.message || reminder.message;

    let timeInfo = '';
    if (updates.due_at) {
      const newDate = new Date(updates.due_at as string);
      timeInfo = ` It's now set for ${newDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })} at ${newDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })}.`;
    }

    res.json({
      success: true,
      message: `I've updated the ${changesStr} for your reminder.${timeInfo} The reminder now says "${finalMessage}". Is there anything else?`,
    });
  } catch (error) {
    logger.error({ error }, 'Error editing reminder');
    res.status(500).json({ error: 'Failed to edit reminder' });
  }
});
