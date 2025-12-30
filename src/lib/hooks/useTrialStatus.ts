'use client';

import { useMemo } from 'react';
import type { PlanId, UltauraAccountRow } from '~/lib/ultaura/types';

export function useTrialStatus(
  account: Pick<
    UltauraAccountRow,
    'status' | 'plan_id' | 'trial_plan_id' | 'trial_ends_at' | 'cycle_end'
  > | null,
) {
  return useMemo(() => {
    const isOnTrial = account?.status === 'trial';
    const trialEndsAt =
      isOnTrial ? (account?.trial_ends_at ?? account?.cycle_end ?? null) : null;
    const trialPlanId = isOnTrial
      ? ((account?.trial_plan_id ?? account?.plan_id) as PlanId)
      : null;

    if (!isOnTrial || !trialEndsAt) {
      return {
        isOnTrial,
        isExpired: false,
        daysRemaining: 0,
        trialPlanId,
        trialEndsAt,
      };
    }

    const msRemaining = new Date(trialEndsAt).getTime() - Date.now();
    const isExpired = msRemaining <= 0;
    const daysRemaining = Math.max(
      0,
      Math.ceil(msRemaining / (24 * 60 * 60 * 1000)),
    );

    return {
      isOnTrial,
      isExpired,
      daysRemaining,
      trialPlanId,
      trialEndsAt,
    };
  }, [
    account?.cycle_end,
    account?.plan_id,
    account?.status,
    account?.trial_ends_at,
    account?.trial_plan_id,
  ]);
}

