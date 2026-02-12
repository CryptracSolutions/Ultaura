'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { Calendar, AlarmClock, Plus, Trash2 } from 'lucide-react';
import Button from '~/core/ui/Button';
import { ResponsiveActionMenu } from '~/components/ultaura/ResponsiveActionMenu';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import { formatTime } from '~/lib/ultaura/constants';
import { getUpcomingExceptions, deleteScheduleException } from '~/lib/ultaura/schedule-exceptions';
import { formatDaySummary } from '~/lib/ultaura/schedule-utils';
import { normalizeTimeOfDay } from '~/lib/ultaura/schedule-helpers';
import type { ScheduleExceptionRow } from '~/lib/ultaura/types';
import { NewExceptionModal } from './NewExceptionModal';

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
}

export function ScheduleExceptions({
  lineId,
  lineShortId,
  lineTimezone,
  schedules,
  disabled,
}: ScheduleExceptionsProps) {
  const router = useRouter();
  const [exceptions, setExceptions] = useState<ScheduleExceptionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exceptionToDelete, setExceptionToDelete] = useState<ScheduleExceptionRow | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const loadExceptions = useCallback(async () => {
    setIsLoading(true);
    const data = await getUpcomingExceptions(lineId);
    setExceptions(data);
    setIsLoading(false);
  }, [lineId]);

  useEffect(() => {
    loadExceptions();
  }, [loadExceptions]);

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

  const getExceptionTypeLabel = (type: string) => {
    switch (type) {
      case 'skip': return 'Skip';
      case 'snooze': return 'Snooze';
      case 'reschedule': return 'Reschedule';
      default: return type;
    }
  };

  const getExceptionIcon = (type: string) => {
    return type === 'snooze' ? AlarmClock : Calendar;
  };

  const formatExceptionDate = (dateString: string) => {
    return DateTime.fromISO(dateString, { zone: lineTimezone })
      .toLocaleString(DateTime.DATE_FULL);
  };

  const getScheduleLabel = (scheduleId: string) => {
    const schedule = schedules.find((s) => s.scheduleId === scheduleId);
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
      {!disabled && (
        <div className="mb-3 w-full sm:w-auto">
          <Button
            onClick={() => setShowNewModal(true)}
            variant="default"
            size="small"
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            New Exception
          </Button>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {exceptions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No upcoming exceptions
          </div>
        ) : (
          <div className="divide-y divide-border">
            {exceptions.map((exception) => {
              const Icon = getExceptionIcon(exception.exception_type);
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
                  className="px-6 py-4 flex items-center justify-between gap-4"
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
                          label: 'Cancel',
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
        description="Are you sure you want to remove this exception?"
        confirmLabel="Remove Exception"
        variant="destructive"
        onConfirm={handleDelete}
      />

      <NewExceptionModal
        open={showNewModal}
        onOpenChange={setShowNewModal}
        schedules={schedules}
        lineShortId={lineShortId}
        lineTimezone={lineTimezone}
      />
    </>
  );
}
