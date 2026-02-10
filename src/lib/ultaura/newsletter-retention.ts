import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';

const logger = getLogger();
const PRUNE_THROTTLE_MS = 5 * 60 * 1000;

let lastPruneAttemptAtMs: number | null = null;
let pruneInFlight: Promise<void> | null = null;

function logPruneFailure(error: unknown): void {
  logger.warn({ error }, 'Failed to prune newsletter operational data');
}

export async function runNewsletterRetentionPrune(
  client: SupabaseClient,
): Promise<void> {
  const { error } = await client.rpc('prune_newsletter_operational_data');

  if (error) {
    throw new Error(`Failed to prune newsletter operational data: ${error.message}`);
  }
}

export function scheduleNewsletterRetentionPrune(
  client: SupabaseClient,
  nowMs: number = Date.now(),
  onError: (error: unknown) => void = logPruneFailure,
): void {
  if (pruneInFlight) {
    return;
  }

  if (
    lastPruneAttemptAtMs !== null &&
    nowMs - lastPruneAttemptAtMs < PRUNE_THROTTLE_MS
  ) {
    return;
  }

  lastPruneAttemptAtMs = nowMs;
  pruneInFlight = runNewsletterRetentionPrune(client)
    .catch((error) => {
      onError(error);
    })
    .finally(() => {
      pruneInFlight = null;
    });
}
