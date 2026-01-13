import { decryptMemoryValue, encryptMemoryValue } from './encryption.js';
import { getSupabaseClient } from './supabase.js';
import { getOrCreateAccountDEK } from '../services/account-encryption.js';

const HEALTH_MENTION_ALG = 'aes-256-gcm';
const HEALTH_MENTION_KID = 'kek_v1';

export interface EncryptedHealthMentionPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}

export function buildHealthMentionAAD(
  accountId: string,
  lineId: string,
  callSessionId: string,
  mentionId: string
): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      call_session_id: callSessionId,
      mention_id: mentionId,
      type: 'health_mention',
    }),
    'utf8'
  );
}

export async function encryptHealthMentionSummary(
  accountId: string,
  lineId: string,
  callSessionId: string,
  mentionId: string,
  summary: string
): Promise<EncryptedHealthMentionPayload> {
  const supabase = getSupabaseClient();
  const dek = await getOrCreateAccountDEK(supabase, accountId);
  const aad = buildHealthMentionAAD(accountId, lineId, callSessionId, mentionId);

  const { ciphertext, iv, tag } = encryptMemoryValue(dek, summary, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: HEALTH_MENTION_ALG,
    kid: HEALTH_MENTION_KID,
  };
}

export async function decryptHealthMentionSummary(
  accountId: string,
  lineId: string,
  callSessionId: string,
  mentionId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<string> {
  const supabase = getSupabaseClient();
  const dek = await getOrCreateAccountDEK(supabase, accountId);
  const aad = buildHealthMentionAAD(accountId, lineId, callSessionId, mentionId);

  const value = decryptMemoryValue(
    dek,
    Buffer.from(encrypted.ciphertext),
    Buffer.from(encrypted.iv),
    Buffer.from(encrypted.tag),
    aad
  );

  return String(value ?? '');
}
