'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Users, Zap, Heart, Loader2 } from 'lucide-react';
import { PLANS, BILLING } from '~/lib/ultaura/constants';
import { createUltauraCheckout } from '~/lib/ultaura/checkout';

type BillingPeriod = 'monthly' | 'annual';

const planFeatures: Record<string, string[]> = {
  care: [
    '300 minutes of conversation per month',
    '1 phone line for your loved one',
    'Daily scheduled calls',
    'Medication and routine reminders',
    'Activity and interest suggestions',
    'Notes and memories from each call',
    'Email support',
  ],
  comfort: [
    '900 minutes per month',
    '2 phone lines \u2014 for two loved ones',
    'Multiple calls per day',
    'Everything in Care, plus:',
    'Priority support',
    'Family dashboard with call summaries',
    'Mood and wellness insights',
  ],
  family: [
    '2,200 minutes per month',
    '4 phone lines \u2014 for the whole family',
    'Unlimited call scheduling',
    'Everything in Comfort, plus:',
    'Dedicated support contact',
    'Safety alerts when something seems off',
    'Detailed wellness tracking',
  ],
  payg: [
    'Pay only for what you use',
    '4 phone lines',
    'No monthly commitment',
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

interface UltauraPricingTableProps {
  // If provided, enables checkout flow instead of sign-up redirect
  organizationUid?: string;
  // Current plan ID (to show "Current Plan" badge)
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

    // If no organization (public page), redirect to sign-up
    if (!organizationUid) {
      router.push(`/auth/sign-up?plan=${planId}&billing=${billingPeriod}`);
      return;
    }

    // Authenticated flow - create checkout session
    setLoadingPlan(planId);
    startTransition(async () => {
      try {
        const returnUrl = typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard`
          : '/dashboard';

        const result = await createUltauraCheckout(
          planId,
          billingPeriod,
          organizationUid,
          returnUrl
        );

        if (result.success && result.checkoutUrl) {
          // Redirect to Stripe Checkout
          window.location.href = result.checkoutUrl;
        } else {
          setError(result.error || 'Failed to start checkout');
          setLoadingPlan(null);
        }
      } catch (err) {
        setError('An unexpected error occurred');
        setLoadingPlan(null);
      }
    });
  };

  return (
    <div className="w-full">
      {/* Error Display */}
      {error && (
        <div className="mb-8 max-w-md mx-auto p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      {/* Billing Toggle */}
      <div className="flex justify-center mb-12">
        <div className="inline-flex items-center rounded-xl border border-border bg-background/70 p-1">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            Annual
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                billingPeriod === 'annual'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-success/10 text-success'
              }`}
            >
              Save {Math.round(BILLING.ANNUAL_DISCOUNT * 100)}%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {displayPlans.map(([planId, plan]) => {
          const isPopular = planId === 'comfort';
          const isCurrent = planId === currentPlanId;
          const isLoading = loadingPlan === planId && isPending;
          const price = billingPeriod === 'annual' && plan.annualPriceCents
            ? plan.annualPriceCents / 100 / 12
            : plan.monthlyPriceCents / 100;
          const features = planFeatures[planId] || [];

          return (
            <div
              key={planId}
              className={`relative flex flex-col rounded-xl border bg-card p-6 transition-all ${
                isPopular && !isCurrent
                  ? 'border-primary shadow-2xl shadow-primary/30 ring-2 ring-primary lg:scale-110 z-10 bg-primary/5'
                  : isCurrent
                  ? 'border-2 border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:shadow-md cursor-pointer'
              }`}
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
                </div>
              </div>

              <div className="mb-6">
                {planId === 'payg' ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">$0.15</span>
                    <span className="text-muted-foreground">/minute</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${Math.round(price)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                )}
                {billingPeriod === 'annual' && plan.annualPriceCents > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed annually (${plan.annualPriceCents / 100}/year)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span className="text-sm text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(planId)}
                disabled={isLoading || isCurrent}
                className={`w-full py-3 px-4 rounded-lg font-medium text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 ${
                  isCurrent
                    ? 'bg-muted text-muted-foreground'
                    : isPopular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : isCurrent ? (
                  'Current Plan'
                ) : (
                  organizationUid ? 'Choose plan' : 'Start 3-day free trial'
                )}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
