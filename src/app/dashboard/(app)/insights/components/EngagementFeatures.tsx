'use client';

import { DateTime } from 'luxon';
import { BookOpen, Gamepad2, GraduationCap, Heart, TrendingUp, Lightbulb, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import type { StoryArc, SegmentStats, CallPreview } from '~/lib/ultaura/types/retention';

interface EngagementFeaturesProps {
  storyArcs: StoryArc[];
  segmentStats: SegmentStats;
  timezone: string;
  callPreviews?: CallPreview[];
}

const SEGMENT_TYPE_CONFIG = {
  trivia: { label: 'Trivia', icon: Gamepad2, color: 'text-purple-500' },
  story: { label: 'Stories', icon: BookOpen, color: 'text-blue-500' },
  learning: { label: 'Learning', icon: GraduationCap, color: 'text-green-500' },
  memory_lane: { label: 'Memory Lane', icon: Heart, color: 'text-rose-500' },
} as const;

function StoryArcCard({ arc, timezone }: { arc: StoryArc; timezone: string }) {
  const progress = arc.totalChapters > 0
    ? Math.round((arc.currentChapter / arc.totalChapters) * 100)
    : 0;
  const lastChapterLabel = arc.lastChapterAt
    ? DateTime.fromISO(arc.lastChapterAt).setZone(timezone).toFormat('MMM d')
    : null;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{arc.title}</p>
          {arc.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{arc.description}</p>
          )}
        </div>
        <span className="text-xs font-medium text-primary shrink-0">
          {arc.currentChapter}/{arc.totalChapters}
        </span>
      </div>
      <div className="mt-3">
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
          <span>{progress}% complete</span>
          {lastChapterLabel && <span>Last: {lastChapterLabel}</span>}
        </div>
      </div>
    </div>
  );
}

function SegmentTypeCard({
  type,
  stats,
}: {
  type: keyof typeof SEGMENT_TYPE_CONFIG;
  stats: { count: number; enjoymentRate: number; avgDuration: number };
}) {
  const config = SEGMENT_TYPE_CONFIG[type];
  const Icon = config.icon;

  if (stats.count === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className="text-sm font-medium text-foreground">{config.label}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold text-foreground">{stats.count}</p>
          <p className="text-xs text-muted-foreground">Sessions</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">{stats.enjoymentRate}%</p>
          <p className="text-xs text-muted-foreground">Enjoyed</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {stats.avgDuration > 60
              ? `${Math.round(stats.avgDuration / 60)}m`
              : `${stats.avgDuration}s`}
          </p>
          <p className="text-xs text-muted-foreground">Avg Time</p>
        </div>
      </div>
    </div>
  );
}

function getPreviewStatusIcon(preview: CallPreview) {
  if (preview.followedThrough === true) {
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  }
  if (preview.followedThrough === false) {
    return <XCircle className="w-4 h-4 text-muted-foreground" />;
  }
  if (preview.usedAt) {
    return <MessageSquare className="w-4 h-4 text-blue-500" />;
  }
  return <Clock className="w-4 h-4 text-muted-foreground" />;
}

function getPreviewStatusLabel(preview: CallPreview) {
  if (preview.followedThrough === true) {
    return 'Engaged';
  }
  if (preview.followedThrough === false) {
    return 'Skipped';
  }
  if (preview.usedAt) {
    return 'Discussed';
  }
  if (preview.selectedAt) {
    return 'Queued';
  }
  return 'Pending';
}

function CallPreviewCard({ preview, timezone }: { preview: CallPreview; timezone: string }) {
  const dateLabel = DateTime.fromISO(preview.createdAt)
    .setZone(timezone)
    .toFormat('MMM d, yyyy');

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {preview.topicDisplay}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{dateLabel}</span>
            {preview.topicType && (
              <span className="capitalize">{preview.topicType.replace(/_/g, ' ')}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {getPreviewStatusIcon(preview)}
          <span className="text-xs text-muted-foreground">
            {getPreviewStatusLabel(preview)}
          </span>
        </div>
      </div>
      {preview.followThroughResponse && (
        <p className="mt-2 text-xs text-muted-foreground italic">
          &ldquo;{preview.followThroughResponse}&rdquo;
        </p>
      )}
    </div>
  );
}

export function EngagementFeatures({ storyArcs, segmentStats, timezone, callPreviews }: EngagementFeaturesProps) {
  const hasStoryArcs = storyArcs.length > 0;
  const hasSegmentData = segmentStats.totalSegments > 0;
  const hasCallPreviews = callPreviews && callPreviews.length > 0;

  if (!hasStoryArcs && !hasSegmentData && !hasCallPreviews) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Engagement</h3>
        <p className="text-sm text-muted-foreground">
          No engagement data yet. Interactive features like trivia, stories, and learning will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Engagement</h3>
        {hasSegmentData && (
          <span className="text-xs text-muted-foreground">
            {segmentStats.totalSegments} total sessions
          </span>
        )}
      </div>

      <div className="space-y-6">
        {hasStoryArcs && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active Stories
              </h4>
            </div>
            <div className="space-y-3">
              {storyArcs.map((arc) => (
                <StoryArcCard key={arc.id} arc={arc} timezone={timezone} />
              ))}
            </div>
          </div>
        )}

        {hasSegmentData && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Activity by Type (30 days)
              </h4>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(SEGMENT_TYPE_CONFIG) as Array<keyof typeof SEGMENT_TYPE_CONFIG>).map(
                (type) => (
                  <SegmentTypeCard
                    key={type}
                    type={type}
                    stats={segmentStats.byType[type]}
                  />
                )
              )}
            </div>
            {segmentStats.preferredDomains.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/60">
                <p className="text-xs text-muted-foreground mb-2">Preferred topics:</p>
                <div className="flex flex-wrap gap-2">
                  {segmentStats.preferredDomains.map((domain) => (
                    <span
                      key={domain}
                      className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                    >
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {hasCallPreviews && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-muted-foreground" />
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Call Previews
                </h4>
              </div>
              <span className="text-xs text-muted-foreground">Recent topics</span>
            </div>
            <div className="space-y-3">
              {callPreviews.map((preview) => (
                <CallPreviewCard key={preview.id} preview={preview} timezone={timezone} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
