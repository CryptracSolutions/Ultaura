'use client';

import { useState, useEffect, useCallback } from 'react';
import { DateTime } from 'luxon';
import {
  Clock,
  Pause,
  Play,
  AlarmClock,
  SkipForward,
  X,
  Edit2,
  CheckCircle,
  PhoneMissed,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { ReminderEventRow } from '~/lib/ultaura/types';
import { getLineReminderEvents } from '~/lib/ultaura/reminder-events';

const CARD_SHELL_CLASS = 'overflow-hidden rounded-xl border border-border bg-card';

const EVENT_CONFIG: Record<
  string,
  {
    icon: typeof Clock;
    badgeClassName: string;
    borderColor: string;
    label: string;
  }
> = {
  created: {
    icon: Plus,
    badgeClassName: 'bg-emerald-500/10 text-emerald-500',
    borderColor: '#10b981',
    label: 'Created',
  },
  edited: {
    icon: Edit2,
    badgeClassName: 'bg-blue-500/10 text-blue-500',
    borderColor: '#3b82f6',
    label: 'Edited',
  },
  paused: {
    icon: Pause,
    badgeClassName: 'bg-amber-500/10 text-amber-500',
    borderColor: '#f59e0b',
    label: 'Paused',
  },
  resumed: {
    icon: Play,
    badgeClassName: 'bg-emerald-500/10 text-emerald-500',
    borderColor: '#10b981',
    label: 'Resumed',
  },
  snoozed: {
    icon: AlarmClock,
    badgeClassName: 'bg-blue-500/10 text-blue-500',
    borderColor: '#3b82f6',
    label: 'Snoozed',
  },
  skipped: {
    icon: SkipForward,
    badgeClassName: 'bg-orange-500/10 text-orange-500',
    borderColor: '#f97316',
    label: 'Skipped',
  },
  canceled: {
    icon: X,
    badgeClassName: 'bg-red-500/10 text-red-500',
    borderColor: '#ef4444',
    label: 'Canceled',
  },
  delivered: {
    icon: CheckCircle,
    badgeClassName: 'bg-emerald-500/10 text-emerald-500',
    borderColor: '#10b981',
    label: 'Delivered',
  },
  no_answer: {
    icon: PhoneMissed,
    badgeClassName: 'bg-amber-500/10 text-amber-500',
    borderColor: '#f59e0b',
    label: 'No Answer',
  },
  failed: {
    icon: AlertTriangle,
    badgeClassName: 'bg-red-500/10 text-red-500',
    borderColor: '#ef4444',
    label: 'Failed',
  },
};

const TRIGGER_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  voice: 'Ultaura',
  system: 'System',
};

interface ReminderActivityProps {
  lineId: string;
  lineTimezone: string;
  initialEvents?: ReminderEventRow[];
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatEventTimestamp(isoString: string, timezone: string): string {
  return DateTime.fromISO(isoString)
    .setZone(timezone)
    .toFormat('MMM d, h:mm a');
}

function formatEventDetails(event: ReminderEventRow): string | null {
  if (!event.metadata) return null;

  const meta = event.metadata as Record<string, unknown>;

  switch (event.event_type) {
    case 'snoozed':
      if (meta.snoozeMinutes) {
        const mins = meta.snoozeMinutes as number;
        if (mins >= 1440) return 'until tomorrow';
        if (mins >= 60) return `for ${Math.floor(mins / 60)}h`;
        return `for ${mins}m`;
      }
      break;
    case 'edited':
      const changes: string[] = [];
      if (meta.oldValues && typeof meta.oldValues === 'object') {
        const oldVals = meta.oldValues as Record<string, unknown>;
        const messageChanged = meta.messageChanged ||
          meta.oldMessageLength !== undefined ||
          meta.newMessageLength !== undefined ||
          oldVals.messageChanged !== undefined ||
          oldVals.oldMessageLength !== undefined ||
          oldVals.newMessageLength !== undefined;
        if (messageChanged) changes.push('message');
        if (oldVals.dueAt !== undefined) changes.push('time');
        if (oldVals.isRecurring !== undefined) changes.push('recurrence');
      }
      if (changes.length > 0) return `(${changes.join(', ')})`;
      break;
    case 'skipped':
      if (meta.nextDueAt) {
        const nextDate = new Date(meta.nextDueAt as string);
        return `→ ${nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      }
      break;
  }

  return null;
}

function getTriggerLabel(triggeredBy: string): string {
  return TRIGGER_LABELS[triggeredBy] ?? formatLabel(triggeredBy);
}

export function ReminderActivity({ lineId, lineTimezone, initialEvents }: ReminderActivityProps) {
  const [events, setEvents] = useState<ReminderEventRow[]>(initialEvents || []);
  const [isLoading, setIsLoading] = useState(!initialEvents);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    const data = await getLineReminderEvents(lineId, 50);
    setEvents(data);
    setIsLoading(false);
  }, [lineId]);

  useEffect(() => {
    if (!initialEvents) {
      loadEvents();
    }
  }, [initialEvents, loadEvents]);

  if (isLoading) {
    return (
      <div className={CARD_SHELL_CLASS}>
        <div className="flex items-center justify-center gap-2 px-6 py-10 text-sm text-muted-foreground">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Loading activity...
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={CARD_SHELL_CLASS}>
        <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">No activity yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Reminder history will appear here once reminders are created, delivered, edited, or updated.
          </p>
        </div>
      </div>
    );
  }

  const displayedEvents = isExpanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5;

  return (
    <div className={CARD_SHELL_CLASS}>
      <div className="divide-y divide-border">
        {displayedEvents.map((event) => {
          const config = EVENT_CONFIG[event.event_type] || {
            icon: Clock,
            badgeClassName: 'bg-muted text-muted-foreground',
            borderColor: 'var(--primary)',
            label: formatLabel(event.event_type),
          };
          const Icon = config.icon;
          const details = formatEventDetails(event);

          return (
            <div
              key={event.id}
              className="border-l-4 px-5 py-4 sm:px-6"
              style={{ borderLeftColor: config.borderColor }}
            >
              <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
                <div
                  className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${config.badgeClassName}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {config.label}
                      </span>
                      {details ? (
                        <span className="inline-flex items-center rounded-full border border-border/60 bg-background/40 px-2 py-0.5 text-xs text-muted-foreground">
                          {details}
                        </span>
                      ) : null}
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                      via <span className="font-medium text-primary">{getTriggerLabel(event.triggered_by)}</span>
                    </span>
                  </div>

                  {event.reminder_message ? (
                    <div className="mt-1.5">
                      <p className="min-w-0 line-clamp-2 text-sm text-foreground">
                        &ldquo;{event.reminder_message}&rdquo;
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-1.5 hidden items-center justify-between gap-3 sm:flex">
                    <p className="shrink-0 text-xs text-primary">
                      {formatEventTimestamp(event.created_at, lineTimezone)}
                    </p>
                  </div>
                </div>

                <div className="mt-1.5 flex basis-full items-center justify-between gap-3 text-xs sm:hidden">
                  <p className="shrink-0 text-primary">
                    {formatEventTimestamp(event.created_at, lineTimezone)}
                  </p>
                  <span className="shrink-0 text-muted-foreground">
                    via <span className="font-medium text-primary">{getTriggerLabel(event.triggered_by)}</span>
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-border px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              View {events.length - 5} more events <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
