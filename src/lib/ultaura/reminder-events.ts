'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { Json } from '~/database.types';
import type { ReminderEventRow } from './types';
import { decryptReminderMessagesForLine } from './reminder-crypto';
import { getLine } from './lines';

const logger = getLogger();
const DECRYPTION_PLACEHOLDER = '[Unable to decrypt reminder]';

function resolveDecryptedMessage(
  fallback: string | null,
  info?: { message: string | null; decryptFailed: boolean }
): string {
  if (info?.message) {
    return info.message;
  }
  if (info?.decryptFailed) {
    return DECRYPTION_PLACEHOLDER;
  }
  return fallback ?? DECRYPTION_PLACEHOLDER;
}

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
  const adminClient = getSupabaseServerActionClient({ admin: true }) as SupabaseClient;

  const line = await getLine(lineId);
  if (!line) {
    return [];
  }

  const { data, error } = await client
    .from('ultaura_reminder_events')
    .select(`
      *,
      ultaura_reminders!inner(
        id,
        account_id,
        line_id,
        message,
        message_ciphertext,
        message_iv,
        message_tag
      )
    `)
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, 'Failed to get line reminder events');
    return [];
  }

  const events = (data || []) as Array<ReminderEventRow & {
    ultaura_reminders?: {
      id: string;
      account_id: string;
      line_id: string;
      message?: string | null;
      message_ciphertext?: string | null;
      message_iv?: string | null;
      message_tag?: string | null;
    } | null;
  }>;

  const reminders = events
    .map((event) => event.ultaura_reminders)
    .filter((reminder): reminder is NonNullable<typeof reminder> => Boolean(reminder));

  const messageMap = new Map<string, { message: string | null; decryptFailed: boolean }>();
  if (reminders.length > 0) {
    try {
      const accountId = reminders[0].account_id;
      const decrypted = await decryptReminderMessagesForLine(
        adminClient,
        accountId,
        lineId,
        reminders,
        line.created_at
      );
      for (const entry of decrypted) {
        messageMap.set(entry.id, entry);
      }
    } catch (decryptError) {
      logger.error({ error: decryptError, lineId }, 'Failed to decrypt reminder messages');
      for (const reminder of reminders) {
        messageMap.set(reminder.id, {
          message: reminder.message_ciphertext ? null : reminder.message ?? null,
          decryptFailed: Boolean(reminder.message_ciphertext),
        });
      }
    }
  }

  return events.map(event => ({
    ...event,
    reminder_message: event.ultaura_reminders
      ? resolveDecryptedMessage(
        event.ultaura_reminders.message ?? null,
        messageMap.get(event.ultaura_reminders.id)
      )
      : undefined,
    ultaura_reminders: undefined,
  }));
}
