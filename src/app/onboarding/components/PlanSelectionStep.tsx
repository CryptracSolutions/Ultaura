'use client';

import React, { useEffect, useState } from 'react';
import { Check, Clock, Users, Zap, Heart } from 'lucide-react';

import Heading from '~/core/ui/Heading';
import SubHeading from '~/core/ui/SubHeading';
import Button from '~/core/ui/Button';
import Trans from '~/core/ui/Trans';
import Alert from '~/core/ui/Alert';
import type { PlanId, UserType } from '~/lib/ultaura/types';
import { PLANS, TRIAL_ELIGIBLE_PLANS } from '~/lib/ultaura/constants';
import { SHARED_FEATURES, PLAN_LIMITS } from '~/lib/ultaura/plan-features';

const HEALTH_ELIGIBLE_PLANS = new Set(['comfort', 'family', 'payg']);

const planIcons: Record<string, React.ReactNode> = {
  care: <Heart className="w-6 h-6" />,
  comfort: <Clock className="w-6 h-6" />,
  family: <Users className="w-6 h-6" />,
  payg: <Zap className="w-6 h-6" />,
};

const trialPlans = TRIAL_ELIGIBLE_PLANS.map((planId) => ({
  planId,
  plan: PLANS[planId],
  limits: PLAN_LIMITS[planId],
}));

const PlanSelectionStep: React.FCC<{
  onSubmit: (planId: PlanId) => Promise<void> | void;
  userType?: UserType;
  onGoBack?: () => void;
  isLastStep?: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
}> = ({
  onSubmit,
  userType,
  onGoBack,
  isLastStep,
  isSubmitting = false,
  errorMessage,
}) => {
  const defaultPlanId: PlanId = userType === 'self' ? 'care' : 'comfort';
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(defaultPlanId);

  useEffect(() => {
    setSelectedPlanId(defaultPlanId);
  }, [defaultPlanId]);

  async function handleContinue() {
    await onSubmit(selectedPlanId);
  }

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
        {trialPlans.map(({ planId, plan, limits }) => {
          const isPopular = planId === 'comfort';
          const selected = selectedPlanId === planId;
          const price = plan.monthlyPriceCents / 100;

          return (
            <button
              key={planId}
              type="button"
              disabled={isSubmitting}
              onClick={() => setSelectedPlanId(planId)}
              className={`relative flex w-full flex-col rounded-xl border bg-card p-5 text-left transition-all ${
                selected
                  ? 'border-primary ring-2 ring-primary shadow-xl shadow-primary/20'
                  : isPopular
                    ? 'border-primary/50 ring-1 ring-primary/30 shadow-md shadow-primary/10'
                    : 'border-border hover:border-primary/50 hover:shadow-md'
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              {isPopular && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground shadow-md text-xs">
                    ★
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`p-2 rounded-lg ${isPopular ? 'bg-primary/10 text-primary' : 'bg-muted text-primary'}`}
                >
                  {planIcons[planId]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary">
                    {plan.displayName}
                  </h3>
                </div>
              </div>

              <div className="mb-6">
                {planId === 'payg' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-foreground">
                      $0.15
                    </span>
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

              {limits && (
                <ul className="space-y-2 mb-4">
                  {Object.values(limits).map((limit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-foreground">
                        {limit}
                      </span>
                    </li>
                  ))}
                  {HEALTH_ELIGIBLE_PLANS.has(planId) && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-foreground">Health Profile</span>
                    </li>
                  )}
                </ul>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  All plans include:
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <ul className="space-y-2 mb-4 flex-1">
                {SHARED_FEATURES.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="text-xs text-muted-foreground">
                14-day trial starts after checkout
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        By creating an account and using Ultaura&apos;s services, you agree to
        our{' '}
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          Terms of Service
        </a>{' '}
        and{' '}
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline hover:text-primary/80"
        >
          Privacy Policy
        </a>
        .
      </p>

      <div className={'flex flex-col space-y-3'}>
        {errorMessage && (
          <Alert type={'error'}>
            <Alert.Heading>Checkout failed</Alert.Heading>
            {errorMessage}
          </Alert>
        )}

        <Button
          type={'button'}
          onClick={handleContinue}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            'Redirecting to checkout...'
          ) : isLastStep ? (
            'Continue to checkout'
          ) : (
            <Trans i18nKey={'common:continue'} />
          )}
        </Button>

        {onGoBack && (
          <Button
            type={'button'}
            variant={'ghost'}
            onClick={onGoBack}
            disabled={isSubmitting}
          >
            <Trans i18nKey={'common:goBack'} />
          </Button>
        )}
      </div>
    </div>
  );
};

export default PlanSelectionStep;
