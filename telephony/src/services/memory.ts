// Memory service
// Manages memories during calls

import { getSupabaseClient } from '../utils/supabase.js';
import {
  fetchDecryptedMemories,
  storeEncryptedMemory,
  deactivateMemory,
} from '../utils/encryption.js';
import { logger } from '../server.js';

export interface Memory {
  id: string;
  type: 'fact' | 'preference' | 'follow_up';
  key: string;
  value: unknown;
  confidence: number | null;
  privacyScope: 'line_only' | 'shareable_with_payer';
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
      type: m.type as 'fact' | 'preference' | 'follow_up',
      key: m.key,
      value: m.value,
      confidence: m.confidence,
      privacyScope: m.privacyScope as 'line_only' | 'shareable_with_payer',
    }));
  } catch (error) {
    logger.error({ error, lineId }, 'Failed to fetch memories');
    return [];
  }
}

// Format memories for system prompt
export function formatMemoriesForPrompt(memories: Memory[]): string {
  if (memories.length === 0) {
    return 'No previous memories recorded yet.';
  }

  // Group by type
  const facts = memories.filter(m => m.type === 'fact');
  const preferences = memories.filter(m => m.type === 'preference');
  const followUps = memories.filter(m => m.type === 'follow_up');

  const sections: string[] = [];

  if (facts.length > 0) {
    sections.push('**Facts about them:**');
    facts.forEach(m => {
      sections.push(`- ${m.key}: ${formatValue(m.value)}`);
    });
  }

  if (preferences.length > 0) {
    sections.push('\n**Their preferences:**');
    preferences.forEach(m => {
      sections.push(`- ${m.key}: ${formatValue(m.value)}`);
    });
  }

  if (followUps.length > 0) {
    sections.push('\n**Things to follow up on:**');
    followUps.forEach(m => {
      sections.push(`- ${m.key}: ${formatValue(m.value)}`);
    });
  }

  return sections.join('\n');
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return String(value);
}

// Store a new memory
export async function storeMemory(
  accountId: string,
  lineId: string,
  type: 'fact' | 'preference' | 'follow_up',
  key: string,
  value: unknown,
  options?: {
    confidence?: number;
    source?: 'onboarding' | 'conversation' | 'caregiver_seed';
    privacyScope?: 'line_only' | 'shareable_with_payer';
  }
): Promise<string | null> {
  const supabase = getSupabaseClient();

  try {
    const memoryId = await storeEncryptedMemory(
      supabase,
      accountId,
      lineId,
      type,
      key,
      value,
      {
        confidence: options?.confidence,
        source: options?.source || 'conversation',
        privacyScope: options?.privacyScope || 'line_only',
      }
    );

    return memoryId;
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
  value: unknown
): Promise<string | null> {
  const supabase = getSupabaseClient();

  try {
    // Get the existing memory
    const memories = await fetchDecryptedMemories(supabase, accountId, lineId, { limit: 1000 });
    const existing = memories.find(m => m.id === memoryId);

    if (!existing) {
      logger.error({ memoryId }, 'Memory not found for update');
      return null;
    }

    // Deactivate old version
    await deactivateMemory(supabase, memoryId);

    // Create new version
    const newId = await storeEncryptedMemory(
      supabase,
      accountId,
      lineId,
      existing.type as 'fact' | 'preference' | 'follow_up',
      existing.key,
      value,
      {
        confidence: existing.confidence || 1.0,
        privacyScope: existing.privacyScope as 'line_only' | 'shareable_with_payer',
      }
    );

    return newId;
  } catch (error) {
    logger.error({ error, memoryId }, 'Failed to update memory');
    return null;
  }
}

// Delete (deactivate) a memory - "forget that"
export async function forgetMemory(
  accountId: string,
  lineId: string,
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

// Mark a memory as line-only (don't tell family)
export async function markMemoryPrivate(
  accountId: string,
  lineId: string,
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
  type: 'fact' | 'preference' | 'follow_up';
  key: string;
  value: string;
}> {
  const memories: Array<{ type: 'fact' | 'preference' | 'follow_up'; key: string; value: string }> = [];

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
