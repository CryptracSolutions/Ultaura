'use server';

import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import type { CallSessionRow, LineActivity, UsageSummary, UltauraAccountRow } from './types';

const logger = getLogger();
const DEV_TELEPHONY_BACKEND_URL = 'http://localhost:3001';

function getTelephonyBackendUrl(): string {
  const backendUrl = process.env.ULTAURA_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? '' : DEV_TELEPHONY_BACKEND_URL);

  if (!backendUrl) {
    throw new Error('ULTAURA_BACKEND_URL is required in production');
  }

  return backendUrl;
}

function getInternalApiSecret(): string {
  const secret = process.env.ULTAURA_INTERNAL_API_SECRET;

  if (!secret) {
    throw new Error('Missing ULTAURA_INTERNAL_API_SECRET');
  }

  return secret;
}

export async function getUsageSummary(accountId: string): Promise<UsageSummary | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client.rpc('get_ultaura_usage_summary', {
    p_account_id: accountId,
  });

  if (error) {
    logger.error({ error }, 'Failed to get usage summary');
    return null;
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    minutesIncluded: row.minutes_included,
    minutesUsed: row.minutes_used,
    minutesRemaining: row.minutes_remaining,
    overageMinutes: row.overage_minutes,
    cycleStart: row.cycle_start,
    cycleEnd: row.cycle_end,
  };
}

const updateOverageCapWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { accountId: string; overageCentsCap: number }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_accounts')
    .update({ overage_cents_cap: input.overageCentsCap })
    .eq('id', input.accountId);

  if (error) {
    logger.error({ error, accountId: input.accountId }, 'Failed to update overage cap');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update overage cap'),
    };
  }

  revalidatePath('/dashboard/usage', 'page');
  revalidatePath('/dashboard', 'page');

  return { success: true, data: undefined };
});

export async function updateOverageCap(
  accountId: string,
  overageCentsCap: number
): Promise<ActionResult<void>> {
  const account = await getUltauraAccountById(accountId);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return updateOverageCapWithTrial(account, { accountId, overageCentsCap });
}

export async function getCallSessions(
  lineId: string,
  limit: number = 10
): Promise<CallSessionRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_call_sessions')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error({ error }, 'Failed to get call sessions');
    return [];
  }

  return data || [];
}

export async function getLineActivity(accountId: string): Promise<LineActivity[]> {
  const client = getSupabaseServerComponentClient();

  const { data: lines } = await client
    .from('ultaura_lines')
    .select('id, short_id, display_name, last_successful_call_at, next_scheduled_call_at')
    .eq('account_id', accountId);

  if (!lines) return [];

  const activities: LineActivity[] = [];

  for (const line of lines) {
    let lastCallDuration: number | null = null;
    if (line.last_successful_call_at) {
      const { data: lastCall } = await client
        .from('ultaura_call_sessions')
        .select('seconds_connected')
        .eq('line_id', line.id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(1)
        .single();

      lastCallDuration = lastCall?.seconds_connected || null;
    }

    activities.push({
      lineId: line.id,
      lineShortId: line.short_id,
      displayName: line.display_name,
      lastCallAt: line.last_successful_call_at,
      lastCallDuration,
      nextScheduledAt: line.next_scheduled_call_at,
    });
  }

  return activities;
}

const initiateTestCallWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string }
): Promise<ActionResult<void>> => {
  const line = await getSupabaseServerComponentClient()
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', input.lineId)
    .single();

  if (line.error || !line.data) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const telephonyUrl = getTelephonyBackendUrl();

  try {
    const response = await fetch(`${telephonyUrl}/calls/outbound`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        lineId: input.lineId,
        reason: 'test',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, error.error || 'Failed to initiate test call'),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    logger.error({ error }, 'Failed to initiate test call');
    return {
      success: false,
      error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to initiate test call'),
    };
  }
});

export async function initiateTestCall(lineId: string): Promise<ActionResult<void>> {
  const line = await getSupabaseServerComponentClient()
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', lineId)
    .single();

  if (line.error || !line.data) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.data.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return initiateTestCallWithTrial(account, { lineId });
}
