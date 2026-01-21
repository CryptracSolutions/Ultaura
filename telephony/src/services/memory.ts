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
import type {
  Memory,
  MemoryType,
  PrivacyScope,
  RelationshipMemoryValue,
  TemporalMemoryValue,
  RoutineMemoryValue,
  ExclusionCategory,
} from '@ultaura/types';
import { isDeepStrictEqual } from 'node:util';
import { buildSearchableText, generateEmbedding, formatEmbeddingForDb } from './embedding.js';
import { categorizeMemoryTopic, isTopicExcluded } from './topic-exclusions.js';
import { minimizeDerivedObjectDeep } from '../utils/derived-artifact-minimizer.js';

export type MemoryWriteAction = 'created' | 'updated' | 'skipped' | 'excluded';
export type MemoryWriteReason = 'duplicate_value' | 'key_updated' | 'topic_excluded' | 'embedding_pending';

export interface MemoryWriteResult {
  memoryId: string;
  action: MemoryWriteAction;
  reason?: MemoryWriteReason;
  version: number;
  excludedCategory?: string | null;
  embeddingGenerated?: boolean;
  pinned?: boolean;
}

function normalizeMemoryKey(key: string): string {
  return key.toLowerCase();
}

function valuesMatch(a: unknown, b: unknown): boolean {
  return isDeepStrictEqual(a, b);
}

const MEMORY_DECAY_ENABLED = process.env.ULTAURA_MEMORY_DECAY_ENABLED !== 'false';
const DECAY_THRESHOLD = Number.parseFloat(process.env.ULTAURA_DECAY_THRESHOLD || '0.5');
const TOPIC_EXCLUSIONS_ENABLED = process.env.ULTAURA_TOPIC_EXCLUSIONS_ENABLED !== 'false';
const SEMANTIC_SEARCH_ENABLED = process.env.ULTAURA_SEMANTIC_SEARCH_ENABLED !== 'false';
const SIMILARITY_THRESHOLD = Number.parseFloat(process.env.ULTAURA_EMBEDDING_SIMILARITY_THRESHOLD || '0.7');

function toNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function computeRelevanceScore(memory: Memory): number {
  const confidence = toNumber(memory.confidence ?? 1.0, 1.0);
  const updatedAt = memory.updatedAt ?? memory.createdAt;
  const daysSinceUpdate = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86400000);
  const recencyScore = 1 / (1 + daysSinceUpdate);
  const accessCount = toNumber(memory.accessCount ?? 0, 0);
  const accessScore = Math.min(accessCount / 10, 1);
  const pinnedBoost = memory.pinned ? 1 : 0;
  return (confidence * 0.4) + (recencyScore * 0.3) + (accessScore * 0.2) + (pinnedBoost * 0.1);
}

function isMemoryVisible(memory: Memory): boolean {
  if (TOPIC_EXCLUSIONS_ENABLED && memory.excludedCategory) {
    return false;
  }
  if (MEMORY_DECAY_ENABLED && !memory.pinned) {
    const confidence = memory.confidence ?? 1.0;
    if (confidence < DECAY_THRESHOLD) {
      return false;
    }
  }
  return true;
}

function stringifyForSearch(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(' ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function mapDecryptedMemory(m: {
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
  createdInCallSessionId?: string | null;
  lastAccessedAt?: string | null;
  accessCount?: number | null;
  pinned?: boolean;
  pinnedReason?: string | null;
  excludedCategory?: string | null;
  embeddingPending?: boolean;
  expectedEndDate?: string | null;
  expiryPending?: boolean;
}): Memory {
  const normalizedExcludedCategory = (m.excludedCategory ?? null) as ExclusionCategory | null;

  return {
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
    createdInCallSessionId: m.createdInCallSessionId ?? null,
    lastAccessedAt: m.lastAccessedAt ?? null,
    accessCount: m.accessCount ?? 0,
    pinned: m.pinned ?? false,
    pinnedReason: m.pinnedReason ?? null,
    excludedCategory: normalizedExcludedCategory,
    embeddingPending: m.embeddingPending ?? false,
    expectedEndDate: m.expectedEndDate ?? null,
    expiryPending: m.expiryPending ?? false,
  };
}

