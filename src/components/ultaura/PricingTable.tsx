'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Users, Zap, Shield, Heart, Loader2 } from 'lucide-react';
import { PLANS, BILLING } from '~/lib/ultaura/constants';
import { createUltauraCheckout } from '~/lib/ultaura/actions';

type BillingPeriod = 'monthly' | 'annual';

const planFeatures: Record<string, string[]> = {
  care: [
    '300 minutes per month',
    '1 phone line',
    'Scheduled daily calls',
    'Medication reminders',
    'Activity suggestions',
    'Memory notes',
    'Email support',
  ],
  comfort: [
    '900 minutes per month',
    '2 phone lines',
    'Multiple call times daily',
    'All Care features',
    'Priority support',
    'Family dashboard access',
    'Call summaries',
  ],
  family: [
    '2,200 minutes per month',
    '4 phone lines',
    'Unlimited call scheduling',
    'All Comfort features',
    'Dedicated support',
    'Safety alerts',
    'Wellness insights',
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
        <div className="inline-flex items-center p-1 bg-muted rounded-lg">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'monthly'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingPeriod('annual')}
            className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
              billingPeriod === 'annual'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Annual
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
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
                  ? 'border-primary shadow-xl shadow-primary/20 ring-1 ring-primary lg:scale-105 z-10'
                  : isCurrent
                  ? 'border-2 border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:shadow-md cursor-pointer'
              }`}
            >
              {isPopular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                    Most Popular
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

      {/* Free Trial Banner */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">
            All plans include a 3-day free trial • No credit card required to start
          </span>
        </div>
      </div>

      {/* FAQ Preview */}
      <div className="mt-16 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Questions?
        </h2>
        <p className="text-muted-foreground mb-6">
          Our team is here to help you find the right plan for your family.
          Call us or email support@ultaura.com
        </p>
        <a
          href="/contact"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Contact Us
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
