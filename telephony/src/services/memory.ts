// Memory service
// Manages memories during calls

import { getSupabaseClient } from '../utils/supabase.js';
import {
  fetchDecryptedMemories,
  fetchDecryptedMemoryById,
  fetchDecryptedMemoryByKey,
  upsertEncryptedMemory,
  deactivateMemory,
  deleteMemoriesByKey,
} from '../utils/encryption.js';
import { logger } from '../server.js';
import type { Memory, MemoryType, PrivacyScope } from '@ultaura/types';
import { isDeepStrictEqual } from 'node:util';

export type MemoryWriteAction = 'created' | 'updated' | 'skipped';
export type MemoryWriteReason = 'duplicate_value' | 'key_updated';

export interface MemoryWriteResult {
  memoryId: string;
  action: MemoryWriteAction;
  reason?: MemoryWriteReason;
  version: number;
}

function normalizeMemoryKey(key: string): string {
  return key.toLowerCase();
}

function valuesMatch(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b);
}

// Fetch memories for a line (for prompt assembly)
export async function getMemoriesForLine(
  accountId: string,
  lineId: string,
  options?: {
    limit?: number;
    includeInactive?: boolean;
  }
): Promise<Memory[]> {
  const supabase = getSupabaseClient();

  try {
    const memories = await fetchDecryptedMemories(supabase, accountId, lineId, {
      active: !options?.includeInactive,
      limit: options?.limit || 200,
    });

    return memories.map(m => ({
      id: m.id,
      accountId: m.accountId,
      lineId: m.lineId,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      type: m.type as MemoryType,
      key: m.key,
      value: m.value,
      confidence: m.confidence,
      source: m.source as Memory['source'],
      version: m.version,
      active: m.active,
      privacyScope: m.privacyScope as PrivacyScope,
      redactionLevel: m.redactionLevel as Memory['redactionLevel'],
    }));
  } catch (error) {
    logger.error({
      error,
      accountId,
      lineId,
      operation: 'getMemoriesForLine',
      stack: error instanceof Error ? error.stack : undefined,
    }, 'Failed to fetch memories - returning empty array. Conversation may lack personalization.');
    return [];
  }
}

// Store a new memory
export async function storeMemory(
  accountId: string,
  lineId: string,
  type: MemoryType,
  key: string,
  value: unknown,
  options?: {
    confidence?: number;
    source?: 'onboarding' | 'conversation' | 'caregiver_seed';
    privacyScope?: PrivacyScope;
  }
): Promise<MemoryWriteResult | null> {
  const supabase = getSupabaseClient();
  const normalizedKey = normalizeMemoryKey(key);

  try {
    const existing = await fetchDecryptedMemoryByKey(
      supabase,
      accountId,
      lineId,
      normalizedKey
    );

    if (existing && valuesMatch(existing.value, value)) {
      return {
        memoryId: existing.id,
        action: 'skipped',
        reason: 'duplicate_value',
        version: existing.version,
      };
    }

    const result = await upsertEncryptedMemory(
      supabase,
      accountId,
      lineId,
      type,
      normalizedKey,
      value,
      {
        confidence: options?.confidence,
        source: options?.source || 'conversation',
        privacyScope: options?.privacyScope || 'line_only',
      }
    );

    return {
      memoryId: result.memoryId,
      action: result.action,
      reason: result.action === 'updated' ? 'key_updated' : undefined,
      version: result.version,
    };
  } catch (error) {
    logger.error({ error, lineId, type, key }, 'Failed to store memory');
    return null;
  }
}

// Update a memory (creates new version)
export async function updateMemory(
  accountId: string,
  lineId: string,
  memoryId: string,
  value: unknown,
  existingMemory?: Memory
): Promise<MemoryWriteResult | null> {
  const supabase = getSupabaseClient();

  try {
    // Get the existing memory
    const existing = existingMemory ?? await fetchDecryptedMemoryById(
      supabase,
      accountId,
      lineId,
      memoryId
    );

    if (!existing) {
      logger.error({ memoryId }, 'Memory not found for update');
      return null;
    }

    if (existing.id !== memoryId) {
      logger.warn({ memoryId, existingId: existing.id }, 'Memory mismatch during update');
    }

    if (valuesMatch(existing.value, value)) {
      return {
        memoryId: existing.id,
        action: 'skipped',
        reason: 'duplicate_value',
        version: existing.version,
      };
    }

    const normalizedKey = normalizeMemoryKey(existing.key);

    // Create new version
    const result = await upsertEncryptedMemory(
      supabase,
      accountId,
      lineId,
      existing.type as MemoryType,
      normalizedKey,
      value,
      {
        confidence: existing.confidence || 1.0,
        privacyScope: existing.privacyScope as PrivacyScope,
      }
    );

    return {
      memoryId: result.memoryId,
      action: result.action,
      reason: result.action === 'updated' ? 'key_updated' : undefined,
      version: result.version,
    };
  } catch (error) {
    logger.error({ error, memoryId }, 'Failed to update memory');
    return null;
  }
}

