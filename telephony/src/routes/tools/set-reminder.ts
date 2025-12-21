// Set reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const setReminderRouter = Router();

interface SetReminderRequest {
  callSessionId: string;
  lineId: string;
  dueAtLocal: string; // ISO datetime in local time
  timezone: string;
  message: string;
  privacyScope?: 'line_only' | 'shareable_with_payer';
}

setReminderRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      dueAtLocal,
      timezone,
      message,
      privacyScope = 'line_only',
    } = req.body as SetReminderRequest;

    logger.info({ callSessionId, lineId, dueAtLocal, message }, 'Set reminder request');

    // Validate required fields
    if (!callSessionId || !lineId || !dueAtLocal || !message) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get call session to verify and get account ID
    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // Parse the due date
    let dueAt: Date;
    try {
      // If timezone is provided, parse as local time in that timezone
      if (timezone) {
        const localDate = new Date(dueAtLocal);
        // This is a simplified conversion - in production, use a proper timezone library
        dueAt = localDate;
      } else {
        dueAt = new Date(dueAtLocal);
      }
    } catch {
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    // Check if due date is in the past
    if (dueAt.getTime() < Date.now()) {
      res.status(400).json({ error: 'Due date is in the past' });
      return;
    }

    const supabase = getSupabaseClient();

    // Create the reminder
    const { data: reminder, error } = await supabase
      .from('ultaura_reminders')
      .insert({
        account_id: session.account_id,
        line_id: lineId,
        due_at: dueAt.toISOString(),
        timezone: timezone || 'America/Los_Angeles',
        message: message.slice(0, 500), // Limit message length
        delivery_method: 'outbound_call',
        status: 'scheduled',
        privacy_scope: privacyScope,
        created_by_call_session_id: callSessionId,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to create reminder');
      res.status(500).json({ error: 'Failed to create reminder' });
      return;
    }

    // Record tool invocation
    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_reminder',
      reminderId: reminder.id,
      dueAt: reminder.due_at,
    });

    logger.info({ reminderId: reminder.id, dueAt: reminder.due_at }, 'Reminder created');

    res.json({
      success: true,
      reminderId: reminder.id,
      dueAt: reminder.due_at,
      message: `Reminder set for ${dueAt.toLocaleString()}`,
    });
  } catch (error) {
    logger.error({ error }, 'Error setting reminder');
    res.status(500).json({ error: 'Internal server error' });
  }
});
