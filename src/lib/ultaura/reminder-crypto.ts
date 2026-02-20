import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';
import { decodeBytea, encodeBytea, type ByteaInput } from './bytea';
import { buildShingles, tokenizeText } from '~/lib/search/match';
import {
  isDecryptionError,
  unwrapDEK,
  wrapDEKWithCurrentKey,
} from './crypto-kek';

const logger = getLogger();

const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;
const IV_LENGTH = 12;
const REMINDER_ALG = 'AES-256-GCM';
const REMINDER_KID = 'kek_v1';
const SEARCH_TOKEN_CONTEXT = 'reminder_search_token_v1';

const DEFAULT_DEK_CUTOFF = '2026-03-01T00:00:00Z';
const PER_LINE_DEK_ENABLED = process.env.ULTAURA_PER_LINE_DEK_ENABLED !== 'false';
const PER_LINE_DEK_CUTOFF = new Date(process.env.ULTAURA_PER_LINE_DEK_CUTOFF || DEFAULT_DEK_CUTOFF);
const SEARCH_HASH_FALLBACK_WINDOW_MS = 15 * 60 * 1000;
const SEARCH_HASH_FALLBACK_ALERT_THRESHOLD = Number.parseInt(
  process.env.ULTAURA_SEARCH_HASH_FALLBACK_ALERT_THRESHOLD || '25',
  10
);
const SEARCH_HASH_FALLBACK_WARN_EVERY = Number.parseInt(
  process.env.ULTAURA_SEARCH_HASH_FALLBACK_WARN_EVERY || '10',
  10
);
let searchHashFallbackWindowStartedAt = Date.now();
let searchHashFallbackCountInWindow = 0;

function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return Uint8Array.from(value);
}

function decodeByteaOrThrow(
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

function wrapDEK(dek: Buffer): { wrapped: Buffer; iv: Buffer; tag: Buffer } {
  return wrapDEKWithCurrentKey(dek, {
    algorithm: ALGORITHM,
    authTagLength: TAG_LENGTH,
    ivLength: IV_LENGTH,
  });
}

function isLegacyLine(createdAt: string | null | undefined): boolean {
  if (!PER_LINE_DEK_ENABLED || !createdAt) {
    return true;
  }

  const cutoff = Number.isNaN(PER_LINE_DEK_CUTOFF.getTime())
    ? new Date(DEFAULT_DEK_CUTOFF)
    : PER_LINE_DEK_CUTOFF;

  return new Date(createdAt) < cutoff;
}

async function getOrCreateAccountDEK(
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
      dek_kid: REMINDER_KID,
      dek_alg: REMINDER_ALG,
    });

  if (error) {
    logger.error({ error, accountId }, 'Failed to create account DEK');
    throw new Error('Failed to create account encryption key');
  }

  return dek;
}

