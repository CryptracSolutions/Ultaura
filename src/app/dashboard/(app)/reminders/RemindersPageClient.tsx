'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Bell,
  Plus,
  Clock,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Repeat,
} from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { cancelReminder } from '~/lib/ultaura/reminders';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { AddReminderModal } from '~/components/ultaura/AddReminderModal';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import Button from '~/core/ui/Button';

interface Reminder {
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
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getOrdinalSuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatRecurrence(reminder: Reminder): string {
  if (!reminder.isRecurring || !reminder.rrule) return '';

  if (reminder.rrule.includes('FREQ=DAILY')) {
    const interval = reminder.intervalDays || 1;
    return interval === 1 ? 'Daily' : `Every ${interval} days`;
  }

  if (reminder.rrule.includes('FREQ=WEEKLY')) {
    if (reminder.daysOfWeek && reminder.daysOfWeek.length > 0) {
      const days = reminder.daysOfWeek.map(d => DAY_NAMES[d]).join(', ');
      return `Weekly on ${days}`;
    }
    return 'Weekly';
  }

  if (reminder.rrule.includes('FREQ=MONTHLY')) {
    const day = reminder.dayOfMonth || 1;
    return `Monthly on the ${day}${getOrdinalSuffix(day)}`;
  }

  return 'Recurring';
}

interface RemindersPageClientProps {
  lines: LineRow[];
  reminders: Reminder[];
  disabled?: boolean;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  scheduled: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    icon: Clock,
    label: 'Scheduled',
  },
  sent: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    icon: CheckCircle,
    label: 'Delivered',
  },
  missed: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: AlertCircle,
    label: 'Missed',
  },
  canceled: {
    color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
    icon: XCircle,
    label: 'Canceled',
  },
};

