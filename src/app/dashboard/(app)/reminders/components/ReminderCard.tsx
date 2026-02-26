'use client';

import {
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Pause,
  Play,
  AlarmClock,
  Edit2,
  SkipForward,
  X,
  Repeat,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import type { ActionItem } from '~/components/ultaura/ResponsiveActionMenu';
import { formatRecurrence, SNOOZE_OPTIONS } from '~/lib/ultaura/reminder-utils';

export interface ReminderCardReminder {
  reminderId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
  message: string;
  dueAt: string;
  timezone: string;
  status: 'scheduled' | 'sent' | 'missed' | 'canceled';
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  isPaused: boolean;
  currentSnoozeCount: number;
  snoozedUntil: string | null;
  lineTimezone: string;
  linePhoneE164: string;
  deliveryMethod?: 'outbound_call' | 'sms' | null;
}

export interface ReminderCardProps {
  reminder: ReminderCardReminder;
  showLineName?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onEdit: (reminder: ReminderCardReminder) => void;
  onPause: (reminderId: string) => void;
  onResume: (reminderId: string) => void;
  onSnooze: (reminderId: string, minutes: number) => void;
  onSkip: (reminderId: string) => void;
  onCancel: (reminderId: string) => void;
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; iconColor: string; icon: React.ElementType; label: string }
> = {
  scheduled: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-800 dark:text-blue-300',
    icon: Clock,
    label: 'Scheduled',
  },
  sent: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-800 dark:text-green-300',
    icon: CheckCircle,
    label: 'Delivered',
  },
  missed: {
    bg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-800 dark:text-red-300',
    icon: AlertCircle,
    label: 'Missed',
  },
  canceled: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    iconColor: 'text-gray-800 dark:text-gray-300',
    icon: XCircle,
    label: 'Canceled',
  },
};

const PAUSED_CONFIG = {
  bg: 'bg-yellow-100 dark:bg-yellow-900/30',
  iconColor: 'text-yellow-800 dark:text-yellow-300',
  icon: Pause,
};

const SNOOZED_CONFIG = {
  bg: 'bg-blue-100 dark:bg-blue-900/30',
  iconColor: 'text-blue-800 dark:text-blue-300',
  icon: AlarmClock,
};

