import { getSupabaseClient } from '../utils/supabase.js';
import { fetchDecryptedMemories } from '../utils/encryption.js';
import { logger } from '../server.js';

export type ExclusionCategory =
  | 'health_medical'
  | 'family_relationships'
  | 'finances'
  | 'location_address';

export const EXCLUSION_DISPLAY_NAMES: Record<ExclusionCategory, string> = {
  health_medical: 'Health & Medical',
  family_relationships: 'Family & Relationships',
  finances: 'Finances',
  location_address: 'Location & Address',
};

const CATEGORY_PATTERNS: Record<ExclusionCategory, RegExp> = {
  health_medical: /(medication|medicine|doctor|hospital|surgery|diagnosis|symptom|pain|prescription|illness|disease|treatment|therapy|medical|nurse|clinic|pharmacy|pill|dose|appointment|checkup|blood pressure|diabetes|arthritis|heart|cancer)/i,
  family_relationships: /(son|daughter|wife|husband|spouse|grandchild|grandson|granddaughter|family|brother|sister|mother|father|parent|friend|neighbor|caregiver|nephew|niece|aunt|uncle|cousin|in-law|ex-|divorce|marriage|relationship)/i,
  finances: /(money|bank|account|bill|payment|insurance|pension|savings|debt|loan|mortgage|income|expense|retire|social security|medicare|medicaid|tax|budget|afford|cost|price|dollar|cent|\\$)/i,
  location_address: /(address|street|avenue|road|apartment|apt|house|home|live|living|location|neighborhood|city|town|state|zip|floor|building|complex|community|facility|residence|move|moved)/i,
};

function buildCategoryText(key: string, value: unknown): string {
  if (value == null) return key;
  if (typeof value === 'string') return `${key} ${value}`;
  if (Array.isArray(value)) return `${key} ${value.join(' ')}`;
  if (typeof value === 'object') return `${key} ${JSON.stringify(value)}`;
  return `${key} ${String(value)}`;
}

export function categorizeMemoryTopic(
  key: string,
  value: unknown
): ExclusionCategory | null {
  const combined = buildCategoryText(key, value).toLowerCase();

  for (const [category, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (pattern.test(combined)) {
      return category as ExclusionCategory;
    }
  }

  return null;
}

export async function listTopicExclusions(lineId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_topic_exclusions')
    .select('*')
    .eq('line_id', lineId)
    .order('category', { ascending: true });

  if (error) {
    logger.error({ error, lineId }, 'Failed to load topic exclusions');
    return [];
  }

  return data ?? [];
}

export async function isTopicExcluded(
  lineId: string,
  category: ExclusionCategory
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_topic_exclusions')
    .select('excluded')
    .eq('line_id', lineId)
    .eq('category', category)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId, category }, 'Failed to check topic exclusion');
    return false;
  }

  return Boolean(data?.excluded);
}

export async function excludeTopic(options: {
  accountId: string;
  lineId: string;
  category: ExclusionCategory;
  callSessionId?: string;
}): Promise<{ affectedMemoryIds: string[] }> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('ultaura_topic_exclusions')
    .update({
      excluded: true,
      excluded_at: now,
      excluded_call_session_id: options.callSessionId ?? null,
      updated_at: now,
      reincluded_at: null,
      reincluded_call_session_id: null,
    })
    .eq('line_id', options.lineId)
    .eq('category', options.category);

  if (error) {
    logger.error({ error, lineId: options.lineId, category: options.category }, 'Failed to update topic exclusion');
    throw error;
  }

  const memories = await fetchDecryptedMemories(supabase, options.accountId, options.lineId, {
    active: true,
    limit: 200,
  });

  const affectedMemories = memories
    .filter((m) => !m.excludedCategory && categorizeMemoryTopic(m.key, m.value) === options.category)
    .map((m) => ({ id: m.id, key: m.key, confidence: m.confidence ?? null }));

  if (affectedMemories.length > 0) {
    const affectedIds = affectedMemories.map((memory) => memory.id);
    const { error: updateError } = await supabase
      .from('ultaura_memories')
      .update({
        excluded_category: options.category,
        embedding_pending: false,
        updated_at: now,
      })
      .in('id', affectedIds);

    if (updateError) {
      logger.error({ error: updateError, lineId: options.lineId }, 'Failed to mark memories excluded');
    }

    const { error: deleteError } = await supabase
      .from('ultaura_memory_embeddings')
      .delete()
      .in('memory_id', affectedIds);

    if (deleteError) {
      logger.error({ error: deleteError, lineId: options.lineId }, 'Failed to delete excluded embeddings');
    }

    const { error: logError } = await supabase
      .from('ultaura_memory_deactivation_log')
      .insert(
        affectedMemories.map((memory) => ({
          memory_id: memory.id,
          memory_key: memory.key,
          line_id: options.lineId,
          account_id: options.accountId,
          reason: 'topic_exclusion',
          confidence_at_deactivation: memory.confidence,
          call_session_id: options.callSessionId ?? null,
          metadata: { category: options.category },
        }))
      );

    if (logError) {
      logger.error({ error: logError, lineId: options.lineId }, 'Failed to log topic exclusion deactivations');
    }
  }

  return { affectedMemoryIds: affectedMemories.map((memory) => memory.id) };
}

export async function includeTopic(options: {
  lineId: string;
  category: ExclusionCategory;
  callSessionId?: string;
}): Promise<{ restoredMemoryIds: string[] }> {
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('ultaura_topic_exclusions')
    .update({
      excluded: false,
      reincluded_at: now,
      reincluded_call_session_id: options.callSessionId ?? null,
      updated_at: now,
    })
    .eq('line_id', options.lineId)
    .eq('category', options.category);

  if (error) {
    logger.error({ error, lineId: options.lineId, category: options.category }, 'Failed to update topic inclusion');
    throw error;
  }

  const { data, error: fetchError } = await supabase
    .from('ultaura_memories')
    .select('id')
    .eq('line_id', options.lineId)
    .eq('active', true)
    .eq('excluded_category', options.category);

  if (fetchError) {
    logger.error({ error: fetchError, lineId: options.lineId }, 'Failed to fetch excluded memories for inclusion');
    return { restoredMemoryIds: [] };
  }

  const memoryIds = (data ?? []).map((row) => row.id);
  if (memoryIds.length > 0) {
    const { error: updateError } = await supabase
      .from('ultaura_memories')
      .update({
        excluded_category: null,
        embedding_pending: true,
        updated_at: now,
      })
      .in('id', memoryIds);

    if (updateError) {
      logger.error({ error: updateError, lineId: options.lineId }, 'Failed to restore excluded memories');
    }
  }

  return { restoredMemoryIds: memoryIds };
}
