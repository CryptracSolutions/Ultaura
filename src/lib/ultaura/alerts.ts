'use server';

import { revalidatePath } from 'next/cache';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { WellnessAlert } from './types';
import { getSharingGate, validateAccountOwnership } from './sharing-gate';
import { redactAlertByTier } from './alerts-redaction';

const logger = getLogger();

export async function getWellnessAlerts(
  accountId: string,
  options?: { limit?: number }
): Promise<WellnessAlert[]> {
  const limit = options?.limit ?? 50;
  const userClient = getSupabaseServerActionClient();
  await requireSession(userClient);

  const ownsAccount = await validateAccountOwnership(userClient, accountId);
  if (!ownsAccount) {
    throw new Error('Access denied');
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const { data: alerts, error } = await adminClient
    .from('ultaura_wellness_alerts')
    .select(`
      id,
      line_id,
      created_at,
      alert_type,
      severity,
      title,
      summary,
      acknowledged_at,
      ultaura_lines!inner(display_name, account_id)
    `)
    .eq('ultaura_lines.account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, accountId }, 'Failed to fetch wellness alerts');
    return [];
  }

  const gateCache = new Map<string, ReturnType<typeof getSharingGate>>();
  const results: WellnessAlert[] = [];

  for (const alert of alerts ?? []) {
    const lineId = alert.line_id;
    let gate = gateCache.get(lineId);
    if (!gate) {
      gate = getSharingGate(adminClient, lineId, accountId);
      gateCache.set(lineId, gate);
    }
    const resolvedGate = await gate;

    if (!resolvedGate.canAccessNonSafety) {
      continue;
    }

    if (!resolvedGate.isSelfUser && resolvedGate.isFamilyOutputSuppressed) {
      continue;
    }

    const lineName = (alert.ultaura_lines as { display_name?: string } | null)?.display_name ?? 'Unknown';
    const mapped = mapAlert(alert, lineName);

    if (resolvedGate.isSelfUser) {
      results.push(mapped);
      continue;
    }

    const redacted = redactAlertByTier(mapped, resolvedGate.effectiveTier);
    if (redacted) {
      results.push(redacted);
    }
  }

  return results;
}

function mapAlert(
  alert: {
    id: string;
    line_id: string;
    created_at: string;
    alert_type: string;
    severity: string;
    title: string;
    summary: string;
    acknowledged_at: string | null;
  },
  lineName: string
): WellnessAlert {
  return {
    id: alert.id,
    lineId: alert.line_id,
    lineName,
    createdAt: alert.created_at,
    alertType: alert.alert_type,
    severity: alert.severity as WellnessAlert['severity'],
    title: alert.title,
    summary: alert.summary,
    acknowledgedAt: alert.acknowledged_at ?? null,
  };
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
