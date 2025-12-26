'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, Plus, Clock, X, Check, AlertCircle, Repeat, SkipForward } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import type { ReminderRow } from '~/lib/ultaura/actions';
import { createReminder, cancelReminder, skipNextOccurrence } from '~/lib/ultaura/actions';
import { getShortLineId } from '~/lib/ultaura';

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
  const [error, setError] = useState<string | null>(null);

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
      router.refresh();
    } else {
      setError(result.error || 'Failed to skip reminder');
    }
  };

  const handleCancel = async (reminderId: string) => {
    setCancelingId(reminderId);

    const result = await cancelReminder(reminderId);

    setCancelingId(null);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error || 'Failed to cancel reminder');
    }
  };

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  // Group reminders by status
  const scheduledReminders = reminders.filter(r => r.status === 'scheduled');
  const pastReminders = reminders.filter(r => r.status !== 'scheduled');

  return (
    <div className="w-full p-6">
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
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium">Repeat this reminder</span>
              </label>

              {isRecurring && (
                <div className="mt-4 space-y-4 pl-6 border-l-2 border-muted">
                  {/* Frequency selector */}
                  <div>
                    <label className="block text-sm font-medium mb-2">How often?</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom interval</option>
                    </select>
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
                      <input
                        type="checkbox"
                        checked={hasEndDate}
                        onChange={(e) => setHasEndDate(e.target.checked)}
                        className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
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

            <div className="flex gap-3 pt-2">
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
                className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !message.trim() || !date || !time}
                className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
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
                className="p-4 rounded-lg border border-input bg-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{reminder.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(reminder.due_at)}
                    </span>

                    {/* Recurrence badge */}
                    {reminder.is_recurring && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-xs font-medium">
                        <Repeat className="w-3 h-3" />
                        {formatRecurrence(reminder)}
                      </span>
                    )}

                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[reminder.status]}`}>
                      {STATUS_LABELS[reminder.status]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {/* Skip button for recurring reminders */}
                  {reminder.is_recurring && (
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
                    onClick={() => handleCancel(reminder.id)}
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
    </div>
  );
}
