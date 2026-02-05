'use client';

import { useState } from 'react';
import { DateTime } from 'luxon';
import { CalendarDays, ChevronLeft, ChevronRight, Edit2, Trash2, Star } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '~/core/ui/Popover';
import type { LineRow, MilestoneRow } from '~/lib/ultaura/types';

interface MilestoneCalendarProps {
  line: LineRow;
  milestones: MilestoneRow[];
  onEdit: (milestone: MilestoneRow) => void;
  onDelete: (milestone: MilestoneRow) => void;
  disabled?: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatMilestoneDate(
  milestone: MilestoneRow,
  timezone: string
): string {
  const year = milestone.date_year ?? DateTime.now().setZone(timezone).year;
  const date = DateTime.fromObject({
    year,
    month: milestone.date_month,
    day: milestone.date_day,
  }, { zone: timezone });
  if (!date.isValid) {
    return `${milestone.date_month}/${milestone.date_day}`;
  }

  if (milestone.date_year) {
    return date.toFormat('MMM d, yyyy');
  }

  return date.toFormat('MMM d');
}

function getNextOccurrence(milestone: MilestoneRow, timezone: string): DateTime | null {
  const now = DateTime.now().setZone(timezone).startOf('day');

  if (!milestone.is_recurring && milestone.date_year) {
    const date = DateTime.fromObject({
      year: milestone.date_year,
      month: milestone.date_month,
      day: milestone.date_day,
    }, { zone: timezone });
    return date.isValid && date >= now ? date : null;
  }

  const baseYear = now.year;
  let date = DateTime.fromObject({
    year: baseYear,
    month: milestone.date_month,
    day: milestone.date_day,
  }, { zone: timezone });

  if (!date.isValid) {
    return null;
  }

  if (date < now) {
    date = date.plus({ years: 1 });
  }

  return date;
}

function isMilestoneOnDate(milestone: MilestoneRow, date: DateTime): boolean {
  if (milestone.date_month !== date.month || milestone.date_day !== date.day) {
    return false;
  }

  if (!milestone.is_recurring && milestone.date_year) {
    return milestone.date_year === date.year;
  }

  return true;
}

export function MilestoneCalendar({
  line,
  milestones,
  onEdit,
  onDelete,
  disabled = false,
}: MilestoneCalendarProps) {
  const now = DateTime.now().setZone(line.timezone);
  const currentYear = now.year;

  // Track which month the user is viewing (1-12)
  const [viewMonth, setViewMonth] = useState(now.month);

  const monthStart = DateTime.fromObject(
    { year: currentYear, month: viewMonth, day: 1 },
    { zone: line.timezone },
  );
  const daysInMonth = monthStart.daysInMonth ?? 30;
  const offset = monthStart.weekday % 7; // 0 for Sunday
  const totalCells = Math.ceil((daysInMonth + offset) / 7) * 7;

  const canGoPrev = viewMonth > 1;
  const canGoNext = viewMonth < 12;

  const handlePrevMonth = () => {
    if (canGoPrev) setViewMonth((m) => m - 1);
  };

  const handleNextMonth = () => {
    if (canGoNext) setViewMonth((m) => m + 1);
  };

  const upcoming = milestones
    .map((milestone) => ({
      milestone,
      date: getNextOccurrence(milestone, line.timezone),
    }))
    .filter((entry): entry is { milestone: MilestoneRow; date: DateTime } => Boolean(entry.date))
    .sort((a, b) => a.date.toMillis() - b.date.toMillis())
    .slice(0, 5);

  const sortedMilestones = [...milestones].sort((a, b) => {
    if (a.date_month !== b.date_month) return a.date_month - b.date_month;
    if (a.date_day !== b.date_day) return a.date_day - b.date_day;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label="Previous month"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className="p-1 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {monthStart.toFormat('MMMM yyyy')}
            </h3>
          </div>

          <button
            type="button"
            aria-label="Next month"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className="p-1 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2 text-xs text-muted-foreground">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center">
              {label}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {Array.from({ length: totalCells }).map((_, index) => {
            const day = index - offset + 1;
            if (day < 1 || day > daysInMonth) {
              return <div key={`empty-${index}`} className="h-16 rounded-lg border border-dashed border-border/60" />;
            }

            const date = monthStart.set({ day });
            const dayMilestones = milestones.filter((milestone) =>
              isMilestoneOnDate(milestone, date)
            );

            if (dayMilestones.length > 0) {
              return (
                <Popover key={`day-${day}`}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-16 w-full rounded-lg p-2 text-xs text-left transition-colors cursor-pointer flex flex-col items-start border border-primary bg-primary/5 hover:bg-primary/10"
                    >
                      <div className="text-sm font-medium text-primary">
                        {day}
                      </div>
                      <div className="mt-1 space-y-1 hidden md:block">
                        {dayMilestones.slice(0, 2).map((milestone) => (
                          <div key={milestone.id} className="truncate text-[11px] text-primary">
                            {milestone.title}
                          </div>
                        ))}
                        {dayMilestones.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayMilestones.length - 2} more
                          </div>
                        )}
                      </div>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="center">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">
                        {date.toFormat('MMMM d')}
                      </div>
                      {dayMilestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="border-b border-border/40 pb-2 last:border-0 last:pb-0"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {milestone.title}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {milestone.milestone_type}
                            {milestone.related_person_name && ` · ${milestone.related_person_name}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            }

            return (
              <div
                key={`day-${day}`}
                className="h-16 rounded-lg border border-border/60 bg-muted/10 p-2 text-xs"
              >
                <div className="text-sm font-medium text-foreground">{day}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">Upcoming milestones</h3>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No upcoming milestones yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {upcoming.map(({ milestone, date }) => (
              <div key={milestone.id} className="rounded-lg border border-border/60 bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{milestone.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {date.toFormat('MMM d')} - {milestone.milestone_type}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {milestone.is_recurring ? 'Recurring' : 'One-time'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-sm font-semibold text-foreground">All milestones</h3>
        {sortedMilestones.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No milestones added yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {sortedMilestones.map((milestone) => {
              const lastCelebrated = milestone.last_celebrated_at
                ? DateTime.fromISO(milestone.last_celebrated_at).toLocaleString(DateTime.DATE_MED)
                : null;

              return (
                <div
                  key={milestone.id}
                  className="rounded-lg border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">{milestone.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMilestoneDate(milestone, line.timezone)} - {milestone.milestone_type}
                      </p>
                      {milestone.related_person_name ? (
                        <p className="text-xs text-muted-foreground">
                          Related to {milestone.related_person_name}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 text-primary" />
                          Celebrated {milestone.times_celebrated ?? 0} times
                        </span>
                        {lastCelebrated ? (
                          <span>Last celebrated {lastCelebrated}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onEdit(milestone)}
                        disabled={disabled}
                        className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                        title="Edit milestone"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onDelete(milestone)}
                        disabled={disabled}
                        className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Delete milestone"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
