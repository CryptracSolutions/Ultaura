'use client';

import type { InsightsDashboard } from '~/lib/ultaura/types';
import type { StoryArc, SegmentStats, CallPreview } from '~/lib/ultaura/types/retention';
import { RetentionInsightsCard } from '../../components/RetentionInsightsCard';
import { EngagementFeatures } from '../../components/EngagementFeatures';
import { TierGateNotice, type TierAccess } from './shared';

interface EngagementTabContentProps {
  dashboard: InsightsDashboard | null;
  callPreviews: CallPreview[];
  storyArcs: StoryArc[];
  segmentStats: SegmentStats | null;
  timezone: string;
  tierAccess: TierAccess;
}

export function EngagementTabContent({
  dashboard,
  callPreviews,
  storyArcs,
  segmentStats,
  timezone,
  tierAccess,
}: EngagementTabContentProps) {
  const { allowMood, lineName } = tierAccess;

  if (!allowMood) {
    return (
      <div className="space-y-6">
        <TierGateNotice title="Engagement Features" requiredTier="tier_2" lineName={lineName} />
        <TierGateNotice title="Retention Insights" requiredTier="tier_2" lineName={lineName} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Engagement Features */}
      {segmentStats && (
        <EngagementFeatures
          storyArcs={storyArcs}
          segmentStats={segmentStats}
          timezone={timezone}
          callPreviews={callPreviews}
        />
      )}

      {!segmentStats && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Engagement Features</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            No engagement data available yet. Features like story arcs and learning journeys will appear here.
          </p>
        </div>
      )}

      {/* Retention Highlights */}
      {dashboard && <RetentionInsightsCard retention={dashboard.retention} />}
    </div>
  );
}
