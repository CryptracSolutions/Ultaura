'use client';

import {
  CheckCircle,
  PauseCircle,
  CalendarClock,
  Edit2,
  Pause,
  Play,
  Trash2,
} from 'lucide-react';
import { formatTime } from '~/lib/ultaura/constants';
import { formatDaySummary, formatNextRunAt } from '~/lib/ultaura/schedule-utils';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';

interface ScheduleCardProps {
  schedule: {
    scheduleId: string;
    lineId: string;
    lineShortId: string;
    displayName: string;
    enabled: boolean;
    nextRunAt: string | null;
    timeOfDay: string;
    daysOfWeek: number[];
    isOneTime: boolean;
    rescheduledFrom?: string | null;
    lineTimezone: string;
  };
  showLineName?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onEdit?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}

const STATUS_BORDER_COLORS = {
  active: 'var(--primary)',
  paused: 'var(--warning)',
  oneTime: 'var(--info)',
};

function getBorderColor(schedule: ScheduleCardProps['schedule']): string {
  if (schedule.isOneTime) return STATUS_BORDER_COLORS.oneTime;
  if (!schedule.enabled) return STATUS_BORDER_COLORS.paused;
  return STATUS_BORDER_COLORS.active;
}

export function ScheduleCard({
  schedule,
  showLineName,
  disabled,
  loading,
  onEdit,
  onToggle,
  onDelete,
}: ScheduleCardProps) {
  const isOneTime = schedule.isOneTime;
  const nextCallLabel = formatNextRunAt(schedule.nextRunAt, schedule.lineTimezone);
  const borderColor = getBorderColor(schedule);

  let StatusIcon = CheckCircle;
  let iconBg = 'bg-primary/10';
  let iconColor = 'text-primary';

  if (isOneTime) {
    StatusIcon = CalendarClock;
    iconBg = 'bg-blue-100 dark:bg-blue-900/30';
    iconColor = 'text-blue-600 dark:text-blue-400';
  } else if (!schedule.enabled) {
    StatusIcon = PauseCircle;
    iconBg = 'bg-muted';
    iconColor = 'text-muted-foreground';
  }

  const sheetTitle = isOneTime
    ? `One-time call\nScheduled: ${nextCallLabel || 'TBD'}`
    : [
        formatTime(schedule.timeOfDay),
        formatDaySummary(schedule.daysOfWeek),
        schedule.enabled && nextCallLabel ? `Next: ${nextCallLabel}` : null,
      ]
        .filter(Boolean)
        .join('\n');

  const actions = [];
  if (!isOneTime && onEdit) {
    actions.push({
      label: 'Edit',
      icon: <Edit2 className="w-5 h-5" />,
      onClick: onEdit,
    });
  }
  if (!isOneTime && onToggle) {
    actions.push({
      label: schedule.enabled ? 'Pause' : 'Resume',
      icon: schedule.enabled ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />,
      onClick: onToggle,
    });
  }
  if (onDelete) {
    actions.push({
      label: 'Delete',
      icon: <Trash2 className="w-5 h-5" />,
      onClick: onDelete,
      variant: 'destructive' as const,
      separator: actions.length > 0,
    });
  }

  return (
    <div
      className={`border-l-4 px-6 py-4 flex items-center justify-between gap-4 ${
        !schedule.enabled ? 'opacity-60' : ''
      }`}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <StatusIcon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-foreground">
              {isOneTime ? 'One-time call' : formatTime(schedule.timeOfDay)}
            </p>
            {isOneTime && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                One-time
              </span>
            )}
            {!schedule.enabled && !isOneTime && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Paused
              </span>
            )}
          </div>
          {isOneTime ? (
            <p className="text-sm text-muted-foreground truncate">
              Scheduled: {nextCallLabel || 'TBD'}
            </p>
          ) : (
            <div className="space-y-0.5">
              <p className="text-sm text-muted-foreground">
                {formatDaySummary(schedule.daysOfWeek)}
              </p>
              {schedule.enabled && nextCallLabel && (
                <p className="text-sm text-muted-foreground">
                  Next: {nextCallLabel}
                </p>
              )}
            </div>
          )}
          {isOneTime && schedule.rescheduledFrom && (
            <p className="text-xs text-muted-foreground">{schedule.rescheduledFrom}</p>
          )}
          {showLineName && (
            <p className="text-xs text-muted-foreground">{schedule.displayName}</p>
          )}
        </div>
      </div>

      {!disabled && actions.length > 0 && (
        <ResponsiveActionMenu
          title={sheetTitle}
          actions={actions}
          disabled={loading}
          loading={loading}
        />
      )}
    </div>
  );
}