async function getLineDEK(
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

async function createLineDEK(
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
      dek_kid: REMINDER_KID,
      dek_alg: REMINDER_ALG,
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

async function getOrCreateLineDEK(
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

export function buildReminderMessageAAD(
  accountId: string,
  lineId: string,
  reminderId: string
): Uint8Array {
  return Uint8Array.from(
    Buffer.from(
      JSON.stringify({
        account_id: accountId,
        line_id: lineId,
        reminder_id: reminderId,
        type: 'reminder_message',
      }),
      'utf8'
    )
  );
}

function encryptValue(
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

function decryptValue(
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

async function getReminderDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  lineCreatedAt?: string | null
): Promise<Buffer> {
  if (!PER_LINE_DEK_ENABLED) {
    return getOrCreateAccountDEK(client, accountId);
  }

  if (isLegacyLine(lineCreatedAt)) {
    return getOrCreateAccountDEK(client, accountId);
  }

  return getOrCreateLineDEK(client, accountId, lineId);
}

function hashSearchToken(key: Buffer, token: string): string {
  return crypto
    .createHmac('sha256', key)
    .update(`${SEARCH_TOKEN_CONTEXT}:${token}`)
    .digest('hex');
}

function normalizeFallbackAlertThreshold(): number {
  return Number.isFinite(SEARCH_HASH_FALLBACK_ALERT_THRESHOLD)
    && SEARCH_HASH_FALLBACK_ALERT_THRESHOLD > 0
    ? SEARCH_HASH_FALLBACK_ALERT_THRESHOLD
    : 25;
}

function normalizeFallbackWarnInterval(): number {
  return Number.isFinite(SEARCH_HASH_FALLBACK_WARN_EVERY)
    && SEARCH_HASH_FALLBACK_WARN_EVERY > 0
    ? SEARCH_HASH_FALLBACK_WARN_EVERY
    : 10;
}

function recordSearchHashFallback(params: {
  accountId: string;
  errorCode: string;
  tokenCount: number;
}): void {
  const now = Date.now();
  if (now - searchHashFallbackWindowStartedAt >= SEARCH_HASH_FALLBACK_WINDOW_MS) {
    searchHashFallbackWindowStartedAt = now;
    searchHashFallbackCountInWindow = 0;
  }

  searchHashFallbackCountInWindow += 1;
  const warnInterval = normalizeFallbackWarnInterval();
  if (
    searchHashFallbackCountInWindow === 1
    || searchHashFallbackCountInWindow % warnInterval === 0
  ) {
    logger.warn(
      {
        event: 'reminder_search_hash_fallback',
        accountId: params.accountId,
        errorCode: params.errorCode,
        tokenCount: params.tokenCount,
        fallbackCountInWindow: searchHashFallbackCountInWindow,
        fallbackWindowMs: SEARCH_HASH_FALLBACK_WINDOW_MS,
        fallbackWindowStartedAt: new Date(searchHashFallbackWindowStartedAt).toISOString(),
        warnInterval,
      },
      'Failed to hash reminder query tokens; returning empty token set.'
    );
  }

  const threshold = normalizeFallbackAlertThreshold();
  if (
    searchHashFallbackCountInWindow === threshold
    || searchHashFallbackCountInWindow % threshold === 0
  ) {
    logger.error(
      {
        event: 'reminder_search_hash_fallback_threshold',
        accountId: params.accountId,
        errorCode: params.errorCode,
        tokenCount: params.tokenCount,
        fallbackCountInWindow: searchHashFallbackCountInWindow,
        threshold,
        fallbackWindowMs: SEARCH_HASH_FALLBACK_WINDOW_MS,
      },
      'Reminder search hash fallback threshold reached.'
    );
  }
}

export async function buildReminderSearchTokens(
  client: SupabaseClient,
  accountId: string,
  message: string
): Promise<string[]> {
  const baseTokens = tokenizeText(message, { minLength: 2, maxTokens: 32 });
  const shingles = buildShingles(baseTokens);
  const combined = Array.from(new Set([...baseTokens, ...shingles]));

  if (combined.length === 0) {
    return [];
  }

  const key = await getOrCreateAccountDEK(client, accountId);
  return combined.map((token) => hashSearchToken(key, token));
}

export async function hashReminderQueryTokens(
  client: SupabaseClient,
  accountId: string,
  tokens: string[]
): Promise<string[]> {
  if (tokens.length === 0) return [];
  try {
    const key = await getOrCreateAccountDEK(client, accountId);
    return Array.from(new Set(tokens)).map((token) => hashSearchToken(key, token));
  } catch (error) {
    recordSearchHashFallback({
      accountId,
      errorCode: isDecryptionError(error) ? error.code : 'UNKNOWN',
      tokenCount: tokens.length,
    });
    return [];
  }
}

export async function encryptReminderMessage(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  reminderId: string,
  message: string,
  lineCreatedAt?: string | null
): Promise<{
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}> {
  const dek = await getReminderDEK(client, accountId, lineId, lineCreatedAt);
  const aad = buildReminderMessageAAD(accountId, lineId, reminderId);
  const { ciphertext, iv, tag } = encryptValue(dek, message, aad);

  return {
    ciphertext,
    iv,
    tag,
    alg: REMINDER_ALG,
    kid: REMINDER_KID,
  };
}

export async function decryptReminderMessage(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  reminderId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
  lineCreatedAt?: string | null
): Promise<string> {
  const dek = await getReminderDEK(client, accountId, lineId, lineCreatedAt);
  const aad = buildReminderMessageAAD(accountId, lineId, reminderId);

  return decryptValue(dek, encrypted.ciphertext, encrypted.iv, encrypted.tag, aad);
}

export function decryptReminderMessagesWithDek(
  dek: Buffer,
  accountId: string,
  lineId: string,
  reminders: Array<{
    id: string;
    message_ciphertext?: Uint8Array | string | null;
    message_iv?: Uint8Array | string | null;
    message_tag?: Uint8Array | string | null;
    message?: string | null;
  }>
): Array<{ id: string; message: string | null; decryptFailed: boolean }> {
  return reminders.map((reminder) => {
    if (reminder.message_ciphertext && reminder.message_iv && reminder.message_tag) {
      const ciphertext = decodeBytea(reminder.message_ciphertext);
      const iv = decodeBytea(reminder.message_iv);
      const tag = decodeBytea(reminder.message_tag);
      if (!ciphertext || !iv || !tag) {
        return { id: reminder.id, message: null, decryptFailed: true };
      }
      const aad = buildReminderMessageAAD(accountId, lineId, reminder.id);
      try {
        const message = decryptValue(
          dek,
          toUint8Array(ciphertext),
          toUint8Array(iv),
          toUint8Array(tag),
          aad
        );
        return { id: reminder.id, message, decryptFailed: false };
      } catch {
        return { id: reminder.id, message: null, decryptFailed: true };
      }
    }

    return {
      id: reminder.id,
      message: reminder.message ?? null,
      decryptFailed: false,
    };
  });
}

export async function decryptReminderMessagesForLine(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  reminders: Array<{
    id: string;
    message_ciphertext?: Uint8Array | string | null;
    message_iv?: Uint8Array | string | null;
    message_tag?: Uint8Array | string | null;
    message?: string | null;
  }>,
  lineCreatedAt?: string | null
): Promise<Array<{ id: string; message: string | null; decryptFailed: boolean }>> {
  const dek = await getReminderDEK(client, accountId, lineId, lineCreatedAt);
  return decryptReminderMessagesWithDek(dek, accountId, lineId, reminders);
}
