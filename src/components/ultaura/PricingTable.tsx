'use client';

import { useState } from 'react';
import { Check, Phone, Clock, Users, Zap, Shield, Heart } from 'lucide-react';
import { PLANS, BILLING } from '~/lib/ultaura/constants';

type BillingPeriod = 'monthly' | 'annual';

const planFeatures: Record<string, string[]> = {
  free_trial: [
    '20 minutes of calls',
    '1 phone line',
    'Morning check-in calls',
    'Basic reminders',
    'Try before you buy',
  ],
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
    '600 minutes per month',
    '3 phone lines',
    'Multiple call times daily',
    'All Care features',
    'Priority support',
    'Family dashboard access',
    'Call summaries',
  ],
  family: [
    '1,200 minutes per month',
    '6 phone lines',
    'Unlimited call scheduling',
    'All Comfort features',
    'Dedicated support',
    'Safety alerts',
    'Wellness insights',
  ],
  payg: [
    'Pay only for what you use',
    '1 phone line',
    'No monthly commitment',
    'All core features',
    'Flexible scheduling',
    '$0.15 per minute',
  ],
};

const planIcons: Record<string, React.ReactNode> = {
  free_trial: <Phone className="w-6 h-6" />,
  care: <Heart className="w-6 h-6" />,
  comfort: <Clock className="w-6 h-6" />,
  family: <Users className="w-6 h-6" />,
  payg: <Zap className="w-6 h-6" />,
};

export function UltauraPricingTable() {
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const displayPlans = Object.entries(PLANS).filter(([id]) => id !== 'free_trial');

  return (
    <div className="w-full">
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
              Save {Math.round((1 - BILLING.ANNUAL_DISCOUNT) * 100)}%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {displayPlans.map(([planId, plan]) => {
          const isPopular = planId === 'comfort';
          const price = billingPeriod === 'annual' && plan.annual_price_cents
            ? plan.annual_price_cents / 100 / 12
            : plan.monthly_price_cents / 100;
          const features = planFeatures[planId] || [];

          return (
            <div
              key={planId}
              className={`relative flex flex-col rounded-2xl border bg-card p-6 ${
                isPopular
                  ? 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary'
                  : 'border-border'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${isPopular ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {planIcons[planId]}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
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
                {billingPeriod === 'annual' && plan.annual_price_cents && planId !== 'payg' && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Billed annually (${plan.annual_price_cents / 100}/year)
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`/auth/sign-up?plan=${planId}`}
                className={`w-full py-3 px-4 rounded-lg font-medium text-center transition-colors ${
                  isPopular
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-muted text-foreground hover:bg-muted/80'
                }`}
              >
                {planId === 'payg' ? 'Get Started' : 'Start Free Trial'}
              </a>
            </div>
          );
        })}
      </div>

      {/* Free Trial Banner */}
      <div className="mt-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
          <Shield className="w-4 h-4" />
          <span className="text-sm font-medium">
            All plans include a 20-minute free trial • No credit card required
          </span>
        </div>
      </div>

      {/* FAQ Preview */}
      <div className="mt-16 max-w-3xl mx-auto text-center">
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Questions about pricing?
        </h2>
        <p className="text-muted-foreground mb-6">
          Our team is here to help you find the right plan for your family.
          Call us or email support@ultaura.com
        </p>
        <a
          href="/contact"
          className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
        >
          Contact Sales
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </div>
  );
}
