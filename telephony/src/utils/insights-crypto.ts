import type { CallInsights } from '@ultaura/types';
import { getSupabaseClient } from './supabase.js';
import { decryptMemoryValue, encryptMemoryValue, getOrCreateAccountDEK } from './encryption.js';

const INSIGHTS_ALG = 'aes-256-gcm';
const INSIGHTS_KID = 'kek_v1';

export interface EncryptedInsightsPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}

export function buildInsightsAAD(
  accountId: string,
  lineId: string,
  callSessionId: string
): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      call_session_id: callSessionId,
      type: 'call_insight',
    }),
    'utf8'
  );
}

export function encryptInsightsWithDek(
  dek: Buffer,
  insights: CallInsights,
  aad: Buffer
): EncryptedInsightsPayload {
  const { ciphertext, iv, tag } = encryptMemoryValue(dek, insights, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: INSIGHTS_ALG,
    kid: INSIGHTS_KID,
  };
}

export function decryptInsightsWithDek(
  dek: Buffer,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
  aad: Buffer
): CallInsights {
  const value = decryptMemoryValue(
    dek,
    Buffer.from(encrypted.ciphertext),
    Buffer.from(encrypted.iv),
    Buffer.from(encrypted.tag),
    aad
  );

  return value as CallInsights;
}

export async function encryptInsights(
  accountId: string,
  lineId: string,
  callSessionId: string,
  insights: CallInsights
): Promise<EncryptedInsightsPayload> {
  const supabase = getSupabaseClient();
  const dek = await getOrCreateAccountDEK(supabase, accountId);
  const aad = buildInsightsAAD(accountId, lineId, callSessionId);

  return encryptInsightsWithDek(dek, insights, aad);
}

export async function decryptInsights(
  accountId: string,
  lineId: string,
  callSessionId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<CallInsights> {
  const supabase = getSupabaseClient();
  const dek = await getOrCreateAccountDEK(supabase, accountId);
  const aad = buildInsightsAAD(accountId, lineId, callSessionId);

  return decryptInsightsWithDek(dek, encrypted, aad);
}
