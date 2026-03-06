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
import { formatDaySummary, formatDaySummaryFull, formatNextRunAt } from '~/lib/ultaura/schedule-utils';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import {
  ResponsiveDetailsButton,
  type DetailItem,
} from '~/components/ultaura/ResponsiveDetailsButton';

interface ScheduleCardProps {
  schedule: {
    scheduleId: string;
    lineId: string;
    lineShortId: string;
    displayName: string;
    lineVoiceName: string | null;
    enabled: boolean;
    nextRunAt: string | null;
    timeOfDay: string;
    daysOfWeek: number[];
    isOneTime: boolean;
    rescheduledFrom?: string | null;
    lineTimezone: string;
  };
  title?: string;
  showLineName?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onEdit?: () => void;
  onToggle?: () => void;
  onDelete?: () => void;
}

const STATUS_BORDER_COLORS = {
  active: '#3b82f6',
  paused: '#f59e0b',
  oneTime: '#6366f1',
};

const STATUS_CONFIG: Record<
  string,
  { bg: string; iconColor: string; icon: React.ElementType; label: string }
> = {
  active: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-800 dark:text-blue-300',
    icon: CheckCircle,
    label: 'Active',
  },
  paused: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-800 dark:text-yellow-300',
    icon: PauseCircle,
    label: 'Paused',
  },
  oneTime: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-800 dark:text-indigo-300',
    icon: CalendarClock,
    label: 'One-time',
  },
};

function getBorderColor(schedule: ScheduleCardProps['schedule']): string {
  if (schedule.isOneTime) return STATUS_BORDER_COLORS.oneTime;
  if (!schedule.enabled) return STATUS_BORDER_COLORS.paused;
  return STATUS_BORDER_COLORS.active;
}

function getStatusConfig(schedule: ScheduleCardProps['schedule']) {
  if (schedule.isOneTime) return STATUS_CONFIG.oneTime;
  if (!schedule.enabled) return STATUS_CONFIG.paused;
  return STATUS_CONFIG.active;
}

function formatTimezoneAbbr(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(new Date());
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
  } catch {
    return timezone;
  }
}

function buildDetails(schedule: ScheduleCardProps['schedule']): DetailItem[] {
  const details: DetailItem[] = [];
  const statusLabel = schedule.isOneTime ? 'One-time' : schedule.enabled ? 'Active' : 'Paused';
  details.push({ label: 'Status', value: statusLabel });
  const nextCall = formatNextRunAt(schedule.nextRunAt, schedule.lineTimezone);
  if (nextCall) {
    details.push({ label: 'Next call', value: nextCall });
  }
  details.push({ label: 'Timezone', value: formatTimezoneAbbr(schedule.lineTimezone) });
  return details;
}

export function ScheduleCard({
  schedule,
  title,
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
  const config = getStatusConfig(schedule);
  const StatusIcon = config.icon;
  const timeStr = formatTime(schedule.timeOfDay);
  const daysStr = formatDaySummaryFull(schedule.daysOfWeek);

  const sheetTitle = isOneTime
    ? `One-time call${schedule.lineVoiceName ? ` with ${schedule.lineVoiceName}` : ''}\nScheduled: ${nextCallLabel || 'TBD'}`
    : `${timeStr}\n${daysStr}${schedule.lineVoiceName ? `\nwith ${schedule.lineVoiceName}` : ''}`;

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
      className={`border-l-4 px-6 py-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${
        !schedule.enabled ? 'opacity-60' : ''
      }`}
      style={{ borderLeftColor: borderColor }}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}
        >
          <StatusIcon className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          {showLineName && (
            <p className="text-xs text-muted-foreground mb-1">{schedule.displayName}</p>
          )}
          {title && (
            <p className="text-sm font-medium text-foreground mb-1">{title}</p>
          )}
          <div className="flex flex-col items-start gap-0.5">
            {isOneTime ? (
              <>
                <p className="text-sm text-foreground font-medium">One-time call</p>
                {schedule.lineVoiceName && (
                  <p className="text-xs text-muted-foreground">
                    with <span className="text-primary text-sm">{schedule.lineVoiceName}</span>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  at <span className="text-primary text-sm">{timeStr}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  on <span className="text-primary text-sm">{daysStr}</span>
                </p>
                {schedule.lineVoiceName && (
                  <p className="text-xs text-muted-foreground">
                    with <span className="text-primary text-sm">{schedule.lineVoiceName}</span>
                  </p>
                )}
              </>
            )}
          </div>
          {isOneTime ? (
            <div className="mt-1.5 flex flex-col items-start gap-1 text-xs sm:text-sm">
              <span className="text-muted-foreground">
                Scheduled: {nextCallLabel || 'TBD'}
              </span>
            </div>
          ) : null}
          {isOneTime && schedule.rescheduledFrom && (
            <p className="text-xs text-muted-foreground">{schedule.rescheduledFrom}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <ResponsiveDetailsButton
          title={sheetTitle}
          details={buildDetails(schedule)}
          label="Schedule details"
        />
        {!disabled && actions.length > 0 && (
          <ResponsiveActionMenu
            title={sheetTitle}
            actions={actions}
            disabled={loading}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
