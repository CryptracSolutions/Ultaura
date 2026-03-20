import 'server-only';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { HealthConsentStatus } from '@ultaura/types';
import { requireHealthLineAccess } from './access';
import { writeHealthConsentHistoryEntry } from './consent-history';
import type { HealthConsentRow } from './types';

const logger = getLogger();

const CONSENT_COOLDOWN_DAYS = 30;
const CONSENT_COOLDOWN_MS = CONSENT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export async function getHealthConsentState(
  lineId: string
): Promise<HealthConsentRow | null> {
  const userClient = getSupabaseServerActionClient();
  const { data, error } = await userClient.from('ultaura_health_line_consent')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to load health consent state');
    return null;
  }

  return data;
}

export async function getHealthConsentCounts(
  lineIds: string[]
): Promise<{ granted: number; total: number }> {
  if (lineIds.length === 0) return { granted: 0, total: 0 };

  const userClient = getSupabaseServerActionClient();
  const { data, error } = await userClient.from('ultaura_health_line_consent')
    .select('line_id, health_consent')
    .in('line_id', lineIds);

  if (error) {
    logger.error({ error }, 'Failed to load health consent counts');
    return { granted: 0, total: lineIds.length };
  }

  const granted = (data ?? []).filter((r: any) => r.health_consent === 'granted').length;
  return { granted, total: lineIds.length };
}

export async function requestHealthConsentRePrompt(
  lineId: string
): Promise<
  | { success: true }
  | { success: false; code: 'health_cooldown' | 'access_denied' | 'invalid_line' | 'not_family_managed'; message: string }
> {
  const accessResult = await requireHealthLineAccess(lineId);
  if (!accessResult.ok) {
    return { success: false, code: 'access_denied', message: accessResult.error };
  }

  const { context } = accessResult;

  // Only family-managed accounts can request re-prompt
  if (context.accountUserType !== 'family_managed') {
    return {
      success: false,
      code: 'not_family_managed',
      message: 'Re-prompt requests are only available for family-managed lines',
    };
  }

  // Check cooldown
  const { data: consentRow, error: consentError } = await context.userClient.from('ultaura_health_line_consent')
    .select('health_consent_requested_at')
    .eq('line_id', lineId)
    .maybeSingle();

  if (consentError) {
    return { success: false, code: 'invalid_line', message: 'Failed to load consent state' };
  }

  if (consentRow?.health_consent_requested_at) {
    const requestedAt = new Date(consentRow.health_consent_requested_at).getTime();
    if (Date.now() - requestedAt < CONSENT_COOLDOWN_MS) {
      return {
        success: false,
        code: 'health_cooldown',
        message: `A consent request was already sent within the last ${CONSENT_COOLDOWN_DAYS} days`,
      };
    }
  }

  const now = new Date().toISOString();
  const isFirstRequest = !consentRow?.health_consent_requested_at;

  const consentUpdates: Record<string, unknown> = {
    health_consent_requested_at: now,
    updated_at: now,
  };

  if (isFirstRequest) {
    consentUpdates.health_first_consent_requested_at = now;
  }

  const { error: updateError } = await context.adminClient.from('ultaura_health_line_consent')
    .update(consentUpdates)
    .eq('line_id', lineId);

  if (updateError) {
    logger.error({ error: updateError, lineId }, 'Failed to update consent re-prompt');
    return { success: false, code: 'invalid_line', message: 'Failed to record consent request' };
  }

  await writeHealthConsentHistoryEntry({
    accountId: context.accountId,
    lineId,
    eventType: 'owner_request',
    actorUserId: context.actorUserId,
    payload: { eventType: 'owner_request', requestedAt: now },
  });

  return { success: true };
}

export async function grantHealthConsentSelf(
  lineId: string
): Promise<{ success: true } | { success: false; code: 'access_denied' | 'invalid_line' | 'not_self_managed'; message: string }> {
  const accessResult = await requireHealthLineAccess(lineId);
  if (!accessResult.ok) {
    return { success: false, code: 'access_denied', message: accessResult.error };
  }

  const { context } = accessResult;

  if (context.accountUserType !== 'self') {
    return {
      success: false,
      code: 'not_self_managed',
      message: 'Self-service consent is only available for self-managed lines',
    };
  }

  const now = new Date().toISOString();
  const { error } = await context.adminClient.from('ultaura_health_line_consent')
    .update({
      health_consent: 'granted',
      health_consent_at: now,
      health_consent_call_session_id: null,
      updated_at: now,
    })
    .eq('line_id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to grant health consent self-service');
    return { success: false, code: 'invalid_line', message: 'Failed to grant consent' };
  }

  await writeHealthConsentHistoryEntry({
    accountId: context.accountId,
    lineId,
    eventType: 'self_service_decision',
    resultingStatus: 'granted',
    actorUserId: context.actorUserId,
    payload: { eventType: 'self_service_decision', consentStatus: 'granted', actedAt: now },
  });

  return { success: true };
}

export async function revokeHealthConsentSelf(
  lineId: string
): Promise<{ success: true } | { success: false; code: 'access_denied' | 'invalid_line' | 'not_self_managed'; message: string }> {
  const accessResult = await requireHealthLineAccess(lineId);
  if (!accessResult.ok) {
    return { success: false, code: 'access_denied', message: accessResult.error };
  }

  const { context } = accessResult;

  if (context.accountUserType !== 'self') {
    return {
      success: false,
      code: 'not_self_managed',
      message: 'Self-service consent revocation is only available for self-managed lines',
    };
  }

  const now = new Date().toISOString();
  const { error } = await context.adminClient.from('ultaura_health_line_consent')
    .update({
      health_consent: 'revoked',
      updated_at: now,
    })
    .eq('line_id', lineId);

  if (error) {
    logger.error({ error, lineId }, 'Failed to revoke health consent self-service');
    return { success: false, code: 'invalid_line', message: 'Failed to revoke consent' };
  }

  await writeHealthConsentHistoryEntry({
    accountId: context.accountId,
    lineId,
    eventType: 'self_service_decision',
    resultingStatus: 'revoked',
    actorUserId: context.actorUserId,
    payload: { eventType: 'self_service_decision', consentStatus: 'revoked', actedAt: now },
  });

  return { success: true };
}
