'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Bell, X, AlertCircle, Repeat, SkipForward, Pause, Play, Edit2, AlarmClock } from 'lucide-react';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { useLeavePageGuard } from '~/core/hooks/use-leave-page-guard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  focusDialogAutofocusTarget,
  gateDialogAutoFocus,
} from '~/core/ui/Dialog';
import { AutomationPageHeader, AutomationSection, AutomationItemCard, AutomationEmptyState } from '~/components/ultaura/automation';
import type { StatusPillProps } from '~/components/ultaura/automation/StatusPill';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import type { ActionItem } from '~/components/ultaura/ResponsiveActionMenu';
import type { LineRow } from '~/lib/ultaura/types';
import type { ReminderRow } from '~/lib/ultaura/types';
import { cancelReminder, skipNextOccurrence, pauseReminder, resumeReminder, snoozeReminder, editReminder } from '~/lib/ultaura/reminders';
import { ReminderActivity } from './ReminderActivity';
import { CreateReminderForm } from '~/components/ultaura/CreateReminderForm';
import { DatePicker } from '~/core/ui/DatePicker';
import { TimePicker } from '~/core/ui/TimePicker';
import Button from '~/core/ui/Button';
import Textarea from '~/core/ui/Textarea';

const SNOOZE_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 1440, label: 'Tomorrow' },
];

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
  reminderLimit: number | null;
  activeReminderCount: number;
  disabled?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  sent: 'Delivered',
  missed: 'Missed',
  canceled: 'Canceled',
};

