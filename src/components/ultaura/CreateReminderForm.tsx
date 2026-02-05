'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { Checkbox } from '~/core/ui/Checkbox';
import { DatePicker } from '~/core/ui/DatePicker';
import { TimePicker } from '~/core/ui/TimePicker';
import { createReminder } from '~/lib/ultaura/reminders';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

export interface CreateReminderFormProps {
  lineId: string;
  lineName: string;
  timezone: string;
  onSuccess: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  messageTextareaRef?: React.RefObject<HTMLTextAreaElement>;
}

type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CreateReminderForm({
  lineId,
  lineName,
  timezone,
  onSuccess,
  onCancel,
  onDirtyChange,
  messageTextareaRef,
}: CreateReminderFormProps) {
  const router = useRouter();

  // Focus message textarea when form mounts (for step transitions)
  useEffect(() => {
    messageTextareaRef?.current?.focus();
  }, [messageTextareaRef]);

  // Form state
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recurrence form state
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('daily');
  const [interval, setInterval] = useState(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  // Track dirty state
  const isDirty = message.trim() !== '' || date !== '' || time !== '09:00' || isRecurring;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!date || !time || !message.trim()) {
      setError('Please fill in all fields');
      return;
    }

    // Validate weekly frequency has at least one day selected
    if (isRecurring && frequency === 'weekly' && selectedDays.length === 0) {
      setError('Please select at least one day of the week');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Combine date and time
      const dueAt = new Date(`${date}T${time}:00`);

      const result = await createReminder({
        lineId,
        dueAt: dueAt.toISOString(),
        message: message.trim(),
        timezone,
        recurrence: isRecurring
          ? {
              frequency,
              interval: frequency === 'custom' ? interval : undefined,
              daysOfWeek: frequency === 'weekly' ? selectedDays : undefined,
              dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
              endsAt: hasEndDate && endDate ? new Date(endDate).toISOString() : undefined,
            }
          : undefined,
      });

      if (result.success) {
        toast.success('Reminder created');
        router.refresh();
        onSuccess();
      } else {
        setError(result.error.message || 'Failed to create reminder');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {error && (
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
          {/* Message */}
          <div>
            <label
              htmlFor="reminder-message"
              className="block text-sm font-medium text-foreground mb-2"
            >
              Reminder Message
            </label>
            <textarea
              ref={messageTextareaRef}
              data-autofocus
              id="reminder-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g., Time to take your afternoon medication"
              rows={3}
              maxLength={500}
              disabled={isSubmitting}
              className="w-full px-3 py-2 min-h-[44px] rounded-lg border border-input bg-background text-base sm:text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:!outline-none focus-visible:!border-primary resize-none disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">{message.length}/500 characters</p>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Date</label>
              <DatePicker
                value={date}
                onChange={setDate}
                min={today}
                disabled={isSubmitting}
                placeholder="Select date"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Time ({timezone.split('/').pop()?.replace('_', ' ')})
              </label>
              <TimePicker
                value={time}
                onChange={setTime}
                disabled={isSubmitting}
                placeholder="Select time"
              />
            </div>
          </div>

          {/* Recurrence Options */}
          <div className="border-t border-input pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={isRecurring}
                onCheckedChange={(checked) => setIsRecurring(checked === true)}
                disabled={isSubmitting}
              />
              <span className="text-sm font-medium">Repeat this reminder</span>
            </label>

            {isRecurring && (
              <div className="mt-4 space-y-4 pl-6 border-l-2 border-muted">
                {/* Frequency selector */}
                <div>
                  <label className="block text-sm font-medium mb-2">How often?</label>
                  <Select
                    value={frequency}
                    onValueChange={(val) => setFrequency(val as RecurrenceFrequency)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full h-11">
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
                      disabled={isSubmitting}
                      className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors focus-visible:!outline-none focus-visible:!border-primary disabled:opacity-50"
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
                            setSelectedDays((prev) =>
                              prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i],
                            );
                          }}
                          disabled={isSubmitting}
                          aria-pressed={selectedDays.includes(i)}
                          className={`min-w-[44px] min-h-[44px] px-3 py-2 rounded-full text-sm font-medium transition-colors disabled:opacity-50 ${
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
                    <label className="block text-sm font-medium mb-2">
                      On which day of the month?
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value) || 1)}
                      disabled={isSubmitting}
                      className="w-24 px-3 py-2 rounded-lg border border-input bg-background text-foreground transition-colors focus-visible:!outline-none focus-visible:!border-primary disabled:opacity-50"
                    />
                  </div>
                )}

                {/* Optional end date */}
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={hasEndDate}
                      onCheckedChange={(checked) => setHasEndDate(checked === true)}
                      disabled={isSubmitting}
                    />
                    <span className="text-sm">Set an end date</span>
                  </label>
                  {hasEndDate && (
                    <div className="mt-2">
                      <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        min={date || today}
                        disabled={isSubmitting}
                        placeholder="Select end date"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className={COMPACT_OUTLINE_BUTTON_CLASS}
          >
            Discard changes
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !message.trim() || !date || !time}
            className={COMPACT_PRIMARY_BUTTON_CLASS}
          >
            {isSubmitting ? (
              <>
                <span className="w-3 h-3 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                Saving...
              </>
            ) : (
              'Save Reminder'
            )}
          </button>
        </div>
      </form>
    </>
  );
}
