import type { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../server.js';
import { generateDEK, wrapDEK, unwrapDEK } from '../utils/crypto.js';

export async function getOrCreateAccountDEK(
  supabase: SupabaseClient,
  accountId: string
): Promise<Buffer> {
  const { data: existingKey } = await supabase
    .from('ultaura_account_crypto_keys')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (existingKey) {
    const wrapped = Buffer.from(existingKey.dek_wrapped);
    const iv = Buffer.from(existingKey.dek_wrap_iv);
    const tag = Buffer.from(existingKey.dek_wrap_tag);
    return unwrapDEK(wrapped, iv, tag);
  }

  const dek = generateDEK();
  const { wrapped, iv, tag } = wrapDEK(dek);

  const { error: insertError } = await supabase
    .from('ultaura_account_crypto_keys')
    .insert({
      account_id: accountId,
      dek_wrapped: wrapped,
      dek_wrap_iv: iv,
      dek_wrap_tag: tag,
      dek_kid: 'kek_v1',
      dek_alg: 'AES-256-GCM',
    });

  if (insertError) {
    logger.error({ error: insertError, accountId }, 'Failed to store account DEK');
    throw new Error('Failed to create account encryption key');
  }

  logger.info({ accountId }, 'Created new account encryption key');
  return dek;
}
