'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarDays, Clock, Plus } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { deleteSchedule, updateSchedule } from '~/lib/ultaura/schedules';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { AddScheduleModal } from '~/components/ultaura/AddScheduleModal';
import Button from '~/core/ui/Button';
import { ScheduleLineFilter } from './components/ScheduleLineFilter';
import { ScheduleCard } from './components/ScheduleCard';
import { EditScheduleModal } from './components/EditScheduleModal';
import { ScheduleExceptions } from './components/ScheduleExceptions';

interface Schedule {
  scheduleId: string;
  lineId: string;
  lineShortId: string;
  displayName: string;
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

  const selectedLineShortId = searchParams.get('line') ?? null;
  const editScheduleIdParam = searchParams.get('edit') ?? null;

  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [editScheduleId, setEditScheduleId] = useState<string | null>(null);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});

  // Deep-link: open edit modal from ?edit= param
  const handledEditIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (disabled || !editScheduleIdParam) {
      handledEditIdRef.current = null;
      return;
    }
    if (handledEditIdRef.current === editScheduleIdParam) return;
    handledEditIdRef.current = editScheduleIdParam;

    const schedule = schedules.find((s) => s.scheduleId === editScheduleIdParam);
    if (schedule) setEditScheduleId(schedule.scheduleId);

    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const query = next.toString();
    router.replace(query ? `?${query}` : '?', { scroll: false });
  }, [disabled, editScheduleIdParam, schedules, router, searchParams]);

  // Derived data
  const selectedLine = selectedLineShortId
    ? lines.find((l) => l.short_id === selectedLineShortId) ?? null
    : null;

  const filteredSchedules = selectedLine
    ? schedules.filter((s) => s.lineId === selectedLine.id)
    : schedules;

  const recurringSchedules = filteredSchedules.filter(
    (s) => !s.isOneTime && s.daysOfWeek.length > 0,
  );
  const oneTimeSchedules = filteredSchedules.filter(
    (s) => s.isOneTime || s.daysOfWeek.length === 0,
  );

  const schedulesByLine = schedules.reduce<Record<string, Schedule[]>>((acc, s) => {
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
  const editingSchedule = editScheduleId
    ? schedules.find((s) => s.scheduleId === editScheduleId)
    : null;
  const editingLine = editingSchedule
    ? lines.find((l) => l.id === editingSchedule.lineId)
    : null;

  function setLoading(scheduleId: string, value: boolean) {
    setLoadingActions((prev) => ({ ...prev, [scheduleId]: value }));
  }

  const handleToggle = async (scheduleId: string, currentEnabled: boolean) => {
    if (disabled) return;
    setLoading(scheduleId, true);

    const schedule = schedules.find((s) => s.scheduleId === scheduleId);
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

  const handleOpenForLine = (lineId: string) => {
    setPreselectedLineId(lineId);
    setShowAddModal(true);
  };

  // -- No lines state --
  if (lines.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">No phone lines yet</h2>
        <p className="text-muted-foreground mb-4">
          Add a phone line first, then you can set up call schedules.
        </p>
        {!disabled && (
          <Button variant="default" size="small" href="/dashboard/lines?action=add">
            <Plus className="w-3 h-3" />
            Add a Phone Line
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top bar: CTA + filter */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {!disabled && (
            <Button
              variant="default"
              size="small"
              onClick={() => {
                if (selectedLine) setPreselectedLineId(selectedLine.id);
                setShowAddModal(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="w-3 h-3" />
              Add Schedule
            </Button>
          )}
        </div>
        {lines.length > 1 && (
          <div className="w-full sm:w-[16rem] -ml-1 sm:-ml-2">
            <ScheduleLineFilter
              lines={lineFilterData}
              currentLineShortId={selectedLineShortId}
            />
          </div>
        )}
      </div>

      {/* ---- All Lines view ---- */}
      {!selectedLine && (
        <div className="space-y-6">
          {lines.map((line) => {
            const lineSchedules = schedulesByLine[line.id] || [];
            const enabledSchedules = lineSchedules.filter((s) => s.enabled).sort(sortByNextRunAt);
            const disabledSchedules = lineSchedules.filter((s) => !s.enabled).sort(sortByNextRunAt);

            return (
              <div key={line.id} className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <h3 className="font-semibold text-foreground">{line.display_name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {lineSchedules.length === 0
                      ? 'No schedules'
                      : `${enabledSchedules.length} active schedule${enabledSchedules.length !== 1 ? 's' : ''}`}
                  </p>
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
                            <Plus className="w-3 h-3" />
                            Create your first schedule
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {enabledSchedules.map((schedule) => (
                        <ScheduleCard
                          key={schedule.scheduleId}
                          schedule={schedule}
                          disabled={disabled}
                          loading={!!loadingActions[schedule.scheduleId]}
                          onEdit={() => handleEdit(schedule.scheduleId)}
                          onToggle={() => handleToggle(schedule.scheduleId, schedule.enabled)}
                          onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                        />
                      ))}

                      {disabledSchedules.length > 0 && enabledSchedules.length > 0 && (
                        <div className="px-6 py-2 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Paused
                          </p>
                        </div>
                      )}
                      {disabledSchedules.map((schedule) => (
                        <ScheduleCard
                          key={schedule.scheduleId}
                          schedule={schedule}
                          disabled={disabled}
                          loading={!!loadingActions[schedule.scheduleId]}
                          onEdit={() => handleEdit(schedule.scheduleId)}
                          onToggle={() => handleToggle(schedule.scheduleId, schedule.enabled)}
                          onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                        />
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
                {recurringSchedules
                  .slice()
                  .sort((a, b) => {
                    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
                    return sortByNextRunAt(a, b);
                  })
                  .map((schedule) => (
                    <ScheduleCard
                      key={schedule.scheduleId}
                      schedule={schedule}
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
          {oneTimeSchedules.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3">One-time Calls</h2>
              <div className="bg-card rounded-xl border border-border overflow-hidden divide-y divide-border">
                {oneTimeSchedules.sort(sortByNextRunAt).map((schedule) => (
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
                    <Plus className="w-3 h-3" />
                    Create First Schedule
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Schedule Exceptions */}
          {filteredSchedules.length > 0 && (
            <div>
              <h2 className="font-semibold text-lg mb-3">Schedule Exceptions</h2>
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
