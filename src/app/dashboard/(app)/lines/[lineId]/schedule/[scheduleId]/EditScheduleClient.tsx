'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Check, ToggleLeft, ToggleRight, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '~/core/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import type { LineRow, ScheduleRow } from '~/lib/ultaura/types';
import { updateSchedule } from '~/lib/ultaura/schedules';
import { DAYS_OF_WEEK, TIME_OPTIONS, formatTime } from '~/lib/ultaura/constants';
import { getShortLineId } from '~/lib/ultaura/short-id';

interface EditScheduleClientProps {
  line: LineRow;
  schedule: ScheduleRow;
  disabled?: boolean;
}

function normalizeTimeOfDay(timeOfDay: string): string {
  const match = timeOfDay.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : timeOfDay;
}

export function EditScheduleClient({
  line,
  schedule,
  disabled = false,
}: EditScheduleClientProps) {
  const router = useRouter();
  const [selectedDays, setSelectedDays] = useState<number[]>(schedule.days_of_week);
  const [selectedTime, setSelectedTime] = useState(normalizeTimeOfDay(schedule.time_of_day));
  const [enabled, setEnabled] = useState(schedule.enabled);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    if (disabled) return;

    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const hasChanges =
    enabled !== schedule.enabled ||
    selectedTime !== normalizeTimeOfDay(schedule.time_of_day) ||
    JSON.stringify(selectedDays.sort()) !== JSON.stringify(schedule.days_of_week.sort());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    if (selectedDays.length === 0) {
      setError('Please select at least one day');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await updateSchedule(schedule.id, {
        enabled,
        daysOfWeek: selectedDays,
        timeOfDay: selectedTime,
        timezone: line.timezone,
      });

      if (result.success) {
        toast.success('Schedule updated');
        router.refresh();
      } else {
        setError(result.error.message || 'Failed to update schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full p-6 pb-12">
      <Link
        href={`/dashboard/lines/${getShortLineId(line.id)}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Line Details
      </Link>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Schedule settings</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Update the schedule for {line.display_name}. Times are in {line.timezone}.
          </p>
        </CardHeader>

        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Enable/Disable Toggle */}
            <div className="rounded-lg border border-input bg-background p-4">
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                disabled={disabled}
                className="flex items-center justify-between w-full"
              >
                <div>
                  <p className="font-medium text-foreground">Schedule Active</p>
                  <p className="text-sm text-muted-foreground">
                    {enabled ? 'Calls will be made on schedule' : 'Schedule is paused'}
                  </p>
                </div>
                {enabled ? (
                  <ToggleRight className="w-10 h-10 text-primary" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Day Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                Which days should we call?
              </label>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleDay(day.value)}
                    disabled={disabled}
                    className={`px-3 py-3 sm:px-4 sm:py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selectedDays.includes(day.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-input hover:bg-muted'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Selection */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-3">
                What time should we call?
              </label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="w-full py-3" disabled={disabled}>
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
                Times are in {line.timezone}. Quiet hours: {formatTime(line.quiet_hours_start)} -{' '}
                {formatTime(line.quiet_hours_end)}
              </p>
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4">
              <h3 className="font-medium text-foreground mb-2">Schedule Summary</h3>
              <p className="text-sm text-muted-foreground">
                {!enabled ? (
                  <span className="text-warning">Schedule is currently paused</span>
                ) : selectedDays.length > 0 ? (
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
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/dashboard/lines/${getShortLineId(line.id)}`}
                className="w-full sm:flex-1 py-3 px-4 rounded-lg border border-input bg-background text-foreground text-center font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={disabled || isLoading || !hasChanges}
                className="w-full sm:flex-1 py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  'Saving...'
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
