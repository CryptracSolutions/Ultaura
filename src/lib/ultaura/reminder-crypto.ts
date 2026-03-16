import 'server-only';

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';
import { decodeBytea } from './bytea';
import { buildShingles, tokenizeText } from '~/lib/search/match';
import { isDecryptionError } from './crypto-kek';
import {
  toUint8Array,
  isLegacyLine,
  getOrCreateAccountDEK,
  getOrCreateLineDEK,
  encryptPayload,
  decryptPayload,
} from './crypto-dek';

const logger = getLogger();

const REMINDER_ALG = 'AES-256-GCM';
const REMINDER_KID = 'kek_v1';
const SEARCH_TOKEN_CONTEXT = 'reminder_search_token_v1';

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

async function getReminderDEK(
  client: SupabaseClient,
  accountId: string,
  lineId: string,
  lineCreatedAt?: string | null
): Promise<Buffer> {
  const PER_LINE_DEK_ENABLED = process.env.ULTAURA_PER_LINE_DEK_ENABLED !== 'false';

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
  const { ciphertext, iv, tag } = encryptPayload(dek, message, aad);

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

  return decryptPayload(dek, encrypted.ciphertext, encrypted.iv, encrypted.tag, aad);
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
        const message = decryptPayload(
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

