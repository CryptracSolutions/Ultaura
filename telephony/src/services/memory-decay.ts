import { getSupabaseClient } from '../utils/supabase.js';
import { logger } from '../server.js';

const MEMORY_DECAY_ENABLED = process.env.ULTAURA_MEMORY_DECAY_ENABLED !== 'false';
const DECAY_RATE = Number.parseFloat(process.env.ULTAURA_DECAY_RATE || '0.20');
const DECAY_THRESHOLD = Number.parseFloat(process.env.ULTAURA_DECAY_THRESHOLD || '0.5');

function daysBetween(a: Date, b: Date): number {
  const diffMs = Math.max(0, b.getTime() - a.getTime());
  return diffMs / (1000 * 60 * 60 * 24);
}

function calculateDecayedConfidence(options: {
  confidence: number | null;
  createdAt: string;
  lastAccessedAt?: string | null;
}): number {
  const base = options.confidence ?? 1.0;
  const last = options.lastAccessedAt ? new Date(options.lastAccessedAt) : new Date(options.createdAt);
  const days = daysBetween(last, new Date());
  const decayAmount = DECAY_RATE * (days / 30);
  return Math.max(0, base - decayAmount);
}

export async function applyMemoryDecayForLine(lineId: string): Promise<number> {
  if (!MEMORY_DECAY_ENABLED) {
    return 0;
  }

  const supabase = getSupabaseClient();
  const { data: memories, error } = await supabase
    .from('ultaura_memories')
    .select('id, account_id, line_id, key, confidence, created_at, last_accessed_at, pinned, active')
    .eq('line_id', lineId)
    .eq('active', true)
    .eq('pinned', false);

  if (error) {
    logger.error({ error, lineId }, 'Failed to load memories for decay');
    return 0;
  }

  if (!memories?.length) {
    return 0;
  }

  const updates: Array<{ id: string; newConfidence: number; accountId: string; key: string }> = [];
  for (const memory of memories) {
    const newConfidence = calculateDecayedConfidence({
      confidence: memory.confidence,
      createdAt: memory.created_at,
      lastAccessedAt: memory.last_accessed_at,
    });

    if (memory.confidence !== null && newConfidence < memory.confidence) {
      updates.push({ id: memory.id, newConfidence, accountId: memory.account_id, key: memory.key });
    }
  }

  if (updates.length === 0) {
    return 0;
  }

  for (const update of updates) {
    const { error: updateError } = await supabase
      .from('ultaura_memories')
      .update({
        confidence: update.newConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', update.id);

    if (updateError) {
      logger.error({ error: updateError, memoryId: update.id }, 'Failed to update memory confidence');
    }
  }

  const belowThreshold = updates.filter((item) => item.newConfidence < DECAY_THRESHOLD);
  if (belowThreshold.length > 0) {
    const ids = belowThreshold.map((item) => item.id);
    const { data: existingLogs } = await supabase
      .from('ultaura_memory_deactivation_log')
      .select('memory_id')
      .in('memory_id', ids)
      .eq('reason', 'decay')
      .is('restored_at', null);

    const loggedIds = new Set((existingLogs || []).map((row) => row.memory_id));
    const rowsToInsert = belowThreshold
      .filter((item) => !loggedIds.has(item.id))
      .map((item) => ({
        memory_id: item.id,
        memory_key: item.key,
        line_id: lineId,
        account_id: item.accountId,
        reason: 'decay',
        confidence_at_deactivation: item.newConfidence,
      }));

    if (rowsToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from('ultaura_memory_deactivation_log')
        .insert(rowsToInsert);

      if (insertError) {
        logger.error({ error: insertError, lineId }, 'Failed to log memory decay');
      }
    }
  }

  return updates.length;
}

export async function markTemporalExpiryPending(lineId?: string): Promise<number> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('ultaura_memories')
    .update({
      expiry_pending: true,
      updated_at: new Date().toISOString(),
    })
    .eq('type', 'temporal')
    .eq('active', true)
    .eq('expiry_pending', false)
    .lt('expected_end_date', new Date().toISOString());

  if (lineId) {
    query = query.eq('line_id', lineId);
  }

  const { error, count } = await query;
  if (error) {
    logger.error({ error, lineId }, 'Failed to mark temporal memories for expiry review');
    return 0;
  }

  return count ?? 0;
}

export async function applyMemoryDecayForAllLines(): Promise<void> {
  if (!MEMORY_DECAY_ENABLED) {
    return;
  }

  const supabase = getSupabaseClient();
  const { data: lines, error } = await supabase
    .from('ultaura_lines')
    .select('id');

  if (error) {
    logger.error({ error }, 'Failed to load lines for memory decay');
    return;
  }

  for (const line of lines || []) {
    await applyMemoryDecayForLine(line.id);
    await markTemporalExpiryPending(line.id);
  }
}
