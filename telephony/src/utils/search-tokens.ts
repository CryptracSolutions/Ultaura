import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateAccountDEK } from '../services/account-encryption.js';

const SEARCH_TOKEN_CONTEXT = 'reminder_search_token_v1';
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'you',
  'your',
]);

function normalizeText(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeText(text: string, options?: { minLength?: number; maxTokens?: number }): string[] {
  const minLength = options?.minLength ?? 2;
  const maxTokens = options?.maxTokens ?? 32;
  const normalized = normalizeText(text);
  if (!normalized) return [];
  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= minLength && !STOP_WORDS.has(token));

  const unique = Array.from(new Set(tokens));
  return unique.slice(0, maxTokens);
}

function buildShingles(tokens: string[]): string[] {
  if (tokens.length < 2) return [];
  const shingles: string[] = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    shingles.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return shingles;
}

function hashToken(key: Buffer, token: string): string {
  return crypto
    .createHmac('sha256', key)
    .update(`${SEARCH_TOKEN_CONTEXT}:${token}`)
    .digest('hex');
}

export async function buildReminderSearchTokens(
  supabase: SupabaseClient,
  accountId: string,
  message: string
): Promise<string[]> {
  const baseTokens = tokenizeText(message, { minLength: 2, maxTokens: 32 });
  const shingles = buildShingles(baseTokens);
  const combined = Array.from(new Set([...baseTokens, ...shingles]));
  if (combined.length === 0) return [];

  const key = await getOrCreateAccountDEK(supabase, accountId);
  return combined.map((token) => hashToken(key, token));
}
