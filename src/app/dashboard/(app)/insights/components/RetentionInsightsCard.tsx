import { InfoTip } from '~/core/ui/InfoTip';
import type { InsightsDashboard } from '~/lib/ultaura/types';

interface RetentionInsightsCardProps {
  retention: InsightsDashboard['retention'];
}

function formatTrend(trend: 'increasing' | 'stable' | 'decreasing'): string {
  if (trend === 'increasing') return 'Up';
  if (trend === 'decreasing') return 'Down';
  return 'Stable';
}

export function RetentionInsightsCard({ retention }: RetentionInsightsCardProps) {
  if (!retention) {
    return null;
  }

  const { retentionFeatures, engagementMetrics, inboundMetrics } = retention;
  const favoriteSegments = retentionFeatures.favoriteSegments.length
    ? retentionFeatures.favoriteSegments.map((segment) => segment.replace(/_/g, ' ')).join(', ')
    : 'None yet';
  const preferredSegment = engagementMetrics.preferredSegmentType
    ? engagementMetrics.preferredSegmentType.replace(/_/g, ' ')
    : 'None yet';

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold text-foreground">Retention Highlights</h3>
        <InfoTip content="Shows engagement patterns over the last 30 days — including story arc progress, preferred conversation topics, and how often call previews lead to full discussions." />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs text-muted-foreground">Preview follow-through</div>
          <div className="text-lg font-semibold text-foreground">
            {engagementMetrics.callPreviewFollowThrough}%
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs text-muted-foreground">Segment completion</div>
          <div className="text-lg font-semibold text-foreground">
            {engagementMetrics.segmentCompletionRate}%
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs text-muted-foreground">Preferred segment</div>
          <div className="text-sm font-semibold text-foreground capitalize">{preferredSegment}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
          <div className="text-xs text-muted-foreground">Avg segment duration</div>
          <div className="text-sm font-semibold text-foreground">
            {engagementMetrics.averageSegmentDuration
              ? `${engagementMetrics.averageSegmentDuration}s`
              : 'N/A'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted-foreground">Favorite segments</div>
          <div className="text-sm font-medium text-foreground mt-1 capitalize">
            {favoriteSegments}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Inbound calls</div>
          <div className="text-sm font-medium text-foreground mt-1">
            {inboundMetrics.inboundCallCount} ({formatTrend(inboundMetrics.inboundCallTrend)})
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs text-muted-foreground">Active story arcs</div>
        {retentionFeatures.activeStoryArcs.length ? (
          <div className="mt-2 space-y-2">
            {retentionFeatures.activeStoryArcs.map((arc) => (
              <div key={arc.id} className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-foreground">{arc.title}</div>
                  <div className="text-xs text-muted-foreground">{arc.progress}%</div>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary/70"
                    style={{ width: `${Math.min(100, Math.max(0, arc.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground mt-1">No active story arcs</div>
        )}
      </div>
    </div>
  );
}
