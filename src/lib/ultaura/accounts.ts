'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';
import requireSession from '~/lib/user/require-session';
import {
  GetOrCreateAccountInputSchema,
  OrganizationIdSchema,
  createError,
  ErrorCodes,
  type ActionResult,
} from '@ultaura/schemas';
import { BILLING, PLANS } from './constants';
import type { PlanId, UltauraAccountRow } from './types';
import { getUltauraAccountById, getTrialStatus } from './helpers';
import { logRequiredConsentAudit } from './privacy';

const logger = getLogger();

async function logRequiredAccountSharingAudit(input: {
  accountId: string;
  actorUserId: string;
  oldValue: Record<string, unknown>;
  newValue: Record<string, unknown>;
}): Promise<boolean> {
  const headersList = await headers();
  const adminClient = getSupabaseServerActionClient({ admin: true });

  return logRequiredConsentAudit({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    actorType: 'payer',
    action: 'sharing_consent_updated',
    consentType: 'data_sharing',
    oldValue: input.oldValue,
    newValue: input.newValue,
    ipAddress: headersList.get('x-forwarded-for')?.split(',')[0] || null,
    userAgent: headersList.get('user-agent') || null,
  }, adminClient);
}

export async function getOrCreateUltauraAccount(
  organizationId: number,
  userId: string,
  name: string,
  email: string,
  options?: {
    userType?: 'self' | 'family_managed';
  }
): Promise<{ accountId: string; isNew: boolean }> {
  const parsed = GetOrCreateAccountInputSchema.safeParse({
    organizationId,
    userId,
    name,
    email,
    userType: options?.userType,
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message || 'Invalid input');
  }

  const client = getSupabaseServerComponentClient();

  const { data: existing } = await client
    .from('ultaura_accounts')
    .select('id')
    .eq('organization_id', organizationId)
    .single();

  if (existing) {
    return { accountId: existing.id, isNew: false };
  }

  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + BILLING.TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);
  const defaultTrialPlanId: PlanId = 'comfort';
  const plan = PLANS[defaultTrialPlanId];

  const userType = options?.userType ?? 'family_managed';
  const sharingEnabled = userType === 'family_managed';

  const { data: account, error } = await client
    .from('ultaura_accounts')
    .insert({
      organization_id: organizationId,
      name,
      billing_email: email,
      created_by_user_id: userId,
      status: 'trial',
      plan_id: defaultTrialPlanId,
      trial_plan_id: defaultTrialPlanId,
      trial_starts_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      minutes_included: plan.minutesIncluded,
      minutes_used: 0,
      cycle_start: now.toISOString(),
      cycle_end: trialEndsAt.toISOString(),
      user_type: userType,
      sharing_enabled: sharingEnabled,
      sharing_enabled_at: null,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create Ultaura account');
    throw new Error('Failed to create account');
  }

  return { accountId: account.id, isNew: true };
}

