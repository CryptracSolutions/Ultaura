'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, Plus, Clock, X, AlertCircle, Repeat, SkipForward, Pause, Play, Edit2, AlarmClock } from 'lucide-react';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';
import type { LineRow } from '~/lib/ultaura/types';
import type { ReminderRow } from '~/lib/ultaura/types';
import { cancelReminder, skipNextOccurrence, pauseReminder, resumeReminder, snoozeReminder, editReminder } from '~/lib/ultaura/reminders';
import { ReminderActivity } from './ReminderActivity';
import { CreateReminderForm } from '~/components/ultaura/CreateReminderForm';

const SNOOZE_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 1440, label: 'Tomorrow' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getOrdinalSuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatRecurrence(reminder: ReminderRow): string {
  if (!reminder.is_recurring || !reminder.rrule) return '';

  if (reminder.rrule.includes('FREQ=DAILY')) {
    const interval = reminder.interval_days || 1;
    return interval === 1 ? 'Daily' : `Every ${interval} days`;
  }

  if (reminder.rrule.includes('FREQ=WEEKLY')) {
    if (reminder.days_of_week && reminder.days_of_week.length > 0) {
      const days = reminder.days_of_week.map(d => DAY_NAMES[d]).join(', ');
      return `Weekly on ${days}`;
    }
    return 'Weekly';
  }

  if (reminder.rrule.includes('FREQ=MONTHLY')) {
    const day = reminder.day_of_month || 1;
    return `Monthly on the ${day}${getOrdinalSuffix(day)}`;
  }

  return 'Recurring';
}

interface RemindersClientProps {
  line: LineRow;
  reminders: ReminderRow[];
  disabled?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sent: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  missed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  canceled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  sent: 'Delivered',
  missed: 'Missed',
  canceled: 'Canceled',
};

