import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import {
  DEK_ALG,
  DEK_KID,
  toUint8Array,
  decodeByteaOrThrow,
  getOrCreateLineDEK,
  encryptPayload,
  decryptPayload,
  IV_LENGTH,
  TAG_LENGTH,
} from '../crypto-dek';
import { encodeBytea, type ByteaInput } from '../bytea';

// Health ALWAYS uses line DEK — no account DEK fallback, no legacy line check.

/** Pre-fetch the line DEK so it can be reused across multiple decrypt calls. */
export async function preloadLineDEK(
  accountId: string,
  lineId: string,
): Promise<Buffer> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  return getOrCreateLineDEK(adminClient, accountId, lineId);
}

function buildHealthPayloadAAD(
  accountId: string,
  lineId: string
): Uint8Array {
  return Uint8Array.from(
    Buffer.from(
      JSON.stringify({
        account_id: accountId,
        line_id: lineId,
        type: 'health_payload',
      }),
      'utf8'
    )
  );
}

type EncryptedHealthPayload = {
  ciphertext: string; // bytea hex-encoded
  iv: string;        // bytea hex-encoded
  tag: string;       // bytea hex-encoded
  alg: string;
  kid: string;
};

export async function encryptHealthPayload(
  accountId: string,
  lineId: string,
  plaintext: string
): Promise<EncryptedHealthPayload> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const dek = await getOrCreateLineDEK(adminClient, accountId, lineId);
  const aad = buildHealthPayloadAAD(accountId, lineId);
  const { ciphertext, iv, tag } = encryptPayload(dek, plaintext, aad);

  return {
    ciphertext: encodeBytea(ciphertext),
    iv: encodeBytea(iv),
    tag: encodeBytea(tag),
    alg: DEK_ALG,
    kid: DEK_KID,
  };
}

export async function decryptHealthPayload(
  accountId: string,
  lineId: string,
  encrypted: {
    ciphertext: ByteaInput;
    iv: ByteaInput;
    tag: ByteaInput;
    alg: string;
    kid: string | null;
  },
  preloadedDek?: Buffer,
): Promise<string> {
  const dek = preloadedDek ?? await getOrCreateLineDEK(
    getSupabaseServerActionClient({ admin: true }),
    accountId,
    lineId,
  );
  const aad = buildHealthPayloadAAD(accountId, lineId);

  const ciphertextBuf = decodeByteaOrThrow('health.ciphertext', encrypted.ciphertext);
  const ivBuf = decodeByteaOrThrow('health.iv', encrypted.iv, IV_LENGTH);
  const tagBuf = decodeByteaOrThrow('health.tag', encrypted.tag, TAG_LENGTH);

  return decryptPayload(
    dek,
    toUint8Array(ciphertextBuf),
    toUint8Array(ivBuf),
    toUint8Array(tagBuf),
    aad
  );
}
