'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { toast } from 'sonner';
import { Calendar, AlarmClock, Plus, Trash2 } from 'lucide-react';
import Button from '~/core/ui/Button';
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
      <div className="border border-input rounded-lg bg-card">
        <div className="px-4 py-3 border-b border-input">
          <h3 className="font-medium text-sm">Schedule Exceptions</h3>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          <span className="inline-block w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
          Loading exceptions...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="border border-input rounded-lg bg-card">
        <div className="px-4 py-3 border-b border-input flex items-center justify-between">
          <h3 className="font-medium text-sm">Schedule Exceptions</h3>
          {!disabled && (
            <Button
              onClick={() => setShowNewModal(true)}
              variant="default"
              size="small"
              className="gap-1"
            >
              <Plus className="w-3 h-3" />
              New Exception
            </Button>
          )}
        </div>

        {exceptions.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            No upcoming exceptions
          </div>
        ) : (
          <div className="divide-y divide-input">
            {exceptions.map((exception) => {
              const Icon = getExceptionIcon(exception.exception_type);
              const newTime = exception.new_datetime
                ? DateTime.fromISO(exception.new_datetime)
                    .setZone(lineTimezone)
                    .toLocaleString(DateTime.DATETIME_FULL)
                : null;

              return (
                <div key={exception.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {getExceptionTypeLabel(exception.exception_type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatExceptionDate(exception.exception_date)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {getScheduleLabel(exception.schedule_id)}
                      {newTime && <span> &rarr; {newTime}</span>}
                    </p>
                  </div>
                  {!disabled && (
                    <button
                      onClick={() => setExceptionToDelete(exception)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                      title="Remove exception"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
