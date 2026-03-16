import 'server-only';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';

const logger = getLogger();

const CURRENT_DISCLAIMER_VERSION =
  process.env.HEALTH_PROFILE_DISCLAIMER_VERSION || '1.0';

type HealthAccountStateRow = {
  account_id: string;
  disclaimer_acknowledged_at: string | null;
  disclaimer_acknowledged_by: string | null;
  disclaimer_version: string | null;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  first_item_created_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getHealthAccountState(
  accountId: string
): Promise<HealthAccountStateRow | null> {
  const userClient = getSupabaseServerActionClient();
  const { data, error } = await userClient.from('ultaura_health_account_state')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    logger.error({ error, accountId }, 'Failed to load health account state');
    return null;
  }

  return data;
}

export async function acknowledgeHealthDisclaimer(
  accountId: string,
  actorUserId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const now = new Date().toISOString();

  const { error } = await adminClient.from('ultaura_health_account_state')
    .upsert(
      {
        account_id: accountId,
        disclaimer_acknowledged_at: now,
        disclaimer_acknowledged_by: actorUserId,
        disclaimer_version: CURRENT_DISCLAIMER_VERSION,
        updated_at: now,
      },
      { onConflict: 'account_id' }
    );

  if (error) {
    logger.error({ error, accountId }, 'Failed to acknowledge health disclaimer');
    return { success: false, error: 'Failed to record disclaimer acknowledgement' };
  }

  return { success: true };
}

export async function recordHealthFirstView(
  accountId: string
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const now = new Date().toISOString();

  // Check if first_viewed_at is already set (write-once)
  const { data: existing } = await adminClient.from('ultaura_health_account_state')
    .select('first_viewed_at')
    .eq('account_id', accountId)
    .maybeSingle();

  const { error } = await adminClient.from('ultaura_health_account_state')
    .upsert({
      account_id: accountId,
      last_viewed_at: now,
      updated_at: now,
      ...(!existing?.first_viewed_at ? { first_viewed_at: now } : {}),
    }, { onConflict: 'account_id' });

  if (error) {
    logger.error({ error, accountId }, 'Failed to record health first view');
  }
}

export function isDisclaimerCurrent(
  accountState: Pick<HealthAccountStateRow, 'disclaimer_version' | 'disclaimer_acknowledged_at'> | null
): boolean {
  if (!accountState?.disclaimer_acknowledged_at) {
    return false;
  }
  return accountState.disclaimer_version === CURRENT_DISCLAIMER_VERSION;
}
