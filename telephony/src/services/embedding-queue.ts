import { getSupabaseClient } from '../utils/supabase.js';
import { fetchDecryptedMemoryById } from '../utils/encryption.js';
import { logger } from '../server.js';
import { buildSearchableText, generateEmbedding, formatEmbeddingForDb } from './embedding.js';

const BATCH_SIZE = Number.parseInt(process.env.ULTAURA_EMBEDDING_BATCH_SIZE || '10', 10);

export async function processPendingEmbeddings(): Promise<number> {
  const supabase = getSupabaseClient();

  const { data: pending, error } = await supabase
    .from('ultaura_memories')
    .select('id, account_id, line_id')
    .eq('embedding_pending', true)
    .eq('active', true)
    .is('excluded_category', null)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    logger.error({ error }, 'Failed to load pending embeddings');
    return 0;
  }

  if (!pending?.length) {
    return 0;
  }

  let processed = 0;

  for (const row of pending) {
    const memory = await fetchDecryptedMemoryById(
      supabase,
      row.account_id,
      row.line_id,
      row.id
    );

    if (!memory) {
      continue;
    }

    const searchableText = buildSearchableText(memory.key, memory.value);
    const result = await generateEmbedding(searchableText);

    if (!result) {
      continue;
    }

    const { error: embedError } = await supabase
      .from('ultaura_memory_embeddings')
      .upsert({
        memory_id: memory.id,
        line_id: memory.lineId,
        account_id: memory.accountId,
        embedding: formatEmbeddingForDb(result.embedding),
        embedding_model: result.model,
        searchable_text: searchableText,
      }, { onConflict: 'memory_id' });

    if (embedError) {
      logger.error({ error: embedError, memoryId: memory.id }, 'Failed to store embedding');
      continue;
    }

    const { error: updateError } = await supabase
      .from('ultaura_memories')
      .update({
        embedding_pending: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memory.id);

    if (updateError) {
      logger.error({ error: updateError, memoryId: memory.id }, 'Failed to clear embedding_pending');
      continue;
    }

    processed++;
  }

  return processed;
}
