// Set reminder tool handler

import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';

/**
 * Convert a local datetime string to UTC Date, respecting the given timezone.
 *
 * @param localDateTimeStr - ISO-like string without timezone (e.g., "2025-12-27T14:00:00")
 * @param timezone - IANA timezone name (e.g., "America/New_York")
 * @returns Date object in UTC
 */
function localToUtc(localDateTimeStr: string, timezone: string): Date {
  // Parse the local datetime components
  const match = localDateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) {
    throw new Error('Invalid datetime format');
  }

  const [, year, month, day, hour, minute, second = '00'] = match;

  // Create a formatter that will tell us the offset for this timezone at this datetime
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

  // Create a rough UTC estimate first
  const roughUtc = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);

  // Get the timezone offset by comparing formatted local time with UTC
  const parts = formatter.formatToParts(roughUtc);
  const formatted: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      formatted[part.type] = part.value;
    }
  }

  // Calculate offset: what time does the timezone show when it's roughUtc in UTC?
  const localInTz = new Date(
    `${formatted.year}-${formatted.month}-${formatted.day}T${formatted.hour}:${formatted.minute}:${formatted.second}Z`
  );
  const offsetMs = localInTz.getTime() - roughUtc.getTime();

  // The actual UTC time is: local time minus the offset
  const targetLocalMs = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`).getTime();
  return new Date(targetLocalMs - offsetMs);
}

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

    // Parse the due date, converting from user's local time to UTC
    let dueAt: Date;
    try {
      const tz = timezone || 'America/Los_Angeles';
      dueAt = localToUtc(dueAtLocal, tz);
      logger.info({ dueAtLocal, timezone: tz, dueAtUtc: dueAt.toISOString() }, 'Parsed reminder due date');
    } catch (parseError) {
      logger.error({ parseError, dueAtLocal, timezone }, 'Failed to parse reminder due date');
      res.status(400).json({ error: 'Invalid date format' });
      return;
    }

    // Check if due date is in the past
    if (dueAt.getTime() < Date.now()) {
      logger.warn({
        dueAtLocal,
        dueAtUtc: dueAt.toISOString(),
        now: new Date().toISOString(),
        diffMs: dueAt.getTime() - Date.now(),
        timezone,
        callSessionId,
      }, 'Reminder rejected: due date is in the past');
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
      logger.error({
        error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
        insertData: {
          account_id: session.account_id,
          line_id: lineId,
          due_at: dueAt.toISOString(),
          timezone: timezone || 'America/Los_Angeles',
          message: message.slice(0, 50) + '...', // Truncate for logging
          created_by_call_session_id: callSessionId,
        },
      }, 'Failed to create reminder');
      res.status(500).json({ error: 'Failed to create reminder', details: error.message });
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
