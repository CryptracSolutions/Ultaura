import type { ActionResult } from '@ultaura/schemas';
import { createError, ErrorCodes } from '@ultaura/schemas';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import type { UltauraAccountRow } from './types';

export async function getUltauraAccountById(accountId: string): Promise<UltauraAccountRow | null> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_accounts')
    .select('*')
    .eq('id', accountId)
    .single();

  if (error) return null;
  return data;
}

export function getTrialStatus(account: UltauraAccountRow): {
  isOnTrial: boolean;
  isExpired: boolean;
  trialPlanId: string | null;
  trialEndsAt: string | null;
  daysRemaining: number;
} {
  const isOnTrial = account.status === 'trial';
  const trialEndsAt = isOnTrial
    ? (account.trial_ends_at ?? account.cycle_end ?? null)
    : null;

  const trialPlanId = isOnTrial
    ? (account.trial_plan_id ?? account.plan_id)
    : null;

  if (!isOnTrial || !trialEndsAt) {
    return { isOnTrial, isExpired: false, trialPlanId, trialEndsAt, daysRemaining: 0 };
  }

  const msRemaining = new Date(trialEndsAt).getTime() - Date.now();
  const isExpired = msRemaining <= 0;
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  return { isOnTrial, isExpired, trialPlanId, trialEndsAt, daysRemaining };
}

export async function getPlan(planId: string) {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error) return null;
  return data;
}

type ActionFn<TInput, TOutput> = (
  account: UltauraAccountRow,
  input: TInput
) => Promise<ActionResult<TOutput>>;

export function withTrialCheck<TInput, TOutput>(
  fn: ActionFn<TInput, TOutput>
): (account: UltauraAccountRow, input: TInput) => Promise<ActionResult<TOutput>> {
  return async (account, input) => {
    const trialStatus = getTrialStatus(account);
    if (trialStatus.isExpired) {
      return {
        success: false,
        error: createError(
          ErrorCodes.TRIAL_EXPIRED,
          'Your trial has ended. Subscribe to continue.'
        ),
      };
    }
    return fn(account, input);
  };
}
