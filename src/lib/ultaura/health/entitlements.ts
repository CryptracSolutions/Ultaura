import 'server-only';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { UltauraAccountRow } from '../types';

const HEALTH_ELIGIBLE_PLAN_IDS = new Set(['comfort', 'family', 'payg']);

export function isHealthEligiblePlan(planId: string, status: string): boolean {
  if (status === 'trial') {
    return false;
  }
  return HEALTH_ELIGIBLE_PLAN_IDS.has(planId);
}

export async function isHealthFeatureEnabled(): Promise<boolean> {
  try {
    const adminClient = getSupabaseServerActionClient({ admin: true });
    const { data, error } = await adminClient.from('ultaura_runtime_feature_flags')
      .select('enabled')
      .eq('flag_key', 'health_profile')
      .maybeSingle();

    if (!error && data !== null) {
      return data.enabled;
    }
  } catch {
    // Fall through to env var fallback
  }

  return process.env.HEALTH_PROFILE_ENABLED === 'true';
}

type HealthEntitlementState = {
  isEnabled: boolean;
  isEligible: boolean;
  isLocked: boolean;
  lockReason: 'feature_disabled' | 'plan_ineligible' | 'on_trial' | null;
};

export async function getHealthEntitlementState(
  account: Pick<UltauraAccountRow, 'plan_id' | 'status'>
): Promise<HealthEntitlementState> {
  const featureEnabled = await isHealthFeatureEnabled();

  if (!featureEnabled) {
    return {
      isEnabled: false,
      isEligible: false,
      isLocked: true,
      lockReason: 'feature_disabled',
    };
  }

  const onTrial = account.status === 'trial';
  if (onTrial) {
    return {
      isEnabled: true,
      isEligible: false,
      isLocked: true,
      lockReason: 'on_trial',
    };
  }

  const eligible = isHealthEligiblePlan(account.plan_id ?? '', account.status);
  if (!eligible) {
    return {
      isEnabled: true,
      isEligible: false,
      isLocked: true,
      lockReason: 'plan_ineligible',
    };
  }

  return {
    isEnabled: true,
    isEligible: true,
    isLocked: false,
    lockReason: null,
  };
}
