import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';

const logger = getLogger();
const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;
  if (!kekHex || kekHex.length !== 64) {
    throw new Error('Invalid ULTAURA_ENCRYPTION_KEY');
  }
  return Buffer.from(kekHex, 'hex');
}

function unwrapDEK(wrapped: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const kek = getKEK();
  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
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

  return unwrapDEK(
    Buffer.from(data.dek_wrapped),
    Buffer.from(data.dek_wrap_iv),
    Buffer.from(data.dek_wrap_tag)
  );
}

function buildDebugLogAAD(
  accountId: string,
  callSessionId: string | null,
  debugLogId: string
): Buffer {
  return Buffer.from(JSON.stringify({
    account_id: accountId,
    call_session_id: callSessionId,
    debug_log_id: debugLogId,
    type: 'debug_log_payload',
  }), 'utf8');
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
    const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(encrypted.iv), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(encrypted.tag));
    decipher.setAAD(aad);

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext)),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8'));
  } catch (error) {
    const err = error as Error;
    logger.error({
      debugLogId,
      accountId,
      errorName: err?.name,
      errorMessage: err?.message,
    }, 'Failed to decrypt debug payload');
    return null;
  }
}