function formatDateTime(isoString: string, timezone: string): string {
  const date = new Date(isoString);
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  if (timezone) {
    options.timeZone = timezone;
  }
  return date.toLocaleString('en-US', options);
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return 'Past due';
  if (diff < 60 * 60 * 1000) {
    const mins = Math.round(diff / (60 * 1000));
    return `In ${mins} min${mins !== 1 ? 's' : ''}`;
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.round(diff / (60 * 60 * 1000));
    return `In ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (diff < 48 * 60 * 60 * 1000) {
    return 'Tomorrow';
  }
  const days = Math.round(diff / (24 * 60 * 60 * 1000));
  return `In ${days} days`;
}

function getEffectiveIcon(reminder: ReminderCardReminder) {
  if (reminder.isPaused) return PAUSED_CONFIG;
  if (reminder.snoozedUntil && reminder.status === 'scheduled') return SNOOZED_CONFIG;
  const config = STATUS_CONFIG[reminder.status];
  return { bg: config.bg, iconColor: config.iconColor, icon: config.icon };
}

function getDeliveryMethodBadge(reminder: ReminderCardReminder) {
  const deliveryMethod = reminder.deliveryMethod ?? 'outbound_call';

  if (deliveryMethod === 'sms') {
    return {
      label: 'SMS',
      icon: MessageSquare,
    };
  }

  return {
    label: 'Call',
    icon: Phone,
  };
}

function buildActions(
  reminder: ReminderCardReminder,
  props: Pick<ReminderCardProps, 'onEdit' | 'onPause' | 'onResume' | 'onSnooze' | 'onSkip' | 'onCancel'>,
): ActionItem[] {
  const actions: ActionItem[] = [
    {
      label: 'Edit',
      icon: <Edit2 className="w-5 h-5" />,
      onClick: () => props.onEdit(reminder),
    },
  ];

  if (reminder.isPaused) {
    actions.push({
      label: 'Resume',
      icon: <Play className="w-5 h-5" />,
      onClick: () => props.onResume(reminder.reminderId),
    });
  } else {
    actions.push({
      label: 'Pause',
      icon: <Pause className="w-5 h-5" />,
      onClick: () => props.onPause(reminder.reminderId),
    });
  }

  const canSnooze = !reminder.isPaused && reminder.currentSnoozeCount < 3;
  if (canSnooze) {
    actions.push({
      label: 'Snooze',
      icon: <AlarmClock className="w-5 h-5" />,
      subItems: SNOOZE_OPTIONS.map((o) => ({
        label: o.label,
        onClick: () => props.onSnooze(reminder.reminderId, o.value),
      })),
    });
  }

  const canSkip = reminder.isRecurring && !reminder.isPaused;
  if (canSkip) {
    actions.push({
      label: 'Skip next',
      icon: <SkipForward className="w-5 h-5" />,
      onClick: () => props.onSkip(reminder.reminderId),
    });
  }

  actions.push({
    label: reminder.isRecurring ? 'Cancel series' : 'Cancel',
    icon: <X className="w-5 h-5" />,
    onClick: () => props.onCancel(reminder.reminderId),
    variant: 'destructive' as const,
    separator: true,
  });

  return actions;
}

export function ReminderCard({
  reminder,
  showLineName = false,
  disabled = false,
  loading = false,
  onEdit,
  onPause,
  onResume,
  onSnooze,
  onSkip,
  onCancel,
}: ReminderCardProps) {
  const isPast = reminder.status !== 'scheduled';
  const statusConfig = STATUS_CONFIG[reminder.status];
  const effective = getEffectiveIcon(reminder);
  const EffectiveIcon = effective.icon;
  const deliveryBadge = getDeliveryMethodBadge(reminder);
  const DeliveryIcon = deliveryBadge.icon;

  return (
    <div
      className={`px-6 py-4 flex items-start justify-between gap-4 ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        {/* Circular status icon */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${effective.bg}`}
        >
          <EffectiveIcon className={`w-5 h-5 ${effective.iconColor}`} />
        </div>

        <div className="min-w-0 flex-1">
          {/* Line name label */}
          {showLineName && (
            <p className="text-xs text-muted-foreground mb-1">
              {reminder.displayName}
            </p>
          )}

          {/* Message */}
          <p className="text-foreground line-clamp-2">{reminder.message}</p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
            {/* DateTime */}
            <span className="text-muted-foreground">
              {formatDateTime(reminder.dueAt, reminder.lineTimezone)}
            </span>

            {/* Relative time badge */}
            {!isPast && (
              <span className="text-primary font-medium">
                {formatRelativeTime(reminder.dueAt)}
              </span>
            )}

            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              <DeliveryIcon className="h-3 w-3" aria-hidden="true" />
              {deliveryBadge.label}
            </span>

            {/* Recurrence badge */}
            {reminder.isRecurring && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-medium">
                <Repeat className="w-3 h-3" />
                {formatRecurrence(reminder)}
              </span>
            )}

            {/* Paused badge */}
            {reminder.isPaused && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-medium">
                <Pause className="w-3 h-3" />
                Paused
              </span>
            )}

            {/* Snoozed badge */}
            {reminder.snoozedUntil && !reminder.isPaused && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                <AlarmClock className="w-3 h-3" />
                Snoozed ({reminder.currentSnoozeCount}/3)
              </span>
            )}

            {/* Status badge */}
            {!reminder.isPaused && (
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.bg} ${statusConfig.iconColor}`}
              >
                {statusConfig.label}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action menu for scheduled (active) reminders only */}
      {!isPast && !disabled && (
        <ResponsiveActionMenu
          title={reminder.message}
          loading={loading}
          actions={buildActions(reminder, {
            onEdit,
            onPause,
            onResume,
            onSnooze,
            onSkip,
            onCancel,
          })}
        />
      )}
    </div>
  );
}