// Delete (deactivate) a memory - "forget that"
export async function forgetMemory(
  _accountId: string,
  _lineId: string,
  memoryId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    await deactivateMemory(supabase, memoryId);
    return true;
  } catch (error) {
    logger.error({ error, memoryId }, 'Failed to forget memory');
    return false;
  }
}

export async function hardDeleteMemoryByKey(
  accountId: string,
  lineId: string,
  key: string
): Promise<number | null> {
  const supabase = getSupabaseClient();

  try {
    return await deleteMemoriesByKey(supabase, accountId, lineId, key);
  } catch (error) {
    logger.error({ error, lineId, key }, 'Failed to hard delete memory');
    return null;
  }
}

// Mark a memory as line-only (don't tell family)
export async function markMemoryPrivate(
  _accountId: string,
  _lineId: string,
  memoryId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('ultaura_memories')
      .update({
        privacy_scope: 'line_only',
        updated_at: new Date().toISOString(),
      })
      .eq('id', memoryId);

    if (error) {
      throw error;
    }

    return true;
  } catch (error) {
    logger.error({ error, memoryId }, 'Failed to mark memory private');
    return false;
  }
}

// Common memory keys
export const MEMORY_KEYS = {
  PREFERRED_NAME: 'preferred_name',
  LANGUAGE: 'language',
  INTERESTS: 'interests',
  TOPICS_TO_AVOID: 'topics_to_avoid',
  FAMILY_MEMBERS: 'family_members',
  PETS: 'pets',
  HOBBIES: 'hobbies',
  HEALTH_GENERAL: 'health_general', // General health notes, not diagnoses
  LOCATION: 'location',
  DAILY_ROUTINE: 'daily_routine',
  UPCOMING_EVENTS: 'upcoming_events',
  LAST_CONVERSATION_TOPIC: 'last_conversation_topic',
} as const;

// Extract memories from conversation (simple heuristics)
export function extractMemoriesFromText(text: string): Array<{
  type: MemoryType;
  key: string;
  value: string;
}> {
  const memories: Array<{ type: MemoryType; key: string; value: string }> = [];

  // Simple pattern matching for common memory types
  // In production, this would use NLP or the LLM itself

  // Name extraction
  const nameMatch = text.match(/(?:call me|my name is|i'm|i am)\s+(\w+)/i);
  if (nameMatch) {
    memories.push({
      type: 'fact',
      key: MEMORY_KEYS.PREFERRED_NAME,
      value: nameMatch[1],
    });
  }

  // Interest extraction
  const interestMatch = text.match(/(?:i like|i love|i enjoy|interested in)\s+(.+?)(?:\.|,|$)/i);
  if (interestMatch) {
    memories.push({
      type: 'preference',
      key: MEMORY_KEYS.INTERESTS,
      value: interestMatch[1].trim(),
    });
  }

  // Avoid topic extraction
  const avoidMatch = text.match(/(?:don't like|hate|don't want to talk about|avoid)\s+(.+?)(?:\.|,|$)/i);
  if (avoidMatch) {
    memories.push({
      type: 'preference',
      key: MEMORY_KEYS.TOPICS_TO_AVOID,
      value: avoidMatch[1].trim(),
    });
  }

  // Pet extraction
  const petMatch = text.match(/(?:my|i have a)\s+(dog|cat|bird|fish|pet)\s+(?:named\s+)?(\w+)?/i);
  if (petMatch) {
    memories.push({
      type: 'fact',
      key: MEMORY_KEYS.PETS,
      value: petMatch[2] ? `${petMatch[1]} named ${petMatch[2]}` : petMatch[1],
    });
  }

  // Follow-up extraction
  const followUpMatch = text.match(/(?:remind me|i need to|i have to|don't forget)\s+(.+?)(?:\.|!|$)/i);
  if (followUpMatch) {
    memories.push({
      type: 'follow_up',
      key: 'reminder',
      value: followUpMatch[1].trim(),
    });
  }

  return memories;
}
