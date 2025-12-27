// Cancel reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const cancelReminderRouter = Router();

interface CancelReminderRequest {
  callSessionId: string;
  lineId: string;
  reminderId: string;
}

cancelReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, reminderId } = req.body as CancelReminderRequest;

    if (!callSessionId || !lineId || !reminderId) {
      res.status(400).json({ error: 'Missing required fields' });
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
      .select('allow_voice_reminder_control')
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
        message: 'This reminder is no longer active.',
      });
      return;
    }

    // Cancel the reminder
    const { error: updateError } = await supabase
      .from('ultaura_reminders')
      .update({ status: 'canceled' })
      .eq('id', reminderId);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to cancel reminder');
      res.status(500).json({ error: 'Failed to cancel reminder' });
      return;
    }

    // Log the event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: session.account_id,
      reminder_id: reminderId,
      line_id: lineId,
      event_type: 'canceled',
      triggered_by: 'voice',
      call_session_id: callSessionId,
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'cancel_reminder',
      reminderId,
    });

    const seriesNote = reminder.is_recurring
      ? ' The entire recurring series has been canceled.'
      : '';

    res.json({
      success: true,
      message: `I've canceled your reminder "${reminder.message}".${seriesNote} Is there anything else you'd like me to do?`,
    });
  } catch (error) {
    logger.error({ error }, 'Error canceling reminder');
    res.status(500).json({ error: 'Failed to cancel reminder' });
  }
});
