'use client';

import { TrendingUp, AlertTriangle } from 'lucide-react';

interface UsageCardProps {
  minutesIncluded: number;
  minutesUsed: number;
  minutesRemaining: number;
  planName: string;
  cycleEnd: string | null;
}

export function UsageCard({
  minutesIncluded,
  minutesUsed,
  minutesRemaining,
  planName,
  cycleEnd,
}: UsageCardProps) {
  const usagePercent = minutesIncluded > 0 ? (minutesUsed / minutesIncluded) * 100 : 0;
  const isLow = minutesRemaining <= 15;
  const isCritical = minutesRemaining <= 5;

  // Format plan name
  const formattedPlanName = planName.charAt(0).toUpperCase() + planName.slice(1).replace('_', ' ');

  // Format cycle end date
  const formattedCycleEnd = cycleEnd
    ? new Date(cycleEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className={`bg-card rounded-xl border p-6 ${isLow ? 'border-warning/50' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isLow ? (
            <AlertTriangle className="w-5 h-5 text-warning" />
          ) : (
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          )}
          <h3 className="font-semibold text-foreground">
            {isLow ? 'Minutes Running Low' : 'Minutes This Month'}
          </h3>
        </div>
        <span className="text-sm text-muted-foreground">{formattedPlanName} Plan</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-foreground font-medium">{minutesUsed} used</span>
          <span className="text-muted-foreground">{minutesIncluded} included</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isCritical
                ? 'bg-destructive'
                : isLow
                ? 'bg-warning'
                : 'bg-primary'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
        <p className={`text-sm ${isLow ? (isCritical ? 'text-destructive' : 'text-warning') : 'text-muted-foreground'}`}>
          {minutesRemaining} minutes remaining
          {formattedCycleEnd && ` • Resets ${formattedCycleEnd}`}
        </p>
      </div>

      {/* Upgrade CTA for low minutes */}
      {isLow && (
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
