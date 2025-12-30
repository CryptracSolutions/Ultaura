'use client';

import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import type { PlanId } from '~/lib/ultaura/types';
import { PLANS, TRIAL_ELIGIBLE_PLANS } from '~/lib/ultaura/constants';

const PLAN_FEATURES: Record<PlanId, string[]> = {
  free_trial: [],
  care: [
    '300 minutes/month (after trial)',
    '1 phone line',
    'Scheduled daily calls',
    'Medication reminders',
    'Memory notes',
  ],
  comfort: [
    '900 minutes/month (after trial)',
    '2 phone lines',
    'Multiple call times daily',
    'All Care features',
    'Priority support',
  ],
  family: [
    '2,000 minutes/month (after trial)',
    '4 phone lines',
    'Unlimited call scheduling',
    'All Comfort features',
    'Safety alerts',
  ],
  payg: [
    '$0/month + $0.15 per minute (after trial)',
    '4 phone lines',
    'No monthly commitment',
    'All core features',
    'Flexible scheduling',
  ],
};

const DEFAULT_PLAN_ID: PlanId = 'comfort';

const PlanSelectionStep: React.FCC<{
  onSubmit: (planId: PlanId) => void;
}> = ({ onSubmit }) => {
  const { t } = useTranslation('onboarding');
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(DEFAULT_PLAN_ID);

  const plans = useMemo(() => {
    return TRIAL_ELIGIBLE_PLANS.map((planId) => ({
      planId,
      plan: PLANS[planId],
      features: PLAN_FEATURES[planId] ?? [],
    }));
  }, []);

  const handleContinue = useCallback(() => {
    onSubmit(selectedPlanId);
  }, [onSubmit, selectedPlanId]);

  return (
    <div className={'flex w-full flex-1 flex-col space-y-12'}>
      <div className={'flex flex-col space-y-2'}>
        <Heading type={1}>
          <Trans i18nKey={'onboarding:selectPlan'} />
        </Heading>

        <SubHeading>
          <span className={'text-base'}>
            <Trans i18nKey={'onboarding:selectPlanDescription'} />
          </span>
        </SubHeading>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map(({ planId, plan, features }) => {
          const isPopular = planId === 'comfort';
          const selected = selectedPlanId === planId;

          const priceLabel =
            planId === 'payg'
              ? '$0.15/min'
              : `$${Math.round(plan.monthlyPriceCents / 100)}/mo`;

          return (
            <button
              key={planId}
              type="button"
              onClick={() => setSelectedPlanId(planId)}
              className={`relative flex w-full flex-col rounded-xl border bg-card p-5 text-left transition-all ${
                selected
                  ? 'border-primary ring-2 ring-primary/20'
                  : 'border-border hover:border-primary/40 hover:shadow-sm'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-2 left-4">
                  <span className="inline-flex items-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-foreground">
                    {plan.displayName}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {plan.linesIncluded} line{plan.linesIncluded === 1 ? '' : 's'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xl font-semibold text-foreground">
                    {priceLabel}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('plan', { defaultValue: 'Plan' })}
                  </div>
                </div>
              </div>

              {features.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 text-xs text-muted-foreground">
                3-day free trial • No credit card required
              </div>
            </button>
          );
        })}
      </div>

      <Button type={'button'} onClick={handleContinue}>
        <Trans i18nKey={'common:continue'} />
      </Button>
    </div>
  );
};

export default PlanSelectionStep;

