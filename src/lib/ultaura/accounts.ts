'use server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { GetOrCreateAccountInputSchema, OrganizationIdSchema } from '@ultaura/schemas';
import { BILLING, PLANS } from './constants';
import type { PlanId, UltauraAccountRow } from './types';
import { getUltauraAccountById, getTrialStatus } from './helpers';

const logger = getLogger();

export async function getOrCreateUltauraAccount(
  organizationId: number,
  userId: string,
  name: string,
  email: string
): Promise<{ accountId: string; isNew: boolean }> {
  const parsed = GetOrCreateAccountInputSchema.safeParse({
    organizationId,
    userId,
    name,
    email,
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
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create Ultaura account');
    throw new Error('Failed to create account');
  }

  return { accountId: account.id, isNew: true };
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
