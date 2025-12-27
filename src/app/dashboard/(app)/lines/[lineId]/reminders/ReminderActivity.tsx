'use client';

import { useState, useEffect } from 'react';
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
import type { ReminderEventRow } from '~/lib/ultaura/actions';
import { getLineReminderEvents } from '~/lib/ultaura/actions';

const EVENT_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  created: { icon: Plus, color: 'text-green-600', label: 'Created' },
  edited: { icon: Edit2, color: 'text-blue-600', label: 'Edited' },
  paused: { icon: Pause, color: 'text-yellow-600', label: 'Paused' },
  resumed: { icon: Play, color: 'text-green-600', label: 'Resumed' },
  snoozed: { icon: AlarmClock, color: 'text-blue-600', label: 'Snoozed' },
  skipped: { icon: SkipForward, color: 'text-orange-600', label: 'Skipped' },
  canceled: { icon: X, color: 'text-red-600', label: 'Canceled' },
  delivered: { icon: CheckCircle, color: 'text-green-600', label: 'Delivered' },
  no_answer: { icon: PhoneMissed, color: 'text-yellow-600', label: 'No Answer' },
  failed: { icon: AlertTriangle, color: 'text-red-600', label: 'Failed' },
};

const TRIGGER_LABELS: Record<string, string> = {
  dashboard: 'via Dashboard',
  voice: 'via Phone',
  system: 'by System',
};

interface ReminderActivityProps {
  lineId: string;
  initialEvents?: ReminderEventRow[];
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
        if (oldVals.message !== undefined) changes.push('message');
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

export function ReminderActivity({ lineId, initialEvents }: ReminderActivityProps) {
  const [events, setEvents] = useState<ReminderEventRow[]>(initialEvents || []);
  const [isLoading, setIsLoading] = useState(!initialEvents);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!initialEvents) {
      loadEvents();
    }
  }, [lineId, initialEvents]);

  async function loadEvents() {
    setIsLoading(true);
    const data = await getLineReminderEvents(lineId, 50);
    setEvents(data);
    setIsLoading(false);
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <span className="inline-block w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
        Loading activity...
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No activity yet
      </div>
    );
  }

  const displayedEvents = isExpanded ? events : events.slice(0, 5);
  const hasMore = events.length > 5;

  return (
    <div className="border border-input rounded-lg bg-card">
      <div className="px-4 py-3 border-b border-input">
        <h3 className="font-medium text-sm">Recent Activity</h3>
      </div>

      <div className="divide-y divide-input">
        {displayedEvents.map((event) => {
          const config = EVENT_CONFIG[event.event_type] || {
            icon: Clock,
            color: 'text-muted-foreground',
            label: event.event_type,
          };
          const Icon = config.icon;
          const details = formatEventDetails(event);

          return (
            <div key={event.id} className="px-4 py-3 flex items-start gap-3">
              <div className={`mt-0.5 ${config.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{config.label}</span>
                  {details && (
                    <span className="text-xs text-muted-foreground">{details}</span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {TRIGGER_LABELS[event.triggered_by]}
                  </span>
                </div>
                {event.reminder_message && (
                  <p className="text-sm text-foreground mt-0.5 truncate">
                    &ldquo;{event.reminder_message}&rdquo;
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatRelativeTime(event.created_at)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-1 border-t border-input"
        >
          {isExpanded ? (
            <>
              Show less <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show {events.length - 5} more <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
