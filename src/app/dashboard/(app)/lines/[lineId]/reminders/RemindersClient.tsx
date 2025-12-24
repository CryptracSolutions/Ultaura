'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, Plus, Clock, X, Check, AlertCircle } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import type { ReminderRow } from '~/lib/ultaura/actions';
import { createReminder, cancelReminder } from '~/lib/ultaura/actions';

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
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');

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

    // Combine date and time
    const dueAt = new Date(`${date}T${time}:00`);

    const result = await createReminder({
      lineId: line.id,
      dueAt: dueAt.toISOString(),
      message: message.trim(),
      timezone: line.timezone,
    });

    setIsSubmitting(false);

    if (result.success) {
      setShowForm(false);
      setMessage('');
      setDate('');
      setTime('09:00');
      router.refresh();
    } else {
      setError(result.error || 'Failed to create reminder');
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
        href={`/dashboard/lines/${line.id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Line Details
      </Link>

      <div className="mb-8 flex items-start justify-between gap-4">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
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

            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="text-muted-foreground">
                <strong className="text-foreground">Note:</strong> Reminder calls use 1 minute from your plan.
                The AI will deliver your message and check if they have questions.
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
                className="p-4 rounded-lg border border-input bg-card flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-foreground">{reminder.message}</p>
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDateTime(reminder.due_at)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[reminder.status]}`}>
                      {STATUS_LABELS[reminder.status]}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleCancel(reminder.id)}
                  disabled={cancelingId === reminder.id}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                  title="Cancel reminder"
                >
                  {cancelingId === reminder.id ? (
                    <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                </button>
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
                <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {formatDateTime(reminder.due_at)}
                  </span>
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
