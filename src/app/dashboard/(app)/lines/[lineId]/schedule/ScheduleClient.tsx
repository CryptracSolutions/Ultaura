'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { ArrowLeft, Clock, Check, Plus, Edit2, Trash2, AlertCircle, Calendar, Pause, Play, ToggleLeft, ToggleRight, X, CalendarClock, AlarmClock } from 'lucide-react';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import type { LineRow, ScheduleRow, ScheduleExceptionRow } from '~/lib/ultaura/types';
import { createSchedule, deleteSchedule, getSchedule, updateSchedule } from '~/lib/ultaura/schedules';
import { createScheduleException, deleteScheduleException } from '~/lib/ultaura/schedule-exceptions';
import { DAYS_OF_WEEK, TIME_OPTIONS, formatTime } from '~/lib/ultaura/constants';
import { extractOriginalTimeOfDay, normalizeTimeOfDay } from '~/lib/ultaura/schedule-helpers';

interface ScheduleClientProps {
  line: LineRow;
  schedules: ScheduleRow[];
  exceptions: ScheduleExceptionRow[];
  disabled?: boolean;
}


export function ScheduleClient({ line, schedules, exceptions, disabled = false }: ScheduleClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledEditIdRef = useRef<string | null>(null);
  const editLoadSeqRef = useRef(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Weekdays
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

  // Edit modal state
  const [editingSchedule, setEditingSchedule] = useState<ScheduleRow | null>(null);
  const [editSelectedDays, setEditSelectedDays] = useState<number[]>([]);
  const [editSelectedTime, setEditSelectedTime] = useState('09:00');
  const [editEnabled, setEditEnabled] = useState(true);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);

  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionType, setExceptionType] = useState<'skip' | 'snooze' | 'reschedule'>('skip');
  const [exceptionScheduleId, setExceptionScheduleId] = useState('');
  const [exceptionDate, setExceptionDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('');
  const [rescheduleDateTime, setRescheduleDateTime] = useState('');
  const [exceptionError, setExceptionError] = useState<string | null>(null);
  const [exceptionLoading, setExceptionLoading] = useState(false);
  const [exceptionToDelete, setExceptionToDelete] = useState<ScheduleExceptionRow | null>(null);

  const recurringSchedules = useMemo(
    () => schedules.filter((schedule) => !schedule.is_one_time && schedule.days_of_week.length > 0),
    [schedules]
  );
  const oneTimeSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.is_one_time || schedule.days_of_week.length === 0),
    [schedules]
  );

  const scheduleOptions = useMemo(
    () => schedules
      .filter((schedule) => schedule.enabled && schedule.next_run_at)
      .slice()
      .sort((a, b) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime()),
    [schedules]
  );

  const scheduleMap = useMemo(() => {
    return new Map(schedules.map((schedule) => [schedule.id, schedule]));
  }, [schedules]);

  const snoozePreview = useMemo(() => {
    if (exceptionType !== 'snooze' || !snoozeTime) return null;
    const now = DateTime.now().setZone(line.timezone);
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
  }, [exceptionType, line.timezone, snoozeTime]);

  const rescheduleSourceMap = useMemo(() => {
    const map = new Map<string, string>();
    exceptions.forEach((exception) => {
      if (exception.exception_type !== 'reschedule' || !exception.reschedule_schedule_id) {
        return;
      }
      const dayLabel = DateTime.fromISO(exception.exception_date, { zone: line.timezone })
        .toFormat('cccc');
      const originalTime = extractOriginalTimeOfDay(exception.metadata);
      const timeLabel = originalTime ? formatTime(originalTime) : null;
      const label = timeLabel
        ? `Rescheduled from ${dayLabel} ${timeLabel}`
        : `Rescheduled from ${dayLabel}`;
      map.set(exception.reschedule_schedule_id, label);
    });
    return map;
  }, [exceptions, line.timezone]);

  const toggleDay = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const toggleEditDay = (day: number) => {
    if (editSelectedDays.includes(day)) {
      setEditSelectedDays(editSelectedDays.filter((d) => d !== day));
    } else {
      setEditSelectedDays([...editSelectedDays, day].sort());
    }
  };

  const openEditModal = useCallback(async (schedule: ScheduleRow) => {
    if (disabled) return;

    setShowCreate(false);
    setEditingSchedule(schedule);
    setIsEditLoading(true);

    const requestSeq = ++editLoadSeqRef.current;

    try {
      const latest = await getSchedule(schedule.id);
      if (editLoadSeqRef.current !== requestSeq) return;

      if (!latest) {
        toast.error('Failed to load schedule');
        setEditingSchedule(null);
        return;
      }

      setEditingSchedule(latest);
      setEditSelectedDays(latest.days_of_week);
      setEditSelectedTime(normalizeTimeOfDay(latest.time_of_day));
      setEditEnabled(latest.enabled);
    } catch {
      if (editLoadSeqRef.current !== requestSeq) return;
      toast.error('Failed to load schedule');
      setEditingSchedule(null);
    } finally {
      if (editLoadSeqRef.current === requestSeq) {
        setIsEditLoading(false);
      }
    }
  }, [disabled]);

  // Allow deep-linking into the edit modal (e.g. from the Calls page)
  useEffect(() => {
    if (disabled) return;

    const editId = searchParams.get('edit');
    if (!editId) {
      handledEditIdRef.current = null;
      return;
    }

    // Avoid re-opening multiple times for the same URL param while it exists
    if (handledEditIdRef.current === editId) return;
    handledEditIdRef.current = editId;

    const schedule = schedules.find((s) => s.id === editId);
    if (!schedule) return;

    void openEditModal(schedule);

    // Clean up the URL so refresh/back doesn't keep reopening
    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const nextUrl = next.toString() ? `${pathname}?${next}` : pathname;
    router.replace(nextUrl);
  }, [disabled, openEditModal, pathname, router, schedules, searchParams]);

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

  const formatDate = (dateString: string) => {
    return DateTime.fromISO(dateString, { zone: line.timezone })
      .toLocaleString(DateTime.DATE_FULL);
  };

  const getScheduleLocalDate = (schedule: ScheduleRow) => {
    if (!schedule.next_run_at) return null;
    return DateTime.fromISO(schedule.next_run_at).setZone(schedule.timezone).toISODate();
  };

  const getScheduleSummary = (schedule: Pick<ScheduleRow, 'days_of_week' | 'time_of_day'>) => {
    const days = schedule.days_of_week
      .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.label)
      .filter(Boolean)
      .join(', ');

    const normalizedTime = normalizeTimeOfDay(schedule.time_of_day);
    const timeLabel =
      TIME_OPTIONS.find((t) => t.value === normalizedTime)?.label ?? normalizedTime;

    return { days, timeLabel };
  };

  const getScheduleOptionLabel = (schedule: ScheduleRow) => {
    if (schedule.is_one_time || schedule.days_of_week.length === 0) {
      return schedule.next_run_at
        ? `One-time: ${formatDateTime(schedule.next_run_at)}`
        : 'One-time schedule';
    }

    const { days, timeLabel } = getScheduleSummary(schedule);
    return `${days || 'Custom days'} at ${timeLabel}`;
  };

  const getExceptionTypeLabel = (type: ScheduleExceptionRow['exception_type']) => {
    switch (type) {
      case 'skip':
        return 'Skip';
      case 'snooze':
        return 'Snooze';
      case 'reschedule':
        return 'Reschedule';
      default:
        return type;
    }
  };

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
  };

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
      const result = await createSchedule(line.account_id, {
        lineId: line.id,
        daysOfWeek: selectedDays,
        timeOfDay: selectedTime,
        timezone: line.timezone,
      });

      if (result.success) {
        toast.success('Schedule created');
        setShowCreate(false);
        router.refresh();
      } else {
        setError(result.error.message || 'Failed to create schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedDays([1, 2, 3, 4, 5]);
    setSelectedTime('09:00');
    setError(null);
  };

  const handleToggleEnabled = async (schedule: ScheduleRow) => {
    if (disabled) return;

    setTogglingId(schedule.id);
    setError(null);

    try {
      const result = await updateSchedule(schedule.id, {
        enabled: !schedule.enabled,
        timezone: line.timezone,
      });

      if (result.success) {
        toast.success(schedule.enabled ? 'Schedule paused' : 'Schedule resumed');
        router.refresh();
      } else {
        const message = result.error.message || 'Failed to update schedule';
        setError(message);
        toast.error(message);
      }
    } catch {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;
    if (disabled) return;

    setDeletingId(scheduleToDelete);
    setError(null);

    try {
      const result = await deleteSchedule(scheduleToDelete);

      if (result.success) {
        toast.success('Schedule deleted');
        router.refresh();
      } else {
        const message = result.error.message || 'Failed to delete schedule';
        setError(message);
        toast.error(message);
      }
    } catch {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setDeletingId(null);
      setScheduleToDelete(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
    if (disabled) return;
    if (editSelectedDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    setIsEditSaving(true);
    setError(null);

    try {
      const result = await updateSchedule(editingSchedule.id, {
        enabled: editEnabled,
        daysOfWeek: editSelectedDays,
        timeOfDay: editSelectedTime,
        timezone: line.timezone,
      });

      if (result.success) {
        toast.success('Schedule updated');
        setEditingSchedule(null);
        router.refresh();
      } else {
        const message = result.error.message || 'Failed to update schedule';
        setError(message);
        toast.error(message);
      }
    } catch {
      setError('An unexpected error occurred');
      toast.error('An unexpected error occurred');
    } finally {
      setIsEditSaving(false);
    }
  };

  useEffect(() => {
    if (!showExceptionModal) return;
    if (scheduleOptions.length === 0) return;
    if (!exceptionScheduleId) {
      const nextSchedule = scheduleOptions[0];
      setExceptionScheduleId(nextSchedule.id);
      const localDate = getScheduleLocalDate(nextSchedule);
      if (localDate) {
        setExceptionDate(localDate);
      }
      if (nextSchedule.next_run_at) {
        setRescheduleDateTime(
          DateTime.fromISO(nextSchedule.next_run_at)
            .setZone(line.timezone)
            .toFormat("yyyy-MM-dd'T'HH:mm")
        );
      }
      setSnoozeTime(
        DateTime.now().setZone(line.timezone).plus({ hours: 1 }).toFormat('HH:mm')
      );
    }
  }, [exceptionScheduleId, line.timezone, scheduleOptions, showExceptionModal]);

  useEffect(() => {
    if (!exceptionScheduleId) return;
    const selected = scheduleMap.get(exceptionScheduleId);
    if (!selected) return;
    const localDate = getScheduleLocalDate(selected);
    if (localDate) {
      setExceptionDate(localDate);
    }
    if (selected.next_run_at) {
      setRescheduleDateTime(
        DateTime.fromISO(selected.next_run_at)
          .setZone(line.timezone)
          .toFormat("yyyy-MM-dd'T'HH:mm")
      );
    }
  }, [exceptionScheduleId, line.timezone, scheduleMap]);

  const openExceptionModal = () => {
    if (disabled) return;
    if (scheduleOptions.length === 0) {
      toast.error('No upcoming schedules to edit');
      return;
    }
    setExceptionError(null);
    setExceptionType('skip');
    setExceptionScheduleId('');
    setExceptionDate('');
    setRescheduleDateTime('');
    setSnoozeTime('');
    setShowExceptionModal(true);
  };

  const handleExceptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled) return;

    const selected = scheduleMap.get(exceptionScheduleId);
    if (!selected || !selected.next_run_at) {
      setExceptionError('Select a schedule with an upcoming call.');
      return;
    }

    setExceptionLoading(true);
    setExceptionError(null);

    try {
      const today = DateTime.now().setZone(line.timezone).toISODate();
      let targetDate = exceptionDate;
      if (exceptionType === 'snooze') {
        const localDate = getScheduleLocalDate(selected);
        if (!localDate) {
          setExceptionError('Unable to determine the next scheduled date.');
          return;
        }
        targetDate = localDate;
      } else if (!targetDate) {
        setExceptionError('Choose a date to apply the exception.');
        return;
      }

      if (today && targetDate && targetDate < today) {
        setExceptionError('Exception date must be today or later.');
        return;
      }

      let newDatetime: string | undefined;

      if (exceptionType === 'snooze') {
        if (!snoozeTime) {
          setExceptionError('Choose a time to snooze to.');
          return;
        }

        const [hoursStr, minutesStr] = snoozeTime.split(':');
        const hours = Number(hoursStr);
        const minutes = Number(minutesStr);
        const now = DateTime.now().setZone(line.timezone);
        let candidate = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
        if (candidate <= now) {
          candidate = candidate.plus({ days: 1 });
        }

        const diffMinutes = candidate.diff(now, 'minutes').minutes;
        if (diffMinutes < 5 || diffMinutes > 1440) {
          setExceptionError('Snooze must be between 5 minutes and 24 hours from now.');
          return;
        }

        newDatetime = candidate.toFormat("yyyy-MM-dd'T'HH:mm:ss");
      }

      if (exceptionType === 'reschedule') {
        if (!rescheduleDateTime) {
          setExceptionError('Choose a new date and time.');
          return;
        }
        newDatetime = rescheduleDateTime.length === 16
          ? `${rescheduleDateTime}:00`
          : rescheduleDateTime;
      }

      const result = await createScheduleException({
        scheduleId: selected.id,
        exceptionDate: targetDate,
        exceptionType,
        newDatetime,
      }, line.short_id);

      if (!result.success) {
        setExceptionError(result.error.message || 'Failed to create exception');
        return;
      }

      toast.success('Exception saved');
      setShowExceptionModal(false);
      router.refresh();
    } catch {
      setExceptionError('An unexpected error occurred');
    } finally {
      setExceptionLoading(false);
    }
  };

  const handleExceptionDelete = async () => {
    if (!exceptionToDelete) return;
    setExceptionLoading(true);
    const result = await deleteScheduleException(exceptionToDelete.id, line.short_id);
    setExceptionLoading(false);

    if (result.success) {
      toast.success('Exception removed');
      setExceptionToDelete(null);
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to delete exception');
    }
  };

  return (
    <div className="w-full p-6 pb-12">
      <Link
        href={`/dashboard/lines/${line.short_id}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Line Details
      </Link>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-foreground">Schedules</h1>
            <p className="text-muted-foreground mt-2">
              Set up recurring calls for {line.display_name} at {formatPhone(line.phone_e164)}
            </p>
          </div>
        </div>

        {!showCreate && !disabled && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Schedule
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {showCreate && !disabled && (
        <div className="mb-8 p-6 rounded-lg border border-input bg-card">
          <h2 className="font-semibold text-lg mb-4">Create New Schedule</h2>

          <form onSubmit={handleSubmit} className="space-y-8">
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
                    className={`px-3 py-3 sm:px-4 sm:py-2 rounded-lg border text-sm font-medium transition-colors ${
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
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="w-full py-3">
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

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  resetCreateForm();
                }}
                className="w-full sm:flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || selectedDays.length === 0}
                className="w-full sm:flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  'Creating...'
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Create Schedule
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {recurringSchedules.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-4">Recurring schedules</h2>
          <div className="space-y-3">
            {recurringSchedules
              .slice()
              .sort((a, b) => {
                if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
                const aNext = a.next_run_at
                  ? new Date(a.next_run_at).getTime()
                  : Number.POSITIVE_INFINITY;
                const bNext = b.next_run_at
                  ? new Date(b.next_run_at).getTime()
                  : Number.POSITIVE_INFINITY;
                return aNext - bNext;
              })
              .map((schedule) => {
                const { days, timeLabel } = getScheduleSummary(schedule);
                const isToggling = togglingId === schedule.id;
                const isDeleting = deletingId === schedule.id;

                return (
                  <div
                      key={schedule.id}
                      className={`p-4 rounded-lg border bg-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${
                        schedule.enabled
                          ? 'border-input'
                          : 'border-yellow-300 dark:border-yellow-700'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground">{days || 'Custom days'} at {timeLabel}</p>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {schedule.next_run_at
                            ? `Next: ${formatDateTime(schedule.next_run_at)}`
                            : 'Next run: TBD'}
                        </span>

                        {!schedule.enabled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-xs font-medium">
                            Paused
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 flex-wrap">
                      {!disabled && (
                        <>
                          <Link
                            href={`/dashboard/lines/${line.short_id}/schedule?edit=${schedule.id}`}
                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                            title="Edit schedule"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>

                          <button
                            onClick={() => handleToggleEnabled(schedule)}
                            disabled={isToggling}
                            className={`p-2 rounded-lg text-muted-foreground transition-colors disabled:opacity-50 ${
                              schedule.enabled
                                ? 'hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                            }`}
                            title={schedule.enabled ? 'Pause schedule' : 'Resume schedule'}
                          >
                            {isToggling ? (
                              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : schedule.enabled ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>

                          <button
                            onClick={() => {
                              setScheduleToDelete(schedule.id);
                              toast.message('Confirm delete schedule');
                            }}
                            disabled={isDeleting}
                            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                            title="Delete schedule"
                          >
                            {isDeleting ? (
                              <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {oneTimeSchedules.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-4">Upcoming one-time calls</h2>
          <div className="space-y-3">
            {oneTimeSchedules
              .slice()
              .sort((a, b) => {
                const aNext = a.next_run_at ? new Date(a.next_run_at).getTime() : Number.POSITIVE_INFINITY;
                const bNext = b.next_run_at ? new Date(b.next_run_at).getTime() : Number.POSITIVE_INFINITY;
                return aNext - bNext;
              })
              .map((schedule) => {
                const isDeleting = deletingId === schedule.id;
                const rescheduledFrom = rescheduleSourceMap.get(schedule.id) ?? null;
                return (
                  <div
                    key={schedule.id}
                    className="p-4 rounded-lg border border-input bg-card flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="w-4 h-4 text-muted-foreground" />
                        <p className="text-foreground font-medium">One-time call</p>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {schedule.next_run_at
                            ? `Scheduled: ${formatDateTime(schedule.next_run_at)}`
                            : 'Scheduled time: TBD'}
                        </span>
                      </div>
                      {rescheduledFrom ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {rescheduledFrom}
                        </div>
                      ) : null}
                    </div>
                    {!disabled && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setScheduleToDelete(schedule.id);
                            toast.message('Confirm delete schedule');
                          }}
                          disabled={isDeleting}
                          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          title="Delete schedule"
                        >
                          {isDeleting ? (
                            <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">Schedule exceptions</h2>
          {!disabled && (
            <button
              onClick={openExceptionModal}
              className="inline-flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="w-4 h-4" />
              New exception
            </button>
          )}
        </div>

        {exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming exceptions.</p>
        ) : (
          <div className="space-y-2">
            {exceptions.map((exception) => {
              const schedule = scheduleMap.get(exception.schedule_id);
              const scheduleLabel = schedule ? getScheduleOptionLabel(schedule) : 'Schedule';
              const newTime = exception.new_datetime
                ? DateTime.fromISO(exception.new_datetime).setZone(line.timezone).toLocaleString(DateTime.DATETIME_FULL)
                : null;

              return (
                <div
                  key={exception.id}
                  className="rounded-lg border border-input bg-card px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {exception.exception_type === 'snooze' ? (
                        <AlarmClock className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                      )}
                      {getExceptionTypeLabel(exception.exception_type)} &middot; {formatDate(exception.exception_date)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {scheduleLabel}
                      {newTime ? ` → ${newTime}` : null}
                    </div>
                  </div>
                  {!disabled && (
                    <button
                      onClick={() => setExceptionToDelete(exception)}
                      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {schedules.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No schedules yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Create a schedule for regular check-in calls. Times are in {line.timezone}.
          </p>
          {!disabled && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Schedule
            </button>
          )}
        </div>
      )}

      <ConfirmationDialog
        open={scheduleToDelete !== null}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
        title="Delete Schedule"
        description="Are you sure you want to delete this schedule?"
        confirmLabel="Delete Schedule"
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmationDialog
        open={exceptionToDelete !== null}
        onOpenChange={(open) => !open && setExceptionToDelete(null)}
        title="Remove Exception"
        description="Are you sure you want to remove this exception?"
        confirmLabel="Remove Exception"
        variant="destructive"
        onConfirm={handleExceptionDelete}
      />

      {/* Edit Modal */}
      <Dialog
        open={editingSchedule !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSchedule(null);
            setIsEditLoading(false);
            setIsEditSaving(false);
          }
        }}
      >
        <DialogContent
          className="max-w-[468px]"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Edit schedule</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Update days and time for {line.display_name}
              </DialogDescription>
            </div>

            <button
              type="button"
              onClick={() => setEditingSchedule(null)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="rounded-lg border border-input bg-background p-4">
              <button
                type="button"
                onClick={() => setEditEnabled(!editEnabled)}
                disabled={disabled || isEditLoading || isEditSaving}
                className="flex items-center justify-between w-full"
              >
                <div className="text-left">
                  <p className="font-medium text-foreground">Schedule active</p>
                  <p className="text-sm text-muted-foreground">
                    {editEnabled ? 'Calls will be made on schedule' : 'Schedule is paused'}
                  </p>
                </div>
                {editEnabled ? (
                  <ToggleRight className="w-8 h-8 text-primary" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                )}
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Days
              </label>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleEditDay(day.value)}
                    disabled={disabled || isEditLoading || isEditSaving}
                    className={`px-3 py-3 rounded-lg border text-sm font-medium transition-colors ${
                      editSelectedDays.includes(day.value)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-foreground border-input hover:bg-muted'
                    }`}
                  >
                    {day.short}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Time
              </label>
              <Select value={editSelectedTime} onValueChange={setEditSelectedTime}>
                <SelectTrigger className="w-full h-11" disabled={disabled || isEditLoading || isEditSaving}>
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

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingSchedule(null)}
                disabled={disabled || isEditLoading || isEditSaving}
                className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={disabled || isEditLoading || isEditSaving || editSelectedDays.length === 0}
                className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="inline-flex w-full items-center justify-center gap-2">
                  {isEditLoading ? (
                    <>
                      <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Loading...
                    </>
                  ) : isEditSaving ? (
                    <>
                      <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </span>
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exception Modal */}
      <Dialog
        open={showExceptionModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowExceptionModal(false);
            setExceptionError(null);
            setExceptionLoading(false);
          }
        }}
      >
        <DialogContent
          className="max-w-[468px]"
          overlayClassName="bg-black/50 backdrop-blur-none"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">New exception</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Skip, snooze, or reschedule a single call.
              </DialogDescription>
            </div>

            <button
              type="button"
              onClick={() => setShowExceptionModal(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {exceptionError && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {exceptionError}
            </div>
          )}

          <form onSubmit={handleExceptionSubmit} className="space-y-4">
            {scheduleOptions.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Schedule
                </label>
                <Select value={exceptionScheduleId} onValueChange={setExceptionScheduleId}>
                  <SelectTrigger className="w-full h-11">
                    <SelectValue placeholder="Select a schedule" />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleOptions.map((schedule) => (
                      <SelectItem key={schedule.id} value={schedule.id}>
                        {getScheduleOptionLabel(schedule)}
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
                <input
                  type="date"
                  value={exceptionDate}
                  onChange={(e) => setExceptionDate(e.target.value)}
                  min={DateTime.now().setZone(line.timezone).toISODate() ?? undefined}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            {exceptionType === 'snooze' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New time
                </label>
                <input
                  type="time"
                  value={snoozeTime}
                  onChange={(e) => setSnoozeTime(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Snoozes the next call. If the time is earlier than now, we’ll schedule for tomorrow.
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
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  New date & time
                </label>
                <input
                  type="datetime-local"
                  value={rescheduleDateTime}
                  onChange={(e) => setRescheduleDateTime(e.target.value)}
                  min={DateTime.now().setZone(line.timezone).toFormat("yyyy-MM-dd'T'HH:mm")}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowExceptionModal(false)}
                className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
                disabled={exceptionLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={exceptionLoading}
                className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {exceptionLoading ? (
                  <>
                    <span className="w-4 h-4 block animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Saving...
                  </>
                ) : (
                  'Save Exception'
                )}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
