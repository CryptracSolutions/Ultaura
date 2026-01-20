import { getSupabaseClient } from '../src/utils/supabase.js';
import { encryptDebugPayload } from '../src/utils/debug-log-crypto.js';
import { buildPayloadSummary } from '../src/utils/payload-summary.js';

const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true';

type DebugLogRow = {
  id: string;
  account_id: string;
  call_session_id: string | null;
  payload: Record<string, unknown> | null;
};

async function main(): Promise<void> {
  const supabase = getSupabaseClient();

  console.log(`Starting debug log encryption backfill (dry_run=${DRY_RUN})`);

  let processed = 0;
  let encrypted = 0;
  let skipped = 0;
  let failed = 0;
  let lastId: string | null = null;
  const failedIds = new Set<string>();

  while (true) {
    let query = supabase
      .from('ultaura_debug_logs')
      .select('id, account_id, call_session_id, payload')
      .is('payload_ciphertext', null)
      .not('account_id', 'is', null)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Failed to fetch logs:', { code: error.code, message: error.message });
      break;
    }

    if (!logs || logs.length === 0) {
      console.log('No more unencrypted logs to process');
      break;
    }

    for (const log of logs as DebugLogRow[]) {
      processed += 1;

      const originalPayload = log.payload;
      if (!originalPayload || typeof originalPayload !== 'object') {
        skipped += 1;
        continue;
      }

      try {
        const encryptedPayload = await encryptDebugPayload(
          supabase,
          log.account_id,
          log.call_session_id,
          log.id,
          originalPayload
        );

        const payloadSummary = buildPayloadSummary(originalPayload);
        const safePayload = {
          _encrypted: true,
          _backfilled: true,
          summary: payloadSummary,
        };

        if (!DRY_RUN) {
          const { error: updateError } = await supabase
            .from('ultaura_debug_logs')
            .update({
              payload: safePayload,
              payload_ciphertext: encryptedPayload.ciphertext,
              payload_iv: encryptedPayload.iv,
              payload_tag: encryptedPayload.tag,
              payload_alg: encryptedPayload.alg,
              payload_kid: encryptedPayload.kid,
              payload_summary: payloadSummary,
            })
            .eq('id', log.id)
            .is('payload_ciphertext', null);

          if (updateError) {
            console.error('Failed to update log:', {
              debugLogId: log.id,
              code: updateError.code,
              message: updateError.message,
            });
            failed += 1;
            continue;
          }
        }

        encrypted += 1;
      } catch (error) {
        const err = error as Error;
        console.error('Failed to encrypt log:', {
          debugLogId: log.id,
          errorMessage: err?.message ?? String(error),
        });
        failed += 1;
        failedIds.add(log.id);
      }

      if (processed % 100 === 0) {
        console.log(`Progress: processed=${processed}, encrypted=${encrypted}, skipped=${skipped}, failed=${failed}`);
      }
    }

    lastId = logs[logs.length - 1]?.id ?? lastId;
  }

  console.log(`Backfill complete: processed=${processed}, encrypted=${encrypted}, skipped=${skipped}, failed=${failed}`);

  if (failedIds.size > 0) {
    console.log('Failed debug log IDs (first 20):', Array.from(failedIds).slice(0, 20));
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const err = error as Error;
  console.error('Backfill failed:', { errorMessage: err?.message ?? String(error) });
  process.exit(1);
});
