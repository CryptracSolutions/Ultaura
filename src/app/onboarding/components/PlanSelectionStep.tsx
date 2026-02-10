'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, Users, Zap, Heart } from 'lucide-react';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import type { PlanId, UserType } from '~/lib/ultaura/types';
import { PLANS, TRIAL_ELIGIBLE_PLANS } from '~/lib/ultaura/constants';

const planFeatures: Record<string, string[]> = {
  care: [
    '300 minutes per month',
    '1 phone line',
    'Scheduled daily calls',
    'Up to 3 reminders per line',
    'Activity suggestions',
    'Memory notes',
    'Email support',
  ],
  comfort: [
    '900 minutes per month',
    '2 phone lines',
    'Multiple call times daily',
    'Up to 10 reminders per line',
    'All Care features',
    'Priority support',
    'Family dashboard access',
    'Call summaries',
  ],
  family: [
    '2,200 minutes per month',
    '4 phone lines',
    'Unlimited call scheduling',
    'Unlimited reminders',
    'All Comfort features',
    'Dedicated support',
    'Safety alerts',
    'Wellness insights',
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

const planIcons: Record<string, React.ReactNode> = {
  care: <Heart className="w-6 h-6" />,
  comfort: <Clock className="w-6 h-6" />,
  family: <Users className="w-6 h-6" />,
  payg: <Zap className="w-6 h-6" />,
};

const PlanSelectionStep: React.FCC<{
  onSubmit: (planId: PlanId) => void;
  userType?: UserType;
  onGoBack?: () => void;
  isLastStep?: boolean;
}> = ({ onSubmit, userType, onGoBack, isLastStep }) => {
  const { t } = useTranslation('onboarding');
  const defaultPlanId: PlanId = userType === 'self' ? 'care' : 'comfort';
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(defaultPlanId);

  useEffect(() => {
    setSelectedPlanId(defaultPlanId);
  }, [defaultPlanId]);

  const plans = useMemo(() => {
    return TRIAL_ELIGIBLE_PLANS.map((planId) => ({
      planId,
      plan: PLANS[planId],
      features: planFeatures[planId] ?? [],
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map(({ planId, plan, features }) => {
          const isPopular = planId === 'comfort';
          const selected = selectedPlanId === planId;
          const price = plan.monthlyPriceCents / 100;

          return (
            <button
              key={planId}
              type="button"
              onClick={() => setSelectedPlanId(planId)}
              className={`relative flex w-full flex-col rounded-xl border bg-card p-5 text-left transition-all ${
                selected
                  ? 'border-primary ring-2 ring-primary shadow-xl shadow-primary/20'
                  : isPopular
                  ? 'border-primary/50 ring-1 ring-primary/30 shadow-md shadow-primary/10'
                  : 'border-border hover:border-primary/50 hover:shadow-md'
              }`}
            >
              {isPopular && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md text-xs">
                    ★
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isPopular ? 'bg-primary/10 text-primary' : 'bg-muted text-primary'}`}>
                  {planIcons[planId]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary">{plan.displayName}</h3>
                </div>
              </div>

              <div className="mb-6">
                {planId === 'payg' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">$0.15</span>
                    <span className="text-muted-foreground">/minute</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      ${Math.round(price)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 mb-6 flex-1">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="text-xs text-muted-foreground">
                3-day free trial • No credit card required
              </div>
            </button>
          );
        })}
      </div>

      <div className={'flex flex-col space-y-3'}>
        <Button type={'button'} onClick={handleContinue}>
          {isLastStep ? 'Start free trial' : <Trans i18nKey={'common:continue'} />}
        </Button>

        {onGoBack && (
          <Button type={'button'} variant={'ghost'} onClick={onGoBack}>
            <Trans i18nKey={'common:goBack'} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlanSelectionStep;
