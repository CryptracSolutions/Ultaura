'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { Info, X } from 'lucide-react';
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
  onSuccess?: () => void;
}

function parseTimeParts(time: string): { hours: number; minutes: number } | null {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }
  return { hours, minutes };
}

export function NewExceptionModal({
  open,
  onOpenChange,
  schedules,
  lineShortId,
  lineTimezone,
  onSuccess,
}: NewExceptionModalProps) {
  const router = useRouter();
  const todayIso = DateTime.now().setZone(lineTimezone).toISODate() ?? '';

  const [exceptionType, setExceptionType] = useState<'skip' | 'snooze' | 'reschedule'>('skip');
  const [scheduleId, setScheduleId] = useState('');
  const [exceptionDate, setExceptionDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('');
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<
    'scheduleId' | 'exceptionDate' | 'snoozeTime' | 'rescheduleDate' | 'rescheduleTime',
    string
  >>>({});
  const [liveValidationMessage, setLiveValidationMessage] = useState('');
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

  const selectedSchedule = useMemo(
    () => recurringSchedules.find((schedule) => schedule.scheduleId === scheduleId) ?? null,
    [recurringSchedules, scheduleId],
  );

  const selectedScheduleLabel = selectedSchedule ? getScheduleLabel(selectedSchedule) : null;
  const [rescheduleDateValue, rescheduleTimeValue = ''] = rescheduleDateTime.split('T');

  const getOccurrenceDateTime = (date: string, timeOfDay: string) => {
    const normalizedTime = normalizeTimeOfDay(timeOfDay);
    const parsedTime = parseTimeParts(normalizedTime);

    if (!date || !parsedTime) return null;

    const occurrence = DateTime.fromISO(`${date}T00:00:00`, { zone: lineTimezone }).set({
      hour: parsedTime.hours,
      minute: parsedTime.minutes,
      second: 0,
      millisecond: 0,
    });

    return occurrence.isValid ? occurrence : null;
  };

  const originalOccurrence = useMemo(() => {
    if (!selectedSchedule || !exceptionDate || exceptionType === 'snooze') return null;
    return getOccurrenceDateTime(exceptionDate, selectedSchedule.timeOfDay);
  }, [exceptionDate, exceptionType, selectedSchedule]);

  useEffect(() => {
    if (!open) return;
    setExceptionType('skip');
    setFormError(null);
    setFieldErrors({});
    setLiveValidationMessage('');
    setIsLoading(false);

    if (recurringSchedules.length > 0) {
      setScheduleId(recurringSchedules[0].scheduleId);
    } else {
      setScheduleId('');
    }

    setExceptionDate(todayIso);
    setSnoozeTime(
      DateTime.now().setZone(lineTimezone).plus({ hours: 1 }).toFormat('HH:mm')
    );
    setRescheduleDateTime(`${todayIso}T09:00`);
  }, [open, lineTimezone, recurringSchedules, todayIso]);

  const setFieldError = (
    field: keyof typeof fieldErrors,
    message: string,
  ) => {
    setFieldErrors((prev) => ({ ...prev, [field]: message }));
    setLiveValidationMessage(message);
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const snoozePreview = useMemo(() => {
    if (exceptionType !== 'snooze' || !snoozeTime) return null;
    const now = DateTime.now().setZone(lineTimezone);
    const parsedTime = parseTimeParts(snoozeTime);
    if (!parsedTime) return null;

    let candidate = now.set({
      hour: parsedTime.hours,
      minute: parsedTime.minutes,
      second: 0,
      millisecond: 0,
    });
    if (candidate <= now) {
      candidate = candidate.plus({ days: 1 });
    }
    const diffMinutes = Math.round(candidate.diff(now, 'minutes').minutes);
    const isTomorrow = candidate.startOf('day') > now.startOf('day');

    return {
      datetime: candidate,
      isTomorrow,
      diffMinutes,
      relative: candidate.toRelative({ base: now }) ?? null,
    };
  }, [exceptionType, lineTimezone, snoozeTime]);

  const reschedulePreview = useMemo(() => {
    if (exceptionType !== 'reschedule' || !rescheduleDateTime || !originalOccurrence) return null;

    const candidate = DateTime.fromISO(rescheduleDateTime, { zone: lineTimezone });
    if (!candidate.isValid) return null;

    const diffMinutes = Math.round(candidate.diff(originalOccurrence, 'minutes').minutes);
    const direction = diffMinutes >= 0 ? 'later' : 'earlier';

    return {
      datetime: candidate,
      diffMinutes: Math.abs(diffMinutes),
      direction,
      relative: candidate.toRelative({ base: originalOccurrence }) ?? null,
    };
  }, [exceptionType, lineTimezone, originalOccurrence, rescheduleDateTime]);

  const exceptionTypeHelpText = useMemo(() => {
    if (exceptionType === 'skip') {
      return 'Skip one scheduled occurrence on the selected date. Future recurring calls stay unchanged.';
    }
    if (exceptionType === 'snooze') {
      return 'Delay the next scheduled occurrence to a later time today or tomorrow.';
    }
    return 'Move one scheduled occurrence to a new date and time. The recurring pattern continues after that.';
  }, [exceptionType]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!scheduleId) {
      setFieldError('scheduleId', 'Choose a recurring schedule first.');
      return;
    }

    setIsLoading(true);

    try {
      const today = DateTime.now().setZone(lineTimezone).toISODate();
      let targetDate = exceptionDate;

      if (exceptionType === 'snooze') {
        targetDate = today ?? '';
      } else if (!targetDate) {
        setFieldError('exceptionDate', 'Choose the date for this one-time exception.');
        setIsLoading(false);
        return;
      }

      if (today && targetDate && targetDate < today) {
        setFieldError('exceptionDate', 'Exception date must be today or later.');
        setIsLoading(false);
        return;
      }

      let newDatetime: string | undefined;

      if (exceptionType === 'snooze') {
        if (!snoozeTime) {
          setFieldError('snoozeTime', 'Choose a snooze time.');
          setIsLoading(false);
          return;
        }

        const parsedTime = parseTimeParts(snoozeTime);
        if (!parsedTime) {
          setFieldError('snoozeTime', 'Choose a valid snooze time.');
          setIsLoading(false);
          return;
        }
        const now = DateTime.now().setZone(lineTimezone);
        let candidate = now.set({
          hour: parsedTime.hours,
          minute: parsedTime.minutes,
          second: 0,
          millisecond: 0,
        });
        if (candidate <= now) {
          candidate = candidate.plus({ days: 1 });
        }

        const diffMinutes = candidate.diff(now, 'minutes').minutes;
        if (diffMinutes < 5 || diffMinutes > 1440) {
          setFieldError('snoozeTime', 'Snooze must be between 5 minutes and 24 hours from now.');
          setIsLoading(false);
          return;
        }

        newDatetime = candidate.toFormat("yyyy-MM-dd'T'HH:mm:ss");
      }

      if (exceptionType === 'reschedule') {
        if (!rescheduleDateTime) {
          setFieldError('rescheduleDate', 'Choose a new date and time.');
          setFieldError('rescheduleTime', 'Choose a new date and time.');
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
        setFormError(result.error.message || 'Failed to create exception');
        setLiveValidationMessage(result.error.message || 'Failed to create exception');
        return;
      }

      toast.success('Exception saved');
      onOpenChange(false);
      router.refresh();
      onSuccess?.();
    } catch {
      setFormError('An unexpected error occurred');
      setLiveValidationMessage('An unexpected error occurred');
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
            <DialogTitle className="truncate">Create exception</DialogTitle>
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

        <p className="sr-only" role="status" aria-live="assertive">
          {liveValidationMessage}
        </p>

        <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3.5">
          <Info className="h-[18px] w-[18px] text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-primary leading-snug">
            This applies to one occurrence only. Your recurring schedule still runs normally after this.
          </p>
        </div>

        {formError && (
          <div
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
            aria-live="assertive"
          >
            {formError}
          </div>
        )}

        {recurringSchedules.length === 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-background px-3 py-3">
              <p className="text-sm font-medium text-foreground">No eligible recurring schedules</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Exceptions can only be applied to active recurring schedules. Close this modal, then create or resume a recurring schedule first.
              </p>
            </div>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Button
                type="button"
                onClick={handleClose}
                variant="default"
                size="small"
                className="w-full"
              >
                Back to schedules
              </Button>
              <Button
                type="button"
                href={`/dashboard/calls?line=${lineShortId}`}
                variant="outline"
                size="small"
                className="w-full"
              >
                View line schedules
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {recurringSchedules.length > 1 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Schedule
              </label>
              <Select
                value={scheduleId}
                onValueChange={(value) => {
                  setScheduleId(value);
                  clearFieldError('scheduleId');
                }}
              >
                <SelectTrigger
                  className="w-full h-11"
                  aria-invalid={!!fieldErrors.scheduleId}
                  aria-describedby={fieldErrors.scheduleId ? 'schedule-id-error' : undefined}
                >
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
              {fieldErrors.scheduleId && (
                <p id="schedule-id-error" className="mt-2 text-xs text-destructive" role="alert">
                  {fieldErrors.scheduleId}
                </p>
              )}
            </div>
          )}

          {recurringSchedules.length === 1 && selectedScheduleLabel && (
            <div className="rounded-lg border border-border bg-background px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected schedule</p>
              <p className="text-sm text-foreground">{selectedScheduleLabel}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Exception type
            </label>
            <Select
              value={exceptionType}
              onValueChange={(value) => {
                setExceptionType(value as typeof exceptionType);
                clearFieldError('exceptionDate');
                clearFieldError('snoozeTime');
                clearFieldError('rescheduleDate');
                clearFieldError('rescheduleTime');
              }}
            >
              <SelectTrigger className="w-full h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="skip">Skip</SelectItem>
                <SelectItem value="snooze">Snooze</SelectItem>
                <SelectItem value="reschedule">Reschedule</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">{exceptionTypeHelpText}</p>
          </div>

          {exceptionType !== 'snooze' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Date to apply
              </label>
              <DatePicker
                value={exceptionDate}
                onChange={(value) => {
                  setExceptionDate(value);
                  clearFieldError('exceptionDate');
                }}
                min={todayIso || undefined}
                placeholder="Select date"
                className={fieldErrors.exceptionDate ? 'border-destructive' : undefined}
              />
              {fieldErrors.exceptionDate && (
                <p className="mt-2 text-xs text-destructive" role="alert">
                  {fieldErrors.exceptionDate}
                </p>
              )}
              {originalOccurrence && (
                <p className="text-xs text-muted-foreground mt-2">
                  Occurrence to modify: {originalOccurrence.toLocaleString(DateTime.DATETIME_MED)}
                </p>
              )}
            </div>
          )}

          {exceptionType === 'snooze' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                New time
              </label>
              <TimePicker
                value={snoozeTime}
                onChange={(value) => {
                  setSnoozeTime(value);
                  clearFieldError('snoozeTime');
                }}
                placeholder="Select time"
                className={fieldErrors.snoozeTime ? 'border-destructive' : undefined}
              />
              {fieldErrors.snoozeTime && (
                <p className="mt-2 text-xs text-destructive" role="alert">
                  {fieldErrors.snoozeTime}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                If this time has already passed today, it will move to tomorrow in {lineTimezone}.
              </p>
              {snoozePreview && (
                <p className="text-xs text-muted-foreground mt-2">
                  Next call occurrence will move to {snoozePreview.datetime.toLocaleString(DateTime.DATETIME_FULL)}
                  {snoozePreview.isTomorrow ? ' (tomorrow)' : ''}
                  {snoozePreview.relative ? `, about ${snoozePreview.relative}` : ''} ({snoozePreview.diffMinutes} minutes from now).
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
                  value={rescheduleDateValue || ''}
                  onChange={(date) => {
                    const time = rescheduleTimeValue || '09:00';
                    setRescheduleDateTime(`${date}T${time}`);
                    clearFieldError('rescheduleDate');
                  }}
                  min={todayIso || undefined}
                  placeholder="Select date"
                  className={fieldErrors.rescheduleDate ? 'border-destructive' : undefined}
                />
                {fieldErrors.rescheduleDate && (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {fieldErrors.rescheduleDate}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New time
                </label>
                <TimePicker
                  value={rescheduleTimeValue}
                  onChange={(time) => {
                    const date = rescheduleDateValue || todayIso;
                    setRescheduleDateTime(`${date}T${time}`);
                    clearFieldError('rescheduleTime');
                  }}
                  placeholder="Select time"
                  className={fieldErrors.rescheduleTime ? 'border-destructive' : undefined}
                />
                {fieldErrors.rescheduleTime && (
                  <p className="mt-2 text-xs text-destructive" role="alert">
                    {fieldErrors.rescheduleTime}
                  </p>
                )}
              </div>
              {reschedulePreview && originalOccurrence && (
                <p className="text-xs text-muted-foreground">
                  This moves the call from {originalOccurrence.toLocaleString(DateTime.DATETIME_MED)} to{' '}
                  {reschedulePreview.datetime.toLocaleString(DateTime.DATETIME_FULL)} (
                  {reschedulePreview.relative
                    ? `${reschedulePreview.relative} ${reschedulePreview.direction}`
                    : `${reschedulePreview.diffMinutes} minutes ${reschedulePreview.direction}`})
                  .
                </p>
              )}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
