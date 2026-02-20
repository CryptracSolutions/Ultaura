'use client';

import { Lock } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';

// Re-export types and constants from tier-utils for client components
export {
  SHARING_TIER_LABELS,
  TIER_REQUIREMENTS,
  type TierAccess,
  type SafetyEvent,
} from './tier-utils';

// Import TIER_REQUIREMENTS for local use
import { TIER_REQUIREMENTS } from './tier-utils';

export function TierGateNotice({
  title,
  requiredTier,
  lineName,
}: {
  title: string;
  requiredTier: keyof typeof TIER_REQUIREMENTS;
  lineName: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Lock className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Available at {TIER_REQUIREMENTS[requiredTier]} {lineName} controls sharing preferences.
      </p>
    </div>
  );
}

function formatSafetyAction(action?: string | null) {
  if (!action) return null;
  return action.replace(/_/g, ' ');
}

export function SafetyAlertsCard({
  events,
  timezone,
  highTierOnly,
}: {
  events: Array<{
    id: string;
    occurredAt: string;
    severity: 'low' | 'medium' | 'high';
    actionTaken: string | null;
    eventType: string | null;
  }>;
  timezone: string;
  highTierOnly: boolean;
}) {
  const formatDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">Safety Incidents</h3>
          <InfoTip content="Detected in real time during calls when distress keywords or safety concerns are identified. Not related to Wellness Alerts." />
        </div>
      </div>
      {events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {highTierOnly
            ? 'No high-tier safety incidents in the last 30 days.'
            : 'No safety incidents in the last 30 days.'}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {events.map((event) => {
            const dateLabel = formatDate(event.occurredAt);
            const actionLabel = formatSafetyAction(event.actionTaken);
            return (
              <div key={event.id} className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-foreground">{dateLabel}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {event.severity} incident
                  </span>
                </div>
                {event.eventType && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Type: {event.eventType.replace(/_/g, ' ')}
                  </p>
                )}
                {actionLabel && (
                  <p className="mt-1 text-xs text-muted-foreground">Action: {actionLabel}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
