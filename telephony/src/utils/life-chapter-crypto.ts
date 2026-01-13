import { decryptMemoryValue, encryptMemoryValue } from './encryption.js';
import { getSupabaseClient } from './supabase.js';
import { getMemoryDEK } from '../services/line-encryption.js';

const LIFE_CHAPTER_ALG = 'aes-256-gcm';
const LIFE_CHAPTER_KID = 'kek_v1';

export interface EncryptedLifeChapterPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}

export function buildLifeChapterAAD(
  accountId: string,
  lineId: string,
  chapterId: string
): Buffer {
  return Buffer.from(
    JSON.stringify({
      account_id: accountId,
      line_id: lineId,
      chapter_id: chapterId,
      type: 'life_chapter',
    }),
    'utf8'
  );
}

export async function encryptLifeChapterNarrative(
  accountId: string,
  lineId: string,
  chapterId: string,
  narrative: string
): Promise<EncryptedLifeChapterPayload> {
  const supabase = getSupabaseClient();
  const dek = await getMemoryDEK(supabase, accountId, lineId);
  const aad = buildLifeChapterAAD(accountId, lineId, chapterId);

  const { ciphertext, iv, tag } = encryptMemoryValue(dek, narrative, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: LIFE_CHAPTER_ALG,
    kid: LIFE_CHAPTER_KID,
  };
}

export async function decryptLifeChapterNarrative(
  accountId: string,
  lineId: string,
  chapterId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<string> {
  const supabase = getSupabaseClient();
  const dek = await getMemoryDEK(supabase, accountId, lineId);
  const aad = buildLifeChapterAAD(accountId, lineId, chapterId);

  const value = decryptMemoryValue(
    dek,
    Buffer.from(encrypted.ciphertext),
    Buffer.from(encrypted.iv),
    Buffer.from(encrypted.tag),
    aad
  );

  return String(value ?? '');
}
