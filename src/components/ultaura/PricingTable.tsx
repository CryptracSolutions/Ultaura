'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Users, Zap, Heart, Loader2, Lock } from 'lucide-react';
import classNames from 'clsx';
import { PLANS, BILLING } from '~/lib/ultaura/constants';
import { SHARED_FEATURES, PLAN_LIMITS, HEALTH_ELIGIBLE_PLANS } from '~/lib/ultaura/plan-features';
import { createUltauraCheckout } from '~/lib/ultaura/checkout';

type BillingPeriod = 'monthly' | 'annual';

const planIcons: Record<string, React.ReactNode> = {
  care: <Heart className="w-6 h-6" />,
  comfort: <Clock className="w-6 h-6" />,
  family: <Users className="w-6 h-6" />,
  payg: <Zap className="w-6 h-6" />,
};

const PLAN_TAGLINES: Record<string, string> = {
  care: 'Great for your loved one',
  comfort: 'Perfect for most families',
  family: 'Built for families who need more',
  payg: 'Only pay for what you use',
};

const DAILY_COST: Record<string, { monthly: string; annual: string }> = {
  care: { monthly: '$0.63/day', annual: '$0.49/day' },
  comfort: { monthly: '$1.63/day', annual: '$1.29/day' },
  family: { monthly: '$3.30/day', annual: '$2.60/day' },
};

interface UltauraPricingTableProps {
  organizationUid?: string;
  currentPlanId?: string;
}

export function UltauraPricingTable({ organizationUid, currentPlanId }: UltauraPricingTableProps) {
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [isPending, startTransition] = useTransition();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayPlans = Object.entries(PLANS).filter(([id]) => id !== 'free_trial');

  const handleSelectPlan = async (planId: string) => {
    setError(null);

    if (!organizationUid) {
      router.push(`/auth/sign-up?plan=${planId}&billing=${billingPeriod}`);
      return;
    }

    setLoadingPlan(planId);
    startTransition(async () => {
      try {
        const returnUrl = `${window.location.origin}/dashboard`;
        const result = await createUltauraCheckout(
          planId,
          billingPeriod,
          organizationUid,
          returnUrl,
        );

        if (result.success && result.checkoutUrl) {
          window.location.href = result.checkoutUrl;
        } else {
          setError(result.error || 'Failed to start checkout');
          setLoadingPlan(null);
        }
      } catch {
        setError('An unexpected error occurred');
        setLoadingPlan(null);
      }
    });
  };

  return (
    <div className="w-full">
      {error && (
        <div className="mb-8 max-w-md mx-auto p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center rounded-xl border border-border bg-background/70 p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={classNames(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              billingPeriod === 'monthly'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={classNames(
              'px-6 py-2 rounded-md text-sm font-medium transition-colors',
              billingPeriod === 'annual'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            Annual
            <span
              className={classNames(
                'ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                billingPeriod === 'annual'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-success/10 text-success',
              )}
            >
              Save {Math.round(BILLING.ANNUAL_DISCOUNT * 100)}%
            </span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {displayPlans.map(([planId, plan]) => {
          const isPopular = planId === 'comfort';
          const isCurrent = planId === currentPlanId;
          const isLoading = loadingPlan === planId && isPending;
          const price = billingPeriod === 'annual' && plan.annualPriceCents
            ? plan.annualPriceCents / 100 / 12
            : plan.monthlyPriceCents / 100;
          const limits = PLAN_LIMITS[planId];
          const dailyCost = DAILY_COST[planId];

          return (
            <div
              key={planId}
              className={classNames(
                'relative flex min-w-0 w-full flex-col overflow-hidden rounded-xl border bg-card p-6 transition-all',
                isPopular && !isCurrent && 'border-primary shadow-2xl shadow-primary/30 ring-2 ring-primary z-10 bg-primary/5',
                isCurrent && 'border-2 border-primary bg-primary/5',
                !isPopular && !isCurrent && 'border-border hover:border-primary/50 hover:shadow-md cursor-pointer',
              )}
            >
              {isPopular && !isCurrent && (
                <div className="absolute top-3 right-3">
                  <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground shadow-lg text-sm">
                    ★
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                    Current Plan
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isPopular ? 'bg-primary/10 text-primary' : 'bg-muted text-primary'}`}>
                  {planIcons[planId]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-primary">{plan.displayName}</h3>
                  {PLAN_TAGLINES[planId] && (
                    <p className="text-xs text-muted-foreground italic">{PLAN_TAGLINES[planId]}</p>
                  )}
                </div>
              </div>

              <div className="mb-6">
                {planId === 'payg' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">$0.15</span>
                    <span className="text-muted-foreground">/minute</span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-foreground">
                        ${Math.round(price)}
                      </span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    {dailyCost && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {billingPeriod === 'annual' ? dailyCost.annual : dailyCost.monthly}
                      </p>
                    )}
                  </>
                )}
                {billingPeriod === 'annual' && plan.annualPriceCents > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed annually (${plan.annualPriceCents / 100}/year)
                  </p>
                )}
              </div>

              {limits && (
                <ul className="space-y-2 mb-4">
                  {Object.values(limits).map((limit, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm font-medium text-foreground">{limit}</span>
                    </li>
                  ))}
                  {HEALTH_ELIGIBLE_PLANS.has(planId) ? (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-foreground">Health Profile</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Track conditions, medications, observations, and medical documents — and let Ultaura care better
                        </p>
                      </div>
                    </li>
                  ) : planId === 'care' ? (
                    <li className="flex items-start gap-2 opacity-50">
                      <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div>
                        <span className="text-sm text-muted-foreground">Health Profile</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Track conditions, medications, observations, and medical documents — and let Ultaura care better
                        </p>
                      </div>
                    </li>
                  ) : null}
                </ul>
              )}

              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">All plans include:</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <ul className="space-y-2 mb-8 flex-1">
                {SHARED_FEATURES.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(planId)}
                disabled={isLoading || isCurrent}
                className={classNames(
                  'w-full py-3 px-4 rounded-lg font-medium text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2',
                  isCurrent && 'bg-muted text-muted-foreground',
                  !isCurrent && isPopular && 'bg-primary text-primary-foreground hover:bg-primary/90',
                  !isCurrent && !isPopular && 'bg-muted text-foreground hover:bg-muted/80',
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  'Current Plan'
                ) : (
                  organizationUid ? 'Choose plan' : 'Start 14-day free trial'
                )}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
