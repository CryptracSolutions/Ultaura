// List reminders tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

export const listRemindersRouter = Router();

interface ListRemindersRequest {
  callSessionId: string;
  lineId: string;
}

listRemindersRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as ListRemindersRequest;

    if (!callSessionId || !lineId) {
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
        tool: 'list_reminders',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    const supabase = getSupabaseClient();

    // Check if voice reminder control is allowed
    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('allow_voice_reminder_control, display_name')
      .eq('id', lineId)
      .single();

    if (lineError || !line) {
      logger.error({ error: lineError }, 'Failed to get line');
      await recordFailure(lineError?.code);
      res.status(500).json({ error: 'Failed to get line info' });
      return;
    }

    // Get upcoming reminders
    const { data: reminders, error } = await supabase
      .from('ultaura_reminders')
      .select('id, message, due_at, is_recurring, is_paused, current_snooze_count')
      .eq('line_id', lineId)
      .eq('status', 'scheduled')
      .order('due_at', { ascending: true })
      .limit(10);

    if (error) {
      logger.error({ error }, 'Failed to list reminders');
      await recordFailure(error.code);
      res.status(500).json({ error: 'Failed to list reminders' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'list_reminders',
      success: true,
      reminderCount: reminders?.length || 0,
    }, { skipDebugLog: true });

    if (!reminders || reminders.length === 0) {
      res.json({
        success: true,
        reminders: [],
        message: 'You have no upcoming reminders scheduled.',
      });
      return;
    }

    // Format reminders for voice response
    const formattedReminders = reminders.map((r, i) => {
      const dueDate = new Date(r.due_at);
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

      let status = '';
      if (r.is_paused) {
        status = ' (paused)';
      } else if (r.current_snooze_count > 0) {
        status = ' (snoozed)';
      }

      return {
        id: r.id,
        index: i + 1,
        message: r.message,
        dateTime: `${dateStr} at ${timeStr}`,
        isRecurring: r.is_recurring,
        isPaused: r.is_paused,
        status,
      };
    });

    // Build voice-friendly message
    const count = formattedReminders.length;
    let voiceMessage = `You have ${count} upcoming reminder${count > 1 ? 's' : ''}. `;

    formattedReminders.slice(0, 3).forEach((r, i) => {
      voiceMessage += `${i + 1}: "${r.message}" on ${r.dateTime}${r.status}. `;
    });

    if (count > 3) {
      voiceMessage += `And ${count - 3} more.`;
    }

    res.json({
      success: true,
      reminders: formattedReminders,
      message: voiceMessage,
    });
  } catch (error) {
    logger.error({ error }, 'Error listing reminders');
    res.status(500).json({ error: 'Failed to list reminders' });
  }
});
