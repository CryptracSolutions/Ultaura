// Edit reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const editReminderRouter = Router();

interface EditReminderRequest {
  callSessionId: string;
  lineId: string;
  reminderId: string;
  newMessage?: string;
  newTimeLocal?: string; // ISO datetime in local time
  timezone?: string;
}

/**
 * Convert a local datetime string to UTC Date, respecting the given timezone.
 */
function localToUtc(localDateTimeStr: string, timezone: string): Date {
  const match = localDateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error('Invalid datetime format');
  }

  const [, year, month, day, hour, minute, second = '00'] = match;

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const roughUtc = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  const parts = formatter.formatToParts(roughUtc);
  const formatted: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      formatted[part.type] = part.value;
    }
  }

  const localInTz = new Date(
    `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}:${formatted.second}Z`
  );
  const offsetMs = localInTz.getTime() - roughUtc.getTime();

  const targetLocalMs = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
  return new Date(targetLocalMs - offsetMs);
}

editReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, reminderId, newMessage, newTimeLocal, timezone } = req.body as EditReminderRequest;

    if (!callSessionId || !lineId || !reminderId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!newMessage && !newTimeLocal) {
      res.json({
        success: false,
        message: 'What would you like to change? I can update the message or the time.',
      });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const supabase = getSupabaseClient();

    // Check if voice reminder control is allowed
    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('allow_voice_reminder_control, timezone')
      .eq('id', lineId)
      .single();

    if (lineError || !line) {
      res.status(500).json({ error: 'Failed to get line info' });
      return;
    }

    if (!line.allow_voice_reminder_control) {
      res.json({
        success: false,
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
      res.json({
        success: false,
        message: "I couldn't find that reminder. Would you like me to list your reminders?",
      });
      return;
    }

    if (reminder.status !== 'scheduled') {
      res.json({
        success: false,
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
        res.json({
          success: false,
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
        const newDueAt = localToUtc(newTimeLocal, tz);

        if (newDueAt <= new Date()) {
          res.json({
            success: false,
            message: 'That time is in the past. Please choose a future time.',
          });
          return;
        }

        oldValues.dueAt = reminder.due_at;
        updates.due_at = newDueAt.toISOString();

        // Update time_of_day for recurring reminders
        const hours = newDueAt.getUTCHours().toString().padStart(2, '0');
        const minutes = newDueAt.getUTCMinutes().toString().padStart(2, '0');
        updates.time_of_day = `${hours}:${minutes}`;

        changes.push('time');
      } catch (err) {
        logger.error({ err }, 'Failed to parse time');
        res.json({
          success: false,
          message: "I didn't understand that time. Could you say it differently?",
        });
        return;
      }
    }

    if (Object.keys(updates).length === 0) {
      res.json({
        success: false,
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
      changes,
    });

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
