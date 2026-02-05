'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import { createSchedule } from '~/lib/ultaura/schedules';
import { DAYS_OF_WEEK, TIME_OPTIONS, formatTime } from '~/lib/ultaura/constants';
import Button from '~/core/ui/Button';

export interface CreateScheduleFormProps {
  lineId: string;
  accountId: string;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  onSuccess: () => void;
  onCancel: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  firstDayButtonRef?: React.RefObject<HTMLButtonElement>;
}

const DEFAULT_DAYS = [1, 2, 3, 4, 5]; // Weekdays
const DEFAULT_TIME = '09:00';

export function CreateScheduleForm({
  lineId,
  accountId,
  timezone,
  quietHoursStart,
  quietHoursEnd,
  onSuccess,
  onCancel,
  onDirtyChange,
  firstDayButtonRef,
}: CreateScheduleFormProps) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<number[]>(DEFAULT_DAYS);
  const [selectedTime, setSelectedTime] = useState(DEFAULT_TIME);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus first day button when form mounts (for step transitions)
  useEffect(() => {
    firstDayButtonRef?.current?.focus();
  }, [firstDayButtonRef]);

  // Track dirty state
  const isDirty = selectedDays.join(',') !== DEFAULT_DAYS.join(',') || selectedTime !== DEFAULT_TIME;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedDays.length === 0) {
      setError('Please select at least one day');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createSchedule(accountId, {
        lineId,
        daysOfWeek: selectedDays,
        timeOfDay: selectedTime,
        timezone,
      });

      if (result.success) {
        toast.success('Schedule created');
        router.refresh();
        onSuccess();
      } else {
        setError(result.error.message || 'Failed to create schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
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
          {/* Day Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Which days should we call?
            </label>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              {DAYS_OF_WEEK.map((day, index) => (
                <button
                  key={day.value}
                  ref={index === 0 ? firstDayButtonRef : undefined}
                  data-autofocus={index === 0 ? true : undefined}
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  disabled={isLoading}
                  className={`px-3 py-3 sm:px-4 sm:py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${
                    selectedDays.includes(day.value)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-input hover:bg-muted'
                  }`}
                >
                  {day.short}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Select the days of the week for regular calls
            </p>
          </div>

          {/* Time Selection */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              What time should we call?
            </label>
            <Select value={selectedTime} onValueChange={setSelectedTime} disabled={isLoading}>
              <SelectTrigger className="w-full h-11">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Times are in {timezone}. Quiet hours: {formatTime(quietHoursStart)} -{' '}
              {formatTime(quietHoursEnd)}
            </p>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Quick presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDays([1, 2, 3, 4, 5]);
                  setSelectedTime('09:00');
                }}
                disabled={isLoading}
                className="p-3 rounded-lg border border-input bg-background text-left hover:bg-muted transition-colors disabled:opacity-50"
              >
                <p className="font-medium text-foreground">Weekday Mornings</p>
                <p className="text-xs text-muted-foreground">Mon-Fri at 9:00 AM</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
                  setSelectedTime('10:00');
                }}
                disabled={isLoading}
                className="p-3 rounded-lg border border-input bg-background text-left hover:bg-muted transition-colors disabled:opacity-50"
              >
                <p className="font-medium text-foreground">Daily Check-in</p>
                <p className="text-xs text-muted-foreground">Every day at 10:00 AM</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDays([0, 6]);
                  setSelectedTime('11:00');
                }}
                disabled={isLoading}
                className="p-3 rounded-lg border border-input bg-background text-left hover:bg-muted transition-colors disabled:opacity-50"
              >
                <p className="font-medium text-foreground">Weekend Calls</p>
                <p className="text-xs text-muted-foreground">Sat & Sun at 11:00 AM</p>
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium text-foreground mb-2">Schedule Summary</h3>
            <p className="text-sm text-muted-foreground">
              {selectedDays.length > 0 ? (
                <>
                  Calls will be made on{' '}
                  <span className="text-foreground font-medium">
                    {selectedDays
                      .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
                      .join(', ')}
                  </span>{' '}
                  at{' '}
                  <span className="text-foreground font-medium">
                    {TIME_OPTIONS.find((t) => t.value === selectedTime)?.label || selectedTime}
                  </span>
                </>
              ) : (
                'Select days and time to schedule calls'
              )}
            </p>
          </div>
        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="small"
            className="w-full sm:w-auto"
            onClick={onCancel}
            disabled={isLoading}
          >
            Discard changes
          </Button>
          <Button
            type="submit"
            variant="default"
            size="small"
            className="w-full sm:w-auto"
            disabled={selectedDays.length === 0}
            loading={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Schedule'}
          </Button>
        </div>
      </form>
    </>
  );
}
