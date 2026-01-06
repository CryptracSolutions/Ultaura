// Snooze reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const snoozeReminderRouter = Router();

const MAX_SNOOZE_COUNT = 3;
const VALID_SNOOZE_MINUTES = [15, 30, 60, 120, 1440]; // 15m, 30m, 1h, 2h, tomorrow

interface SnoozeReminderRequest {
  callSessionId: string;
  lineId: string;
  reminderId?: string; // Optional - can be inferred from reminder call
  snoozeMinutes: number;
}

snoozeReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, reminderId, snoozeMinutes } = req.body as SnoozeReminderRequest;

    if (!callSessionId || !lineId || !snoozeMinutes) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!VALID_SNOOZE_MINUTES.includes(snoozeMinutes)) {
      res.json({
        success: false,
        message: 'Please choose 15 minutes, 30 minutes, 1 hour, 2 hours, or tomorrow.',
      });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'snooze_reminder',
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

    // Determine which reminder to snooze
    let targetReminderId = reminderId;

    // If no reminderId provided, check if this is a reminder call
    if (!targetReminderId && session.reminder_id) {
      targetReminderId = session.reminder_id;
    }

    if (!targetReminderId) {
      await recordFailure();
      res.json({
        success: false,
        message: "I'm not sure which reminder you want to snooze. Could you tell me which one?",
      });
      return;
    }

    // Get the reminder
    const { data: reminder, error: reminderError } = await supabase
      .from('ultaura_reminders')
      .select('*')
      .eq('id', targetReminderId)
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

    if (reminder.status !== 'scheduled') {
      await recordFailure();
      res.json({
        success: false,
        message: 'This reminder is no longer active.',
      });
      return;
    }

    if (reminder.is_paused) {
      await recordFailure();
      res.json({
        success: false,
        message: "This reminder is paused. You'll need to resume it first.",
      });
      return;
    }

    // Check snooze limit
    if (reminder.current_snooze_count >= MAX_SNOOZE_COUNT) {
      await recordFailure();
      res.json({
        success: false,
        message: `You've already snoozed this reminder ${MAX_SNOOZE_COUNT} times. I can't snooze it again.`,
      });
      return;
    }

    // Calculate new due time
    const now = new Date();
    const newDueAt = new Date(now.getTime() + snoozeMinutes * 60 * 1000);
    const originalDueAt = reminder.original_due_at || reminder.due_at;

    // Update the reminder
    const { error: updateError } = await supabase
      .from('ultaura_reminders')
      .update({
        due_at: newDueAt.toISOString(),
        original_due_at: originalDueAt,
        snoozed_until: newDueAt.toISOString(),
        current_snooze_count: reminder.current_snooze_count + 1,
      })
      .eq('id', targetReminderId);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to snooze reminder');
      await recordFailure(updateError.code);
      res.status(500).json({ error: 'Failed to snooze reminder' });
      return;
    }

    // Log the event
    await supabase.from('ultaura_reminder_events').insert({
      account_id: session.account_id,
      reminder_id: targetReminderId,
      line_id: lineId,
      event_type: 'snoozed',
      triggered_by: 'voice',
      call_session_id: callSessionId,
      metadata: {
        snoozeMinutes,
        snoozeCount: reminder.current_snooze_count + 1,
        originalDueAt,
        newDueAt: newDueAt.toISOString(),
      },
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'snooze_reminder',
      success: true,
      reminderId: targetReminderId,
      snoozeMinutes,
    }, { skipDebugLog: true });

    // Build response message
    let snoozeDuration: string;
    if (snoozeMinutes === 1440) {
      snoozeDuration = 'until tomorrow';
    } else if (snoozeMinutes >= 60) {
      snoozeDuration = `for ${snoozeMinutes / 60} hour${snoozeMinutes > 60 ? 's' : ''}`;
    } else {
      snoozeDuration = `for ${snoozeMinutes} minutes`;
    }

    const remainingSnoozes = MAX_SNOOZE_COUNT - (reminder.current_snooze_count + 1);
    const snoozeNote = remainingSnoozes > 0
      ? ` You can snooze ${remainingSnoozes} more time${remainingSnoozes > 1 ? 's' : ''}.`
      : " That was your last snooze for this reminder.";

    res.json({
      success: true,
      newDueAt: newDueAt.toISOString(),
      snoozeCount: reminder.current_snooze_count + 1,
      message: `Okay, I've snoozed your reminder ${snoozeDuration}.${snoozeNote} Is there anything else?`,
    });
  } catch (error) {
    logger.error({ error }, 'Error snoozing reminder');
    res.status(500).json({ error: 'Failed to snooze reminder' });
  }
});
