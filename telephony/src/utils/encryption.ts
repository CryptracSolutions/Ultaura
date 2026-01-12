// Memory encryption utilities
// AES-256-GCM encryption for memory values

import crypto from 'crypto';
import type { MemoryType } from '@ultaura/types';
import { logger } from '../server.js';
import { getMemoryDEK } from '../services/line-encryption.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const VALUE_ALG = 'AES-256-GCM';
const VALUE_KID = 'kek_v1';

// Encrypt a memory value
export function encryptMemoryValue(
  dek: Buffer,
  value: unknown,
  aad: Buffer // Additional Authenticated Data
): {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const iv = crypto.randomBytes(IV_LENGTH);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');

  const cipher = crypto.createCipheriv(ALGORITHM, dek, iv, {
    authTagLength: TAG_LENGTH,
  });

  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { ciphertext, iv, tag };
}

// Decrypt a memory value
export function decryptMemoryValue(
  dek: Buffer,
  ciphertext: Buffer,
  iv: Buffer,
  tag: Buffer,
  aad: Buffer
): unknown {
  const decipher = crypto.createDecipheriv(ALGORITHM, dek, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(tag);
  decipher.setAAD(aad);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return JSON.parse(plaintext.toString('utf8'));
}

function escapeLikePattern(value: string): string {
  return value.replace(/([\\%_])/g, '\\$1');
}

function decryptMemoryRow(
  dek: Buffer,
  memory: any
): {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  updatedAt: string | null;
  type: string;
  key: string;
  value: unknown;
  confidence: number | null;
  source: string | null;
  version: number;
  active: boolean;
  privacyScope: string;
  redactionLevel: string;
  lastAccessedAt?: string | null;
  accessCount?: number | null;
  pinned?: boolean;
  pinnedReason?: string | null;
  excludedCategory?: string | null;
  embeddingPending?: boolean;
  expectedEndDate?: string | null;
  expiryPending?: boolean;
} {
  const aad = buildMemoryAAD(
    memory.account_id,
    memory.line_id,
    memory.id,
    memory.type,
    memory.key
  );

  const value = decryptMemoryValue(
    dek,
    Buffer.from(memory.value_ciphertext),
    Buffer.from(memory.value_iv),
    Buffer.from(memory.value_tag),
    aad
  );

  return {
    id: memory.id,
    accountId: memory.account_id,
    lineId: memory.line_id,
    createdAt: memory.created_at,
    updatedAt: memory.updated_at,
    type: memory.type,
    key: memory.key,
    value,
    confidence: memory.confidence,
    source: memory.source,
    version: memory.version,
    active: memory.active,
    privacyScope: memory.privacy_scope,
    redactionLevel: memory.redaction_level,
    lastAccessedAt: memory.last_accessed_at ?? null,
    accessCount: memory.access_count ?? null,
    pinned: memory.pinned ?? false,
    pinnedReason: memory.pinned_reason ?? null,
    excludedCategory: memory.excluded_category ?? null,
    embeddingPending: memory.embedding_pending ?? false,
    expectedEndDate: memory.expected_end_date ?? null,
    expiryPending: memory.expiry_pending ?? false,
  };
}

// Build AAD for a memory entry
export function buildMemoryAAD(
  accountId: string,
  lineId: string,
  memoryId: string,
  type: string,
  key: string
): Buffer {
  const aadString = JSON.stringify({
    account_id: accountId,
    line_id: lineId,
    memory_id: memoryId,
    type,
    key,
  });

  return Buffer.from(aadString, 'utf8');
}

// Create or get DEK for an account
export async function upsertEncryptedMemory(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  type: MemoryType,
  key: string,
  value: unknown,
  options?: {
    confidence?: number;
    source?: 'onboarding' | 'conversation' | 'caregiver_seed';
    privacyScope?: 'line_only' | 'shareable_with_payer';
    redactionLevel?: 'none' | 'low' | 'high';
  }
): Promise<{ memoryId: string; action: 'created' | 'updated'; version: number }> {
  const dek = await getMemoryDEK(supabase, accountId, lineId);

  const memoryId = crypto.randomUUID();
  const aad = buildMemoryAAD(accountId, lineId, memoryId, type, key);

  const { ciphertext, iv, tag } = encryptMemoryValue(dek, value, aad);

  const { data, error } = await supabase.rpc('upsert_ultaura_memory', {
    p_account_id: accountId,
    p_line_id: lineId,
    p_type: type,
    p_key: key,
    p_value_ciphertext: ciphertext,
    p_value_iv: iv,
    p_value_tag: tag,
    p_value_alg: VALUE_ALG,
    p_value_kid: VALUE_KID,
    p_confidence: options?.confidence ?? 1.0,
    p_source: options?.source ?? 'conversation',
    p_privacy_scope: options?.privacyScope ?? 'line_only',
    p_redaction_level: options?.redactionLevel ?? 'none',
    p_memory_id: memoryId,
  });

  if (error) {
    logger.error({ error, accountId, lineId }, 'Failed to upsert encrypted memory');
    throw new Error('Failed to store memory');
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.memory_id) {
    logger.error({ accountId, lineId, data }, 'Upsert memory returned unexpected payload');
    throw new Error('Failed to store memory');
  }

  logger.info({
    memoryId: result.memory_id,
    accountId,
    lineId,
    type,
    key,
    action: result.action,
    version: result.version,
  }, 'Stored encrypted memory');

  return {
    memoryId: result.memory_id,
    action: result.action ?? 'created',
    version: result.version ?? 1,
  };
}

// Encrypt and store a memory
export async function storeEncryptedMemory(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  type: MemoryType,
  key: string,
  value: unknown,
  options?: {
    confidence?: number;
    source?: 'onboarding' | 'conversation' | 'caregiver_seed';
    privacyScope?: 'line_only' | 'shareable_with_payer';
    redactionLevel?: 'none' | 'low' | 'high';
  }
): Promise<string> {
  const result = await upsertEncryptedMemory(
    supabase,
    accountId,
    lineId,
    type,
    key,
    value,
    options
  );

  return result.memoryId;
}

export async function fetchDecryptedMemoryByKey(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  key: string
): Promise<{
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  updatedAt: string | null;
  type: string;
  key: string;
  value: unknown;
  confidence: number | null;
  source: string | null;
  version: number;
  active: boolean;
  privacyScope: string;
  redactionLevel: string;
  lastAccessedAt?: string | null;
  accessCount?: number | null;
  pinned?: boolean;
  pinnedReason?: string | null;
  excludedCategory?: string | null;
  embeddingPending?: boolean;
  expectedEndDate?: string | null;
  expiryPending?: boolean;
} | null> {
  const dek = await getMemoryDEK(supabase, accountId, lineId);
  const pattern = escapeLikePattern(key);

  let query = supabase
    .from('ultaura_memories')
    .select('*')
    .eq('account_id', accountId)
    .eq('line_id', lineId)
    .eq('active', true)
    .ilike('key', pattern)
    .order('created_at', { ascending: false })
    .limit(1);

  const { data: memories, error } = await query;

  if (error) {
    logger.error({ error, lineId, key }, 'Failed to fetch memory by key');
    throw new Error('Failed to fetch memory');
  }

  if (!memories || memories.length === 0) {
    return null;
  }

  try {
    return decryptMemoryRow(dek, memories[0]);
  } catch (err) {
    logger.error({ error: err, memoryId: memories[0]?.id }, 'Failed to decrypt memory');
    return null;
  }
}

export async function fetchDecryptedMemoryById(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  memoryId: string
): Promise<{
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  updatedAt: string | null;
  type: string;
  key: string;
  value: unknown;
  confidence: number | null;
  source: string | null;
  version: number;
  active: boolean;
  privacyScope: string;
  redactionLevel: string;
  lastAccessedAt?: string | null;
  accessCount?: number | null;
  pinned?: boolean;
  pinnedReason?: string | null;
  excludedCategory?: string | null;
  embeddingPending?: boolean;
  expectedEndDate?: string | null;
  expiryPending?: boolean;
} | null> {
  const dek = await getMemoryDEK(supabase, accountId, lineId);

  const { data: memories, error } = await supabase
    .from('ultaura_memories')
    .select('*')
    .eq('id', memoryId)
    .eq('account_id', accountId)
    .eq('line_id', lineId)
    .limit(1);

  if (error) {
    logger.error({ error, memoryId, lineId }, 'Failed to fetch memory by id');
    throw new Error('Failed to fetch memory');
  }

  const memory = memories?.[0];
  if (!memory) {
    return null;
  }

  try {
    return decryptMemoryRow(dek, memory);
  } catch (err) {
    logger.error({ error: err, memoryId }, 'Failed to decrypt memory');
    return null;
  }
}

// Fetch and decrypt memories for a line
export async function fetchDecryptedMemories(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  options?: {
    active?: boolean;
    limit?: number;
  }
): Promise<Array<{
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  updatedAt: string | null;
  type: string;
  key: string;
  value: unknown;
  confidence: number | null;
  source: string | null;
  version: number;
  active: boolean;
  privacyScope: string;
  redactionLevel: string;
  lastAccessedAt?: string | null;
  accessCount?: number | null;
  pinned?: boolean;
  pinnedReason?: string | null;
  excludedCategory?: string | null;
  embeddingPending?: boolean;
  expectedEndDate?: string | null;
  expiryPending?: boolean;
}>> {
  const dek = await getMemoryDEK(supabase, accountId, lineId);

  // Fetch encrypted memories
  let query = supabase
    .from('ultaura_memories')
    .select('*')
    .eq('line_id', lineId);

  if (options?.active !== false) {
    query = query.eq('active', true);
  }

  query = query.order('updated_at', { ascending: false, nullsFirst: false });

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data: memories, error } = await query;

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch memories');
    throw new Error('Failed to fetch memories');
  }

  if (!memories || memories.length === 0) {
    return [];
  }

  // Decrypt each memory
  const decrypted = [];

  for (const memory of memories) {
    try {
      decrypted.push(decryptMemoryRow(dek, memory));
    } catch (err) {
      logger.error({ error: err, memoryId: memory.id }, 'Failed to decrypt memory');
      // Skip this memory but continue with others
    }
  }

  return decrypted;
}

// Mark a memory as inactive (soft delete)
export async function deactivateMemory(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  memoryId: string
): Promise<void> {
  const { error } = await supabase
    .from('ultaura_memories')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', memoryId);

  if (error) {
    logger.error({ error, memoryId }, 'Failed to deactivate memory');
    throw new Error('Failed to deactivate memory');
  }

  logger.info({ memoryId }, 'Memory deactivated');
}

export async function deleteMemoriesByKey(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  key: string
): Promise<number> {
  const { data, error } = await supabase.rpc('delete_ultaura_memories_for_key', {
    p_account_id: accountId,
    p_line_id: lineId,
    p_key: key,
  });

  if (error) {
    logger.error({ error, accountId, lineId, key }, 'Failed to hard delete memories');
    throw new Error('Failed to hard delete memories');
  }

  const deletedCount = typeof data === 'number' ? data : 0;
  logger.info({ accountId, lineId, key, deletedCount }, 'Memories hard deleted');
  return deletedCount;
}
