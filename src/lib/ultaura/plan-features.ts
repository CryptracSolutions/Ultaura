export const SHARED_FEATURES = [
  'Daily scheduled calls',
  'Mood and wellness insights',
  'Safety alerts and monitoring',
  'Family dashboard with call summaries',
  'Activity and interest suggestions',
  'Notes and memories from each call',
  'Wellness and cognitive tracking',
] as const;

export const PLAN_LIMITS: Record<string, { minutes: string; lines: string; reminders: string; support: string }> = {
  care: {
    minutes: '200 minutes/month',
    lines: '1 phone line',
    reminders: 'Up to 5 reminders per line',
    support: 'Email support',
  },
  comfort: {
    minutes: '600 minutes/month',
    lines: '2 phone lines',
    reminders: 'Up to 10 reminders per line',
    support: 'Priority support',
  },
  family: {
    minutes: '1,200 minutes/month',
    lines: '4 phone lines',
    reminders: 'Unlimited reminders',
    support: 'Dedicated support contact',
  },
  payg: {
    minutes: '$0.15 per minute',
    lines: '4 phone lines',
    reminders: 'Unlimited reminders',
    support: 'Email support',
  },
};

// Backward-compatible export: limits first, then shared features
export const DASHBOARD_PLAN_FEATURES: Record<string, string[]> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([planId, limits]) => [
    planId,
    [limits.minutes, limits.lines, limits.reminders, limits.support, ...SHARED_FEATURES],
  ]),
);
