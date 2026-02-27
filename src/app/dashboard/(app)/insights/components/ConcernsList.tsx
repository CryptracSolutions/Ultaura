'use client';

import type { InsightsDashboard } from '~/lib/ultaura/types';
import { Check } from 'lucide-react';
import { InfoTip } from '~/core/ui/InfoTip';

interface ConcernsListProps {
  concerns: InsightsDashboard['concerns'];
  privacyLabel: string;
  isSharedView: boolean;
}

const NOVELTY_CHIP_STYLES: Record<string, string> = {
  new: 'border-warning/50 bg-warning/15 text-foreground',
  recurring: 'border-info/50 bg-info/15 text-foreground',
  resolved: 'border-success/50 bg-success/15 text-foreground',
};

const NOVELTY_CARD_STYLES: Record<string, string> = {
  new: 'border-l-4 border-l-warning bg-warning/5',
  recurring: 'border-l-4 border-l-info bg-muted/20',
  resolved: 'border-l-4 border-l-success bg-muted/20',
};

const NOVELTY_STAT_STYLES: Record<string, string> = {
  new: 'border-warning/40 bg-warning/10',
  recurring: 'border-info/40 bg-info/10',
  resolved: 'border-success/40 bg-success/10',
};

function titleCase(value: string): string {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}

export function ConcernsList({ concerns, privacyLabel, isSharedView }: ConcernsListProps) {
  const concernCountByNovelty = concerns.reduce(
    (acc, concern) => {
      if (concern.novelty in acc) {
        acc[concern.novelty as keyof typeof acc] += 1;
      }
      return acc;
    },
    { new: 0, recurring: 0, resolved: 0 }
  );

  const quickStats = [
    { key: 'resolved', label: 'Resolved', count: concernCountByNovelty.resolved },
    { key: 'new', label: 'New', count: concernCountByNovelty.new },
    { key: 'recurring', label: 'Recurring', count: concernCountByNovelty.recurring },
  ];

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-foreground">Conversation Concerns</h3>
          <InfoTip content="Extracted from conversation tone at the end of each call. Tracks weekly patterns like loneliness, sleep, or pain. Not related to Wellness Alerts or Safety Incidents." />
        </div>
        <p className="max-w-2xl text-sm leading-5 text-muted-foreground">
          {isSharedView
            ? 'Use this to spot changing patterns and follow up directly in your next check-in.'
            : 'Use this to spot changing patterns and plan supportive follow-up conversations.'}
        </p>
        <span className="inline-flex min-h-8 items-center rounded-full border border-border/70 bg-muted/30 px-3 text-[11px] font-semibold uppercase tracking-wide text-foreground">
          {privacyLabel}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
        {quickStats.map((stat) => (
          <div
            key={stat.key}
            className={`rounded-xl border px-3 py-2.5 text-center ${NOVELTY_STAT_STYLES[stat.key]}`}
          >
            <p className="text-lg font-semibold leading-none text-foreground">{stat.count}</p>
            <p className="inline-flex items-center justify-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
              {stat.label}
              {stat.key === 'resolved' && <Check className="h-3 w-3 text-success" />}
            </p>
          </div>
        ))}
      </div>

      {concerns.length > 0 ? (
        <div className="mt-5 space-y-3">
          {concerns.map((concern) => {
            const noveltyLabel = titleCase(concern.novelty);
            const severityLabel =
              concern.novelty === 'resolved'
                ? `Previous severity: ${titleCase(concern.severity)}`
                : `Severity: ${titleCase(concern.severity)}`;
            return (
              <div
                key={`${concern.code}-${concern.novelty}`}
                className={`min-h-12 rounded-xl border border-border/60 px-4 py-3.5 ${NOVELTY_CARD_STYLES[concern.novelty]}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-5 text-foreground">{concern.label}</p>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-semibold ${
                      NOVELTY_CHIP_STYLES[concern.novelty]
                    }`}
                  >
                    Status: {noveltyLabel}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{severityLabel}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-4">
          No conversation concerns detected this week.
        </p>
      )}
    </div>
  );
}
