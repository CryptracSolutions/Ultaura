'use server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { Json } from '~/database.types';
import type { ScheduleEventRow } from './types';

const logger = getLogger();

export async function logScheduleEvent(params: {
  accountId: string;
  scheduleId: string;
  lineId: string;
  eventType: ScheduleEventRow['event_type'];
  triggeredBy: ScheduleEventRow['triggered_by'];
  callSessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const metadata = (params.metadata ?? null) as Json | null;

  const { error } = await client
    .from('ultaura_schedule_events')
    .insert({
      account_id: params.accountId,
      schedule_id: params.scheduleId,
      line_id: params.lineId,
      event_type: params.eventType,
      triggered_by: params.triggeredBy,
      call_session_id: params.callSessionId || null,
      metadata,
    });

  if (error) {
    logger.error({ error }, 'Failed to log schedule event');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to log event'),
    };
  }

  return { success: true, data: undefined };
}

export async function getScheduleEvents(scheduleId: string): Promise<ScheduleEventRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_schedule_events')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get schedule events');
    return [];
  }

  return data || [];
}
