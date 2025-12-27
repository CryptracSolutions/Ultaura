'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Check, Plus, Edit2, Trash2, AlertCircle, Calendar, Pause, Play, ToggleLeft, ToggleRight, X } from 'lucide-react';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import type { LineRow, ScheduleRow } from '~/lib/ultaura/types';
import { createSchedule, deleteSchedule, getSchedule, updateSchedule } from '~/lib/ultaura/actions';
import { DAYS_OF_WEEK, TIME_OPTIONS, formatTime, getShortLineId } from '~/lib/ultaura';

interface ScheduleClientProps {
  line: LineRow;
  schedules: ScheduleRow[];
}

function normalizeTimeOfDay(timeOfDay: string): string {
  // Our UI time picker uses HH:MM values, but DB values may come back as HH:MM:SS
  const match = timeOfDay.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : timeOfDay;
}

export function ScheduleClient({ line, schedules }: ScheduleClientProps) {
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

  const openEditModal = async (schedule: ScheduleRow) => {
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
  };

  // Allow deep-linking into the edit modal (e.g. from the Calls page)
  useEffect(() => {
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
  }, [pathname, router, schedules, searchParams]);

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

  const formatPhone = (e164: string) => {
    const digits = e164.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return e164;
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
        toast.success('Schedule created');
        setShowCreate(false);
        router.refresh();
      } else {
        setError(result.error || 'Failed to create schedule');
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
    setTogglingId(schedule.id);
    setError(null);

    try {
      const result = await updateSchedule(schedule.id, {
        enabled: !schedule.enabled,
        timezone: line.timezone,
      });

      if (result.success) {
        toast.success(schedule.enabled ? 'Schedule paused' : 'Schedule enabled');
        router.refresh();
      } else {
        setError(result.error || 'Failed to update schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setTogglingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!scheduleToDelete) return;

    setDeletingId(scheduleToDelete);
    setError(null);

    try {
      const result = await deleteSchedule(scheduleToDelete);

      if (result.success) {
        toast.success('Schedule deleted');
        router.refresh();
      } else {
        setError(result.error || 'Failed to delete schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setDeletingId(null);
      setScheduleToDelete(null);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSchedule) return;
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
        setError(result.error || 'Failed to update schedule');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsEditSaving(false);
    }
  };

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
            <Calendar className="w-6 h-6 text-primary" />
          </div>

          <div>
            <h1 className="text-2xl font-semibold text-foreground">Schedules</h1>
            <p className="text-muted-foreground mt-2">
              Set up recurring calls for {line.display_name} at {formatPhone(line.phone_e164)}
            </p>
          </div>
        </div>

        {!showCreate && (
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

      {showCreate && (
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

      {schedules.length > 0 && (
        <div className="mb-8">
          <h2 className="font-semibold text-lg mb-4">Upcoming Schedules</h2>
          <div className="space-y-3">
            {schedules
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
                      <Link
                        href={`/dashboard/lines/${getShortLineId(line.id)}/schedule?edit=${schedule.id}`}
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
                        onClick={() => setScheduleToDelete(schedule.id)}
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
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {schedules.length === 0 && !showCreate && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <Calendar className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">No schedules yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Create a schedule for regular check-in calls. Times are in {line.timezone}.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create First Schedule
          </button>
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
                disabled={isEditLoading || isEditSaving}
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
                    disabled={isEditLoading || isEditSaving}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
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
                <SelectTrigger className="w-full py-3" disabled={isEditLoading || isEditSaving}>
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
                disabled={isEditLoading || isEditSaving}
                className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isEditLoading || isEditSaving || editSelectedDays.length === 0}
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
    </div>
  );
}
