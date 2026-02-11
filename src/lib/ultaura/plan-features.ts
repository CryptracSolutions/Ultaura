import { PLANS } from './constants';

type PlanFeatureId = 'care' | 'comfort' | 'family' | 'payg';
type IncludedPlanFeatureId = Exclude<PlanFeatureId, 'payg'>;

const formatMinutes = (planId: IncludedPlanFeatureId) =>
  `${PLANS[planId].minutesIncluded.toLocaleString('en-US')} minutes per month`;

const formatLines = (planId: IncludedPlanFeatureId, suffix: string) =>
  `${PLANS[planId].linesIncluded} phone line${PLANS[planId].linesIncluded === 1 ? '' : 's'}${suffix}`;

export const DASHBOARD_PLAN_FEATURES: Record<PlanFeatureId, string[]> = {
  care: [
    `${PLANS.care.minutesIncluded.toLocaleString('en-US')} minutes of conversation per month`,
    formatLines('care', ' for your loved one'),
    'Daily scheduled calls',
    'Up to 5 reminders per line',
    'Activity and interest suggestions',
    'Notes and memories from each call',
    'Email support',
  ],
  comfort: [
    formatMinutes('comfort'),
    formatLines('comfort', ' \u2014 for two loved ones'),
    'Multiple calls per day',
    'Up to 10 reminders per line',
    'Everything in Care, plus:',
    'Priority support',
    'Family dashboard with call summaries',
    'Mood and wellness insights',
  ],
  family: [
    formatMinutes('family'),
    formatLines('family', ' \u2014 for the whole family'),
    'Unlimited call scheduling',
    'Unlimited reminders',
    'Everything in Comfort, plus:',
    'Dedicated support contact',
    'Safety alerts when something seems off',
    'Detailed wellness tracking',
  ],
  payg: [
    'Pay only for what you use',
    '4 phone lines',
    'No monthly commitment',
    'Unlimited reminders',
    'All core features',
    'Flexible scheduling',
    '$0.15 per minute',
  ],
};
