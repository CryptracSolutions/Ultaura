'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Bell, Plus, Clock, X, Check, AlertCircle, Repeat, SkipForward, Pause, Play, Edit2, AlarmClock } from 'lucide-react';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/core/ui/Dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Checkbox } from '~/core/ui/Checkbox';
import type { LineRow } from '~/lib/ultaura/types';
import type { ReminderRow } from '~/lib/ultaura/actions';
import { createReminder, cancelReminder, skipNextOccurrence, pauseReminder, resumeReminder, snoozeReminder, editReminder } from '~/lib/ultaura/actions';
import { getShortLineId } from '~/lib/ultaura';
import { ReminderActivity } from './ReminderActivity';

const SNOOZE_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 1440, label: 'Tomorrow' },
];

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

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

export function RemindersClient({ line, reminders }: RemindersClientProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Form state
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');

  // Recurrence form state
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('daily');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!date || !time || !message.trim()) {
      setError('Please fill in all fields');
      setIsSubmitting(false);
      return;
    }

    // Validate weekly frequency has at least one day selected
    if (isRecurring && frequency === 'weekly' && selectedDays.length === 0) {
      setError('Please select at least one day of the week');
      setIsSubmitting(false);
      return;
    }

    // Combine date and time
    const dueAt = new Date(`${date}T${time}:00`);

    const result = await createReminder({
      lineId: line.id,
      dueAt: dueAt.toISOString(),
      message: message.trim(),
      timezone: line.timezone,
      recurrence: isRecurring ? {
        frequency,
        interval: frequency === 'custom' ? interval : undefined,
        daysOfWeek: frequency === 'weekly' ? selectedDays : undefined,
        dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
        endsAt: hasEndDate && endDate ? new Date(endDate).toISOString() : undefined,
      } : undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      toast.success('Reminder created');
      setShowForm(false);
      setMessage('');
      setDate('');
      setTime('09:00');
      setIsRecurring(false);
      setFrequency('daily');
      setInterval(1);
      setSelectedDays([]);
      setDayOfMonth(1);
      setHasEndDate(false);
      setEndDate('');
      router.refresh();
    } else {
      setError(result.error || 'Failed to create reminder');
    }
  };

  const handleSkip = async (reminderId: string) => {
    setSkippingId(reminderId);

    const result = await skipNextOccurrence(reminderId);

    setSkippingId(null);

    if (result.success) {
      toast.success('Next occurrence skipped');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to skip reminder');
    }
  };

  const handleConfirmCancel = async () => {
    if (!reminderToCancel) return;
    setCancelingId(reminderToCancel);

    const result = await cancelReminder(reminderToCancel);

    setCancelingId(null);

    if (result.success) {
      toast.success('Reminder canceled');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to cancel reminder');
      throw new Error('Cancel failed');
    }
  };

  const handlePause = async (reminderId: string) => {
    setPausingId(reminderId);

    const result = await pauseReminder(reminderId);

    setPausingId(null);

    if (result.success) {
      toast.success('Reminder paused');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to pause reminder');
    }
  };

  const handleResume = async (reminderId: string) => {
    setResumingId(reminderId);

    const result = await resumeReminder(reminderId);

    setResumingId(null);

    if (result.success) {
      toast.success('Reminder resumed');
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to resume reminder');
    }
  };

  const handleSnooze = async (reminderId: string, minutes: number) => {
    setSnoozingId(reminderId);
    setSnoozeDropdownId(null);

    const result = await snoozeReminder(reminderId, minutes);

    setSnoozingId(null);

    if (result.success) {
      const option = SNOOZE_OPTIONS.find(o => o.value === minutes);
      toast.success(`Snoozed for ${option?.label || minutes + ' minutes'}`);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to snooze reminder');
    }
  };

  const openEditModal = (reminder: ReminderRow) => {
    setEditingReminder(reminder);
    setEditMessage(reminder.message);
    // Parse the due_at to get date and time in local format
    const dueDate = new Date(reminder.due_at);
    setEditDate(dueDate.toISOString().split('T')[0]);
    const hours = dueDate.getHours().toString().padStart(2, '0');
    const minutes = dueDate.getMinutes().toString().padStart(2, '0');
    setEditTime(`${hours}:${minutes}`);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReminder) return;

    setIsEditSubmitting(true);

    const updates: { message?: string; dueAt?: string } = {};

    if (editMessage.trim() !== editingReminder.message) {
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

    const result = await editReminder(editingReminder.id, updates);

    setIsEditSubmitting(false);

    if (result.success) {
      toast.success('Reminder updated');
      setEditingReminder(null);
      router.refresh();
    } else {
      toast.error(result.error || 'Failed to update reminder');
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  // Group reminders by status
  const scheduledReminders = reminders.filter(r => r.status === 'scheduled');
  const pastReminders = reminders.filter(r => r.status !== 'scheduled');

  return (
    <div className="w-full p-6 pb-12">
      <Link
        href={`/dashboard/lines/${getShortLineId(line.id)}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Line Details
      </Link>

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

        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
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

      {/* Create Reminder Form */}
      {showForm && (
        <div className="mb-8 p-6 rounded-lg border border-input bg-card">
          <h2 className="font-semibold text-lg mb-4">Create New Reminder</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Reminder Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="e.g., Time to take your afternoon medication"
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {message.length}/500 characters
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  min={today}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Time ({line.timezone.split('/').pop()?.replace('_', ' ')})
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Recurrence Options */}
            <div className="border-t border-input pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={isRecurring}
                  onCheckedChange={(checked) => setIsRecurring(checked === true)}
                />
                <span className="text-sm font-medium">Repeat this reminder</span>
              </label>

              {isRecurring && (
                <div className="mt-4 space-y-4 pl-6 border-l-2 border-muted">
                  {/* Frequency selector */}
                  <div>
                    <label className="block text-sm font-medium mb-2">How often?</label>
                    <Select value={frequency} onValueChange={(val) => setFrequency(val as RecurrenceFrequency)}>
                      <SelectTrigger className="w-full py-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom interval</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom interval */}
                  {frequency === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Every how many days?</label>
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={interval}
                        onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Day of week selector for weekly */}
                  {frequency === 'weekly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">On which days?</label>
                      <div className="flex gap-2 flex-wrap">
                        {DAY_NAMES.map((day, i) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              setSelectedDays(prev =>
                                prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                              );
                            }}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              selectedDays.includes(i)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Day of month for monthly */}
                  {frequency === 'monthly' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">On which day of the month?</label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={dayOfMonth}
                        onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                        className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Optional end date */}
                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={hasEndDate}
                        onCheckedChange={(checked) => setHasEndDate(checked === true)}
                      />
                      <span className="text-sm">Set an end date</span>
                    </label>
                    {hasEndDate && (
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={date || today}
                        className="mt-2 w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Reminder calls use 1 minute from your plan.
                {isRecurring && ' Each occurrence counts as a separate call.'}
                {!isRecurring && ' The AI will deliver your message and check if they have questions.'}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setMessage('');
                  setDate('');
                  setTime('09:00');
                  setIsRecurring(false);
                  setFrequency('daily');
                  setInterval(1);
                  setSelectedDays([]);
                  setDayOfMonth(1);
                  setHasEndDate(false);
                  setEndDate('');
                  setError(null);
                }}
                className="w-full sm:flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || !date || !time}
                className="w-full sm:flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  'Creating...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Reminder
                  </>
                )}
              </button>
            </div>
          </form>
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

                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  {/* Edit button */}
                  <button
                    onClick={() => openEditModal(reminder)}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    title="Edit reminder"
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
                  >
                    {cancelingId === reminder.id ? (
                      <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>
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
      {reminders.length === 0 && !showForm && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No reminders yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Create reminders for medication, appointments, or any important tasks.
            Each reminder call uses 1 minute.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Reminder
          </button>
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
      {editingReminder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingReminder(null)}
          />
          <div className="relative bg-card border border-input rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="font-semibold text-lg mb-4">Edit Reminder</h2>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Message
                </label>
                <textarea
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {editMessage.length}/500 characters
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    min={today}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingReminder(null)}
                  className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting || !editMessage.trim()}
                  className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isEditSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
