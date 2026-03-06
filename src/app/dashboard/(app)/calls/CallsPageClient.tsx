'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, CalendarDays, Clock, PhoneOutgoing, Plus, User } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { deleteSchedule, updateSchedule } from '~/lib/ultaura/schedules';
import { useManualCall } from '~/lib/contexts/ManualCallContext';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { AddScheduleModal } from '~/components/ultaura/AddScheduleModal';
import Button from '~/core/ui/Button';
import { ScheduleLineFilter } from './components/ScheduleLineFilter';
import { ScheduleCard } from './components/ScheduleCard';
import { EditScheduleModal } from './components/EditScheduleModal';
import { ScheduleExceptions } from './components/ScheduleExceptions';
import { NewExceptionModal } from './components/NewExceptionModal';

interface Schedule {
  scheduleId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
  lineVoiceName: string | null;
  enabled: boolean;
  nextRunAt: string | null;
  timeOfDay: string;
  daysOfWeek: number[];
  isOneTime: boolean;
  rescheduledFrom?: string | null;
  lineTimezone: string;
  linePhoneE164: string | null;
}

interface CallsPageClientProps {
  lines: LineRow[];
  schedules: Schedule[];
  disabled?: boolean;
}

export function CallsPageClient({ lines, schedules, disabled = false }: CallsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openManualCall } = useManualCall();

  const selectedLineShortId = searchParams.get('line') ?? null;
  const editScheduleIdParam = searchParams.get('edit') ?? null;

  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewExceptionModal, setShowNewExceptionModal] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);
  const [exceptionRefreshTrigger, setExceptionRefreshTrigger] = useState(0);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  const scheduleById = useMemo(
    () => new Map(schedules.map((schedule) => [schedule.scheduleId, schedule])),
    [schedules]
  );

  // Deep-link: open edit modal from ?edit= param
  const handledEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (disabled || !editScheduleIdParam) {
      handledEditIdRef.current = null;
      return;
    }
    if (handledEditIdRef.current === editScheduleIdParam) return;
    handledEditIdRef.current = editScheduleIdParam;

    const schedule = scheduleById.get(editScheduleIdParam);
    if (schedule) setEditScheduleId(schedule.scheduleId);

    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const query = next.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  }, [disabled, editScheduleIdParam, scheduleById, router, searchParams]);

  // Derived data
  const selectedLine = selectedLineShortId
    ? lines.find((l) => l.short_id === selectedLineShortId) ?? null
    : null;

  const orderedSchedules = useMemo(
    () => {
      const compareString = (a: string, b: string) => a.localeCompare(b);

      const compareNumberArray = (a: number[], b: number[]) => {
        const maxLength = Math.max(a.length, b.length);

        for (let index = 0; index < maxLength; index += 1) {
          const left = a[index] ?? Number.POSITIVE_INFINITY;
          const right = b[index] ?? Number.POSITIVE_INFINITY;

          if (left !== right) {
            return left - right;
          }
        }

        return 0;
      };

      return [...schedules].sort((left, right) => {
        if (left.lineId !== right.lineId) {
          return compareString(left.lineId, right.lineId);
        }

        if (left.isOneTime !== right.isOneTime) {
          return left.isOneTime ? 1 : -1;
        }

        const dayComparison = compareNumberArray(left.daysOfWeek, right.daysOfWeek);
        if (dayComparison !== 0) {
          return dayComparison;
        }

        const timeComparison = compareString(left.timeOfDay, right.timeOfDay);
        if (timeComparison !== 0) {
          return timeComparison;
        }

        return compareString(left.scheduleId, right.scheduleId);
      });
    },
    [schedules],
  );

  const filteredSchedules = selectedLine
    ? orderedSchedules.filter((s) => s.lineId === selectedLine.id)
    : orderedSchedules;

  const recurringSchedules = filteredSchedules.filter(
    (s) => !s.isOneTime && s.daysOfWeek.length > 0,
  );
  const standaloneOneTimeSchedules = filteredSchedules.filter(
    (s) => (s.isOneTime || s.daysOfWeek.length === 0) && !s.rescheduledFrom,
  );

  const schedulesByLine = orderedSchedules.reduce<Record<string, Schedule[]>>((acc, s) => {
    if (!acc[s.lineId]) acc[s.lineId] = [];
    acc[s.lineId].push(s);
    return acc;
  }, {});

  const linesForModal = lines.map((line) => ({
    id: line.id,
    accountId: line.account_id,
    displayName: line.display_name,
    timezone: line.timezone,
    quietHoursStart: line.quiet_hours_start,
    quietHoursEnd: line.quiet_hours_end,
    phoneE164: line.phone_e164,
  }));

  const lineFilterData = lines.map((l) => ({
    short_id: l.short_id,
    display_name: l.display_name,
  }));

  const sortByNextRunAt = (a: Schedule, b: Schedule) => {
    const aTime = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  };
  // Find the schedule being edited (to get line info for the modal)
  const editingSchedule = editScheduleId ? scheduleById.get(editScheduleId) ?? null : null;
  const editingLine = editingSchedule
    ? lines.find((l) => l.id === editingSchedule.lineId)
    : null;

  function setLoading(scheduleId: string, value: boolean) {
    setLoadingActions((prev) => ({ ...prev, [scheduleId]: value }));
  }

  const handleToggle = async (scheduleId: string, currentEnabled: boolean) => {
    if (disabled) return;
    setLoading(scheduleId, true);

    const schedule = scheduleById.get(scheduleId);
    const result = await updateSchedule(scheduleId, {
      enabled: !currentEnabled,
      timezone: schedule?.lineTimezone,
    });

    setLoading(scheduleId, false);

    if (result.success) {
      toast.success(currentEnabled ? 'Schedule paused' : 'Schedule resumed');
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to update schedule');
    }
  };

  const handleDelete = async () => {
    if (!scheduleToDelete) return;

    const result = await deleteSchedule(scheduleToDelete);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to delete schedule');
      throw new Error('Delete failed');
    }
    toast.success('Schedule deleted');
    router.refresh();
  };

  const handleEdit = (scheduleId: string) => {
    if (disabled) return;
    setEditScheduleId(scheduleId);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setPreselectedLineId(null);
  };

  const openAddModal = (lineId?: string) => {
    if (lineId) {
      setPreselectedLineId(lineId);
    }
    setShowAddModal(true);
  };

  const handleOpenForLine = (lineId: string) => {
    openAddModal(lineId);
  };

  // -- No lines state --
  if (lines.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8">
        <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">No phone lines yet</h2>
        <p className="text-muted-foreground mb-4">
          Add a phone line first, then you can set up call schedules.
        </p>
        {!disabled && (
          <div className="flex w-full justify-end">
            <Button variant="default" size="small" href="/dashboard/lines?action=add">
              <Plus className="w-4 h-4" />
              Add a Phone Line
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top bar: CTA + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {lines.length > 1 && (
          <div className="w-full sm:w-[16rem] rounded-xl ring-1 ring-primary">
            <ScheduleLineFilter
              lines={lineFilterData}
              currentLineShortId={selectedLineShortId}
            />
          </div>
        )}
        {!disabled && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="default"
              size="small"
              onClick={() => openAddModal(selectedLine?.id)}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </Button>
            <Button
              variant="default"
              size="small"
              onClick={() => openManualCall({ preselectedLineId: selectedLine?.id })}
              className="w-full sm:w-auto"
            >
              <PhoneOutgoing className="w-4 h-4" />
              Place Call
            </Button>
            {selectedLine && recurringSchedules.length > 0 && (
              <Button
                variant="default"
                size="small"
                onClick={() => setShowNewExceptionModal(true)}
                className="w-full sm:w-auto"
              >
                <CalendarClock className="w-4 h-4" />
                Move Call
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ---- All Lines view ---- */}
      {!selectedLine && (
        <div className="space-y-6">
          {lines.map((line) => {
            const lineSchedules = schedulesByLine[line.id] ?? [];
            const recurringScheduleIds = lineSchedules
              .filter((schedule) => !schedule.isOneTime && schedule.daysOfWeek.length > 0)
              .map((schedule) => schedule.scheduleId);
            const activeScheduleCount = lineSchedules.filter((s) => s.enabled).length;
            const hasPausedSchedules = activeScheduleCount > 0 && lineSchedules.some((s) => !s.enabled);

            return (
              <div key={line.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/30 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      {line.display_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {lineSchedules.length === 0
                        ? 'No schedules'
                        : `${activeScheduleCount} active schedule${activeScheduleCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-border">
                  {lineSchedules.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No schedules set up yet</p>
                      {!disabled && (
                        <div className="mt-2">
                          <Button
                            variant="default"
                            size="small"
                            onClick={() => handleOpenForLine(line.id)}
                          >
                            <Plus className="w-4 h-4" />
                            Create your first schedule
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {lineSchedules.map((schedule, index) => (
                        <div key={schedule.scheduleId}>
                          {hasPausedSchedules && !schedule.enabled && (
                            <div className="px-6 py-2 bg-muted/30">
                              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                                Paused
                              </p>
                            </div>
                          )}
                          <ScheduleCard
                            schedule={schedule}
                            title={recurringScheduleIds.includes(schedule.scheduleId)
                              ? `Schedule ${recurringScheduleIds.indexOf(schedule.scheduleId) + 1}`
                              : undefined}
                            disabled={disabled}
                            loading={!!loadingActions[schedule.scheduleId]}
                            onEdit={() => handleEdit(schedule.scheduleId)}
                            onToggle={() => handleToggle(schedule.scheduleId, schedule.enabled)}
                            onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                          />
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Single line view ---- */}
      {selectedLine && (
        <div className="space-y-6">
          {/* Recurring Schedules */}
          {recurringSchedules.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3">Recurring Schedules</h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
                {recurringSchedules.map((schedule, index) => (
                  <ScheduleCard
                    key={schedule.scheduleId}
                    schedule={schedule}
                    title={`Schedule ${index + 1}`}
                    disabled={disabled}
                    loading={!!loadingActions[schedule.scheduleId]}
                    onEdit={() => handleEdit(schedule.scheduleId)}
                    onToggle={() => handleToggle(schedule.scheduleId, schedule.enabled)}
                    onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* One-time Calls */}
          {standaloneOneTimeSchedules.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-1">One-time Calls</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Single calls that are not tied to a recurring schedule.
              </p>
              <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
                {[...standaloneOneTimeSchedules].sort(sortByNextRunAt).map((schedule) => (
                  <ScheduleCard
                    key={schedule.scheduleId}
                    schedule={schedule}
                    disabled={disabled}
                    loading={!!loadingActions[schedule.scheduleId]}
                    onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredSchedules.length === 0 && (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No schedules for {selectedLine.display_name}</p>
              {!disabled && (
                <div className="mt-3">
                  <Button
                    variant="default"
                    size="small"
                    onClick={() => handleOpenForLine(selectedLine.id)}
                  >
                    <Plus className="w-4 h-4" />
                    Create First Schedule
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Schedule Exceptions */}
          {filteredSchedules.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3">Schedule Changes</h2>
              <ScheduleExceptions
                lineId={selectedLine.id}
                lineShortId={selectedLine.short_id}
                lineTimezone={selectedLine.timezone}
                schedules={filteredSchedules.map((s) => ({
                  scheduleId: s.scheduleId,
                  timeOfDay: s.timeOfDay,
                  daysOfWeek: s.daysOfWeek,
                  enabled: s.enabled,
                }))}
                disabled={disabled}
                refreshTrigger={exceptionRefreshTrigger}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={scheduleToDelete !== null}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
        title="Delete Schedule"
        description="Are you sure you want to delete this schedule?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />

      {/* Edit modal */}
      <EditScheduleModal
        scheduleId={editScheduleId}
        lineShortId={editingLine?.short_id ?? ''}
        lineTimezone={editingLine?.timezone ?? 'America/Los_Angeles'}
        lineDisplayName={editingLine?.display_name ?? ''}
        quietHoursStart={editingLine?.quiet_hours_start ?? '21:00'}
        quietHoursEnd={editingLine?.quiet_hours_end ?? '09:00'}
        disabled={disabled}
        onClose={() => setEditScheduleId(null)}
      />

      {/* Create Exception modal */}
      {selectedLine && (
        <NewExceptionModal
          open={showNewExceptionModal}
          onOpenChange={setShowNewExceptionModal}
          schedules={recurringSchedules.map((s) => ({
            scheduleId: s.scheduleId,
            timeOfDay: s.timeOfDay,
            daysOfWeek: s.daysOfWeek,
            enabled: s.enabled,
          }))}
          lineShortId={selectedLine.short_id}
          lineTimezone={selectedLine.timezone}
          onSuccess={() => setExceptionRefreshTrigger((k) => k + 1)}
        />
      )}

      {/* Add modal */}
      <AddScheduleModal
        open={showAddModal}
        onOpenChange={handleCloseModal}
        lines={linesForModal}
        preselectedLineId={preselectedLineId}
      />
    </div>
  );
}
