'use server';

import crypto from 'crypto';
import { z } from 'zod';
import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import { hashNotificationToken } from './notification-tokens';
import type { Database } from '~/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

const logger = getLogger();
const DEV_TELEPHONY_BACKEND_URL = 'http://localhost:3001';
const DEFAULT_ACCESS_TOKEN_TTL_MINUTES = 60 * 24 * 7;
const AUTO_SEND_COOLDOWN_MS = 45_000;

const StartRecipientSmsVerificationInputSchema = z.object({
  token: z.string().min(1),
  mode: z.enum(['auto', 'resend']).default('auto'),
});

const CheckRecipientSmsVerificationInputSchema = z.object({
  token: z.string().min(1),
  code: z.string().trim().regex(/^\d{4,10}$/),
});

type RecipientRow =
  Database['public']['Tables']['ultaura_notification_recipients']['Row'];

export type RecipientSmsVerificationContext = {
  recipientId: string;
  accountId: string;
  recipientName: string;
  phoneE164: string;
  phoneMasked: string;
  smsVerifiedAt: string | null;
  tokenExpiresAt: string;
  lastSentAt: string | null;
};

function getTelephonyBackendUrl(): string {
  const backendUrl =
    process.env.ULTAURA_BACKEND_URL ||
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

function maskPhoneForDisplay(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length < 4) {
    return phoneE164;
  }

  return `••• ••• ${digits.slice(-4)}`;
}

function generateRawAccessToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function readRecipientRowsQuery(client: SupabaseClient<Database>) {
  return client
    .from('ultaura_notification_recipients')
    .select('*');
}

function isTokenExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) {
    return true;
  }
  return new Date(expiresAt).getTime() <= Date.now();
}

async function findRecipientByTokenHash(
  tokenHash: string,
  client?: SupabaseClient<Database>
): Promise<{ row: RecipientRow | null; error: unknown | null }> {
  const adminClient = client ?? getSupabaseServerActionClient({ admin: true });
  const nowIso = new Date().toISOString();

  const query = (readRecipientRowsQuery(adminClient) as any)
    .eq('sms_verify_access_token_hash', tokenHash)
    .gt('sms_verify_access_token_expires_at', nowIso)
    .is('unsubscribed_at', null)
    .maybeSingle();

  const { data, error } = await query;
  return { row: (data as RecipientRow | null) ?? null, error };
}

export async function issueRecipientSmsVerificationAccessToken(
  recipientId: string,
  options: {
    client?: SupabaseClient<Database>;
    ttlMinutes?: number;
  } = {}
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  const adminClient = options.client ?? getSupabaseServerActionClient({ admin: true });
  const ttlMinutes = Math.max(1, options.ttlMinutes ?? DEFAULT_ACCESS_TOKEN_TTL_MINUTES);
  const token = generateRawAccessToken();
  const tokenHash = hashNotificationToken(token);
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const { data, error } = await (adminClient
    .from('ultaura_notification_recipients')
    .update({
      sms_verify_access_token_hash: tokenHash,
      sms_verify_access_token_expires_at: expiresAt,
      sms_verify_last_sent_at: null,
      updated_at: nowIso,
    } as never)
    .eq('id', recipientId)
    .is('unsubscribed_at', null)
    .select('id')
    .maybeSingle());

  if (error) {
    logger.error({ error, recipientId }, 'Failed to persist recipient SMS verification access token');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to issue verification access token'),
    };
  }

  if (!data) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found or unsubscribed'),
    };
  }

  return {
    success: true,
    data: { token, expiresAt },
  };
}

export async function lookupRecipientBySmsVerificationToken(
  token: string
): Promise<ActionResult<RecipientSmsVerificationContext>> {
  if (!token?.trim()) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Invalid or expired verification link'),
    };
  }

  const tokenHash = hashNotificationToken(token);
  const { row, error } = await findRecipientByTokenHash(tokenHash);

  if (error) {
    logger.error({ error }, 'Failed to look up recipient SMS verification token');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Unable to verify this link right now'),
    };
  }

  if (!row || !row.phone_e164 || isTokenExpired(row.sms_verify_access_token_expires_at)) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Invalid or expired verification link'),
    };
  }
  const tokenExpiresAt = row.sms_verify_access_token_expires_at;
  if (!tokenExpiresAt) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Invalid or expired verification link'),
    };
  }

  return {
    success: true,
    data: {
      recipientId: row.id,
      accountId: row.account_id,
      recipientName: row.name,
      phoneE164: row.phone_e164,
      phoneMasked: maskPhoneForDisplay(row.phone_e164),
      smsVerifiedAt: row.sms_verified_at ?? null,
      tokenExpiresAt,
      lastSentAt: row.sms_verify_last_sent_at ?? null,
    },
  };
}

