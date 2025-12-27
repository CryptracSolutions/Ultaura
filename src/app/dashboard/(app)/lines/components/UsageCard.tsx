'use client';

import { TrendingUp, AlertTriangle, Zap } from 'lucide-react';
import { BILLING } from '~/lib/ultaura/constants';

interface UsageCardProps {
  minutesIncluded: number;
  minutesUsed: number;
  minutesRemaining: number;
  planName: string;
  planId: string;
  cycleEnd: string | null;
}

export function UsageCard({
  minutesIncluded,
  minutesUsed,
  minutesRemaining,
  planName,
  planId,
  cycleEnd,
}: UsageCardProps) {
  const isPayg = planId === 'payg';
  const overageMinutes = !isPayg ? Math.max(minutesUsed - minutesIncluded, 0) : 0;
  const usagePercent = minutesIncluded > 0 ? (Math.min(minutesUsed, minutesIncluded) / minutesIncluded) * 100 : 0;
  const overagePercent = minutesIncluded > 0 ? Math.min((overageMinutes / minutesIncluded) * 100, 100) : 0;
  const isLow = !isPayg && minutesRemaining <= 15;
  const isCritical = !isPayg && minutesRemaining <= 5;
  const hasOverage = overageMinutes > 0;
  const overageCostCents = overageMinutes * BILLING.OVERAGE_RATE_CENTS;

  // Format plan name
  const formattedPlanName = planName.charAt(0).toUpperCase() + planName.slice(1).replace('_', ' ');

  // Format cycle end date
  const formattedCycleEnd = cycleEnd
    ? new Date(cycleEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  const statusText = isPayg
    ? `Usage-based billing at $${(BILLING.OVERAGE_RATE_CENTS / 100).toFixed(2)} per minute`
    : hasOverage
    ? `${overageMinutes} minutes over • $${(overageCostCents / 100).toFixed(2)} overage`
    : `${minutesRemaining} minutes remaining`;

  return (
    <div className={`bg-card rounded-xl border p-6 ${isLow || hasOverage ? 'border-warning/50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isPayg ? (
            <Zap className="w-5 h-5 text-primary" />
          ) : isLow || hasOverage ? (
            <AlertTriangle className="w-5 h-5 text-warning" />
          ) : (
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-foreground">
            {isPayg ? 'Pay as you go usage' : isLow ? 'Minutes Running Low' : 'Minutes This Month'}
          </h3>
        </div>
        <span className="text-sm text-muted-foreground">{formattedPlanName} Plan</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          {isPayg ? (
            <>
              <span className="text-foreground font-medium">{minutesUsed} minutes used</span>
              <span className="text-muted-foreground">
                ${((minutesUsed * BILLING.OVERAGE_RATE_CENTS) / 100).toFixed(2)} est.
              </span>
            </>
          ) : (
            <>
              <span className="text-foreground font-medium">{minutesUsed} used</span>
              <span className="text-muted-foreground">{minutesIncluded} included</span>
            </>
          )}
        </div>
        {isPayg ? (
          <div className="h-2 bg-muted rounded-full" />
        ) : (
          <div className="relative h-2 bg-muted rounded-full overflow-visible">
            <div className="absolute inset-0 flex overflow-visible">
              <div
                className={`h-full ${hasOverage ? 'rounded-l-full' : 'rounded-full'} transition-all ${
                  isCritical
                    ? 'bg-destructive'
                    : isLow || hasOverage
                    ? 'bg-warning'
                    : 'bg-primary'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
              {hasOverage && (
                <div
                  className="h-full rounded-r-full bg-warning transition-all"
                  style={{ width: `${overagePercent}%` }}
                />
              )}
            </div>
          </div>
        )}
        <p
          className={`text-sm ${
            isPayg
              ? 'text-muted-foreground'
              : hasOverage
              ? 'text-warning'
              : isLow
              ? isCritical
                ? 'text-destructive'
                : 'text-warning'
              : 'text-muted-foreground'
          }`}
        >
          {statusText}
          {formattedCycleEnd && ` • Resets ${formattedCycleEnd}`}
        </p>
      </div>

      {/* Upgrade CTA for low minutes */}
      {isLow && !isPayg && (
        <div className="mt-4">
          <a
            href="#upgrade"
            className="inline-flex items-center justify-center w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Upgrade Plan
          </a>
        </div>
      )}
    </div>
  );
}
