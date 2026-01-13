'use client';

import { DateTime } from 'luxon';
import { CalendarDays, Edit2, Trash2, Star } from 'lucide-react';
import Button from '~/core/ui/Button';
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
    zone: timezone,
  });
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
      zone: timezone,
    });
    return date.isValid && date >= now ? date : null;
  }

  const baseYear = now.year;
  let date = DateTime.fromObject({
    year: baseYear,
    month: milestone.date_month,
    day: milestone.date_day,
    zone: timezone,
  });

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
  const monthStart = now.startOf('month');
  const daysInMonth = monthStart.daysInMonth ?? 30;
  const offset = monthStart.weekday % 7; // 0 for Sunday
  const totalCells = Math.ceil((daysInMonth + offset) / 7) * 7;

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">{monthStart.toFormat('MMMM yyyy')}</h3>
          </div>
          <span className="text-xs text-muted-foreground">Local time</span>
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

            return (
              <div
                key={`day-${day}`}
                className="h-16 rounded-lg border border-border/60 bg-muted/10 p-2 text-xs"
              >
                <div className="text-sm font-medium text-foreground">{day}</div>
                {dayMilestones.length > 0 ? (
                  <div className="mt-1 space-y-1">
                    {dayMilestones.slice(0, 2).map((milestone) => (
                      <div key={milestone.id} className="truncate text-[11px] text-primary">
                        {milestone.title}
                      </div>
                    ))}
                    {dayMilestones.length > 2 ? (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayMilestones.length - 2} more
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
                          <Star className="h-3.5 w-3.5" />
                          Celebrated {milestone.times_celebrated ?? 0} times
                        </span>
                        {lastCelebrated ? (
                          <span>Last celebrated {lastCelebrated}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => onEdit(milestone)}
                        disabled={disabled}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="small"
                        onClick={() => onDelete(milestone)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
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
