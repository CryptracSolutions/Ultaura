'use server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { Json } from '~/database.types';
import type { ReminderEventRow } from './types';

const logger = getLogger();

export async function logReminderEvent(params: {
  accountId: string;
  reminderId: string;
  lineId: string;
  eventType: ReminderEventRow['event_type'];
  triggeredBy: ReminderEventRow['triggered_by'];
  callSessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const metadata = (params.metadata ?? null) as Json | null;

  const { error } = await client
    .from('ultaura_reminder_events')
    .insert({
      account_id: params.accountId,
      reminder_id: params.reminderId,
      line_id: params.lineId,
      event_type: params.eventType,
      triggered_by: params.triggeredBy,
      call_session_id: params.callSessionId || null,
      metadata,
    });

  if (error) {
    logger.error({ error }, 'Failed to log reminder event');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to log event'),
    };
  }

  return { success: true, data: undefined };
}

export async function getReminderEvents(reminderId: string): Promise<ReminderEventRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminder_events')
    .select('*')
    .eq('reminder_id', reminderId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get reminder events');
    return [];
  }

  return data || [];
}

export async function getLineReminderEvents(lineId: string, limit = 50): Promise<ReminderEventRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_reminder_events')
    .select(`
      *,
      ultaura_reminders!inner(message)
    `)
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, 'Failed to get line reminder events');
    return [];
  }

  const events = (data || []) as Array<ReminderEventRow & {
    ultaura_reminders?: { message?: string } | null;
  }>;

  return events.map(event => ({
    ...event,
    reminder_message: event.ultaura_reminders?.message,
    ultaura_reminders: undefined,
  }));
}
