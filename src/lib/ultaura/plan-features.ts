type PlanLimitDetails = {
  minutes: string;
  lines: string;
  reminders: string;
  support: string;
};

export const SHARED_FEATURES = [
  'Schedule calls + SMS reminders',
  'Mood and wellness insights',
  'Safety alerts and monitoring',
  'Family dashboard with call summaries',
  'Activity and interest suggestions',
  'Engagement and memories from each call',
  'Wellness and cognitive tracking',
] as const;

export const PLAN_LIMITS: Record<string, PlanLimitDetails> = {
  care: {
    minutes: '200 minutes/month',
    lines: 'Up to 1 phone line',
    reminders: 'Up to 5 reminders per line',
    support: '24/7 Priority support',
  },
  comfort: {
    minutes: '600 minutes/month',
    lines: 'Up to 2 phone lines',
    reminders: 'Up to 10 reminders per line',
    support: '24/7 Priority support',
  },
  family: {
    minutes: '1,200 minutes/month',
    lines: 'Up to 4 phone lines',
    reminders: 'Unlimited reminders',
    support: '24/7 Priority support',
  },
  payg: {
    minutes: '$0.15 per minute',
    lines: 'Unlimited phone lines',
    reminders: 'Unlimited reminders',
    support: '24/7 Priority support',
  },
};

// Plans that include Health Profile
const HEALTH_ELIGIBLE_PLANS = new Set(['comfort', 'family', 'payg']);

// Backward-compatible export: limits first, then shared features, then Health for eligible plans
export const DASHBOARD_PLAN_FEATURES: Record<string, string[]> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([planId, limits]) => [
    planId,
    [
      limits.minutes, limits.lines, limits.reminders, limits.support,
      ...SHARED_FEATURES,
      ...(HEALTH_ELIGIBLE_PLANS.has(planId) ? ['Health Profile'] : []),
    ],
  ]),
);

// ============================================
// HEALTH PROFILE PLAN MESSAGING
// ============================================

export type HealthPlanAvailability = 'available' | 'upgrade_required' | 'unavailable_on_trial';

export const HEALTH_PLAN_AVAILABILITY: Record<string, HealthPlanAvailability> = {
  free_trial: 'unavailable_on_trial',
  care: 'upgrade_required',
  comfort: 'available',
  family: 'available',
  payg: 'available',
};

export const HEALTH_PLAN_LOCKED_MESSAGE =
  'Health Profile is available on Comfort, Family, and Usage Based plans.';

export const HEALTH_PLAN_TRIAL_MESSAGE =
  'Health Profile is not available during your free trial. Upgrade to a paid plan to unlock it.';

export const HEALTH_PLAN_UPGRADE_MESSAGE =
  'Upgrade to Comfort, Family, or Usage Based to unlock Health Profile.';

export function getHealthPlanMessage(planId: string, status: string): string {
  if (status === 'trial') {
    return HEALTH_PLAN_TRIAL_MESSAGE;
  }
  const availability = HEALTH_PLAN_AVAILABILITY[planId];
  if (availability === 'upgrade_required') {
    return HEALTH_PLAN_UPGRADE_MESSAGE;
  }
  return HEALTH_PLAN_LOCKED_MESSAGE;
}