function inferTemporalEndDate(text: string): { expectedEndDate: string; durationEstimateWeeks?: number } {
  const now = new Date();
  const match = text.match(/(\d+)\s*(day|week|month|year)s?/i);
  let days = 30;

  if (match) {
    const amount = Number.parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (unit === 'day') days = amount;
    if (unit === 'week') days = amount * 7;
    if (unit === 'month') days = amount * 30;
    if (unit === 'year') days = amount * 365;
  } else if (/surgery|operation|recovery/i.test(text)) {
    days = 42;
  }

  const expected = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const durationEstimateWeeks = Math.round(days / 7);

  return { expectedEndDate: expected.toISOString(), durationEstimateWeeks };
}

function inferRoutineLevel(text: string): 'general' | 'time_specific' | 'day_specific' {
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(text)) {
    return 'day_specific';
  }
  if (/\b(\d{1,2}:\d{2}|\d{1,2}\s?(am|pm))\b/i.test(text)) {
    return 'time_specific';
  }
  return 'general';
}

function timeLabelFromTimeOfDay(timeOfDay?: string): string | null {
  if (!timeOfDay) return null;
  const trimmed = timeOfDay.trim().toLowerCase();
  let hour: number | null = null;

  const ampmMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (ampmMatch) {
    const base = Number.parseInt(ampmMatch[1], 10) % 12;
    const isPm = ampmMatch[3] === 'pm';
    hour = base + (isPm ? 12 : 0);
  } else {
    const twentyFourMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
    if (twentyFourMatch) {
      hour = Number.parseInt(twentyFourMatch[1], 10);
    }
  }

  if (hour === null || Number.isNaN(hour)) return null;
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function buildRoutinePrompt(description: string, timeOfDay?: string): string {
  const cleaned = description.trim();
  if (!cleaned) {
    return 'How is your routine going today?';
  }

  const lower = cleaned.toLowerCase();
  const hasTimeWord = /\b(morning|afternoon|evening|night)\b/.test(lower);
  const timeLabel = hasTimeWord ? null : timeLabelFromTimeOfDay(timeOfDay);

  if (timeLabel) {
    return `How was your ${cleaned} this ${timeLabel}?`;
  }

  return `How was your ${cleaned}?`;
}

function normalizeRelationshipValue(
  value: string,
  existing?: RelationshipMemoryValue
): RelationshipMemoryValue {
  const roleMatch = value.match(/\b(son|daughter|wife|husband|spouse|friend|neighbor|caregiver|mother|father|brother|sister|grandson|granddaughter)\b/i);
  const nameMatch = value.match(/\b[A-Z][a-z]+\b/);
  const frequencyMatch = value.match(/\b(daily|weekly|monthly|rarely)\b/i);

  return {
    name: existing?.name || (nameMatch ? nameMatch[0] : value),
    role: existing?.role || (roleMatch ? roleMatch[0].toLowerCase() : 'relationship'),
    contactFrequency: (frequencyMatch ? frequencyMatch[0].toLowerCase() : existing?.contactFrequency) as RelationshipMemoryValue['contactFrequency'],
    topicsDiscussed: existing?.topicsDiscussed,
    lastMentioned: existing?.lastMentioned,
    sentiment: existing?.sentiment,
    notes: existing?.notes,
  };
}

function normalizeTemporalValue(
  value: string,
  expectedEndDate?: string
): TemporalMemoryValue {
  const inferred = expectedEndDate ? { expectedEndDate } : inferTemporalEndDate(value);
  return {
    description: value,
    expectedEndDate: inferred.expectedEndDate,
    durationEstimateWeeks: inferred.durationEstimateWeeks,
    reviewBeforeArchive: true,
  };
}

function normalizeRoutineValue(
  value: string,
  routineLevel?: RoutineMemoryValue['level']
): RoutineMemoryValue {
  const level = routineLevel || inferRoutineLevel(value);
  const timeMatch = value.match(/\b(\d{1,2}:\d{2}|\d{1,2}\s?(am|pm))\b/i);
  const days: number[] = [];
  const dayMatches = value.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi);
  if (dayMatches) {
    const map: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    for (const day of dayMatches) {
      const index = map[day.toLowerCase()];
      if (index !== undefined && !days.includes(index)) {
        days.push(index);
      }
    }
  }

  const frequency =
    /\bdaily\b/i.test(value) ? 'daily' :
      /\bweekly\b/i.test(value) ? 'weekly' :
        /\boccasionally\b/i.test(value) ? 'occasional' : undefined;

  return {
    description: value,
    level,
    timeOfDay: timeMatch ? timeMatch[0] : undefined,
    daysOfWeek: days.length ? days : undefined,
    frequency,
    proactivePrompt: buildRoutinePrompt(value, timeMatch ? timeMatch[0] : undefined),
  };
}

