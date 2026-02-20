import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';
import { decodeBytea } from './bytea';
import { isDecryptionError, unwrapDEK } from './crypto-kek';

const logger = getLogger();
const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;

function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return Uint8Array.from(value);
}

async function getAccountDEK(
  adminClient: SupabaseClient,
  accountId: string
): Promise<Buffer | null> {
  const { data, error } = await adminClient
    .from('ultaura_account_crypto_keys')
    .select('dek_wrapped, dek_wrap_iv, dek_wrap_tag')
    .eq('account_id', accountId)
    .single();

  if (error || !data) {
    logger.warn({ accountId }, 'No DEK found for account');
    return null;
  }

  const wrapped = decodeBytea(data.dek_wrapped);
  const iv = decodeBytea(data.dek_wrap_iv);
  const tag = decodeBytea(data.dek_wrap_tag);

  if (!wrapped || !iv || !tag) {
    logger.error({ accountId }, 'Failed to decode account DEK payloads');
    return null;
  }

  return unwrapDEK(Buffer.from(wrapped), Buffer.from(iv), Buffer.from(tag), {
    algorithm: ALGORITHM,
    authTagLength: TAG_LENGTH,
  });
}

function buildDebugLogAAD(
  accountId: string,
  callSessionId: string | null,
  debugLogId: string
): Uint8Array {
  return Uint8Array.from(Buffer.from(JSON.stringify({
    account_id: accountId,
    call_session_id: callSessionId,
    debug_log_id: debugLogId,
    type: 'debug_log_payload',
  }), 'utf8'));
}

export async function decryptDebugPayload(
  adminClient: SupabaseClient,
  accountId: string,
  callSessionId: string | null,
  debugLogId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<Record<string, unknown> | null> {
  try {
    const dek = await getAccountDEK(adminClient, accountId);
    if (!dek) {
      return null;
    }

    const aad = buildDebugLogAAD(accountId, callSessionId, debugLogId);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      toUint8Array(dek),
      toUint8Array(encrypted.iv),
      { authTagLength: TAG_LENGTH }
    );
    decipher.setAuthTag(toUint8Array(encrypted.tag));
    decipher.setAAD(aad);

    const plaintext = Buffer.concat([
      Uint8Array.from(decipher.update(toUint8Array(encrypted.ciphertext))),
      Uint8Array.from(decipher.final()),
    ]);

    return JSON.parse(plaintext.toString('utf8'));
  } catch (error) {
    const err = error as Error;
    logger.error({
      debugLogId,
      accountId,
      errorCode: isDecryptionError(error) ? error.code : 'UNKNOWN',
      errorName: err?.name,
      errorMessage: err?.message,
    }, 'Failed to decrypt debug payload');
    return null;
  }
}
