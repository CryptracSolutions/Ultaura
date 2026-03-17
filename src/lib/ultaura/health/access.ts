import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import { isHealthFeatureEnabled, isHealthEligiblePlan } from './entitlements';

type HealthOwnerContext = {
  userClient: ReturnType<typeof getSupabaseServerActionClient>;
  adminClient: ReturnType<typeof getSupabaseServerActionClient>;
  actorUserId: string;
};

type HealthLineOwnerContext = HealthOwnerContext & {
  accountId: string;
  accountUserType: string;
};

export async function requireHealthOwner(
  accountId: string
): Promise<{ ok: true; context: HealthOwnerContext } | { ok: false; error: string }> {
  const userClient = getSupabaseServerActionClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const session = await requireSession(userClient);

  const actorUserId = session.user.id;
  if (!actorUserId) {
    return { ok: false, error: 'User not authenticated' };
  }

  const { data: account, error: accountError } = await userClient
    .from('ultaura_accounts')
    .select('id, created_by_user_id')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    return { ok: false, error: 'Account not found' };
  }

  if (account.created_by_user_id !== actorUserId) {
    return { ok: false, error: 'Access denied' };
  }

  return {
    ok: true,
    context: {
      userClient,
      adminClient,
      actorUserId,
    },
  };
}

export async function requireHealthLineAccess(
  lineId: string
): Promise<{ ok: true; context: HealthLineOwnerContext } | { ok: false; error: string }> {
  const userClient = getSupabaseServerActionClient();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const session = await requireSession(userClient);

  const actorUserId = session.user.id;
  if (!actorUserId) {
    return { ok: false, error: 'User not authenticated' };
  }

  const { data: line, error: lineError } = await userClient
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return { ok: false, error: 'Line not found' };
  }

  const { data: account, error: accountError } = await userClient
    .from('ultaura_accounts')
    .select('id, created_by_user_id, user_type, plan_id, status')
    .eq('id', line.account_id)
    .single();

  if (accountError || !account) {
    return { ok: false, error: 'Account not found' };
  }

  if (account.created_by_user_id !== actorUserId) {
    return { ok: false, error: 'Access denied' };
  }

  // Check feature flag
  const featureEnabled = await isHealthFeatureEnabled();
  if (!featureEnabled) {
    return { ok: false, error: 'health_feature_disabled' };
  }

  // Check plan eligibility
  if (!account.plan_id || !isHealthEligiblePlan(account.plan_id, account.status)) {
    return { ok: false, error: 'health_locked' };
  }

  return {
    ok: true,
    context: {
      userClient,
      adminClient,
      actorUserId,
      accountId: line.account_id,
      accountUserType: account.user_type,
    },
  };
}

export async function isHealthOwner(
  accountId: string,
  userId: string
): Promise<boolean> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: account, error } = await adminClient
    .from('ultaura_accounts')
    .select('created_by_user_id')
    .eq('id', accountId)
    .single();

  if (error || !account) {
    return false;
  }

  return account.created_by_user_id === userId;
}
