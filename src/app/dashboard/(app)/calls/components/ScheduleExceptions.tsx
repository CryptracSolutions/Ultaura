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

const EXCEPTION_CONFIG: Record<
  string,
  { bg: string; iconColor: string; icon: React.ElementType; label: string; borderColor: string }
> = {
  skip: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-800 dark:text-amber-300',
    icon: Calendar,
    label: 'Skip',
    borderColor: '#f59e0b',
  },
  snooze: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-800 dark:text-blue-300',
    icon: AlarmClock,
    label: 'Snooze',
    borderColor: '#3b82f6',
  },
  reschedule: {
    bg: 'bg-indigo-100 dark:bg-indigo-900/30',
    iconColor: 'text-indigo-800 dark:text-indigo-300',
    icon: Calendar,
    label: 'Reschedule',
    borderColor: '#6366f1',
  },
};

const EXCEPTION_FALLBACK = {
  bg: 'bg-muted',
  iconColor: 'text-muted-foreground',
  icon: Calendar,
  label: 'Exception',
  borderColor: 'var(--muted)',
};

function getExceptionSummary(
  exception: ScheduleExceptionRow,
  originalOccurrenceLabel: string,
  newTime: string | null,
) {
  if (exception.exception_type === 'reschedule' && newTime) {
    return {
      title: 'Call moved',
      supportingText: `The original call scheduled for ${originalOccurrenceLabel} is now happening ${newTime}.`,
      actionLabel: 'Cancel moved call',
      confirmTitle: 'Cancel moved call',
      confirmDescription: 'This cancels the moved call. Ultaura restores the original recurring call only if its original scheduled time is still in the future.',
    };
  }

  if (exception.exception_type === 'skip') {
    return {
      title: 'Call skipped',
      supportingText: `The original call scheduled for ${originalOccurrenceLabel} will not happen this time.`,
      actionLabel: 'Remove skipped call change',
      confirmTitle: 'Remove skipped call change',
      confirmDescription: 'This removes the skip. If the original scheduled time is still in the future, Ultaura restores the original recurring call.',
    };
  }

  return {
    title: 'Call changed',
    supportingText: newTime
      ? `The original call scheduled for ${originalOccurrenceLabel} is now happening ${newTime}.`
      : `The original call scheduled for ${originalOccurrenceLabel} was changed for this one occurrence.`,
    actionLabel: 'Remove call change',
    confirmTitle: 'Remove call change',
    confirmDescription: 'This removes the change. If the original scheduled time is still in the future, Ultaura restores the original recurring call.',
  };
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
      toast.success('Call change removed');
      setExceptionToDelete(null);
      loadExceptions();
      router.refresh();
    } else {
      toast.error(result.error.message || 'Failed to delete exception');
    }
  };

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

  const getOriginalOccurrenceLabel = (exception: ScheduleExceptionRow) => {
    const schedule = scheduleById.get(exception.schedule_id);
    if (!schedule) {
      return formatExceptionDate(exception.exception_date);
    }

    const normalizedTime = normalizeTimeOfDay(schedule.timeOfDay);
    const localDateTime = DateTime.fromISO(`${exception.exception_date}T${normalizedTime}`, {
      zone: lineTimezone,
    });

    if (!localDateTime.isValid) {
      return `${formatExceptionDate(exception.exception_date)} at ${formatTime(normalizedTime)}`;
    }

    return localDateTime.toLocaleString(DateTime.DATETIME_FULL);
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
            No upcoming call changes
          </div>
        ) : (
          <div className="divide-y divide-border">
            {exceptions.map((exception) => {
              const config = EXCEPTION_CONFIG[exception.exception_type] || EXCEPTION_FALLBACK;
              const Icon = config.icon;
              const newTime = exception.new_datetime
                ? DateTime.fromISO(exception.new_datetime)
                    .setZone(lineTimezone)
                    .toLocaleString(DateTime.DATETIME_FULL)
                : null;
              const originalOccurrenceLabel = getOriginalOccurrenceLabel(exception);
              const summary = getExceptionSummary(exception, originalOccurrenceLabel, newTime);

              return (
                <div
                  key={exception.id}
                  className="border-l-4 px-6 py-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2"
                  style={{ borderLeftColor: config.borderColor }}
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                      <Icon className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {summary.title}
                      </p>
                      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                        {summary.supportingText}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!disabled && (
                      <ResponsiveActionMenu
                        title={summary.title}
                        actions={[
                          {
                            label: summary.actionLabel,
                            icon: <Trash2 className="w-5 h-5" />,
                            onClick: () => setExceptionToDelete(exception),
                            variant: 'destructive',
                          },
                        ]}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={exceptionToDelete !== null}
        onOpenChange={(open) => !open && setExceptionToDelete(null)}
        title={exceptionToDelete ? getExceptionSummary(
          exceptionToDelete,
          formatExceptionDate(exceptionToDelete.exception_date),
          exceptionToDelete.new_datetime
            ? DateTime.fromISO(exceptionToDelete.new_datetime)
                .setZone(lineTimezone)
                .toLocaleString(DateTime.DATETIME_FULL)
            : null,
        ).confirmTitle : 'Remove call change'}
        description={exceptionToDelete ? getExceptionSummary(
          exceptionToDelete,
          formatExceptionDate(exceptionToDelete.exception_date),
          exceptionToDelete.new_datetime
            ? DateTime.fromISO(exceptionToDelete.new_datetime)
                .setZone(lineTimezone)
                .toLocaleString(DateTime.DATETIME_FULL)
            : null,
        ).confirmDescription : 'This removes the change.'}
        confirmLabel={exceptionToDelete ? getExceptionSummary(
          exceptionToDelete,
          formatExceptionDate(exceptionToDelete.exception_date),
          exceptionToDelete.new_datetime
            ? DateTime.fromISO(exceptionToDelete.new_datetime)
                .setZone(lineTimezone)
                .toLocaleString(DateTime.DATETIME_FULL)
            : null,
        ).actionLabel : 'Remove call change'}
        variant="destructive"
        onConfirm={handleDelete}
      />
    </>
  );
}
