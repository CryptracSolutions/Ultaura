// Memory encryption utilities
// AES-256-GCM encryption for memory values

import crypto from 'crypto';
import { logger } from '../server.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits

// Get the Key Encryption Key (KEK) from environment
function getKEK(): Buffer {
  const kekHex = process.env.MEMORY_ENCRYPTION_KEY;

  if (!kekHex) {
    throw new Error('Missing MEMORY_ENCRYPTION_KEY environment variable');
  }

  if (kekHex.length !== 64) {
    throw new Error('MEMORY_ENCRYPTION_KEY must be 64 hex characters (256 bits)');
  }

  return Buffer.from(kekHex, 'hex');
}

// Generate a new Data Encryption Key (DEK)
export function generateDEK(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

// Wrap (encrypt) a DEK using the KEK
export function wrapDEK(dek: Buffer): {
  wrapped: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const kek = getKEK();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, kek, iv, {
    authTagLength: TAG_LENGTH,
  });

  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return { wrapped, iv, tag };
}

// Unwrap (decrypt) a DEK using the KEK
export function unwrapDEK(
  wrapped: Buffer,
  iv: Buffer,
  tag: Buffer
): Buffer {
  const kek = getKEK();

  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(tag);

  const dek = Buffer.concat([decipher.update(wrapped), decipher.final()]);

  return dek;
}

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
export async function getOrCreateAccountDEK(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string
): Promise<Buffer> {
  // Try to get existing DEK
  const { data: existingKey, error: fetchError } = await supabase
    .from('ultaura_account_crypto_keys')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (existingKey) {
    // Unwrap the existing DEK
    const wrapped = Buffer.from(existingKey.dek_wrapped);
    const iv = Buffer.from(existingKey.dek_wrap_iv);
    const tag = Buffer.from(existingKey.dek_wrap_tag);

    return unwrapDEK(wrapped, iv, tag);
  }

  // Generate new DEK
  const dek = generateDEK();
  const { wrapped, iv, tag } = wrapDEK(dek);

  // Store wrapped DEK
  const { error: insertError } = await supabase
    .from('ultaura_account_crypto_keys')
    .insert({
      account_id: accountId,
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
      dek_kid: 'kek_v1',
      dek_alg: 'AES-256-GCM',
    });

  if (insertError) {
    logger.error({ error: insertError, accountId }, 'Failed to store account DEK');
    throw new Error('Failed to create account encryption key');
  }

  logger.info({ accountId }, 'Created new account encryption key');

  return dek;
}

// Encrypt and store a memory
export async function storeEncryptedMemory(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  accountId: string,
  lineId: string,
  type: 'fact' | 'preference' | 'follow_up',
  key: string,
  value: unknown,
  options?: {
    confidence?: number;
    source?: 'onboarding' | 'conversation' | 'caregiver_seed';
    privacyScope?: 'line_only' | 'shareable_with_payer';
    redactionLevel?: 'none' | 'low' | 'high';
  }
): Promise<string> {
  const dek = await getOrCreateAccountDEK(supabase, accountId);

  // Generate a new memory ID
  const memoryId = crypto.randomUUID();

  // Build AAD
  const aad = buildMemoryAAD(accountId, lineId, memoryId, type, key);

  // Encrypt the value
  const { ciphertext, iv, tag } = encryptMemoryValue(dek, value, aad);

  // Store in database
  const { error } = await supabase.from('ultaura_memories').insert({
    id: memoryId,
    account_id: accountId,
    line_id: lineId,
    type,
    key,
    value_ciphertext: ciphertext,
    value_iv: iv,
    value_tag: tag,
    value_alg: 'AES-256-GCM',
    value_kid: 'kek_v1',
    confidence: options?.confidence ?? 1.0,
    source: options?.source ?? 'conversation',
    privacy_scope: options?.privacyScope ?? 'line_only',
    redaction_level: options?.redactionLevel ?? 'none',
  });

  if (error) {
    logger.error({ error, accountId, lineId }, 'Failed to store encrypted memory');
    throw new Error('Failed to store memory');
  }

  logger.info({ memoryId, accountId, lineId, type, key }, 'Stored encrypted memory');

  return memoryId;
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
  type: string;
  key: string;
  value: unknown;
  confidence: number | null;
  privacyScope: string;
}>> {
  const dek = await getOrCreateAccountDEK(supabase, accountId);

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

      decrypted.push({
        id: memory.id,
        type: memory.type,
        key: memory.key,
        value,
        confidence: memory.confidence,
        privacyScope: memory.privacy_scope,
      });
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
