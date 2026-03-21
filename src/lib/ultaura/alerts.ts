'use server';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { WellnessAlert } from './types';
import { getSharingGate } from './sharing-gate';
import { redactAlertByTier } from './alerts-redaction';

const logger = getLogger();

export async function getWellnessAlerts(
  accountId: string,
  options?: { limit?: number; lineIds?: string[] }
): Promise<WellnessAlert[]> {
  const limit = options?.limit ?? 50;
  const userClient = getSupabaseServerActionClient();
  await requireSession(userClient);

  const { data: accessibleAccount, error: accountAccessError } = await userClient
    .from('ultaura_accounts')
    .select('id')
    .eq('id', accountId)
    .maybeSingle();

  if (accountAccessError || !accessibleAccount) {
    throw new Error('Access denied');
  }

  // This RPC is added by a recent migration; generated Supabase types may lag in local environments.
  const rpcClient = userClient as unknown as {
    rpc: (
      fn: string,
      params: { p_account_id: string }
    ) => Promise<{ data: boolean | null; error: unknown }>;
  };
  const { data: isDashboardViewer, error: viewerRoleError } = await rpcClient.rpc('is_dashboard_viewer', {
    p_account_id: accountId,
  });

  if (viewerRoleError) {
    logger.warn(
      { viewerRoleError, accountId },
      'Failed to resolve viewer role for alerts access; applying viewer-safe filtering',
    );
  }

  const requesterIsViewer = viewerRoleError ? true : Boolean(isDashboardViewer);

  const adminClient = getSupabaseServerActionClient({ admin: true });
  let alertsQuery = adminClient
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
    .eq('ultaura_lines.account_id', accountId);

  if (options?.lineIds && options.lineIds.length > 0) {
    alertsQuery = alertsQuery.in('line_id', options.lineIds);
  }

  const { data: alerts, error } = await alertsQuery
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error, accountId }, 'Failed to fetch wellness alerts');
    return [];
  }

  const gateCache = new Map<string, ReturnType<typeof getSharingGate>>();
  const results: WellnessAlert[] = [];
  const alertRows = alerts ?? [];

  for (const alert of alertRows) {
    const lineId = alert.line_id;
    let gatePromise = gateCache.get(lineId);
    if (!gatePromise) {
      gatePromise = getSharingGate(adminClient, lineId, accountId);
      gateCache.set(lineId, gatePromise);
    }
    const resolvedGate = await gatePromise;

    if (!resolvedGate.canAccessNonSafety) {
      continue;
    }

    const shouldBypassSelfMode = requesterIsViewer && resolvedGate.isSelfUser;
    const isEffectiveSelfUser = resolvedGate.isSelfUser && !shouldBypassSelfMode;

    if (!isEffectiveSelfUser && resolvedGate.isFamilyOutputSuppressed) {
      continue;
    }

    const lineName = (alert.ultaura_lines as { display_name?: string } | null)?.display_name ?? 'Unknown';
    const mapped = mapAlert(alert, lineName);

    if (isEffectiveSelfUser) {
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
  _alertId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerActionClient();
  await requireSession(client);

  return {
    success: false,
    error: createError(ErrorCodes.FORBIDDEN, 'Acknowledgements are not available for wellness alerts'),
  };
}
