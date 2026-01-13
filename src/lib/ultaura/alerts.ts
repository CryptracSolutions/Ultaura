'use server';

import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { WellnessAlert } from './types';

const logger = getLogger();

export async function getWellnessAlerts(
  accountId: string,
  options?: { limit?: number }
): Promise<WellnessAlert[]> {
  const client = getSupabaseServerComponentClient();
  const limit = options?.limit ?? 50;

  const { data: alerts, error } = await client
    .from('ultaura_wellness_alerts')
    .select('id, line_id, created_at, alert_type, severity, title, summary, acknowledged_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, accountId }, 'Failed to fetch wellness alerts');
    return [];
  }

  const lineIds = Array.from(new Set((alerts ?? []).map((alert) => alert.line_id)));
  const lineNameMap = new Map<string, string>();

  if (lineIds.length > 0) {
    const { data: lines, error: lineError } = await client
      .from('ultaura_lines')
      .select('id, display_name')
      .in('id', lineIds);

    if (lineError) {
      logger.error({ error: lineError, accountId }, 'Failed to fetch line names for alerts');
    } else {
      lines?.forEach((line) => {
        lineNameMap.set(line.id, line.display_name);
      });
    }
  }

  return (alerts ?? []).map((alert) => ({
    id: alert.id,
    lineId: alert.line_id,
    lineName: lineNameMap.get(alert.line_id) ?? 'Unknown',
    createdAt: alert.created_at,
    alertType: alert.alert_type,
    severity: alert.severity as WellnessAlert['severity'],
    title: alert.title,
    summary: alert.summary,
    acknowledgedAt: alert.acknowledged_at ?? null,
  }));
}

export async function acknowledgeWellnessAlert(
  alertId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client);
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: createError(ErrorCodes.UNAUTHORIZED, 'User not authenticated'),
    };
  }

  const { data: existing, error: fetchError } = await client
    .from('ultaura_wellness_alerts')
    .select('id')
    .eq('id', alertId)
    .single();

  if (fetchError || !existing) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Alert not found'),
    };
  }

  const { error } = await client
    .from('ultaura_wellness_alerts')
    .update({
      acknowledged_at: new Date().toISOString(),
      acknowledged_by_user_id: userId,
    })
    .eq('id', alertId);

  if (error) {
    logger.error({ error, alertId }, 'Failed to acknowledge alert');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to acknowledge alert'),
    };
  }

  revalidatePath('/dashboard/alerts', 'page');

  return { success: true, data: undefined };
}
