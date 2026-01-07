'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import type { UltauraAccountRow } from './types';

const logger = getLogger();
const DEV_TELEPHONY_BACKEND_URL = 'http://localhost:3001';

const StartVerificationInputSchema = z.object({
  lineId: z.string().uuid(),
  channel: z.enum(['sms', 'call']),
});

const CheckVerificationInputSchema = z.object({
  lineId: z.string().uuid(),
  code: z.string().min(1),
});

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

const startVerificationWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string; channel: 'sms' | 'call' }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const line = await getLine(input.lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const telephonyUrl = getTelephonyBackendUrl();

  try {
    const response = await fetch(`${telephonyUrl}/verify/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        lineId: input.lineId,
        phoneNumber: line.phone_e164,
        channel: input.channel,
        accountId: account.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: createError(
          ErrorCodes.EXTERNAL_SERVICE_ERROR,
          error.error || 'Failed to send verification'
        ),
      };
    }

    await client.from('ultaura_phone_verifications').insert({
      line_id: input.lineId,
      channel: input.channel,
      status: 'pending',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return { success: true, data: undefined };
  } catch (error) {
    logger.error({ error }, 'Failed to start verification');
    return {
      success: false,
      error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to send verification code'),
    };
  }
});

export async function startPhoneVerification(
  lineId: string,
  channel: 'sms' | 'call'
): Promise<ActionResult<void>> {
  const parsed = StartVerificationInputSchema.safeParse({ lineId, channel });
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const line = await getLine(lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return startVerificationWithTrial(account, parsed.data);
}

const checkVerificationWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string; code: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const line = await getLine(input.lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const telephonyUrl = getTelephonyBackendUrl();

  try {
    const response = await fetch(`${telephonyUrl}/verify/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        phoneNumber: line.phone_e164,
        code: input.code,
        accountId: account.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: createError(
          ErrorCodes.EXTERNAL_SERVICE_ERROR,
          error.error || 'Verification failed'
        ),
      };
    }

    const result = await response.json();

    if (result.verified) {
      await client
        .from('ultaura_lines')
        .update({
          phone_verified_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', input.lineId);

      await client
        .from('ultaura_phone_verifications')
        .update({ status: 'approved' })
        .eq('line_id', input.lineId)
        .eq('status', 'pending');

      revalidatePath('/dashboard/lines', 'page');

      return { success: true, data: undefined };
    }

    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Invalid verification code'),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to check verification');
    return {
      success: false,
      error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Verification check failed'),
    };
  }
});

export async function checkPhoneVerification(
  lineId: string,
  code: string
): Promise<ActionResult<void>> {
  const parsed = CheckVerificationInputSchema.safeParse({ lineId, code });
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const line = await getLine(lineId);
  if (!line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return checkVerificationWithTrial(account, parsed.data);
}
