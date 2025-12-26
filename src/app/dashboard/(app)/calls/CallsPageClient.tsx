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
import { deleteSchedule } from '~/lib/ultaura/actions';
import { DAYS_OF_WEEK, formatTime, getShortLineId } from '~/lib/ultaura';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';

interface Schedule {
  scheduleId: string;
  lineId: string;
  displayName: string;
  enabled: boolean;
  nextRunAt: string | null;
  timeOfDay: string;
  daysOfWeek: number[];
}

interface CallsPageClientProps {
  lines: LineRow[];
  schedules: Schedule[];
}

export function CallsPageClient({ lines, schedules }: CallsPageClientProps) {
  const router = useRouter();
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);

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
      toast.error(result.error || 'Failed to delete schedule');
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
      {/* Add Schedule Buttons */}
      {lines.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-6">
          <h2 className="font-medium text-foreground mb-4">Add a new schedule</h2>
          <div className="flex flex-wrap gap-3">
            {lines.map((line) => (
              <Link
                key={line.id}
                href={`/dashboard/lines/${getShortLineId(line.id)}/schedule`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add for {line.display_name}
              </Link>
            ))}
          </div>
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
          <Link
            href="/dashboard/lines"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add a Phone Line
          </Link>
        </div>
      )}

      {/* Schedules grouped by line */}
      {lines.length > 0 && (
        <div className="space-y-6">
          {lines.map((line) => {
            const lineSchedules = schedulesByLine[line.id] || [];
            const enabledSchedules = lineSchedules.filter((s) => s.enabled);
            const disabledSchedules = lineSchedules.filter((s) => !s.enabled);

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
                      href={`/dashboard/lines/${getShortLineId(line.id)}/schedule`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </Link>
                  </div>
                </div>

                {/* Schedules */}
                <div className="divide-y divide-border">
                  {lineSchedules.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-muted-foreground">No schedules set up yet</p>
                      <Link
                        href={`/dashboard/lines/${getShortLineId(line.id)}/schedule`}
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline mt-2"
                      >
                        <Plus className="w-4 h-4" />
                        Create your first schedule
                      </Link>
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
    </div>
  );
}

interface ScheduleRowProps {
  schedule: Schedule;
  onDelete: () => void;
  formatDays: (days: number[]) => string;
  formatNextCall: (nextRunAt: string | null) => string;
}

function ScheduleRow({
  schedule,
  onDelete,
  formatDays,
  formatNextCall,
}: ScheduleRowProps) {
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
              {formatTime(schedule.timeOfDay)}
            </p>
            {!schedule.enabled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                Paused
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {formatDays(schedule.daysOfWeek)}
            {schedule.enabled && schedule.nextRunAt && (
              <span className="ml-2">
                &middot; Next: {formatNextCall(schedule.nextRunAt)}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Link
          href={`/dashboard/lines/${getShortLineId(schedule.lineId)}/schedule/${schedule.scheduleId}`}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="Edit schedule"
        >
          <Edit2 className="w-4 h-4 text-muted-foreground" />
        </Link>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg hover:bg-destructive/10 transition-colors"
          title="Delete schedule"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>
    </div>
  );
}
