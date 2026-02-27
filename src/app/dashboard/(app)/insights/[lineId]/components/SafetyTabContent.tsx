'use client';

import type { InsightsDashboard } from '~/lib/ultaura/types';
import { ConcernsList } from '../../components/ConcernsList';
import {
  SHARING_TIER_LABELS,
  SafetyAlertsCard,
  TierGateNotice,
  type SafetyEvent,
  type TierAccess,
} from './shared';

interface SafetyTabContentProps {
  dashboard: InsightsDashboard | null;
  safetyEvents: SafetyEvent[];
  timezone: string;
  tierAccess: TierAccess;
}

export function SafetyTabContent({
  dashboard,
  safetyEvents,
  timezone,
  tierAccess,
}: SafetyTabContentProps) {
  const { isFamilyManaged, allowConcerns, effectiveTier, lineName } = tierAccess;
  const sharedTierLabel =
    (effectiveTier && SHARING_TIER_LABELS[effectiveTier]) || 'Shared tier (redacted)';
  const concernsPrivacyLabel = isFamilyManaged
    ? `Privacy: ${sharedTierLabel}`
    : 'Privacy: Self view';
  const safetyPrivacyLabel = isFamilyManaged
    ? 'Privacy: Shared view'
    : 'Privacy: Self view';

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Safety incidents and conversation concerns from recent calls.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Concerns List - tier 4 only */}
        {dashboard && (
          <div className="order-1 md:order-1">
            {allowConcerns ? (
              <ConcernsList
                concerns={dashboard.concerns}
                privacyLabel={concernsPrivacyLabel}
                isSharedView={isFamilyManaged}
              />
            ) : (
              <TierGateNotice
                title="Conversation Concerns"
                requiredTier="tier_4"
                lineName={lineName}
                privacyLabel={concernsPrivacyLabel}
              />
            )}
          </div>
        )}

        {/* Safety Alerts - always visible */}
        <div className="order-2 md:order-2">
          <SafetyAlertsCard
            events={safetyEvents}
            timezone={timezone}
            highTierOnly={isFamilyManaged}
            privacyLabel={safetyPrivacyLabel}
          />
        </div>
      </div>

      {/* Fallback when no dashboard */}
      {!dashboard && !safetyEvents.length && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            No safety data available yet.
          </p>
        </div>
      )}
    </div>
  );
}
