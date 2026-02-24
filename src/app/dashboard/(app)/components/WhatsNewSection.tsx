'use client';

import { AlertTriangle, ChevronDown, ChevronUp, Sparkles, X } from 'lucide-react';
import { useState, useTransition } from 'react';

import Button from '~/core/ui/Button';
import {
  CHANGELOG_CATEGORY_META,
  type WhatsNewDashboardItem,
} from '~/lib/ultaura/changelog-shared';
import {
  dismissChangelog,
  loadAllPublishedChangelogDashboardItems,
} from '~/lib/ultaura/changelog-actions';

const DEFAULT_VISIBLE_UPDATES = 5;
const PUBLISHED_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

interface WhatsNewSectionProps {
  userId: string;
  initialUpdates: ReadonlyArray<WhatsNewDashboardItem>;
  totalCount: number;
  latestEntryId: string | null;
  latestPublishedAt: string | null;
}

export default function WhatsNewSection({
  userId,
  initialUpdates,
  totalCount,
  latestEntryId,
  latestPublishedAt,
}: WhatsNewSectionProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [updates, setUpdates] = useState<ReadonlyArray<WhatsNewDashboardItem>>(initialUpdates);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);
  const [isDismissing, startDismissTransition] = useTransition();
  const [isLoadingAll, startLoadAllTransition] = useTransition();

  const canDismiss = Boolean(latestPublishedAt);
  const hasHiddenUpdates = totalCount > DEFAULT_VISIBLE_UPDATES;
  const needsLazyLoad = totalCount > updates.length;

  const visibleUpdates = isExpanded
    ? updates
    : updates.slice(0, DEFAULT_VISIBLE_UPDATES);

  if (!isVisible || updates.length === 0) {
    return null;
  }

  function handleDismiss() {
    if (!latestPublishedAt || isDismissing) {
      return;
    }

    setDismissError(null);

    startDismissTransition(async () => {
      try {
        const result = await dismissChangelog(userId, {
          lastSeenEntryId: latestEntryId,
          lastSeenPublishedAt: latestPublishedAt,
        });

        if (!result.success) {
          throw new Error(result.error.message);
        }

        setIsVisible(false);
      } catch {
        setDismissError('Could not dismiss updates right now. Please try again.');
      }
    });
  }

  function handleToggleExpand() {
    setExpandError(null);

    if (isExpanded) {
      setIsExpanded(false);
      return;
    }

    if (!needsLazyLoad) {
      setIsExpanded(true);
      return;
    }

    startLoadAllTransition(async () => {
      const result = await loadAllPublishedChangelogDashboardItems();

      if (!result.success) {
        setExpandError(result.error.message || 'Could not load all updates right now.');
        return;
      }

      setUpdates(result.data);
      setIsExpanded(true);
    });
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold text-foreground">What&apos;s New</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent updates and improvements across Ultaura.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          disabled={!canDismiss || isDismissing}
          aria-label="Dismiss What's New"
          title="Dismiss What's New"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {dismissError ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{dismissError}</span>
        </div>
      ) : null}

      <ul className="mt-4 space-y-4">
        {visibleUpdates.map((update) => {
          const categoryMeta = CHANGELOG_CATEGORY_META[update.category];

          return (
            <li key={update.id} className="rounded-lg border border-border/70 bg-background/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
                    categoryMeta.dashboardBadgeClassName,
                  ].join(' ')}
                >
                  {categoryMeta.label}
                </span>

                <span className="text-xs text-muted-foreground">
                  {formatPublishedDate(update.publishedAt)}
                </span>
              </div>

              <p className="mt-2 font-medium text-foreground">{update.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{update.description}</p>
            </li>
          );
        })}
      </ul>

      {hasHiddenUpdates ? (
        <div className="mt-4 flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleExpand}
            disabled={isLoadingAll}
            className="w-fit"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show fewer
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                {isLoadingAll ? 'Loading updates...' : 'View all updates'}
              </>
            )}
          </Button>

          {expandError ? (
            <p className="text-xs text-destructive">{expandError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatPublishedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return PUBLISHED_DATE_FORMATTER.format(date);
}
