'use client';

import { useState } from 'react';
import { DateTime } from 'luxon';
import {
  Smile,
  Meh,
  Frown,
  AlertCircle,
  CloudRain,
  Flame,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '~/core/ui/Tooltip';
import { InfoTip } from '~/core/ui/InfoTip';
import type { ElementType } from 'react';
import type { MoodCalendarData, MoodSnapshotMood } from '~/lib/ultaura/types';

interface MoodCalendarProps {
  data: MoodCalendarData;
  timezone: string;
}

const MOOD_COLORS: Record<MoodSnapshotMood, string> = {
  positive: 'text-success',
  neutral: 'text-muted-foreground',
  low: 'text-destructive',
  anxious: 'text-amber-500',
  sad: 'text-blue-500',
  frustrated: 'text-rose-500',
};

const MOOD_BG: Record<MoodSnapshotMood, string> = {
  positive: 'bg-emerald-500/15 border-emerald-500/30',
  neutral: 'bg-muted/30 border-border/60',
  low: 'bg-destructive/10 border-destructive/30',
  anxious: 'bg-amber-500/15 border-amber-500/30',
  sad: 'bg-blue-500/15 border-blue-500/30',
  frustrated: 'bg-rose-500/15 border-rose-500/30',
};

const MOOD_ICONS: Record<MoodSnapshotMood, ElementType> = {
  positive: Smile,
  neutral: Meh,
  low: Frown,
  anxious: AlertCircle,
  sad: CloudRain,
  frustrated: Flame,
};

const MOOD_LABELS: Record<MoodSnapshotMood, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  low: 'Low',
  anxious: 'Anxious',
  sad: 'Sad',
  frustrated: 'Frustrated',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function MoodCalendar({ data, timezone }: MoodCalendarProps) {
  const dataMonth = DateTime.fromFormat(data.month, 'yyyy-MM', { zone: timezone });
  const initialMonth = dataMonth.isValid
    ? dataMonth.startOf('month')
    : DateTime.now().setZone(timezone).startOf('month');

  const [displayedMonth, setDisplayedMonth] = useState(initialMonth);

  const now = DateTime.now().setZone(timezone).startOf('month');
  const canGoNext = displayedMonth < now;

  const daysInMonth = displayedMonth.daysInMonth ?? 30;
  const offset = displayedMonth.weekday % 7;
  const totalCells = Math.ceil((daysInMonth + offset) / 7) * 7;

  const moodMap = new Map(data.days.map((day) => [day.date, day.mood]));
  const isDataMonth = displayedMonth.toFormat('yyyy-MM') === data.month;

  function navigateMonth(direction: -1 | 1) {
    setDisplayedMonth((prev) => prev.plus({ months: direction }));
  }

  function formatCellDate(day: number): string {
    return displayedMonth.set({ day }).toFormat('MMM d, yyyy');
  }

  const monthNav = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigateMonth(-1)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[120px] text-center text-xs text-muted-foreground">
        {displayedMonth.toFormat('MMMM yyyy')}
      </span>
      <button
        type="button"
        onClick={() => navigateMonth(1)}
        disabled={!canGoNext}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 disabled:pointer-events-none disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-semibold text-foreground">Mood calendar</h3>
          <InfoTip content="Shows the dominant mood logged each day of the month. Tap or hover any day to see details. Use the arrows to browse previous months." />
        </div>
        {/* Month nav — desktop only */}
        <div className="hidden lg:flex">{monthNav}</div>
      </div>

      {/* Legend — sits below title, above grid */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(MOOD_LABELS).map(([mood, label]) => {
          const moodKey = mood as MoodSnapshotMood;
          const Icon = MOOD_ICONS[moodKey];
          return (
            <span key={mood} className="inline-flex items-center gap-1">
              <Icon
                className={`h-3 w-3 ${MOOD_COLORS[moodKey]}`}
                aria-hidden="true"
              />
              {label}
            </span>
          );
        })}
      </div>

      {/* Day-of-week header */}
      <div className="mt-4 grid grid-cols-7 gap-1.5 text-xs font-medium text-muted-foreground">
        {DAY_LABELS.map((label) => (
          <div key={label} className="text-center">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid — smaller cells on desktop */}
      <div className="mt-1.5 grid grid-cols-7 gap-1.5">
        {Array.from({ length: totalCells }).map((_, index) => {
          const day = index - offset + 1;
          if (day < 1 || day > daysInMonth) {
            return (
              <div
                key={`empty-${index}`}
                className="aspect-square rounded-md border border-dashed border-border/40 lg:aspect-auto lg:h-[52px]"
              />
            );
          }

          const date = displayedMonth.set({ day }).toISODate();
          const mood = isDataMonth && date ? (moodMap.get(date) ?? null) : null;
          const Icon = mood ? MOOD_ICONS[mood] : null;
          const cellBg = mood ? MOOD_BG[mood] : 'bg-muted/10 border-border/60';
          const tooltipLabel = mood
            ? `${MOOD_LABELS[mood]} \u2014 ${formatCellDate(day)}`
            : `No mood logged \u2014 ${formatCellDate(day)}`;

          return (
            <Tooltip key={`day-${day}`}>
              <TooltipTrigger asChild>
                <div
                  className={`aspect-square rounded-md border lg:aspect-auto lg:h-[52px] ${cellBg} flex flex-col items-center justify-center gap-0.5 text-xs transition-colors`}
                >
                  <span className="font-medium text-foreground">{day}</span>
                  {mood && Icon ? (
                    <span role="img" aria-label={MOOD_LABELS[mood]}>
                      <Icon
                        className={`h-3 w-3 ${MOOD_COLORS[mood]}`}
                        aria-hidden="true"
                      />
                    </span>
                  ) : null}
                </div>
              </TooltipTrigger>
              <TooltipContent>{tooltipLabel}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {!isDataMonth && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          No mood data for this month.
        </p>
      )}

      {/* Month nav — mobile only, below grid */}
      <div className="mt-4 flex justify-center lg:hidden">{monthNav}</div>
    </div>
  );
}
