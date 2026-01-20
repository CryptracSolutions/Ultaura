import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptMemoryValue, decryptMemoryValue } from './encryption.js';
import { getOrCreateAccountDEK } from '../services/account-encryption.js';
import { logger } from '../server.js';

const DEBUG_LOG_ALG = 'aes-256-gcm';
const DEBUG_LOG_KID = 'kek_v1';

export interface EncryptedDebugPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}

export function buildDebugLogAAD(
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

export function encryptDebugPayloadWithDek(
  dek: Buffer,
  payload: Record<string, unknown>,
  aad: Buffer
): EncryptedDebugPayload {
  const { ciphertext, iv, tag } = encryptMemoryValue(dek, payload, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: DEBUG_LOG_ALG,
    kid: DEBUG_LOG_KID,
  };
}

export function decryptDebugPayloadWithDek(
  dek: Buffer,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
  aad: Buffer
): Record<string, unknown> {
  return decryptMemoryValue(
    dek,
    Buffer.from(encrypted.ciphertext),
    Buffer.from(encrypted.iv),
    Buffer.from(encrypted.tag),
    aad
  ) as Record<string, unknown>;
}

export async function encryptDebugPayload(
  supabase: SupabaseClient,
  accountId: string,
  callSessionId: string | null,
  debugLogId: string,
  payload: Record<string, unknown>
): Promise<EncryptedDebugPayload> {
  const dek = await getOrCreateAccountDEK(supabase, accountId);
  const aad = buildDebugLogAAD(accountId, callSessionId, debugLogId);
  return encryptDebugPayloadWithDek(dek, payload, aad);
}

export async function decryptDebugPayload(
  supabase: SupabaseClient,
  accountId: string,
  callSessionId: string | null,
  debugLogId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<Record<string, unknown> | null> {
  try {
    const dek = await getOrCreateAccountDEK(supabase, accountId);
    const aad = buildDebugLogAAD(accountId, callSessionId, debugLogId);
    return decryptDebugPayloadWithDek(dek, encrypted, aad);
  } catch (error) {
    const err = error as Error;
    logger.error({
      accountId,
      debugLogId,
      errorName: err?.name,
      errorMessage: err?.message,
    }, 'Failed to decrypt debug payload');
    return null;
  }
}