export function RemindersClient({
  line,
  reminders,
  reminderLimit,
  activeReminderCount,
  disabled = false,
}: RemindersClientProps) {
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

  const hasReminderLimit = reminderLimit !== null;
  const isAtLimit = hasReminderLimit && activeReminderCount >= reminderLimit;
  const reminderUsageLabel = hasReminderLimit
    ? `${activeReminderCount} of ${reminderLimit} reminders`
    : null;
  const limitReachedMessage = isAtLimit
    ? 'Limit reached. Cancel reminders or upgrade.'
    : undefined;
  const emptyStateDescription = hasReminderLimit
    ? `Create reminders for medication, appointments, or any important tasks. Each reminder uses about 1 minute. Your plan allows ${reminderLimit} per line.`
    : 'Create reminders for medication, appointments, or any important tasks. Each reminder uses about 1 minute.';

  const handleOpenCreateModal = () => {
    if (disabled || isAtLimit) return;
    setShowCreateModal(true);
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

  function buildReminderPills(reminder: ReminderRow, faded?: boolean): StatusPillProps[] {
    const pills: StatusPillProps[] = [];
    if (reminder.is_paused) {
      pills.push({ variant: 'paused', label: 'Paused', icon: Pause, faded });
    }
    if (reminder.snoozed_until && !reminder.is_paused) {
      pills.push({ variant: 'snoozed', label: `Snoozed (${reminder.current_snooze_count}/3)`, icon: AlarmClock, faded });
    }
    if (reminder.is_recurring) {
      pills.push({ variant: 'recurring', label: formatRecurrence(reminder), icon: Repeat, faded });
    }
    if (!reminder.is_paused) {
      pills.push({ variant: reminder.status as StatusPillProps['variant'], label: STATUS_LABELS[reminder.status] ?? reminder.status, faded });
    }
    return pills;
  }

  function buildReminderActions(reminder: ReminderRow): ActionItem[] {
    const isAnyLoading = pausingId === reminder.id || resumingId === reminder.id ||
      snoozingId === reminder.id || skippingId === reminder.id || cancelingId === reminder.id;

    const actions: ActionItem[] = [
      {
        label: 'Edit',
        icon: <Edit2 className="w-5 h-5" />,
        onClick: () => openEditModal(reminder),
      },
    ];

    if (reminder.is_paused) {
      actions.push({
        label: 'Resume',
        icon: <Play className="w-5 h-5" />,
        onClick: () => handleResume(reminder.id),
      });
    } else {
      actions.push({
        label: 'Pause',
        icon: <Pause className="w-5 h-5" />,
        onClick: () => handlePause(reminder.id),
      });
    }

    const canSnooze = !reminder.is_paused && reminder.current_snooze_count < 3;
    if (canSnooze) {
      actions.push({
        label: 'Snooze',
        icon: <AlarmClock className="w-5 h-5" />,
        subItems: SNOOZE_OPTIONS.map((o) => ({
          label: o.label,
          onClick: () => handleSnooze(reminder.id, o.value),
        })),
      });
    }

    const canSkip = reminder.is_recurring && !reminder.is_paused;
    if (canSkip) {
      actions.push({
        label: 'Skip next',
        icon: <SkipForward className="w-5 h-5" />,
        onClick: () => handleSkip(reminder.id),
      });
    }

    actions.push({
      label: reminder.is_recurring ? 'Cancel series' : 'Cancel',
      icon: <X className="w-5 h-5" />,
      onClick: () => setReminderToCancel(reminder.id),
      variant: 'destructive' as const,
      separator: true,
    });

    return actions;
  }

  return (
    <div className="w-full pb-12">
      <AutomationPageHeader
        icon={Bell}
        title="Reminders"
        subtitle={[
          `Set up reminders for ${line.display_name} at ${formatPhone(line.phone_e164)}`,
          reminderUsageLabel,
        ]
          .filter(Boolean)
          .join(' \u2022 ')}
        ctaLabel="New Reminder"
        onCtaClick={handleOpenCreateModal}
        disabled={disabled}
        ctaDisabled={isAtLimit}
        ctaDisabledReason={limitReachedMessage}
      />

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Scheduled Reminders */}
      {scheduledReminders.length > 0 && (
        <AutomationSection title="Upcoming Reminders">
          {scheduledReminders.map((reminder) => {
            const isAnyLoading = pausingId === reminder.id || resumingId === reminder.id ||
              snoozingId === reminder.id || skippingId === reminder.id || cancelingId === reminder.id;

            return (
              <AutomationItemCard
                key={reminder.id}
                title={reminder.message ?? ''}
                dateTimeLabel={formatDateTime(reminder.due_at)}
                pills={buildReminderPills(reminder)}
                highlighted={reminder.is_paused}
                actionMenu={!disabled ? (
                  <ResponsiveActionMenu
                    title={reminder.message?.slice(0, 50) + ((reminder.message?.length ?? 0) > 50 ? '...' : '')}
                    loading={isAnyLoading}
                    actions={buildReminderActions(reminder)}
                  />
                ) : undefined}
              />
            );
          })}
        </AutomationSection>
      )}

      {/* Past Reminders */}
      {pastReminders.length > 0 && (
        <AutomationSection title="Past Reminders">
          {pastReminders.map((reminder) => (
            <AutomationItemCard
              key={reminder.id}
              title={reminder.message ?? ''}
              dateTimeLabel={formatDateTime(reminder.due_at)}
              pills={buildReminderPills(reminder, true)}
              faded
            />
          ))}
        </AutomationSection>
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
        <AutomationEmptyState
          icon={Bell}
          title="No reminders yet"
          description={emptyStateDescription}
          ctaLabel="Create First Reminder"
          onCtaClick={handleOpenCreateModal}
          disabled={disabled}
          ctaDisabled={isAtLimit}
          ctaDisabledReason={limitReachedMessage}
        />
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
          className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
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
              className="min-h-[44px] min-w-[44px] rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 touch-manipulation flex items-center justify-center"
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
              <Textarea
                id="edit-reminder-message"
                value={editMessage}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditMessage(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={isEditSubmitting}
                className="resize-none"
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
                <DatePicker
                  value={editDate}
                  onChange={setEditDate}
                  min={today}
                  disabled={isEditSubmitting}
                  placeholder="Select date"
                  className="h-11"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time
                </label>
                <TimePicker
                  value={editTime}
                  onChange={setEditTime}
                  disabled={isEditSubmitting}
                  placeholder="Select time"
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={discardEditChanges}
                disabled={isEditSubmitting}
              >
                Discard changes
              </Button>
              <Button
                type="submit"
                variant="default"
                className="w-full"
                disabled={isEditSubmitting || !editMessage.trim()}
                loading={isEditSubmitting}
              >
                {isEditSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
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
          className="mobile-form-sheet sm:max-w-[468px] flex flex-col max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
          onOpenAutoFocus={(event) => {
            gateDialogAutoFocus(event, focusDialogAutofocusTarget);
          }}
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
              <X className="w-3 h-3" />
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
