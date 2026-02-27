'use client';

import { useState } from 'react';
import { DateTime } from 'luxon';
import { BookOpen, Gamepad2, GraduationCap, Heart, TrendingUp, Lightbulb, CheckCircle, XCircle, Clock, MessageSquare } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';
import type { StoryArc, SegmentStats, CallPreview } from '~/lib/ultaura/types/retention';

const SEGMENT_TYPE_CONFIG = {
  trivia: { label: 'Trivia', icon: Gamepad2, color: 'text-purple-500', bg: 'bg-purple-500/8' },
  story: { label: 'Stories', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/8' },
  learning: { label: 'Learning', icon: GraduationCap, color: 'text-green-500', bg: 'bg-green-500/8' },
  memory_lane: { label: 'Memory Lane', icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/8' },
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
    <div className={`rounded-lg border border-border/60 p-4 ${config.bg}`}>
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
          <span className="text-xs font-medium text-muted-foreground">
            {getPreviewStatusLabel(preview)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Card 1: Activity Overview ─── */

interface ActivityOverviewCardProps {
  segmentStats: SegmentStats;
}

export function ActivityOverviewCard({ segmentStats }: ActivityOverviewCardProps) {
  const hasSegmentData = segmentStats.totalSegments > 0;

  if (!hasSegmentData) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Activity Overview</h3>
          <InfoTip content="Breakdown of interactive activities during calls over the last 30 days — including trivia, stories, learning modules, and memory lane sessions." />
        </div>
        <span className="text-xs text-muted-foreground">
          {segmentStats.totalSegments} session{segmentStats.totalSegments !== 1 ? 's' : ''}
        </span>
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
                  {segmentStats.preferredDomains.map((domain) => {
                    const label = domain.replace(/_/g, ' ');
                    const display = label.charAt(0).toUpperCase() + label.slice(1);
                    return (
                      <span
                        key={domain}
                        className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary"
                      >
                        {display}
                      </span>
                    );
                  })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Card 2: Upcoming Topics ─── */

const TOPICS_PREVIEW_LIMIT = 5;

interface UpcomingTopicsCardProps {
  callPreviews: CallPreview[];
  timezone: string;
}

export function UpcomingTopicsCard({ callPreviews, timezone }: UpcomingTopicsCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (!callPreviews.length) {
    return null;
  }

  const visiblePreviews = expanded
    ? callPreviews
    : callPreviews.slice(0, TOPICS_PREVIEW_LIMIT);
  const hasMore = callPreviews.length > TOPICS_PREVIEW_LIMIT;

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Upcoming Topics</h3>
          <InfoTip content="Topics that Ultaura will bring up in upcoming calls, based on memories, interests, and follow-ups from previous conversations." />
        </div>
        <span className="text-xs text-muted-foreground">
          {callPreviews.length} topic{callPreviews.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="space-y-3">
        {visiblePreviews.map((preview) => (
          <CallPreviewCard key={preview.id} preview={preview} timezone={timezone} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-sm text-primary hover:underline cursor-pointer"
        >
          {expanded ? 'Show less' : `Show ${callPreviews.length - TOPICS_PREVIEW_LIMIT} more`}
        </button>
      )}
    </div>
  );
}

/* ─── Card 3: Story Progress ─── */

interface StoryProgressCardProps {
  storyArcs: StoryArc[];
  timezone: string;
}

export function StoryProgressCard({ storyArcs, timezone }: StoryProgressCardProps) {
  if (!storyArcs.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Story Progress</h3>
          <InfoTip content="Ongoing fiction and narrative story arcs that are read across multiple calls. Each story progresses chapter by chapter." />
        </div>
        <span className="text-xs text-muted-foreground">
          {storyArcs.length} active stor{storyArcs.length !== 1 ? 'ies' : 'y'}
        </span>
      </div>

      <div className="space-y-3">
        {storyArcs.map((arc) => (
          <StoryArcCard key={arc.id} arc={arc} timezone={timezone} />
        ))}
      </div>
    </div>
  );
}
