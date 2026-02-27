'use client';

import type { InsightsDashboard } from '~/lib/ultaura/types';
import type { StoryArc, SegmentStats, CallPreview } from '~/lib/ultaura/types/retention';
import { EngagementHighlightsCard } from '../../components/RetentionInsightsCard';
import { ActivityOverviewCard, UpcomingTopicsCard, StoryProgressCard } from '../../components/EngagementFeatures';
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
        <p className="text-sm text-muted-foreground">
          Engagement features, story arcs, and retention insights.
        </p>
        <TierGateNotice title="Engagement Features" requiredTier="tier_2" lineName={lineName} />
        <TierGateNotice title="Retention Insights" requiredTier="tier_2" lineName={lineName} />
      </div>
    );
  }

  const hasSegmentData = segmentStats && segmentStats.totalSegments > 0;
  const hasCallPreviews = callPreviews.length > 0;
  const hasStoryArcs = storyArcs.length > 0;
  const hasRetention = !!dashboard?.retention;
  const hasAnyData = hasSegmentData || hasCallPreviews || hasStoryArcs || hasRetention;

  if (!hasAnyData) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Engagement features, story arcs, and retention insights.
        </p>
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Engagement Features</h3>
          <p className="mt-3 text-sm text-muted-foreground">
            No engagement data available yet. Features like story arcs, learning journeys, and activity insights will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Engagement features, story arcs, and retention insights.
      </p>

      {/* Row 1: Activity Overview + Engagement Highlights (side-by-side) */}
      {(hasSegmentData || hasRetention) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {segmentStats && <ActivityOverviewCard segmentStats={segmentStats} />}
          {dashboard && <EngagementHighlightsCard retention={dashboard.retention} />}
        </div>
      )}

      {/* Row 2: Upcoming Topics (full width) */}
      <UpcomingTopicsCard callPreviews={callPreviews} timezone={timezone} />

      {/* Row 3: Story Progress (full width) */}
      <StoryProgressCard storyArcs={storyArcs} timezone={timezone} />
    </div>
  );
}