export function RemindersClient({ line, reminders, disabled = false }: RemindersClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledEditIdRef = useRef<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [skippingId, setSkippingId] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [resumingId, setResumingId] = useState<string | null>(null);
  const [snoozingId, setSnoozingId] = useState<string | null>(null);
  const [snoozeDropdownId, setSnoozeDropdownId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reminderToCancel, setReminderToCancel] = useState<string | null>(null);

  // Edit modal state
  const [editingReminder, setEditingReminder] = useState<ReminderRow | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [initialEditState, setInitialEditState] = useState<{
    message: string;
    date: string;
    time: string;
  } | null>(null);

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
  };

  const discardEditChanges = () => {
    if (initialEditState) {
      setEditMessage(initialEditState.message);
      setEditDate(initialEditState.date);
      setEditTime(initialEditState.time);
    }
    setEditingReminder(null);
    setInitialEditState(null);
    setIsEditSubmitting(false);
  };

  const hasEditChanges =
    Boolean(editingReminder && initialEditState) &&
    (editMessage.trim() !== initialEditState!.message ||
      editDate !== initialEditState!.date ||
      editTime !== initialEditState!.time);
  const shouldWarnOnNavigate = hasEditChanges && !isEditSubmitting;
  const { dialogProps } = useLeavePageGuard({
    isDirty: shouldWarnOnNavigate,
    onDiscard: () => {
      discardEditChanges();
    },
  });

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: line.timezone,
    });
  };

  const handleSkip = async (reminderId: string) => {
    if (disabled) return;

    setSkippingId(reminderId);

    const result = await skipNextOccurrence(reminderId, line.short_id);

    setSkippingId(null);

    if (result.success) {
      toast.success('Next occurrence skipped');
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to skip reminder');
    }
  };

  const handleConfirmCancel = async () => {
    if (!reminderToCancel) return;
    if (disabled) return;

    setCancelingId(reminderToCancel);

    const result = await cancelReminder(reminderToCancel, line.short_id);

    setCancelingId(null);

    if (result.success) {
      toast.success('Reminder canceled');
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to cancel reminder');
      throw new Error('Cancel failed');
    }
  };

  const handlePause = async (reminderId: string) => {
    if (disabled) return;

    setPausingId(reminderId);

    const result = await pauseReminder(reminderId, line.short_id);

    setPausingId(null);

    if (result.success) {
      toast.success('Reminder paused');
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to pause reminder');
    }
  };

  const handleResume = async (reminderId: string) => {
    if (disabled) return;

    setResumingId(reminderId);

    const result = await resumeReminder(reminderId, line.short_id);

    setResumingId(null);

    if (result.success) {
      toast.success('Reminder resumed');
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to resume reminder');
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    if (disabled) return;

    setSnoozingId(reminderId);
    setSnoozeDropdownId(null);

    const result = await snoozeReminder(reminderId, minutes, line.short_id);

    setSnoozingId(null);

    if (result.success) {
      const option = SNOOZE_OPTIONS.find(o => o.value === minutes);
      toast.success(`Snoozed for ${option?.label || minutes + ' minutes'}`);
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to snooze reminder');
    }
  };

  const openEditModal = useCallback((reminder: ReminderRow) => {
    if (disabled) return;

    setEditingReminder(reminder);
    setEditMessage(reminder.message ?? '');
    // Parse the due_at to get date and time in local format
    const dueDate = new Date(reminder.due_at);
    const initialDate = dueDate.toISOString().split('T')[0];
    setEditDate(initialDate);
    const hours = dueDate.getHours().toString().padStart(2, '0');
    const minutes = dueDate.getMinutes().toString().padStart(2, '0');
    const initialTime = `${hours}:${minutes}`;
    setEditTime(initialTime);
    setInitialEditState({
      message: reminder.message ?? '',
      date: initialDate,
      time: initialTime,
    });
  }, [disabled]);

  // Allow deep-linking into the edit modal (e.g. from the global reminders list)
  useEffect(() => {
    if (disabled) return;

    const editId = searchParams.get('edit');
    if (!editId) {
      handledEditIdRef.current = null;
      return;
    }

    if (handledEditIdRef.current === editId) return;
    handledEditIdRef.current = editId;

    const reminder = reminders.find((r) => r.id === editId);
    if (!reminder) return;

    openEditModal(reminder);

    // Clean up the URL so refresh/back doesn't keep reopening
    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const nextUrl = next.toString() ? `${pathname}?${next}` : pathname;
    router.replace(nextUrl);
  }, [disabled, openEditModal, pathname, reminders, router, searchParams]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;
    if (disabled) return;

    setIsEditSubmitting(true);

    const updates: { message?: string; dueAt?: string } = {};

    if (editMessage.trim() !== (editingReminder.message ?? '')) {
      updates.message = editMessage.trim();
    }

    const newDueAt = new Date(`${editDate}T${editTime}:00`);
    const oldDueAt = new Date(editingReminder.due_at);
    if (newDueAt.getTime() !== oldDueAt.getTime()) {
      updates.dueAt = newDueAt.toISOString();
    }

    if (Object.keys(updates).length === 0) {
      toast.info('No changes to save');
      setIsEditSubmitting(false);
      return;
    }

    const result = await editReminder(editingReminder.id, updates, line.short_id);

    setIsEditSubmitting(false);

    if (result.success) {
      toast.success('Reminder updated');
      setEditingReminder(null);
      setInitialEditState(null);
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to update reminder');
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  // Group reminders by status
  const scheduledReminders = reminders.filter(r => r.status === 'scheduled');
  const pastReminders = reminders.filter(r => r.status !== 'scheduled');

  return (
    <div className="w-full pb-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Bell className="w-6 h-6 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-foreground">Reminders</h1>
            <p className="text-muted-foreground mt-2">
              Set up reminders for {line.display_name} at {formatPhone(line.phone_e164)}
            </p>
          </div>
        </div>

        {!disabled && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Reminder
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Scheduled Reminders */}
      {scheduledReminders.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-4">Upcoming Reminders</h2>
          <div className="space-y-3">
            {scheduledReminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`p-4 rounded-lg border bg-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${
                  reminder.is_paused ? 'border-yellow-300 dark:border-yellow-700' : 'border-input'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{reminder.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(reminder.due_at)}
                    </span>

                    {/* Paused badge */}
                    {reminder.is_paused && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-medium">
                        <Pause className="w-3 h-3" />
                        Paused
                      </span>
                    )}

                    {/* Snoozed badge */}
                    {reminder.snoozed_until && !reminder.is_paused && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs font-medium">
                        <AlarmClock className="w-3 h-3" />
                        Snoozed ({reminder.current_snooze_count}/3)
                      </span>
                    )}

                    {/* Recurrence badge */}
                    {reminder.is_recurring && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-medium">
                        <Repeat className="w-3 h-3" />
                        {formatRecurrence(reminder)}
                      </span>
                    )}

                    {!reminder.is_paused && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[reminder.status]}`}>
                        {STATUS_LABELS[reminder.status]}
                      </span>
                    )}
                  </div>
                </div>

                {!disabled && (
                  <div className="flex items-center gap-1 shrink-0 flex-wrap">
                    {/* Edit button */}
                    <button
                      onClick={() => openEditModal(reminder)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Edit reminder"
                      aria-label="Edit reminder"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {/* Pause/Resume button */}
                    {reminder.is_paused ? (
                      <button
                        onClick={() => handleResume(reminder.id)}
                        disabled={resumingId === reminder.id}
                        className="p-2 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
                        title="Resume reminder"
                        aria-label="Resume reminder"
                      >
                        {resumingId === reminder.id ? (
                          <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePause(reminder.id)}
                        disabled={pausingId === reminder.id}
                        className="p-2 rounded-lg text-muted-foreground hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors disabled:opacity-50"
                        title="Pause reminder"
                        aria-label="Pause reminder"
                      >
                        {pausingId === reminder.id ? (
                          <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Snooze dropdown - only show if not paused and under snooze limit */}
                    {!reminder.is_paused && reminder.current_snooze_count < 3 && (
                      <DropdownMenu
                        open={snoozeDropdownId === reminder.id}
                        onOpenChange={(open) =>
                          setSnoozeDropdownId(open ? reminder.id : null)
                        }
                      >
                        <DropdownMenuTrigger asChild>
                          <button
                            disabled={snoozingId === reminder.id}
                            className="p-2 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                            title="Snooze reminder"
                            aria-label="Snooze reminder"
                          >
                            {snoozingId === reminder.id ? (
                              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <AlarmClock className="w-4 h-4" />
                            )}
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                          align="end"
                          sideOffset={8}
                          className="min-w-[140px]"
                        >
                          {SNOOZE_OPTIONS.map((option) => (
                            <DropdownMenuItem
                              key={option.value}
                              className="cursor-pointer"
                              onSelect={() =>
                                handleSnooze(reminder.id, option.value)
                              }
                            >
                              {option.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}

                    {/* Skip button for recurring reminders */}
                    {reminder.is_recurring && !reminder.is_paused && (
                      <button
                        onClick={() => handleSkip(reminder.id)}
                        disabled={skippingId === reminder.id}
                        className="p-2 rounded-lg text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors disabled:opacity-50"
                        title="Skip next occurrence"
                        aria-label="Skip next occurrence"
                      >
                        {skippingId === reminder.id ? (
                          <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <SkipForward className="w-4 h-4" />
                        )}
                      </button>
                    )}

                    {/* Cancel button */}
                    <button
                      onClick={() => setReminderToCancel(reminder.id)}
                      disabled={cancelingId === reminder.id}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      title={reminder.is_recurring ? "Cancel entire series" : "Cancel reminder"}
                      aria-label={reminder.is_recurring ? "Cancel entire series" : "Cancel reminder"}
                    >
                      {cancelingId === reminder.id ? (
                        <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Past Reminders */}
      {pastReminders.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Past Reminders</h2>
          <div className="space-y-3">
            {pastReminders.map((reminder) => (
              <div
                key={reminder.id}
                className="p-4 rounded-lg border border-input bg-card/50 opacity-75"
              >
                <p className="text-foreground">{reminder.message}</p>
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDateTime(reminder.due_at)}
                  </span>

                  {/* Recurrence badge for past reminders */}
                  {reminder.is_recurring && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100/50 text-purple-800/70 dark:bg-purple-900/20 dark:text-purple-300/70 text-xs font-medium">
                      <Repeat className="w-3 h-3" />
                      {formatRecurrence(reminder)}
                    </span>
                  )}

                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[reminder.status]}`}>
                    {STATUS_LABELS[reminder.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reminder Activity Timeline - for caregiver visibility */}
      {reminders.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold text-lg mb-4">Reminder Activity</h2>
          <ReminderActivity lineId={line.id} />
        </div>
      )}

      {/* Empty State */}
      {reminders.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No reminders yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Create reminders for medication, appointments, or any important tasks.
            Each reminder call uses 1 minute.
          </p>
          {!disabled && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Reminder
            </button>
          )}
        </div>
      )}

      <ConfirmationDialog
        open={reminderToCancel !== null}
        onOpenChange={(open) => !open && setReminderToCancel(null)}
        title="Cancel Reminder"
        description="Are you sure you want to cancel this reminder?"
        confirmLabel="Cancel Reminder"
        variant="destructive"
        onConfirm={handleConfirmCancel}
      />

      {/* Edit Modal */}
      <Dialog
        open={editingReminder !== null}
        onOpenChange={(open) => {
          if (!open) discardEditChanges();
        }}
      >
        <DialogContent
          className="max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Edit reminder</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update message and time for {line.display_name}
              </DialogDescription>
            </div>

            <button
              type="button"
              onClick={discardEditChanges}
              disabled={isEditSubmitting}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div>
              <label htmlFor="edit-reminder-message" className="block text-sm font-medium text-foreground mb-2">
                Message
              </label>
              <textarea
                id="edit-reminder-message"
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={isEditSubmitting}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {editMessage.length}/500 characters
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  min={today}
                  disabled={isEditSubmitting}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time
                </label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  disabled={isEditSubmitting}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={discardEditChanges}
                disabled={isEditSubmitting}
                className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Discard changes
              </button>
              <button
                type="submit"
                disabled={isEditSubmitting || !editMessage.trim()}
                className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="inline-flex w-full items-center justify-center gap-2">
                  {isEditSubmitting ? (
                    <>
                      <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Reminder Modal */}
      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          if (!open) handleCloseCreateModal();
        }}
      >
        <DialogContent
          className="max-w-[468px] flex flex-col max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4 flex-shrink-0">
            <div className="min-w-0">
              <DialogTitle className="truncate">Create Reminder</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Set up a new reminder for {line.display_name}
              </DialogDescription>
            </div>

            <button
              type="button"
              onClick={handleCloseCreateModal}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <CreateReminderForm
            lineId={line.id}
            lineName={line.display_name}
            timezone={line.timezone}
            onSuccess={handleCloseCreateModal}
            onCancel={handleCloseCreateModal}
          />
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={dialogProps.open}
        onOpenChange={dialogProps.onOpenChange}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={dialogProps.onConfirm}
      />
    </div>
  );
}
