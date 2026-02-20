export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

import getLogger from '~/core/logger';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { decodeBytea, type ByteaInput } from '~/lib/ultaura/bytea';
import {
  DecryptionError,
  isDecryptionError,
  unwrapDEK,
} from '~/lib/ultaura/crypto-kek';

const logger = getLogger();
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEALTH_ALGORITHM = 'aes-256-gcm';
const WARN_LOG_COOLDOWN_MS = 30_000;

let lastWarnLogAt = 0;
let lastWarnKey = '';

type AccountKeyRow = {
  account_id: string;
  dek_wrapped: ByteaInput;
  dek_wrap_iv: ByteaInput;
  dek_wrap_tag: ByteaInput;
  created_at: string | null;
};

function decodePayloadOrThrow(label: string, value: ByteaInput, expectedLength?: number): Buffer {
  const decoded = decodeBytea(value);
  if (!decoded) {
    throw new DecryptionError(
      'DEK_PAYLOAD_INVALID',
      `Invalid ${label} payload in account crypto key row.`
    );
  }

  const buffer = Buffer.from(decoded);
  if (expectedLength && buffer.length !== expectedLength) {
    throw new DecryptionError(
      'DEK_PAYLOAD_INVALID',
      `Invalid ${label} length in account crypto key row.`
    );
  }

  return buffer;
}

function buildFailureResponse(code: string, message: string, accountId?: string) {
  return NextResponse.json(
    {
      ok: false,
      code,
      message,
      accountId: accountId || null,
      checkedAt: new Date().toISOString(),
    },
    { status: 503 }
  );
}

function getExpectedSecret(): string | null {
  return process.env.ULTAURA_INTERNAL_API_SECRET || process.env.ULTAURA_API_SECRET || null;
}

async function resolveTargetAccountKey(): Promise<{
  row: AccountKeyRow | null;
  configuredAccountId: string | null;
  queryError: string | null;
}> {
  const configuredAccountId = process.env.ULTAURA_CRYPTO_HEALTH_ACCOUNT_ID?.trim() || null;
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });

  if (configuredAccountId) {
    const { data, error } = await adminClient
      .from('ultaura_account_crypto_keys')
      .select('account_id, dek_wrapped, dek_wrap_iv, dek_wrap_tag, created_at')
      .eq('account_id', configuredAccountId)
      .maybeSingle();

    if (error) {
      return {
        row: null,
        configuredAccountId,
        queryError: error.message || 'Failed to query account crypto key row.',
      };
    }

    return {
      row: (data as AccountKeyRow | null) ?? null,
      configuredAccountId,
      queryError: null,
    };
  }

  const { data, error } = await adminClient
    .from('ultaura_account_crypto_keys')
    .select('account_id, dek_wrapped, dek_wrap_iv, dek_wrap_tag, created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    return {
      row: null,
      configuredAccountId: null,
      queryError: error.message || 'Failed to query account crypto key rows.',
    };
  }

  return {
    row: ((data as AccountKeyRow[] | null) ?? [])[0] ?? null,
    configuredAccountId: null,
    queryError: null,
  };
}

export async function GET(request: NextRequest) {
  const expectedSecret = getExpectedSecret();
  const providedSecret = request.headers.get(INTERNAL_SECRET_HEADER);

  if (!expectedSecret) {
    logger.error('ULTAURA_INTERNAL_API_SECRET/ULTAURA_API_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { row, configuredAccountId, queryError } = await resolveTargetAccountKey();

  if (queryError) {
    logger.error({ queryError, configuredAccountId }, 'Crypto health check query failed');
    return buildFailureResponse('DB_ERROR', queryError, configuredAccountId || undefined);
  }

  if (!row && configuredAccountId) {
    return buildFailureResponse(
      'ACCOUNT_KEY_NOT_FOUND',
      'Configured account key row was not found for crypto health validation.',
      configuredAccountId
    );
  }

  if (!row) {
    return NextResponse.json({
      ok: true,
      status: 'skipped',
      reason: 'No account crypto keys exist to validate yet.',
      checkedAt: new Date().toISOString(),
    });
  }

  try {
    const wrapped = decodePayloadOrThrow('dek_wrapped', row.dek_wrapped);
    const iv = decodePayloadOrThrow('dek_wrap_iv', row.dek_wrap_iv, IV_LENGTH);
    const tag = decodePayloadOrThrow('dek_wrap_tag', row.dek_wrap_tag, TAG_LENGTH);

    unwrapDEK(wrapped, iv, tag, {
      algorithm: HEALTH_ALGORITHM,
      authTagLength: TAG_LENGTH,
      mode: 'current_only',
    });

    return NextResponse.json({
      ok: true,
      accountId: row.account_id,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (isDecryptionError(error)) {
      const warnKey = `${row.account_id}:${error.code}`;
      const now = Date.now();
      if (warnKey !== lastWarnKey || now - lastWarnLogAt >= WARN_LOG_COOLDOWN_MS) {
        lastWarnKey = warnKey;
        lastWarnLogAt = now;
        logger.warn(
          {
            accountId: row.account_id,
            errorCode: error.code,
            dedupeWindowMs: WARN_LOG_COOLDOWN_MS,
          },
          'Crypto health check failed to unwrap DEK.'
        );
      }
      return buildFailureResponse(error.code, error.message, row.account_id);
    }

    logger.error({ error, accountId: row.account_id }, 'Crypto health check failed unexpectedly');
    return buildFailureResponse(
      'UNKNOWN_ERROR',
      'Crypto health check failed unexpectedly while validating account key.',
      row.account_id
    );
  }
}
