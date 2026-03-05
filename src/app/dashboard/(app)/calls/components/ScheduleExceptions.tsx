'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { Calendar, AlarmClock, Trash2 } from 'lucide-react';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { formatTime } from '~/lib/ultaura/constants';
import { getUpcomingExceptions, deleteScheduleException } from '~/lib/ultaura/schedule-exceptions';
import { formatDaySummary } from '~/lib/ultaura/schedule-utils';
import { normalizeTimeOfDay } from '~/lib/ultaura/schedule-helpers';
import type { ScheduleExceptionRow } from '~/lib/ultaura/types';

interface ScheduleExceptionsProps {
  lineId: string;
  lineShortId: string;
  lineTimezone: string;
  schedules: Array<{
    scheduleId: string;
    timeOfDay: string;
    daysOfWeek: number[];
    enabled: boolean;
  }>;
  disabled?: boolean;
  refreshTrigger?: number;
}

export function ScheduleExceptions({
  lineId,
  lineShortId,
  lineTimezone,
  schedules,
  disabled,
  refreshTrigger,
}: ScheduleExceptionsProps) {
  const router = useRouter();
  const [exceptions, setExceptions] = useState<ScheduleExceptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exceptionToDelete, setExceptionToDelete] = useState<ScheduleExceptionRow | null>(null);

  const scheduleById = useMemo(
    () => new Map(schedules.map((schedule) => [schedule.scheduleId, schedule])),
    [schedules]
  );

  const loadExceptions = useCallback(async () => {
    setIsLoading(true);
    const data = await getUpcomingExceptions(lineId);
    setExceptions(data);
    setIsLoading(false);
  }, [lineId]);

  useEffect(() => {
    loadExceptions();
  }, [loadExceptions, refreshTrigger]);

  const handleDelete = async () => {
    if (!exceptionToDelete) return;

    const result = await deleteScheduleException(exceptionToDelete.id, lineShortId);

    if (result.success) {
      toast.success('Exception removed');
      setExceptionToDelete(null);
      loadExceptions();
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to delete exception');
    }
  };

  const exceptionTypeLabels: Record<string, string> = {
    skip: 'Skip',
    snooze: 'Snooze',
    reschedule: 'Reschedule',
  };

  const EXCEPTION_BORDER_COLORS: Record<string, string> = {
    skip: '#f59e0b',
    snooze: '#3b82f6',
    reschedule: '#6366f1',
  };

  const getExceptionTypeLabel = (type: string) => exceptionTypeLabels[type] ?? type;
  const getExceptionIcon = (type: string) => (type === 'snooze' ? AlarmClock : Calendar);
  const getExceptionBorderColor = (type: string) => EXCEPTION_BORDER_COLORS[type] || 'var(--muted)';

  const formatExceptionDate = (dateString: string) => {
    return DateTime.fromISO(dateString, { zone: lineTimezone })
      .toLocaleString(DateTime.DATE_FULL);
  };

  const getScheduleLabel = (scheduleId: string) => {
    const schedule = scheduleById.get(scheduleId);
    if (!schedule) return 'Schedule';
    const time = formatTime(normalizeTimeOfDay(schedule.timeOfDay));
    const days = formatDaySummary(schedule.daysOfWeek);
    return `${days || 'Custom days'} at ${time}`;
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 text-center text-muted-foreground">
          <span className="inline-block w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
          Loading exceptions...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {exceptions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No upcoming exceptions
          </div>
        ) : (
          <div className="divide-y divide-border">
            {exceptions.map((exception) => {
              const Icon = getExceptionIcon(exception.exception_type);
              const borderColor = getExceptionBorderColor(exception.exception_type);
              const newTime = exception.new_datetime
                ? DateTime.fromISO(exception.new_datetime)
                    .setZone(lineTimezone)
                    .toLocaleString(DateTime.DATETIME_FULL)
                : null;
              const scheduleLabel = getScheduleLabel(exception.schedule_id);
              const sheetTitle = [
                getExceptionTypeLabel(exception.exception_type),
                formatExceptionDate(exception.exception_date),
                scheduleLabel,
                newTime ? `→ ${newTime}` : null,
              ]
                .filter(Boolean)
                .join('\n');

              return (
                <div
                  key={exception.id}
                  className="border-l-4 px-6 py-4 flex items-center justify-between gap-4"
                  style={{ borderLeftColor: borderColor }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">
                          {getExceptionTypeLabel(exception.exception_type)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatExceptionDate(exception.exception_date)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {scheduleLabel}
                        {newTime && <span> → {newTime}</span>}
                      </p>
                    </div>
                  </div>
                  {!disabled && (
                    <ResponsiveActionMenu
                      title={sheetTitle}
                      actions={[
                        {
                          label: 'Remove exception',
                          icon: <Trash2 className="w-5 h-5" />,
                          onClick: () => setExceptionToDelete(exception),
                          variant: 'destructive',
                        },
                      ]}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={exceptionToDelete !== null}
        onOpenChange={(open) => !open && setExceptionToDelete(null)}
        title="Remove Exception"
        description="This removes this exception. If the affected call is still in the future, Ultaura restores the original schedule timing."
        confirmLabel="Remove exception"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