export async function updateAccountSharing(
  accountId: string,
  sharingEnabled: boolean
): Promise<ActionResult<void>> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client);

  const { data: account, error: accountError } = await client
    .from('ultaura_accounts')
    .select('id, created_by_user_id, user_type, sharing_enabled, sharing_enabled_at')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    return { success: false, error: createError(ErrorCodes.NOT_FOUND, 'Account not found') };
  }

  if (account.created_by_user_id !== session.user.id) {
    return { success: false, error: createError(ErrorCodes.FORBIDDEN, 'Access denied') };
  }

  if (account.user_type !== 'family_managed') {
    return {
      success: false,
      error: createError(ErrorCodes.FORBIDDEN, 'Sharing toggle is only available for family-managed accounts'),
    };
  }

  if (account.sharing_enabled === sharingEnabled) {
    return { success: true, data: undefined };
  }

  const updateTimestamp = new Date().toISOString();
  const updates: Record<string, unknown> = {
    sharing_enabled: sharingEnabled,
  };

  if (sharingEnabled && !account.sharing_enabled_at) {
    updates.sharing_enabled_at = updateTimestamp;
  }

  const casResult = await (account.sharing_enabled_at === null
    ? client
      .from('ultaura_accounts')
      .update(updates)
      .eq('id', accountId)
      .eq('created_by_user_id', session.user.id)
      .eq('user_type', 'family_managed')
      .eq('sharing_enabled', account.sharing_enabled)
      .is('sharing_enabled_at', null)
      .select('id, sharing_enabled')
    : client
      .from('ultaura_accounts')
      .update(updates)
      .eq('id', accountId)
      .eq('created_by_user_id', session.user.id)
      .eq('user_type', 'family_managed')
      .eq('sharing_enabled', account.sharing_enabled)
      .eq('sharing_enabled_at', account.sharing_enabled_at)
      .select('id, sharing_enabled'));

  if (casResult.error || !casResult.data || casResult.data.length === 0) {
    logger.error({ error: casResult.error, accountId }, 'Failed to update account sharing');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Sharing settings changed. Refresh and try again.'),
    };
  }

  const logged = await logRequiredAccountSharingAudit({
    accountId,
    actorUserId: session.user.id,
    oldValue: {
      sharing_enabled: account.sharing_enabled,
      sharing_enabled_at: account.sharing_enabled_at,
    },
    newValue: {
      sharing_enabled: sharingEnabled,
      sharing_enabled_at: updates.sharing_enabled_at ?? account.sharing_enabled_at,
    },
  });
  if (!logged) {
    logger.error({ accountId }, 'Required sharing audit log failed; rolling back update');
    await client
      .from('ultaura_accounts')
      .update({
        sharing_enabled: account.sharing_enabled,
        sharing_enabled_at: account.sharing_enabled_at,
      })
      .eq('id', accountId)
      .eq('created_by_user_id', session.user.id)
      .eq('sharing_enabled', sharingEnabled);
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to record sharing audit event'),
    };
  }

  revalidatePath('/dashboard/privacy', 'page');
  revalidatePath('/dashboard', 'layout');

  return { success: true, data: undefined };
}

export async function upgradeSelfToFamilyMode(
  accountId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client);

  const { data: account, error: accountError } = await client
    .from('ultaura_accounts')
    .select('id, created_by_user_id, user_type, sharing_enabled_at')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    return { success: false, error: createError(ErrorCodes.NOT_FOUND, 'Account not found') };
  }

  if (account.created_by_user_id !== session.user.id) {
    return { success: false, error: createError(ErrorCodes.FORBIDDEN, 'Access denied') };
  }

  if (account.user_type !== 'self') {
    return { success: true, data: undefined };
  }

  const updates: Record<string, unknown> = {
    user_type: 'family_managed',
    sharing_enabled: true,
  };

  if (!account.sharing_enabled_at) {
    updates.sharing_enabled_at = new Date().toISOString();
  }

  const { error } = await client
    .from('ultaura_accounts')
    .update(updates)
    .eq('id', accountId)
    .eq('created_by_user_id', session.user.id)
    .eq('user_type', 'self');

  if (error) {
    logger.error({ error, accountId }, 'Failed to upgrade self user to family mode');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to upgrade account'),
    };
  }

  const logged = await logRequiredAccountSharingAudit({
    accountId,
    actorUserId: session.user.id,
    oldValue: {
      user_type: account.user_type,
      sharing_enabled: false,
      sharing_enabled_at: account.sharing_enabled_at,
    },
    newValue: {
      user_type: 'family_managed',
      sharing_enabled: true,
      sharing_enabled_at: updates.sharing_enabled_at ?? account.sharing_enabled_at,
    },
  });
  if (!logged) {
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to record sharing audit event'),
    };
  }

  revalidatePath('/dashboard', 'layout');
  return { success: true, data: undefined };
}

export async function getUltauraAccount(organizationId: number): Promise<UltauraAccountRow | null> {
  const parsed = OrganizationIdSchema.safeParse(organizationId);
  if (!parsed.success) {
    return null;
  }

  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_accounts')
    .select('*')
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.error({ error }, 'Failed to get Ultaura account');
    }
    return null;
  }

  return data;
}

export async function isTrialExpired(accountId: string): Promise<boolean> {
  const account = await getUltauraAccountById(accountId);
  if (!account) return false;

  return getTrialStatus(account).isExpired;
}

export async function getTrialInfo(accountId: string): Promise<{
  isOnTrial: boolean;
  isExpired: boolean;
  trialPlanId: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
} | null> {
  const account = await getUltauraAccountById(accountId);
  if (!account) return null;

  const status = getTrialStatus(account);

  return {
    isOnTrial: status.isOnTrial,
    isExpired: status.isExpired,
    trialPlanId: status.trialPlanId,
    trialEndsAt: status.trialEndsAt,
    daysRemaining: status.daysRemaining,
  };
}
