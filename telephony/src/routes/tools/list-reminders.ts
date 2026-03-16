// List reminders tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoryDEK } from '../../services/line-encryption.js';
import { decryptReminderMessagesWithDek } from '../../utils/reminder-crypto.js';
import { enforceSessionLineMatch, formatReminderSchedule } from './reminder-tool-helpers.js';

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

    if (!await enforceSessionLineMatch({ session, lineId, recordFailure })) {
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const supabase = getSupabaseClient();

    // Check if voice reminder control is allowed
    const { data: line, error: lineError } = await supabase
      .from('ultaura_lines')
      .select('allow_voice_reminder_control, display_name, timezone')
      .eq('id', session.line_id)
      .single();

    if (lineError || !line) {
      logger.error({ error: lineError }, 'Failed to get line');
      await recordFailure(lineError?.code);
      res.status(500).json({ error: 'Failed to get line info' });
      return;
    }

    if (!line.allow_voice_reminder_control) {
      await recordFailure('unauthorized');
      res.json({
        success: false,
        message: "I'm sorry, but your caregiver has disabled reminder management by phone. Please ask them to make changes through the app.",
      });
      return;
    }

    // Get upcoming reminders — exclude health_profile reminders from voice tool
    const { data: reminders, error } = await supabase
      .from('ultaura_reminders')
      .select('id, message, message_ciphertext, message_iv, message_tag, due_at, timezone, is_recurring, is_paused, current_snooze_count')
      .eq('line_id', session.line_id)
      .eq('account_id', session.account_id)
      .eq('status', 'scheduled')
      .eq('source_context', 'general')
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

    let decryptedMessages = reminders.map((reminder) => ({
      id: reminder.id,
      message: reminder.message ?? null,
      decryptFailed: false,
    }));

    if (reminders.some((reminder) => reminder.message_ciphertext)) {
      try {
        const dek = await getMemoryDEK(supabase, session.account_id, session.line_id);
        decryptedMessages = decryptReminderMessagesWithDek(
          dek,
          session.account_id,
          session.line_id,
          reminders
        );
      } catch (decryptError) {
        logger.error({ error: decryptError, lineId: session.line_id }, 'Failed to decrypt reminder messages');
        decryptedMessages = reminders.map((reminder) => ({
          id: reminder.id,
          message: reminder.message_ciphertext ? null : reminder.message ?? null,
          decryptFailed: Boolean(reminder.message_ciphertext),
        }));
      }
    }

    const messageLookup = new Map(
      decryptedMessages.map((entry) => [entry.id, entry])
    );

    // Format reminders for voice response
    const formattedReminders = reminders.map((r, i) => {
      const resolved = messageLookup.get(r.id);
      const resolvedMessage = resolved?.message ?? 'a reminder';
      const schedule = formatReminderSchedule(r.due_at, line.timezone || r.timezone || 'UTC');

      let status = '';
      if (r.is_paused) {
        status = ' (paused)';
      } else if (r.current_snooze_count > 0) {
        status = ' (snoozed)';
      }

      return {
        id: r.id,
        index: i + 1,
        message: resolvedMessage,
        dateTime: schedule,
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
