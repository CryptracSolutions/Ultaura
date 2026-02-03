'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  CalendarDays,
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  PauseCircle,
} from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { deleteSchedule } from '~/lib/ultaura/schedules';
import { DAYS_OF_WEEK, formatTime } from '~/lib/ultaura/constants';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { AddScheduleModal } from '~/components/ultaura/AddScheduleModal';
import {
  COMPACT_OUTLINE_BUTTON_CLASS,
  COMPACT_PRIMARY_BUTTON_CLASS,
} from '~/app/dashboard/(app)/components/compact-action-classes';

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
}

interface CallsPageClientProps {
  lines: LineRow[];
  schedules: Schedule[];
  disabled?: boolean;
}

export function CallsPageClient({ lines, schedules, disabled = false }: CallsPageClientProps) {
  const router = useRouter();
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [preselectedLineId, setPreselectedLineId] = useState<string | null>(null);

  // Map LineRow to LineForScheduleModal
  const linesForModal = lines.map((line) => ({
    id: line.id,
    accountId: line.account_id,
    displayName: line.display_name,
    timezone: line.timezone,
    quietHoursStart: line.quiet_hours_start,
    quietHoursEnd: line.quiet_hours_end,
    phoneE164: line.phone_e164,
  }));

  const handleOpenForLine = (lineId: string) => {
    setPreselectedLineId(lineId);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setPreselectedLineId(null);
  };

  const sortByNextRunAt = (a: Schedule, b: Schedule) => {
    const aTime = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Number.POSITIVE_INFINITY;
    const bTime = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Number.POSITIVE_INFINITY;
    return aTime - bTime;
  };

  // Group schedules by line
  const schedulesByLine = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.lineId]) {
      acc[schedule.lineId] = [];
    }
    acc[schedule.lineId].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const handleDeleteSchedule = async () => {
    if (!scheduleToDelete) return;

    const result = await deleteSchedule(scheduleToDelete);
    if (!result.success) {
      toast.error(result.error.message || 'Failed to delete schedule');
      throw new Error('Delete failed');
    }
    toast.success('Schedule deleted');
    router.refresh();
  };

  const formatDays = (days: number[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes(0) && !days.includes(6)) return 'Weekdays';
    if (days.length === 2 && days.includes(0) && days.includes(6)) return 'Weekends';
    return days
      .map((d) => DAYS_OF_WEEK.find((day) => day.value === d)?.short || d)
      .join(', ');
  };

  const formatNextCall = (nextRunAt: string | null) => {
    if (!nextRunAt) return 'Not scheduled';
    const date = new Date(nextRunAt);
    const now = new Date();
    const diff = date.getTime() - now.getTime();

    if (diff < 0) return 'Soon';
    if (diff < 24 * 60 * 60 * 1000) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    if (diff < 48 * 60 * 60 * 1000) {
      return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Add Schedule Button */}
      {!disabled && lines.length > 0 && (
        <div>
          <button
            onClick={() => setShowAddModal(true)}
            className={COMPACT_PRIMARY_BUTTON_CLASS}
          >
            <Plus className="w-3 h-3" />
            Add Schedule
          </button>
        </div>
      )}

      {/* No lines state */}
      {lines.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-8 text-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-foreground mb-2">No phone lines yet</h2>
          <p className="text-muted-foreground mb-4">
            Add a phone line first, then you can set up call schedules.
          </p>
          {!disabled && (
            <Link
              href="/dashboard/lines?action=add"
              className={COMPACT_PRIMARY_BUTTON_CLASS}
            >
              <Plus className="w-3 h-3" />
              Add a Phone Line
            </Link>
          )}
        </div>
      )}

      {/* Schedules grouped by line */}
      {lines.length > 0 && (
        <div className="space-y-6">
          {lines.map((line) => {
            const lineSchedules = schedulesByLine[line.id] || [];
            const enabledSchedules = lineSchedules.filter((s) => s.enabled).sort(sortByNextRunAt);
            const disabledSchedules = lineSchedules.filter((s) => !s.enabled).sort(sortByNextRunAt);

            return (
              <div key={line.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Line Header */}
                <div className="px-6 py-4 border-b border-border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{line.display_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {lineSchedules.length === 0
                          ? 'No schedules'
                          : `${enabledSchedules.length} active schedule${enabledSchedules.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    <Link
                      href={`/dashboard/lines/${line.short_id}/schedule`}
                      className={COMPACT_OUTLINE_BUTTON_CLASS}
                    >
                      View All
                    </Link>
                  </div>
                </div>

                {/* Schedules */}
                <div className="divide-y divide-border">
                  {lineSchedules.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No schedules set up yet</p>
                      {!disabled && (
                        <div className="mt-2">
                          <button
                            onClick={() => handleOpenForLine(line.id)}
                            className={COMPACT_PRIMARY_BUTTON_CLASS}
                          >
                            <Plus className="w-3 h-3" />
                            Create your first schedule
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Enabled schedules first */}
                      {enabledSchedules.map((schedule) => (
                        <ScheduleRow
                          key={schedule.scheduleId}
                          schedule={schedule}
                          onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                          formatDays={formatDays}
                          formatNextCall={formatNextCall}
                          disabled={disabled}
                        />
                      ))}

                      {/* Disabled schedules */}
                      {disabledSchedules.length > 0 && enabledSchedules.length > 0 && (
                        <div className="px-6 py-2 bg-muted/30">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">
                            Paused
                          </p>
                        </div>
                      )}
                      {disabledSchedules.map((schedule) => (
                        <ScheduleRow
                          key={schedule.scheduleId}
                          schedule={schedule}
                          onDelete={() => setScheduleToDelete(schedule.scheduleId)}
                          formatDays={formatDays}
                          formatNextCall={formatNextCall}
                          disabled={disabled}
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

      <ConfirmationDialog
        open={scheduleToDelete !== null}
        onOpenChange={(open) => !open && setScheduleToDelete(null)}
        title="Delete Schedule"
        description="Are you sure you want to delete this schedule?"
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteSchedule}
      />

      <AddScheduleModal
        open={showAddModal}
        onOpenChange={handleCloseModal}
        lines={linesForModal}
        preselectedLineId={preselectedLineId}
      />
    </div>
  );
}

interface ScheduleRowProps {
  schedule: Schedule;
  onDelete: () => void;
  formatDays: (days: number[]) => string;
  formatNextCall: (nextRunAt: string | null) => string;
  disabled?: boolean;
}

function ScheduleRow({
  schedule,
  onDelete,
  formatDays,
  formatNextCall,
  disabled = false,
}: ScheduleRowProps) {
  const isOneTime = schedule.isOneTime;
  const nextCallLabel = schedule.nextRunAt ? formatNextCall(schedule.nextRunAt) : 'Scheduled time: TBD';

  return (
    <div
      className={`px-6 py-4 flex items-center justify-between gap-4 ${
        !schedule.enabled ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            schedule.enabled ? 'bg-primary/10' : 'bg-muted'
          }`}
        >
          {schedule.enabled ? (
            <CheckCircle className="w-5 h-5 text-primary" />
          ) : (
            <PauseCircle className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground">
              {isOneTime ? 'One-time call' : formatTime(schedule.timeOfDay)}
            </p>
            {isOneTime && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                One-time
              </span>
            )}
            {!schedule.enabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Paused
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {isOneTime ? (
              <>
                Scheduled: {nextCallLabel}
              </>
            ) : (
              <>
                {formatDays(schedule.daysOfWeek)}
                {schedule.enabled && schedule.nextRunAt && (
                  <span className="ml-2">
                    &middot; Next: {formatNextCall(schedule.nextRunAt)}
                  </span>
                )}
              </>
            )}
          </p>
          {isOneTime && schedule.rescheduledFrom ? (
            <p className="text-xs text-muted-foreground">
              {schedule.rescheduledFrom}
            </p>
          ) : null}
        </div>
      </div>

      {!disabled && (
        <div className="flex items-center gap-2 shrink-0">
          {!isOneTime && (
            <Link
              href={`/dashboard/lines/${schedule.lineShortId}/schedule?edit=${schedule.scheduleId}`}
              className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Edit schedule"
            >
              <Edit2 className="w-4 h-4" />
            </Link>
          )}
          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete schedule"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
