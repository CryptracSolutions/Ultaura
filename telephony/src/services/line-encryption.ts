import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../server.js';
import { generateDEK, wrapDEK, unwrapDEK } from '../utils/crypto.js';
import { getOrCreateAccountDEK } from './account-encryption.js';
import { decodeBytea, encodeBytea } from '../utils/bytea.js';

const DEFAULT_DEK_CUTOFF = '2026-03-01T00:00:00Z';
const PER_LINE_DEK_ENABLED = process.env.ULTAURA_PER_LINE_DEK_ENABLED !== 'false';
const PER_LINE_DEK_CUTOFF = new Date(process.env.ULTAURA_PER_LINE_DEK_CUTOFF || DEFAULT_DEK_CUTOFF);

function isLegacyLine(createdAt: string | null): boolean {
  if (!PER_LINE_DEK_ENABLED || !createdAt) {
    return true;
  }
  const cutoff = Number.isNaN(PER_LINE_DEK_CUTOFF.getTime())
    ? new Date(DEFAULT_DEK_CUTOFF)
    : PER_LINE_DEK_CUTOFF;
  return new Date(createdAt) < cutoff;
}

async function getLineCreatedAt(
  supabase: SupabaseClient,
  lineId: string,
  accountId: string
): Promise<string | null> {
  const { data: line, error } = await supabase
    .from('ultaura_lines')
    .select('created_at, account_id')
    .eq('id', lineId)
    .single();

  if (error || !line) {
    logger.error({ error, lineId }, 'Failed to load line for DEK lookup');
    return null;
  }
  if (line.account_id !== accountId) {
    logger.warn({ lineId, accountId, lineAccountId: line.account_id }, 'Line account mismatch during DEK lookup');
  }
  return line.created_at ?? null;
}

export async function getLineDEK(
  supabase: SupabaseClient,
  lineId: string
): Promise<Buffer | null> {
  const { data: existingKey, error } = await supabase
    .from('ultaura_line_crypto_keys')
    .select('*')
    .eq('line_id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to load line DEK');
    return null;
  }
  if (!existingKey) {
    return null;
  }
  const wrapped = decodeBytea(existingKey.dek_wrapped);
  const iv = decodeBytea(existingKey.dek_wrap_iv);
  const tag = decodeBytea(existingKey.dek_wrap_tag);
  if (!wrapped || !iv || !tag) {
    throw new Error('Failed to decode line DEK payloads');
  }
  return unwrapDEK(wrapped, iv, tag);
}

export async function createLineDEK(
  supabase: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  const dek = generateDEK();
  const { wrapped, iv, tag } = wrapDEK(dek);

  const { error: insertError } = await supabase
    .from('ultaura_line_crypto_keys')
    .insert({
      line_id: lineId,
      account_id: accountId,
      dek_wrapped: encodeBytea(wrapped),
      dek_wrap_iv: encodeBytea(iv),
      dek_wrap_tag: encodeBytea(tag),
      dek_kid: 'kek_v1',
      dek_alg: 'AES-256-GCM',
    });

  if (insertError) {
    if ((insertError as { code?: string }).code === '23505') {
      const existing = await getLineDEK(supabase, lineId);
      if (existing) {
        return existing;
      }
    }
    logger.error({ error: insertError, lineId }, 'Failed to store line DEK');
    throw new Error('Failed to create line encryption key');
  }

  logger.info({ lineId }, 'Created new line encryption key');
  return dek;
}

export async function getOrCreateLineDEK(
  supabase: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  const existing = await getLineDEK(supabase, lineId);
  if (existing) {
    return existing;
  }
  return createLineDEK(supabase, accountId, lineId);
}

export async function getMemoryDEK(
  supabase: SupabaseClient,
  accountId: string,
  lineId: string
): Promise<Buffer> {
  if (!PER_LINE_DEK_ENABLED) {
    return getOrCreateAccountDEK(supabase, accountId);
  }

  const createdAt = await getLineCreatedAt(supabase, lineId, accountId);
  if (isLegacyLine(createdAt)) {
    return getOrCreateAccountDEK(supabase, accountId);
  }

  return getOrCreateLineDEK(supabase, accountId, lineId);
}
