import 'server-only';

import crypto from 'crypto';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import {
  getOrCreateLineDEK,
  ALGORITHM,
  TAG_LENGTH,
  IV_LENGTH,
  toUint8Array,
  DEK_ALG,
  DEK_KID,
} from '../crypto-dek';
import { encodeBytea } from '../bytea';

// File-level AES-256-GCM encryption using the line DEK.
// Unlike encryptHealthPayload (which JSON-encodes strings), this works on raw bytes
// and does NOT use AAD — the file bytes are opaque binary content.

export async function encryptFileBuffer(
  accountId: string,
  lineId: string,
  plainBuffer: Buffer,
): Promise<{
  encryptedBuffer: Buffer;
  iv: string; // bytea hex-encoded
  tag: string; // bytea hex-encoded
  alg: string;
  kid: string;
}> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const dek = await getOrCreateLineDEK(adminClient, accountId, lineId);

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, toUint8Array(dek), toUint8Array(iv), {
    authTagLength: TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    Uint8Array.from(cipher.update(toUint8Array(plainBuffer))),
    Uint8Array.from(cipher.final()),
  ]);
  const tag = cipher.getAuthTag();

  return {
    encryptedBuffer: encrypted,
    iv: encodeBytea(iv),
    tag: encodeBytea(tag),
    alg: DEK_ALG,
    kid: DEK_KID,
  };
}

export async function decryptFileBuffer(
  accountId: string,
  lineId: string,
  encryptedBuffer: Buffer,
  ivEncoded: string,
  tagEncoded: string,
): Promise<Buffer> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const dek = await getOrCreateLineDEK(adminClient, accountId, lineId);

  // Decode hex bytea strings (format: \xABCD...)
  const ivHex = ivEncoded.startsWith('\\x') ? ivEncoded.slice(2) : ivEncoded;
  const tagHex = tagEncoded.startsWith('\\x') ? tagEncoded.slice(2) : tagEncoded;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, toUint8Array(dek), toUint8Array(iv), {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAuthTag(toUint8Array(tag));

  return Buffer.concat([
    Uint8Array.from(decipher.update(toUint8Array(encryptedBuffer))),
    Uint8Array.from(decipher.final()),
  ]);
}