function shouldAutoPin(key: string, value: unknown): string | null {
  const combined = `${key} ${stringifyForSearch(value)}`.toLowerCase();
  const patterns: Record<string, RegExp> = {
    emergency_contact: /(emergency|contact|call if|in case of|reach me at|next of kin)/i,
    medication: /(medication|medicine|pill|prescription|dose|take daily|blood pressure med|insulin|heart medication)/i,
    medical_condition: /(allerg|diabetic|diabetes|heart condition|pacemaker|blood thinner|seizure|epilep)/i,
    primary_doctor: /(doctor|physician|primary care|cardiologist|specialist).*(name|number|office)/i,
  };

  for (const [reason, pattern] of Object.entries(patterns)) {
    if (pattern.test(combined)) {
      return reason;
    }
  }

  return null;
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
    const fetchLimit = Math.max(options?.limit ?? 200, 200);
    const memories = await fetchDecryptedMemories(supabase, accountId, lineId, {
      active: !options?.includeInactive,
      limit: fetchLimit,
    });

    const normalized = memories.map(mapDecryptedMemory);

    const visible = normalized.filter(isMemoryVisible);
    const scored = visible
      .map((memory) => ({ memory, score: computeRelevanceScore(memory) }))
      .sort((a, b) => {
        if (a.memory.pinned && !b.memory.pinned) return -1;
        if (!a.memory.pinned && b.memory.pinned) return 1;
        return b.score - a.score;
      })
      .map((entry) => entry.memory);

    return scored.slice(0, options?.limit ?? 300);
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
    expectedEndDate?: string;
    routineLevel?: RoutineMemoryValue['level'];
    callSessionId?: string | null;
  }
): Promise<MemoryWriteResult | null> {
  const supabase = getSupabaseClient();
  const normalizedKey = normalizeMemoryKey(key);
  let normalizedValue = value;
  let expectedEndDate = options?.expectedEndDate;
  let embeddingGenerated = false;

  if (type === 'relationship') {
    if (typeof value === 'string') {
      normalizedValue = normalizeRelationshipValue(value);
    }
  }

  if (type === 'temporal') {
    if (typeof value === 'string') {
      const temporalValue = normalizeTemporalValue(value, expectedEndDate);
      normalizedValue = temporalValue;
      expectedEndDate = temporalValue.expectedEndDate;
    } else if (value && typeof value === 'object') {
      const temporalValue = value as TemporalMemoryValue;
      if (!temporalValue.expectedEndDate && expectedEndDate) {
        temporalValue.expectedEndDate = expectedEndDate;
      }
      normalizedValue = temporalValue;
      expectedEndDate = temporalValue.expectedEndDate;
    }
  }

  if (type === 'routine') {
    if (typeof value === 'string') {
      normalizedValue = normalizeRoutineValue(value, options?.routineLevel);
    } else if (value && typeof value === 'object') {
      const routineValue = value as RoutineMemoryValue;
      if (!routineValue.proactivePrompt && typeof routineValue.description === 'string') {
        routineValue.proactivePrompt = buildRoutinePrompt(routineValue.description, routineValue.timeOfDay);
      }
      normalizedValue = routineValue;
    }
  }

  if (options?.source === 'conversation') {
    normalizedValue = minimizeDerivedObjectDeep(normalizedValue, {
      defaultMode: 'sentence',
    });
  }

  try {
    const existing = await fetchDecryptedMemoryByKey(
      supabase,
      accountId,
      lineId,
      normalizedKey
    );

    if (existing && valuesMatch(existing.value, normalizedValue)) {
      return {
        memoryId: existing.id,
        action: 'skipped',
        reason: 'duplicate_value',
        version: existing.version,
      };
    }

    const excludedCategory = TOPIC_EXCLUSIONS_ENABLED
      ? categorizeMemoryTopic(normalizedKey, normalizedValue)
      : null;
    const isExcluded = excludedCategory
      ? await isTopicExcluded(lineId, excludedCategory)
      : false;

    const result = await upsertEncryptedMemory(
      supabase,
      accountId,
      lineId,
      type,
      normalizedKey,
      normalizedValue,
      {
        confidence: options?.confidence,
        source: options?.source || 'conversation',
        privacyScope: options?.privacyScope || 'line_only',
        createdInCallSessionId: options?.callSessionId ?? null,
      }
    );

    const metadataUpdates: Record<string, unknown> = {};
    let embeddingPending = false;

    if (expectedEndDate) {
      metadataUpdates.expected_end_date = expectedEndDate;
      metadataUpdates.expiry_pending = false;
    }

    if (isExcluded && excludedCategory) {
      metadataUpdates.excluded_category = excludedCategory;
      metadataUpdates.embedding_pending = false;
    } else {
      const searchableText = buildSearchableText(normalizedKey, normalizedValue);
      const embeddingResult = await generateEmbedding(searchableText);
      if (embeddingResult) {
        embeddingGenerated = true;
        const { error: embedError } = await supabase
          .from('ultaura_memory_embeddings')
          .upsert({
            memory_id: result.memoryId,
            line_id: lineId,
            account_id: accountId,
            embedding: formatEmbeddingForDb(embeddingResult.embedding),
            embedding_model: embeddingResult.model,
            searchable_text: searchableText,
          }, { onConflict: 'memory_id' });

        if (embedError) {
          logger.error({ error: embedError, memoryId: result.memoryId }, 'Failed to store memory embedding');
          embeddingPending = true;
        }
      } else {
        embeddingPending = true;
      }
    }

    if (embeddingPending) {
      metadataUpdates.embedding_pending = true;
    }

    const pinnedReason = shouldAutoPin(normalizedKey, normalizedValue);
    if (pinnedReason) {
      metadataUpdates.pinned = true;
      metadataUpdates.pinned_reason = pinnedReason;
      metadataUpdates.confidence = 1.0;
    }

    if (Object.keys(metadataUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('ultaura_memories')
        .update({ ...metadataUpdates, updated_at: new Date().toISOString() })
        .eq('id', result.memoryId);

      if (updateError) {
        logger.error({ error: updateError, memoryId: result.memoryId }, 'Failed to update memory metadata');
      }
    }

    return {
      memoryId: result.memoryId,
      action: isExcluded ? 'excluded' : result.action,
      reason: result.action === 'updated' ? 'key_updated' : (isExcluded ? 'topic_excluded' : (embeddingPending ? 'embedding_pending' : undefined)),
      version: result.version,
      excludedCategory: isExcluded ? excludedCategory : null,
      embeddingGenerated,
      pinned: Boolean(pinnedReason),
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
  existingMemory?: Memory,
  options?: { callSessionId?: string | null }
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

    let normalizedValue = value;
    let expectedEndDate: string | undefined;

    if (existing.type === 'relationship' && typeof value === 'string') {
      normalizedValue = normalizeRelationshipValue(value, existing.value as RelationshipMemoryValue);
    }

    if (existing.type === 'temporal') {
      if (typeof value === 'string') {
        const temporalValue = normalizeTemporalValue(value);
        normalizedValue = temporalValue;
        expectedEndDate = temporalValue.expectedEndDate;
      } else if (value && typeof value === 'object') {
        const temporalValue = value as TemporalMemoryValue;
        normalizedValue = temporalValue;
        expectedEndDate = temporalValue.expectedEndDate;
      }
    }

    if (existing.type === 'routine' && typeof value === 'string') {
      normalizedValue = normalizeRoutineValue(value);
    } else if (existing.type === 'routine' && value && typeof value === 'object') {
      const routineValue = value as RoutineMemoryValue;
      if (!routineValue.proactivePrompt && typeof routineValue.description === 'string') {
        routineValue.proactivePrompt = buildRoutinePrompt(routineValue.description, routineValue.timeOfDay);
      }
      normalizedValue = routineValue;
    }

    if (options?.callSessionId) {
      normalizedValue = minimizeDerivedObjectDeep(normalizedValue, {
        defaultMode: 'sentence',
      });
    }

    if (valuesMatch(existing.value, normalizedValue)) {
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
      normalizedValue,
      {
        confidence: existing.confidence || 1.0,
        privacyScope: existing.privacyScope as PrivacyScope,
        createdInCallSessionId: options?.callSessionId ?? null,
      }
    );

    const metadataUpdates: Record<string, unknown> = {};
    let embeddingPending = false;
    let embeddingGenerated = false;

    if (expectedEndDate) {
      metadataUpdates.expected_end_date = expectedEndDate;
      metadataUpdates.expiry_pending = false;
    }

    const excludedCategory = TOPIC_EXCLUSIONS_ENABLED
      ? categorizeMemoryTopic(normalizedKey, normalizedValue)
      : null;
    const isExcluded = excludedCategory
      ? await isTopicExcluded(lineId, excludedCategory)
      : false;

    if (isExcluded && excludedCategory) {
      metadataUpdates.excluded_category = excludedCategory;
      metadataUpdates.embedding_pending = false;
    } else {
      const searchableText = buildSearchableText(normalizedKey, normalizedValue);
      const embeddingResult = await generateEmbedding(searchableText);
      if (embeddingResult) {
        embeddingGenerated = true;
        const { error: embedError } = await supabase
          .from('ultaura_memory_embeddings')
          .upsert({
            memory_id: result.memoryId,
            line_id: lineId,
            account_id: accountId,
            embedding: formatEmbeddingForDb(embeddingResult.embedding),
            embedding_model: embeddingResult.model,
            searchable_text: searchableText,
          }, { onConflict: 'memory_id' });

        if (embedError) {
          logger.error({ error: embedError, memoryId: result.memoryId }, 'Failed to store memory embedding');
          embeddingPending = true;
        }
      } else {
        embeddingPending = true;
      }
    }

    if (embeddingPending) {
      metadataUpdates.embedding_pending = true;
    }

    const pinnedReason = existing.pinned ? existing.pinnedReason || 'pinned' : shouldAutoPin(normalizedKey, normalizedValue);
    if (pinnedReason) {
      metadataUpdates.pinned = true;
      metadataUpdates.pinned_reason = pinnedReason;
      metadataUpdates.confidence = 1.0;
    }

    if (Object.keys(metadataUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('ultaura_memories')
        .update({ ...metadataUpdates, updated_at: new Date().toISOString() })
        .eq('id', result.memoryId);

      if (updateError) {
        logger.error({ error: updateError, memoryId: result.memoryId }, 'Failed to update memory metadata');
      }
    }

    return {
      memoryId: result.memoryId,
      action: isExcluded ? 'excluded' : result.action,
      reason: result.action === 'updated' ? 'key_updated' : (isExcluded ? 'topic_excluded' : (embeddingPending ? 'embedding_pending' : undefined)),
      version: result.version,
      excludedCategory: isExcluded ? excludedCategory : null,
      embeddingGenerated,
      pinned: Boolean(pinnedReason),
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

export interface MemoryMatch {
  memory: Memory;
  similarity?: number;
  searchableText?: string;
}

export async function searchMemoriesSemantic(
  accountId: string,
  lineId: string,
  query: string,
  options?: {
    limit?: number;
    minConfidence?: number;
    similarityThreshold?: number;
  }
): Promise<MemoryMatch[]> {
  if (!SEMANTIC_SEARCH_ENABLED) {
    return [];
  }

  const embeddingResult = await generateEmbedding(query);
  if (!embeddingResult) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('match_memories_semantic', {
    p_line_id: lineId,
    p_query_embedding: formatEmbeddingForDb(embeddingResult.embedding),
    p_match_count: options?.limit ?? 5,
    p_similarity_threshold: options?.similarityThreshold ?? SIMILARITY_THRESHOLD,
    p_min_confidence: options?.minConfidence ?? DECAY_THRESHOLD,
  });

  if (error) {
    logger.error({ error, lineId }, 'Semantic memory search failed');
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  const matches: MemoryMatch[] = [];
  for (const row of data as Array<{
    memory_id: string;
    similarity: number;
    searchable_text: string;
  }>) {
    const memory = await fetchDecryptedMemoryById(supabase, accountId, lineId, row.memory_id);
    if (!memory) {
      continue;
    }
    matches.push({
      memory: mapDecryptedMemory(memory),
      similarity: row.similarity,
      searchableText: row.searchable_text,
    });
  }

  return matches;
}

export async function findFuzzyMatches(
  accountId: string,
  lineId: string,
  query: string,
  options?: { limit?: number }
): Promise<MemoryMatch[]> {
  const supabase = getSupabaseClient();
  const memories = await fetchDecryptedMemories(supabase, accountId, lineId, {
    active: true,
    limit: options?.limit ?? 100,
  });

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  const matches: MemoryMatch[] = [];
  for (const memory of memories) {
    const haystack = `${memory.key} ${stringifyForSearch(memory.value)}`.toLowerCase();
    if (terms.length === 0 || terms.some((term) => haystack.includes(term))) {
      matches.push({ memory: mapDecryptedMemory(memory) });
    }
  }

  return matches;
}

export async function markMemoriesAccessed(memoryIds: string[]): Promise<void> {
  if (memoryIds.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  await Promise.all(memoryIds.map(async (memoryId) => {
    const { error } = await supabase.rpc('mark_memory_accessed', {
      p_memory_id: memoryId,
    });
    if (error) {
      logger.error({ error, memoryId }, 'Failed to mark memory accessed');
    }
  }));
}

export async function logMemoryDeactivation(options: {
  memoryId: string;
  memoryKey: string;
  lineId: string;
  accountId: string;
  reason: 'user_request' | 'user_request_bulk' | 'decay' | 'topic_exclusion' | 'temporal_expiry' | 'payer_deletion';
  confidence?: number | null;
  callSessionId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('ultaura_memory_deactivation_log')
    .insert({
      memory_id: options.memoryId,
      memory_key: options.memoryKey,
      line_id: options.lineId,
      account_id: options.accountId,
      reason: options.reason,
      confidence_at_deactivation: options.confidence ?? null,
      call_session_id: options.callSessionId ?? null,
      metadata: options.metadata ?? null,
    });

  if (error) {
    logger.error({ error, memoryId: options.memoryId }, 'Failed to log memory deactivation');
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