export function RemindersPageClient({ lines, reminders, disabled = false }: RemindersPageClientProps) {
  const router = useRouter();
  const [reminderToCancel, setReminderToCancel] = useState<{
    reminderId: string;
    lineShortId: string;
  } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);

  // Map LineRow to LineForReminderModal
  const linesForModal = lines.map((line) => ({
    id: line.id,
    displayName: line.display_name,
    timezone: line.timezone,
    phoneE164: line.phone_e164,
  }));
  const lineTimezoneById = lines.reduce((acc, line) => {
    acc[line.id] = line.timezone;
    return acc;
  }, {} as Record<string, string>);

  const handleOpenForLine = (lineId: string) => {
    setPreselectedLineId(lineId);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setPreselectedLineId(null);
  };

  // Group reminders by line
  const remindersByLine = reminders.reduce((acc, reminder) => {
    if (!acc[reminder.lineId]) {
      acc[reminder.lineId] = [];
    }
    acc[reminder.lineId].push(reminder);
    return acc;
  }, {} as Record<string, Reminder[]>);

  const handleCancelReminder = async () => {
    if (!reminderToCancel) return;
    if (disabled) return;

    const result = await cancelReminder(reminderToCancel.reminderId, reminderToCancel.lineShortId);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to cancel reminder');
      throw new Error('Cancel failed');
    }
    toast.success('Reminder canceled');
    router.refresh();
  };

  const formatDateTime = (isoString: string, lineId: string, fallbackTimezone: string) => {
    const date = new Date(isoString);
    const resolvedTimezone = lineTimezoneById[lineId] ?? fallbackTimezone;
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    };
    if (resolvedTimezone) {
      options.timeZone = resolvedTimezone;
    }
    return date.toLocaleString('en-US', options);
  };

  const formatRelativeTime = (isoString: string) => {
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
  };

  // Count scheduled reminders
  const scheduledCount = reminders.filter((r) => r.status === 'scheduled').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Set Reminder Button */}
      {!disabled && lines.length > 0 && (
        <div>
          <Button
            variant="default"
            size="small"
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="w-3 h-3" />
            Set Reminder
          </Button>
        </div>
      )}

      {/* No lines state */}
      {lines.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No phone lines yet</h2>
          <p className="text-muted-foreground mb-4">
            Add a phone line first, then you can set up reminders.
          </p>
          {!disabled && (
            <Button
              variant="default"
              size="small"
              href="/dashboard/lines?action=add"
              block
            >
              <Plus className="w-3 h-3" />
              Add a Phone Line
            </Button>
          )}
        </div>
      )}

      {/* Reminders grouped by line */}
      {lines.length > 0 && (
        <div className="space-y-6">
          {lines.map((line) => {
            const lineReminders = remindersByLine[line.id] || [];
            const scheduledReminders = lineReminders.filter((r) => r.status === 'scheduled');
            const pastReminders = lineReminders.filter((r) => r.status !== 'scheduled');

            return (
              <div key={line.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Line Header */}
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{line.display_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {scheduledReminders.length === 0
                          ? 'No upcoming reminders'
                          : `${scheduledReminders.length} upcoming`}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/lines/${line.short_id}/reminders`}
                      className="text-sm text-primary hover:underline"
                    >
                      View all
                    </Link>
                  </div>
                </div>

                {/* Reminders */}
                <div className="divide-y divide-border">
                  {lineReminders.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No reminders set up yet</p>
                      {!disabled && (
                        <div className="mt-2">
                          <Button
                            variant="default"
                            size="small"
                            onClick={() => handleOpenForLine(line.id)}
                            block
                          >
                            <Plus className="w-3 h-3" />
                            Create your first reminder
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Scheduled reminders first */}
                      {scheduledReminders.map((reminder) => (
                        <ReminderRow
                          key={reminder.reminderId}
                          reminder={reminder}
                          onCancel={() => setReminderToCancel({
                            reminderId: reminder.reminderId,
                            lineShortId: reminder.lineShortId,
                          })}
                          formatDateTime={formatDateTime}
                          formatRelativeTime={formatRelativeTime}
                          disabled={disabled}
                        />
                      ))}

                      {/* Past reminders */}
                      {pastReminders.length > 0 && scheduledReminders.length > 0 && (
                        <div className="px-6 py-2 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Past
                          </p>
                        </div>
                      )}
                      {pastReminders.slice(0, 5).map((reminder) => (
                        <ReminderRow
                          key={reminder.reminderId}
                          reminder={reminder}
                          onCancel={() => {}}
                          formatDateTime={formatDateTime}
                          formatRelativeTime={formatRelativeTime}
                          isPast
                          disabled
                        />
                      ))}
                      {pastReminders.length > 5 && (
                        <div className="px-6 py-3 text-center">
                          <Link
                            href={`/dashboard/lines/${line.short_id}/reminders`}
                            className="text-sm text-primary hover:underline"
                          >
                            View all {pastReminders.length} past reminders
                          </Link>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        open={reminderToCancel !== null}
        onOpenChange={(open) => !open && setReminderToCancel(null)}
        title="Cancel Reminder"
        description="Are you sure you want to cancel this reminder?"
        confirmLabel="Cancel Reminder"
        variant="destructive"
        onConfirm={handleCancelReminder}
      />

      <AddReminderModal
        open={showAddModal}
        onOpenChange={handleCloseModal}
        lines={linesForModal}
        preselectedLineId={preselectedLineId}
      />
    </div>
  );
}

interface ReminderRowProps {
  reminder: Reminder;
  onCancel: () => void;
  formatDateTime: (isoString: string, lineId: string, fallbackTimezone: string) => string;
  formatRelativeTime: (isoString: string) => string;
  isPast?: boolean;
  disabled?: boolean;
}

function ReminderRow({
  reminder,
  onCancel,
  formatDateTime,
  formatRelativeTime,
  isPast = false,
  disabled = false,
}: ReminderRowProps) {
  const statusConfig = STATUS_CONFIG[reminder.status];
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className={`px-6 py-4 flex items-start justify-between gap-4 ${
        isPast ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            reminder.status === 'scheduled' ? 'bg-primary/10' : 'bg-muted'
          }`}
        >
          <StatusIcon
            className={`w-5 h-5 ${
              reminder.status === 'scheduled' ? 'text-primary' : 'text-muted-foreground'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground line-clamp-2">{reminder.message}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm">
            <span className="text-muted-foreground">
              {formatDateTime(reminder.dueAt, reminder.lineId, reminder.timezone)}
            </span>
            {reminder.status === 'scheduled' && (
              <span className="text-primary font-medium">
                {formatRelativeTime(reminder.dueAt)}
              </span>
            )}
            {reminder.isRecurring && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-medium">
                <Repeat className="w-3 h-3" />
                {formatRecurrence(reminder)}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}
            >
              {statusConfig.label}
            </span>
          </div>
        </div>
      </div>

      {reminder.status === 'scheduled' && !disabled && (
        <ResponsiveActionMenu
          title={reminder.message.slice(0, 30) + (reminder.message.length > 30 ? '...' : '')}
          actions={[
            {
              label: 'Edit',
              icon: <Edit2 className="w-5 h-5" />,
              onClick: () => {
                window.location.href = `/dashboard/lines/${reminder.lineShortId}/reminders?edit=${reminder.reminderId}`;
              },
            },
            {
              label: 'Cancel',
              icon: <Trash2 className="w-5 h-5" />,
              onClick: onCancel,
              variant: 'destructive' as const,
              separator: true,
            },
          ]}
        />
      )}
    </div>
  );
}
