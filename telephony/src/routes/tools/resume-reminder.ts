// Resume reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const resumeReminderRouter = Router();

interface ResumeReminderRequest {
  callSessionId: string;
  lineId: string;
  reminderId: string;
}

resumeReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, reminderId } = req.body as ResumeReminderRequest;

    if (!callSessionId || !lineId || !reminderId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'resume_reminder',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    const supabase = getSupabaseClient();

    // Check if voice reminder control is allowed
    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('allow_voice_reminder_control')
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
        message: "I couldn't find that reminder. Would you like me to list your reminders?",
      });
      return;
    }

    if (!reminder.is_paused) {
      await recordFailure();
      res.json({
        success: false,
        message: "This reminder isn't paused. It's already active.",
      });
      return;
    }

    // Resume the reminder
    const { error: updateError } = await supabase
      .from('ultaura_reminders')
      .update({
        is_paused: false,
        paused_at: null,
        current_snooze_count: 0, // Reset snooze count on resume
      })
      .eq('id', reminderId);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to resume reminder');
      await recordFailure(updateError.code);
      res.status(500).json({ error: 'Failed to resume reminder' });
      return;
    }

    // Log the event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: session.account_id,
      reminder_id: reminderId,
      line_id: lineId,
      event_type: 'resumed',
      triggered_by: 'voice',
      call_session_id: callSessionId,
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'resume_reminder',
      success: true,
      reminderId,
    }, { skipDebugLog: true });

    const dueDate = new Date(reminder.due_at);
    const dateStr = dueDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    const timeStr = dueDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    res.json({
      success: true,
      message: `I've resumed your reminder "${reminder.message}". It will fire on ${dateStr} at ${timeStr}. Is there anything else?`,
    });
  } catch (error) {
    logger.error({ error }, 'Error resuming reminder');
    res.status(500).json({ error: 'Failed to resume reminder' });
  }
});