export async function startRecipientSmsVerification(
  token: string,
  options: { mode?: 'auto' | 'resend' } = {}
): Promise<
  ActionResult<{
    phoneMasked: string;
    alreadyVerified: boolean;
    sent: boolean;
    cooldownRemainingSeconds: number | null;
  }>
> {
  const parsed = StartRecipientSmsVerificationInputSchema.safeParse({
    token,
    mode: options.mode ?? 'auto',
  });

  if (!parsed.success) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Invalid verification request'),
    };
  }

  const context = await lookupRecipientBySmsVerificationToken(parsed.data.token);
  if (!context.success) {
    return context;
  }

  if (context.data.smsVerifiedAt) {
    return {
      success: true,
      data: {
        phoneMasked: context.data.phoneMasked,
        alreadyVerified: true,
        sent: false,
        cooldownRemainingSeconds: null,
      },
    };
  }

  if (context.data.lastSentAt) {
    const lastSentMs = new Date(context.data.lastSentAt).getTime();
    const elapsedMs = Date.now() - lastSentMs;
    if (Number.isFinite(lastSentMs) && elapsedMs < AUTO_SEND_COOLDOWN_MS) {
      return {
        success: true,
        data: {
          phoneMasked: context.data.phoneMasked,
          alreadyVerified: false,
          sent: false,
          cooldownRemainingSeconds: Math.max(
            1,
            Math.ceil((AUTO_SEND_COOLDOWN_MS - elapsedMs) / 1000),
          ),
        },
      };
    }
  }

  const telephonyUrl = getTelephonyBackendUrl();

  try {
    const response = await fetch(`${telephonyUrl}/internal/recipient-verify/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        recipientId: context.data.recipientId,
        phoneNumber: context.data.phoneE164,
        accountId: context.data.accountId,
        channel: 'sms',
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: null }));
      return {
        success: false,
        error: createError(
          ErrorCodes.EXTERNAL_SERVICE_ERROR,
          payload.error || 'Failed to send verification code'
        ),
      };
    }

    const nowIso = new Date().toISOString();
    const client = getSupabaseServerActionClient({ admin: true });
    const updateResult = await (client
      .from('ultaura_notification_recipients')
      .update({
        sms_verify_last_sent_at: nowIso,
        updated_at: nowIso,
      } as never)
      .eq('id', context.data.recipientId)
      .is('unsubscribed_at', null)
      .select('id')
      .maybeSingle());

    if (updateResult.error || !updateResult.data) {
      logger.warn(
        { error: updateResult.error, recipientId: context.data.recipientId },
        'Failed to persist SMS verification last_sent timestamp'
      );
    }

    return {
      success: true,
      data: {
        phoneMasked: context.data.phoneMasked,
        alreadyVerified: false,
        sent: true,
        cooldownRemainingSeconds: null,
      },
    };
  } catch (error) {
    logger.error({ error, recipientId: context.data.recipientId }, 'Failed to start recipient SMS verification');
    return {
      success: false,
      error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to send verification code'),
    };
  }
}

export async function checkRecipientSmsVerification(
  token: string,
  code: string
): Promise<ActionResult<void>> {
  const parsed = CheckRecipientSmsVerificationInputSchema.safeParse({ token, code });
  if (!parsed.success) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Enter a valid verification code'),
    };
  }

  const context = await lookupRecipientBySmsVerificationToken(parsed.data.token);
  if (!context.success) {
    return context;
  }

  if (context.data.smsVerifiedAt) {
    return { success: true, data: undefined };
  }

  const telephonyUrl = getTelephonyBackendUrl();

  try {
    const response = await fetch(`${telephonyUrl}/internal/recipient-verify/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        recipientId: context.data.recipientId,
        phoneNumber: context.data.phoneE164,
        accountId: context.data.accountId,
        code: parsed.data.code,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: null }));
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, payload.error || 'Invalid verification code'),
      };
    }

    const result = await response.json().catch(() => ({ verified: false }));
    if (!result.verified) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Invalid verification code'),
      };
    }

    const nowIso = new Date().toISOString();
    const client = getSupabaseServerActionClient({ admin: true });
    const { data, error } = await (client
      .from('ultaura_notification_recipients')
      .update({
        sms_verified_at: nowIso,
        sms_verify_access_token_hash: null,
        sms_verify_access_token_expires_at: null,
        sms_verify_last_sent_at: nowIso,
        updated_at: nowIso,
      } as never)
      .eq('id', context.data.recipientId)
      .is('unsubscribed_at', null)
      .select('id')
      .maybeSingle());

    if (error || !data) {
      logger.error(
        { error, recipientId: context.data.recipientId },
        'Failed to persist recipient SMS verification status'
      );
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to save verification status'),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    logger.error({ error, recipientId: context.data.recipientId }, 'Failed to check recipient SMS verification');
    return {
      success: false,
      error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Verification check failed'),
    };
  }
}
