'use client';

import { AlertTriangle, ChevronDown, Sparkles, X } from 'lucide-react';
import { useState, useTransition } from 'react';

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
  const [updates, setUpdates] =
    useState<ReadonlyArray<WhatsNewDashboardItem>>(initialUpdates);
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

  function handleToggle() {
    setIsExpanded((prev) => !prev);
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
        setDismissError(
          'Could not dismiss updates right now. Please try again.',
        );
      }
    });
  }

  function handleLoadAll() {
    if (!needsLazyLoad) return;

    setExpandError(null);

    startLoadAllTransition(async () => {
      const result = await loadAllPublishedChangelogDashboardItems();

      if (!result.success) {
        setExpandError(
          result.error.message || 'Could not load all updates right now.',
        );
        return;
      }

      setUpdates(result.data);
    });
  }

  const updateCountLabel =
    totalCount === 1 ? '1 update' : `${totalCount} updates`;

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-border border-l-2 border-l-primary bg-card">
        {/* Header — toggle button spans full width, dismiss is separate */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleToggle}
            disabled={isLoadingAll}
            className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md py-3 pl-4 pr-2 text-left transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 shrink-0 text-primary" />
            <span className="shrink-0 text-sm font-medium text-foreground">
              What&apos;s New
            </span>
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
            <span className="flex-1" />
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {updateCountLabel}
            </span>
            <ChevronDown
              className={[
                'h-3.5 w-3.5 shrink-0 text-primary transition-transform duration-200',
                isExpanded ? 'rotate-180' : '',
              ].join(' ')}
            />
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            disabled={!canDismiss || isDismissing}
            aria-label="Dismiss updates"
            title="Dismiss updates"
            className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Expandable content — CSS grid-rows slide */}
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="border-t border-border/50 px-4 pb-3 pt-2">
              {/* Timeline */}
              <ul className="space-y-0">
                {visibleUpdates.map((update, index) => {
                  const meta = CHANGELOG_CATEGORY_META[update.category];

                  return (
                    <li
                      key={update.id}
                      className="relative border-l-2 py-3 pl-4"
                      style={{
                        borderLeftColor: meta.dashboardItemBorderColor,
                      }}
                    >
                      {/* Timeline dot */}
                      <span
                        className="absolute -left-[5px] h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: meta.dashboardItemBorderColor,
                          top: index === 0 ? '14px' : '18px',
                        }}
                      />

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {update.title}
                          </p>

                          {/* Description */}
                          {update.description ? (
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                              {update.description}
                            </p>
                          ) : null}
                        </div>

                        {/* Pill + date — pinned right, date below pill */}
                        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                          <span
                            className={[
                              'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                              meta.dashboardBadgeClassName,
                            ].join(' ')}
                          >
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {formatPublishedDate(update.publishedAt)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Dismiss error — outside the card */}
      {dismissError ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{dismissError}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatPublishedDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Recently';
  }

  return PUBLISHED_DATE_FORMATTER.format(date);
}
