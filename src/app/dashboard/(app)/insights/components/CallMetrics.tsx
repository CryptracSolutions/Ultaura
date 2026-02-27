'use client';

import { Phone } from 'lucide-react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { InfoTip } from '~/core/ui/InfoTip';
import type { InsightsDashboard } from '~/lib/ultaura/types';

interface CallMetricsProps {
  activity: InsightsDashboard['callActivity'];
}

const CALL_TYPES = {
  scheduled: { dot: 'bg-primary', cell: 'bg-primary/15', label: 'Scheduled' },
  reminder: { dot: 'bg-amber-400', cell: 'bg-amber-400/15', label: 'Reminder' },
  inbound: { dot: 'bg-sky-400', cell: 'bg-sky-400/15', label: 'Inbound' },
} as const;

type CallType = keyof typeof CALL_TYPES;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

type Entry = InsightsDashboard['callActivity'][number];
type Cell = { entry: Entry; day: number } | null;

function buildCalendarGrid(activity: Entry[]): Cell[][] {
  if (!activity.length) return [];

  const firstDow = new Date(activity[0].date + 'T00:00:00').getDay();
  const cells: Cell[] = [];

  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (const entry of activity) {
    cells.push({ entry, day: new Date(entry.date + 'T00:00:00').getDate() });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: Cell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function getCallTypes(entry: Entry): CallType[] {
  const types: CallType[] = [];
  if (entry.scheduled > 0) types.push('scheduled');
  if (entry.reminder > 0) types.push('reminder');
  if (entry.inbound > 0) types.push('inbound');
  return types;
}

export function CallMetrics({ activity }: CallMetricsProps) {
  const totals = activity.reduce(
    (acc, e) => ({
      scheduled: acc.scheduled + e.scheduled,
      reminder: acc.reminder + e.reminder,
      inbound: acc.inbound + e.inbound,
    }),
    { scheduled: 0, reminder: 0, inbound: 0 },
  );

  const activeDays = activity.filter(
    (e) => e.scheduled + e.reminder + e.inbound > 0,
  ).length;

  let streak = 0;
  for (let i = activity.length - 1; i >= 0; i--) {
    if (activity[i].scheduled + activity[i].reminder + activity[i].inbound > 0)
      streak++;
    else break;
  }

  const grid = buildCalendarGrid(activity);

  return (
    <TooltipPrimitive.Provider delayDuration={0}>
      <div className="rounded-xl bg-card p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Call Activity
            </h3>
            <InfoTip content="A breakdown of all calls over the last 30 days — scheduled outbound calls, reminder calls, and inbound calls from your loved one." />
          </div>
          <span className="text-xs text-muted-foreground">Last 30 days</span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-1.5 mb-5 text-xs text-muted-foreground">
          <span>
            <span className="font-semibold text-primary">{activeDays}</span> of{' '}
            {activity.length} days active
          </span>
          <span className="mx-0.5">·</span>
          <span>
            <span className="font-semibold text-primary">{streak}</span>-day
            streak
          </span>
          <span className="mx-0.5">·</span>
          <span>
            <span className="font-semibold text-primary">
              {totals.scheduled + totals.reminder + totals.inbound}
            </span>{' '}
            total calls
          </span>
        </div>

        {/* Calendar heatmap */}
        <div>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div className="space-y-1.5">
            {grid.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-1.5">
                {row.map((cell, ci) => {
                  if (!cell) {
                    return <div key={ci} />;
                  }

                  const { entry, day } = cell;
                  const total =
                    entry.scheduled + entry.reminder + entry.inbound;
                  const isEmpty = total === 0;
                  const types = getCallTypes(entry);

                  const cellBg = isEmpty
                    ? 'bg-muted/40'
                    : types.length === 1
                      ? CALL_TYPES[types[0]].cell
                      : 'bg-primary/10';

                  return (
                    <TooltipPrimitive.Root key={ci}>
                      <TooltipPrimitive.Trigger asChild>
                        <div
                          className={`rounded-lg ${cellBg} py-2.5 flex flex-col items-center justify-center gap-1.5 cursor-default transition-shadow hover:ring-1 hover:ring-border/60`}
                        >
                          <span
                            className={`text-[11px] leading-none ${
                              isEmpty
                                ? 'text-muted-foreground/50'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {day}
                          </span>
                          {types.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {types.map((type) => (
                                <div
                                  key={type}
                                  className={`h-[6px] w-[6px] rounded-full ${CALL_TYPES[type].dot}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className="h-[6px]" />
                          )}
                        </div>
                      </TooltipPrimitive.Trigger>
                      <TooltipPrimitive.Portal>
                        <TooltipPrimitive.Content
                          side="top"
                          sideOffset={6}
                          className="z-50 rounded-md bg-foreground px-3 py-2 text-xs text-background shadow-md animate-in fade-in-50"
                        >
                          <p className="font-medium">
                            {formatShortDate(entry.date)}
                          </p>
                          {isEmpty ? (
                            <p className="text-background/60 mt-0.5">
                              No calls
                            </p>
                          ) : (
                            <div className="space-y-0.5 mt-1">
                              {entry.scheduled > 0 && (
                                <p>{entry.scheduled} Scheduled</p>
                              )}
                              {entry.reminder > 0 && (
                                <p>{entry.reminder} Reminder</p>
                              )}
                              {entry.inbound > 0 && (
                                <p>{entry.inbound} Inbound</p>
                              )}
                            </div>
                          )}
                          <TooltipPrimitive.Arrow className="fill-foreground" />
                        </TooltipPrimitive.Content>
                      </TooltipPrimitive.Portal>
                    </TooltipPrimitive.Root>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {(Object.keys(CALL_TYPES) as CallType[]).map((type) => (
            <span key={type} className="inline-flex items-center gap-1.5">
              <span
                className={`h-2.5 w-2.5 rounded-full ${CALL_TYPES[type].dot}`}
              />
              {CALL_TYPES[type].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-md bg-muted ring-1 ring-border" />
            No calls
          </span>
        </div>
      </div>
    </TooltipPrimitive.Provider>
  );
}
