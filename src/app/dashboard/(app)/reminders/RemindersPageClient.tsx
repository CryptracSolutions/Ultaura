'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Bell,
  Plus,
  Clock,
  X,
  CheckCircle,
  AlertCircle,
  XCircle,
  Repeat,
} from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { cancelReminder } from '~/lib/ultaura/actions';
import { getShortLineId } from '~/lib/ultaura';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';

interface Reminder {
  reminderId: string;
  lineId: string;
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

export function RemindersPageClient({ lines, reminders }: RemindersPageClientProps) {
  const router = useRouter();
  const [reminderToCancel, setReminderToCancel] = useState<string | null>(null);

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

    const result = await cancelReminder(reminderToCancel);
    if (!result.success) {
      toast.error(result.error || 'Failed to cancel reminder');
      throw new Error('Cancel failed');
    }
    toast.success('Reminder canceled');
    router.refresh();
  };

  const formatDateTime = (isoString: string, timezone: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    });
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
      {/* Add Reminder Buttons */}
      {lines.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-medium text-foreground mb-4">Add a new reminder</h2>
          <div className="flex flex-wrap gap-3">
            {lines.map((line) => (
              <Link
                key={line.id}
                href={`/dashboard/lines/${getShortLineId(line.id)}/reminders`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add for {line.display_name}
              </Link>
            ))}
          </div>
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
          <Link
            href="/dashboard/lines"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add a Phone Line
          </Link>
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
                      href={`/dashboard/lines/${getShortLineId(line.id)}/reminders`}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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
                      <Link
                        href={`/dashboard/lines/${getShortLineId(line.id)}/reminders`}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create your first reminder
                      </Link>
                    </div>
                  ) : (
                    <>
                      {/* Scheduled reminders first */}
                      {scheduledReminders.map((reminder) => (
                        <ReminderRow
                          key={reminder.reminderId}
                          reminder={reminder}
                          onCancel={() => setReminderToCancel(reminder.reminderId)}
                          formatDateTime={formatDateTime}
                          formatRelativeTime={formatRelativeTime}
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
                        />
                      ))}
                      {pastReminders.length > 5 && (
                        <div className="px-6 py-3 text-center">
                          <Link
                            href={`/dashboard/lines/${getShortLineId(line.id)}/reminders`}
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
    </div>
  );
}

interface ReminderRowProps {
  reminder: Reminder;
  onCancel: () => void;
  formatDateTime: (isoString: string, timezone: string) => string;
  formatRelativeTime: (isoString: string) => string;
  isPast?: boolean;
}

function ReminderRow({
  reminder,
  onCancel,
  formatDateTime,
  formatRelativeTime,
  isPast = false,
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
              {formatDateTime(reminder.dueAt, reminder.timezone)}
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

      {reminder.status === 'scheduled' && (
        <button
          onClick={onCancel}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          title="Cancel reminder"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
