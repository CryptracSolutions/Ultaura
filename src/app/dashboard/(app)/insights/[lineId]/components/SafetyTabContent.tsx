'use client';

import type { InsightsDashboard } from '~/lib/ultaura/types';
import { ConcernsList } from '../../components/ConcernsList';
import { SafetyAlertsCard, TierGateNotice, type SafetyEvent, type TierAccess } from './shared';

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
  const { isFamilyManaged, allowConcerns, lineName } = tierAccess;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Safety incidents and conversation concerns from recent calls.
      </p>
      {/* Safety Alerts - always visible */}
      <SafetyAlertsCard
        events={safetyEvents}
        timezone={timezone}
        highTierOnly={isFamilyManaged}
      />

      {/* Concerns List - tier 4 only */}
      {dashboard && (
        allowConcerns ? (
          <ConcernsList concerns={dashboard.concerns} />
        ) : (
          <TierGateNotice title="Conversation Concerns" requiredTier="tier_4" lineName={lineName} />
        )
      )}

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
