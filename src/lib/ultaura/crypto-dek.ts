import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';
import { decodeBytea, encodeBytea, type ByteaInput } from './bytea';
import {
  unwrapDEK,
  wrapDEKWithCurrentKey,
} from './crypto-kek';

export { type ByteaInput };

const logger = getLogger();

export const ALGORITHM = 'aes-256-gcm';
export const TAG_LENGTH = 16;
export const IV_LENGTH = 12;
export const DEK_ALG = 'AES-256-GCM';
export const DEK_KID = 'kek_v1';

export function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return Uint8Array.from(value);
}

export function decodeByteaOrThrow(
  label: string,
  value: ByteaInput,
  expectedLength?: number
): Buffer {
  const decoded = decodeBytea(value);
  if (!decoded) {
    const preview = typeof value === 'string'
      ? { rawLength: value.length, rawPrefix: value.slice(0, 8) }
      : undefined;
    logger.error({ label, valueType: typeof value, ...preview }, 'Failed to decode bytea value');
    throw new Error(`Invalid ${label} payload`);
  }
  if (expectedLength && decoded.length !== expectedLength) {
    const preview = typeof value === 'string'
      ? { rawLength: value.length, rawPrefix: value.slice(0, 8) }
      : undefined;
    logger.error(
      { label, expectedLength, actualLength: decoded.length, ...preview },
      'Bytea payload length mismatch'
    );
    throw new Error(`Invalid ${label} length`);
  }
  return Buffer.from(decoded);
}

export function wrapDEK(dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  return wrapDEKWithCurrentKey(dek, {
    algorithm: ALGORITHM,
    authTagLength: TAG_LENGTH,
    ivLength: IV_LENGTH,
  });
}

const PER_LINE_DEK_ENABLED = process.env.ULTAURA_PER_LINE_DEK_ENABLED !== 'false';
const DEFAULT_DEK_CUTOFF = '2026-03-01T00:00:00Z';
const _parsedCutoff = new Date(process.env.ULTAURA_PER_LINE_DEK_CUTOFF || DEFAULT_DEK_CUTOFF);
const PER_LINE_DEK_CUTOFF = Number.isNaN(_parsedCutoff.getTime())
  ? new Date(DEFAULT_DEK_CUTOFF)
  : _parsedCutoff;

export function isLegacyLine(createdAt: string | null | undefined): boolean {
  if (!PER_LINE_DEK_ENABLED || !createdAt) {
    return true;
  }
  return new Date(createdAt) < PER_LINE_DEK_CUTOFF;
}

export async function getOrCreateAccountDEK(
  client: SupabaseClient,
  accountId: string
): Promise<Buffer> {
  const { data: existing } = await client
    .from('ultaura_account_crypto_keys')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (existing) {
    const wrapped = decodeByteaOrThrow('account.dek_wrapped', existing.dek_wrapped);
    const iv = decodeByteaOrThrow('account.dek_wrap_iv', existing.dek_wrap_iv, IV_LENGTH);
    const tag = decodeByteaOrThrow('account.dek_wrap_tag', existing.dek_wrap_tag, TAG_LENGTH);
    return unwrapDEK(
      wrapped,
      iv,
      tag,
      {
        algorithm: ALGORITHM,
        authTagLength: TAG_LENGTH,
      }
    );
  }

  const dek = crypto.randomBytes(32);
  const { wrapped, iv, tag } = wrapDEK(dek);

  const { error } = await client
    .from('ultaura_account_crypto_keys')
    .insert({
      account_id: accountId,
      dek_wrapped: encodeBytea(wrapped),
      dek_wrap_iv: encodeBytea(iv),
      dek_wrap_tag: encodeBytea(tag),
      dek_kid: DEK_KID,
      dek_alg: DEK_ALG,
    });

  if (error) {
    logger.error({ error, accountId }, 'Failed to create account DEK');
    throw new Error('Failed to create account encryption key');
  }

  return dek;
}

export async function getLineDEK(
  client: SupabaseClient,
  lineId: string
): Promise<Buffer | null> {
  const { data: existing, error } = await client
    .from('ultaura_line_crypto_keys')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to load line DEK');
    return null;
  }

  if (!existing) {
    return null;
  }

  const wrapped = decodeByteaOrThrow('line.dek_wrapped', existing.dek_wrapped);
  const iv = decodeByteaOrThrow('line.dek_wrap_iv', existing.dek_wrap_iv, IV_LENGTH);
  const tag = decodeByteaOrThrow('line.dek_wrap_tag', existing.dek_wrap_tag, TAG_LENGTH);
  return unwrapDEK(
    wrapped,
    iv,
    tag,
    {
      algorithm: ALGORITHM,
      authTagLength: TAG_LENGTH,
    }
  );
}

export async function createLineDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  const dek = crypto.randomBytes(32);
  const { wrapped, iv, tag } = wrapDEK(dek);

  const { error } = await client
    .from('ultaura_line_crypto_keys')
    .insert({
      line_id: lineId,
      account_id: accountId,
      dek_wrapped: encodeBytea(wrapped),
      dek_wrap_iv: encodeBytea(iv),
      dek_wrap_tag: encodeBytea(tag),
      dek_kid: DEK_KID,
      dek_alg: DEK_ALG,
    });

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      const existing = await getLineDEK(client, lineId);
      if (existing) {
        return existing;
      }
    }
    logger.error({ error, lineId }, 'Failed to create line DEK');
    throw new Error('Failed to create line encryption key');
  }

  return dek;
}

export async function getOrCreateLineDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  const existing = await getLineDEK(client, lineId);
  if (existing) {
    return existing;
  }
  return createLineDEK(client, accountId, lineId);
}

export function encryptPayload(
  dek: Buffer,
  message: string,
  aad: Uint8Array
): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(IV_LENGTH);
  const plaintext = Buffer.from(JSON.stringify(message), 'utf8');

  const cipher = crypto.createCipheriv(ALGORITHM, toUint8Array(dek), toUint8Array(iv), {
    authTagLength: TAG_LENGTH,
  });

  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([
    Uint8Array.from(cipher.update(toUint8Array(plaintext))),
    Uint8Array.from(cipher.final()),
  ]);
  const tag = cipher.getAuthTag();

  return { ciphertext, iv, tag };
}

export function decryptPayload(
  dek: Buffer,
  ciphertext: Uint8Array,
  iv: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array
): string {
  const decipher = crypto.createDecipheriv(ALGORITHM, toUint8Array(dek), toUint8Array(iv), {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(toUint8Array(tag));
  decipher.setAAD(aad);

  const plaintext = Buffer.concat([
    Uint8Array.from(decipher.update(toUint8Array(ciphertext))),
    Uint8Array.from(decipher.final()),
  ]);

  return String(JSON.parse(plaintext.toString('utf8')) ?? '');
}
