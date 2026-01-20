import { getSupabaseClient } from '../src/utils/supabase.js';
import { getMemoryDEK } from '../src/services/line-encryption.js';
import { buildReminderMessageAAD, encryptReminderMessageWithDek } from '../src/utils/reminder-crypto.js';

const BATCH_SIZE = 100;
const execute = process.argv.includes('--execute');

async function run(): Promise<void> {
  const supabase = getSupabaseClient();

  if (!execute) {
    const { count, error } = await supabase
      .from('ultaura_reminders')
      .select('id', { count: 'exact', head: true })
      .is('message_ciphertext', null)
      .not('message', 'is', null);

    if (error) {
      console.error('Failed to count reminders for encryption', { code: error.code, message: error.message });
      process.exit(1);
    }

    console.log(`Dry run: ${count ?? 0} reminders pending encryption.`);
    return;
  }

  const dekCache = new Map<string, Buffer>();
  let processed = 0;
  let updated = 0;

  while (true) {
    const { data: reminders, error } = await supabase
      .from('ultaura_reminders')
      .select('id, account_id, line_id, message')
      .is('message_ciphertext', null)
      .not('message', 'is', null)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Failed to fetch reminders for encryption', { code: error.code, message: error.message });
      process.exit(1);
    }

    if (!reminders || reminders.length === 0) {
      break;
    }

    for (const reminder of reminders) {
      processed += 1;

      try {
        let dek = dekCache.get(reminder.line_id);
        if (!dek) {
          dek = await getMemoryDEK(supabase, reminder.account_id, reminder.line_id);
          dekCache.set(reminder.line_id, dek);
        }

        const aad = buildReminderMessageAAD(
          reminder.account_id,
          reminder.line_id,
          reminder.id
        );
        const encrypted = encryptReminderMessageWithDek(
          dek,
          String(reminder.message ?? ''),
          aad
        );

        const { error: updateError } = await supabase
          .from('ultaura_reminders')
          .update({
            message_ciphertext: encrypted.ciphertext,
            message_iv: encrypted.iv,
            message_tag: encrypted.tag,
            message_alg: encrypted.alg,
            message_kid: encrypted.kid,
          })
          .eq('id', reminder.id)
          .is('message_ciphertext', null);

        if (updateError) {
          console.error('Failed to update reminder encryption', {
            reminderId: reminder.id,
            code: updateError.code,
            message: updateError.message,
          });
          continue;
        }

        updated += 1;
      } catch (err) {
        console.error('Failed to encrypt reminder', {
          reminderId: reminder.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  console.log(`Encrypted ${updated} of ${processed} reminders.`);
}

run().catch((error) => {
  console.error('Reminder encryption script failed', {
    message: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
