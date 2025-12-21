'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Clock, Check } from 'lucide-react';
import { LineRow } from '~/lib/ultaura/types';
import { createSchedule } from '~/lib/ultaura/actions';
import { DAYS_OF_WEEK, TIME_OPTIONS } from '~/lib/ultaura/constants';

interface ScheduleClientProps {
  line: LineRow;
  organizationSlug: string;
}

export function ScheduleClient({ line, organizationSlug }: ScheduleClientProps) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const result = await createSchedule(line.account_id, {
        lineId: line.id,
        daysOfWeek: selectedDays,
        timeOfDay: selectedTime,
        timezone: line.timezone,
      });

      if (result.success) {
        router.push(`/dashboard/${organizationSlug}/lines/${line.id}`);
      } else {
        setError(result.error || 'Failed to create schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Link
        href={`/dashboard/${organizationSlug}/lines/${line.id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Line Details
      </Link>

      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground">Schedule Calls</h1>
        <p className="text-muted-foreground mt-2">
          Set up regular call times for {line.display_name} at {formatPhone(line.phone_e164)}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Day Selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-3">
            Which days should we call?
          </label>
          <div className="flex flex-wrap gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
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
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-input bg-background text-foreground appearance-none focus:border-primary focus:ring-2 focus:ring-ring"
            >
              {TIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Times are in {line.timezone}. Quiet hours: {line.quiet_hours_start} - {line.quiet_hours_end}
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
              className="p-3 rounded-lg border border-input bg-background text-left hover:bg-muted transition-colors"
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
              className="p-3 rounded-lg border border-input bg-background text-left hover:bg-muted transition-colors"
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
              className="p-3 rounded-lg border border-input bg-background text-left hover:bg-muted transition-colors"
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

        {/* Submit */}
        <div className="flex gap-3">
          <Link
            href={`/dashboard/${organizationSlug}/lines/${line.id}`}
            className="flex-1 py-3 px-4 rounded-lg border border-input bg-background text-foreground text-center font-medium hover:bg-muted transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading || selectedDays.length === 0}
            className="flex-1 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
          >
            {isLoading ? (
              'Creating...'
            ) : (
              <>
                <Check className="w-5 h-5" />
                Create Schedule
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
