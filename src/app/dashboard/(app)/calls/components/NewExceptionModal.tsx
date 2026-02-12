'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/core/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import { DatePicker } from '~/core/ui/DatePicker';
import { TimePicker } from '~/core/ui/TimePicker';
import Button from '~/core/ui/Button';
import { formatTime } from '~/lib/ultaura/constants';
import { createScheduleException } from '~/lib/ultaura/schedule-exceptions';
import { formatDaySummary } from '~/lib/ultaura/schedule-utils';
import { normalizeTimeOfDay } from '~/lib/ultaura/schedule-helpers';

interface NewExceptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedules: Array<{
    scheduleId: string;
    timeOfDay: string;
    daysOfWeek: number[];
    enabled: boolean;
  }>;
  lineShortId: string;
  lineTimezone: string;
}

export function NewExceptionModal({
  open,
  onOpenChange,
  schedules,
  lineShortId,
  lineTimezone,
}: NewExceptionModalProps) {
  const router = useRouter();

  const [exceptionType, setExceptionType] = useState<'skip' | 'snooze' | 'reschedule'>('skip');
  const [scheduleId, setScheduleId] = useState('');
  const [exceptionDate, setExceptionDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('');
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const recurringSchedules = useMemo(
    () => schedules.filter((s) => s.enabled && s.daysOfWeek.length > 0),
    [schedules]
  );

  const getScheduleLabel = (schedule: typeof schedules[number]) => {
    const time = formatTime(normalizeTimeOfDay(schedule.timeOfDay));
    const days = formatDaySummary(schedule.daysOfWeek);
    return `${days || 'Custom days'} at ${time}`;
  };

  useEffect(() => {
    if (!open) return;
    setExceptionType('skip');
    setError(null);
    setIsLoading(false);

    if (recurringSchedules.length > 0) {
      setScheduleId(recurringSchedules[0].scheduleId);
    } else {
      setScheduleId('');
    }

    const today = DateTime.now().setZone(lineTimezone).toISODate() ?? '';
    setExceptionDate(today);
    setSnoozeTime(
      DateTime.now().setZone(lineTimezone).plus({ hours: 1 }).toFormat('HH:mm')
    );
    setRescheduleDateTime(`${today}T09:00`);
  }, [open, lineTimezone, recurringSchedules]);

  const snoozePreview = useMemo(() => {
    if (exceptionType !== 'snooze' || !snoozeTime) return null;
    const now = DateTime.now().setZone(lineTimezone);
    const [hoursStr, minutesStr] = snoozeTime.split(':');
    const hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

    let candidate = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
    if (candidate <= now) {
      candidate = candidate.plus({ days: 1 });
    }
    const isTomorrow = candidate.startOf('day') > now.startOf('day');
    return { datetime: candidate, isTomorrow };
  }, [exceptionType, lineTimezone, snoozeTime]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!scheduleId) {
      setError('Select a schedule.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const today = DateTime.now().setZone(lineTimezone).toISODate();
      let targetDate = exceptionDate;

      if (exceptionType === 'snooze') {
        targetDate = today ?? '';
      } else if (!targetDate) {
        setError('Choose a date to apply the exception.');
        setIsLoading(false);
        return;
      }

      if (today && targetDate && targetDate < today) {
        setError('Exception date must be today or later.');
        setIsLoading(false);
        return;
      }

      let newDatetime: string | undefined;

      if (exceptionType === 'snooze') {
        if (!snoozeTime) {
          setError('Choose a time to snooze to.');
          setIsLoading(false);
          return;
        }

        const [hoursStr, minutesStr] = snoozeTime.split(':');
        const hours = Number(hoursStr);
        const minutes = Number(minutesStr);
        const now = DateTime.now().setZone(lineTimezone);
        let candidate = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        if (candidate <= now) {
          candidate = candidate.plus({ days: 1 });
        }

        const diffMinutes = candidate.diff(now, 'minutes').minutes;
        if (diffMinutes < 5 || diffMinutes > 1440) {
          setError('Snooze must be between 5 minutes and 24 hours from now.');
          setIsLoading(false);
          return;
        }

        newDatetime = candidate.toFormat("yyyy-MM-dd'T'HH:mm:ss");
      }

      if (exceptionType === 'reschedule') {
        if (!rescheduleDateTime) {
          setError('Choose a new date and time.');
          setIsLoading(false);
          return;
        }
        newDatetime = rescheduleDateTime.length === 16
          ? `${rescheduleDateTime}:00`
          : rescheduleDateTime;
      }

      const result = await createScheduleException(
        {
          scheduleId,
          exceptionDate: targetDate,
          exceptionType,
          newDatetime,
        },
        lineShortId,
      );

      if (!result.success) {
        setError(result.error.message || 'Failed to create exception');
        return;
      }

      toast.success('Exception saved');
      onOpenChange(false);
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="truncate">New exception</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Skip, snooze, or reschedule a single call.
            </DialogDescription>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleClose}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {recurringSchedules.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Schedule
              </label>
              <Select value={scheduleId} onValueChange={setScheduleId}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue placeholder="Select a schedule" />
                </SelectTrigger>
                <SelectContent>
                  {recurringSchedules.map((schedule) => (
                    <SelectItem key={schedule.scheduleId} value={schedule.scheduleId}>
                      {getScheduleLabel(schedule)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Exception type
            </label>
            <Select value={exceptionType} onValueChange={(value) => setExceptionType(value as typeof exceptionType)}>
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip</SelectItem>
                <SelectItem value="snooze">Snooze</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exceptionType !== 'snooze' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date to apply
              </label>
              <DatePicker
                value={exceptionDate}
                onChange={setExceptionDate}
                min={DateTime.now().setZone(lineTimezone).toISODate() ?? undefined}
                placeholder="Select date"
              />
            </div>
          )}

          {exceptionType === 'snooze' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                New time
              </label>
              <TimePicker
                value={snoozeTime}
                onChange={setSnoozeTime}
                placeholder="Select time"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Snoozes the next call. If the time is earlier than now, we&apos;ll schedule for tomorrow.
              </p>
              {snoozePreview && (
                <p className="text-xs text-muted-foreground mt-2">
                  Call will be scheduled for {snoozePreview.datetime.toLocaleString(DateTime.DATETIME_MED)}
                  {snoozePreview.isTomorrow ? ' (tomorrow)' : ''}.
                </p>
              )}
            </div>
          )}

          {exceptionType === 'reschedule' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New date
                </label>
                <DatePicker
                  value={rescheduleDateTime.split('T')[0] || ''}
                  onChange={(date) => {
                    const time = rescheduleDateTime.split('T')[1] || '09:00';
                    setRescheduleDateTime(`${date}T${time}`);
                  }}
                  min={DateTime.now().setZone(lineTimezone).toISODate() ?? undefined}
                  placeholder="Select date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New time
                </label>
                <TimePicker
                  value={rescheduleDateTime.split('T')[1] || ''}
                  onChange={(time) => {
                    const date = rescheduleDateTime.split('T')[0] || DateTime.now().setZone(lineTimezone).toISODate();
                    setRescheduleDateTime(`${date}T${time}`);
                  }}
                  placeholder="Select time"
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <Button
              type="submit"
              disabled={isLoading}
              variant="default"
              size="small"
              className="w-full"
              loading={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              size="small"
              className="w-full"
              disabled={isLoading}
            >
              Discard
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
