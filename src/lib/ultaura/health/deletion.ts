import 'server-only';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { Database } from '~/database.types';

type HealthTable = keyof Database['public']['Tables'];

const logger = getLogger();

/**
 * Invalidate all Health-bearing export rows for an account.
 * Must run BEFORE any Health data cleanup.
 */
export async function invalidateHealthBearingExports(accountId: string): Promise<void> {
  const client = getSupabaseServerActionClient({ admin: true });
  const { error } = await client
    .from('ultaura_data_export_requests')
    .update({ invalidated_at: new Date().toISOString() })
    .eq('account_id', accountId)
    .eq('includes_health_profile', true)
    .is('invalidated_at', null);

  if (error) {
    logger.error({ error, accountId }, 'Failed to invalidate Health-bearing exports');
  }
}

/**
 * Centralized Health data cleanup for deletion flows.
 * Handles all Health tables + document blob storage.
 *
 * Deletion order is critical:
 * 1. Invalidate exports
 * 2. Delete document access tokens
 * 3. Delete document blobs from storage
 * 4. Delete document access logs
 * 5. Delete document rows
 * 6. Delete medication reminder links
 * 7. Delete Health-linked reminders
 * 8. Delete suggestions
 * 9. Delete observations
 * 10. Delete medications
 * 11. Delete conditions
 * 12. Delete item history
 * 13. Delete call notices
 * 14. Delete consent history
 * 15. Delete consent state
 */
export async function cleanupHealthDataForDeletion(
  accountId: string,
  lineIds: string[],
  options?: { scope: 'account' | 'line'; lineId?: string },
): Promise<{ success: boolean; failedStages: string[] }> {
  const client = getSupabaseServerActionClient({ admin: true });
  const failedStages: string[] = [];
  const scope = options?.scope ?? 'account';
  const filterField = scope === 'line' ? 'line_id' : 'account_id';
  const filterValue = scope === 'line' ? options!.lineId! : accountId;

  async function deleteFrom(table: HealthTable, stage: string) {
    const { error } = await client.from(table).delete().eq(filterField, filterValue);
    if (error) {
      logger.error({ error, accountId, stage }, `Health deletion failed: ${stage}`);
      failedStages.push(stage);
    }
  }

  // 1. Invalidate exports (always account-level)
  await invalidateHealthBearingExports(accountId);

  // 2. Delete document access tokens
  await deleteFrom('ultaura_health_document_access_tokens', 'document_access_tokens');

  // 3. Delete document blobs from storage BEFORE row deletion
  try {
    const { data: docs } = await client
      .from('ultaura_health_documents')
      .select('storage_object_key')
      .eq(filterField, filterValue)
      .not('storage_object_key', 'is', null);

    if (docs && docs.length > 0) {
      const keys = docs
        .map((d) => d.storage_object_key)
        .filter((k): k is string => k !== null);
      if (keys.length > 0) {
        const { error: storageError } = await client.storage
          .from('ultaura-health-documents')
          .remove(keys);
        if (storageError) {
          logger.error(
            { error: storageError, accountId, keyCount: keys.length },
            'Health document blob cleanup failed',
          );
          failedStages.push('document_blobs');
        }
      }
    }
  } catch (err) {
    logger.error({ error: err, accountId }, 'Health document blob cleanup exception');
    failedStages.push('document_blobs');
  }

  // 4. Delete document access logs
  await deleteFrom('ultaura_health_document_access_log', 'document_access_log');

  // 5. Delete document rows
  await deleteFrom('ultaura_health_documents', 'documents');

  // 6. Delete medication reminder links
  await deleteFrom('ultaura_health_medication_reminders', 'medication_reminders');

  // 7. Delete Health-linked reminders
  const { error: reminderError } = await client
    .from('ultaura_reminders')
    .delete()
    .eq(filterField, filterValue)
    .eq('source_context', 'health_profile');
  if (reminderError) {
    logger.error({ error: reminderError, accountId }, 'Health reminder deletion failed');
    failedStages.push('health_reminders');
  }

  // 8-15. Delete remaining Health tables
  await deleteFrom('ultaura_health_suggestions', 'suggestions');
  await deleteFrom('ultaura_health_observations', 'observations');
  await deleteFrom('ultaura_health_medications', 'medications');
  await deleteFrom('ultaura_health_conditions', 'conditions');
  await deleteFrom('ultaura_health_item_history', 'item_history');
  await deleteFrom('ultaura_health_call_notices', 'call_notices');
  await deleteFrom('ultaura_health_consent_history', 'consent_history');
  await deleteFrom('ultaura_health_line_consent', 'consent_state');

  return {
    success: failedStages.length === 0,
    failedStages,
  };
}
