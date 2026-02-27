import { BarChart3, CheckSquare, Star, Timer, Phone, BookOpen } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { InsightsDashboard } from '~/lib/ultaura/types';

interface EngagementHighlightsCardProps {
  retention: InsightsDashboard['retention'];
}


export function EngagementHighlightsCard({ retention }: EngagementHighlightsCardProps) {
  if (!retention) {
    return null;
  }

  const { retentionFeatures, engagementMetrics, inboundMetrics } = retention;
  const preferredSegment = engagementMetrics.preferredSegmentType
    ? engagementMetrics.preferredSegmentType.replace(/_/g, ' ')
    : 'None yet';

  const activeStoryCount = retentionFeatures.activeStoryArcs.length;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Engagement Highlights</h3>
        <InfoTip content="Key engagement patterns over the last 30 days — including how often topics lead to full discussions, activity completion rates, and calling habits." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Topic Follow-Up Rate</span>
          </div>
          <div className="text-lg font-semibold text-primary mt-1">
            {engagementMetrics.callPreviewFollowThrough}%
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer className="w-3.5 h-3.5" />
            <span>Activity Completion</span>
          </div>
          <div className="text-lg font-semibold text-primary mt-1">
            {engagementMetrics.segmentCompletionRate}%
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Star className="w-3.5 h-3.5" />
            <span>Favorite Activity Type</span>
          </div>
          <div className="text-lg font-semibold text-primary capitalize mt-1">{preferredSegment}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Timer className="w-3.5 h-3.5" />
            <span>Avg Activity Length</span>
          </div>
          <div className="text-lg font-semibold text-primary mt-1">
            {engagementMetrics.averageSegmentDuration
              ? `${engagementMetrics.averageSegmentDuration}s`
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Phone className="w-3.5 h-3.5" />
            <span>Inbound Calls</span>
          </div>
          <div className="text-lg font-semibold text-primary mt-1">
            {inboundMetrics.inboundCallCount}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Active Stories</span>
          </div>
          <div className="text-lg font-semibold text-primary mt-1">
            {activeStoryCount}
          </div>
        </div>
      </div>
    </div>
  );
}
