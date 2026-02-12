'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Clock, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '~/core/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
import Button from '~/core/ui/Button';
import { Switch } from '~/core/ui/Switch';
import { DAYS_OF_WEEK, TIME_OPTIONS, formatTime } from '~/lib/ultaura/constants';
import { getSchedule, updateSchedule } from '~/lib/ultaura/schedules';
import { normalizeTimeOfDay } from '~/lib/ultaura/schedule-helpers';

interface EditScheduleModalProps {
  scheduleId: string | null;
  lineShortId: string;
  lineTimezone: string;
  lineDisplayName: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  disabled?: boolean;
  onClose: () => void;
}

export function EditScheduleModal({
  scheduleId,
  lineShortId,
  lineTimezone,
  lineDisplayName,
  quietHoursStart,
  quietHoursEnd,
  disabled,
  onClose,
}: EditScheduleModalProps) {
  const router = useRouter();
  const loadSeqRef = useRef(0);

  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState('09:00');
  const [enabled, setEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [initialState, setInitialState] = useState<{
    days: number[];
    time: string;
    enabled: boolean;
  } | null>(null);

  const loadSchedule = useCallback(async (id: string) => {
    setIsLoading(true);
    setInitialState(null);
    const requestSeq = ++loadSeqRef.current;

    try {
      const latest = await getSchedule(id);
      if (loadSeqRef.current !== requestSeq) return;

      if (!latest) {
        toast.error('Failed to load schedule');
        onClose();
        return;
      }

      const time = normalizeTimeOfDay(latest.time_of_day);
      setSelectedDays(latest.days_of_week);
      setSelectedTime(time);
      setEnabled(latest.enabled);
      setInitialState({
        days: latest.days_of_week,
        time,
        enabled: latest.enabled,
      });
    } catch {
      if (loadSeqRef.current !== requestSeq) return;
      toast.error('Failed to load schedule');
      onClose();
    } finally {
      if (loadSeqRef.current === requestSeq) {
        setIsLoading(false);
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (scheduleId) {
      loadSchedule(scheduleId);
    }
  }, [scheduleId, loadSchedule]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleDiscard = () => {
    if (initialState) {
      setSelectedDays(initialState.days);
      setSelectedTime(initialState.time);
      setEnabled(initialState.enabled);
    }
    setInitialState(null);
    setIsLoading(false);
    setIsSaving(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleId || disabled) return;
    if (selectedDays.length === 0) {
      toast.error('Please select at least one day');
      return;
    }

    setIsSaving(true);

    try {
      const result = await updateSchedule(scheduleId, {
        enabled,
        daysOfWeek: selectedDays,
        timeOfDay: selectedTime,
        timezone: lineTimezone,
      });

      if (result.success) {
        toast.success('Schedule updated');
        onClose();
        router.refresh();
      } else {
        const message = result.error.message || 'Failed to update schedule';
        toast.error(message);
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={scheduleId !== null}
      onOpenChange={(open) => {
        if (!open) handleDiscard();
      }}
    >
      <DialogContent
        className="sm:max-w-[468px] max-h-[85vh] overflow-y-auto"
        overlayClassName="bg-black/50 backdrop-blur-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogTitle className="truncate">Edit schedule</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Update days and time for {lineDisplayName}
            </DialogDescription>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleDiscard}
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="rounded-lg border border-input bg-background p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">Schedule active</p>
                <p className="text-sm text-muted-foreground">
                  {enabled ? 'Calls will be made on schedule' : 'Schedule is paused'}
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                disabled={disabled || isLoading || isSaving}
              />
            </div>
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
                  onClick={() => toggleDay(day.value)}
                  disabled={disabled || isLoading || isSaving}
                  className={`px-3 py-3 rounded-lg border text-sm font-medium transition-colors ${
                    selectedDays.includes(day.value)
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
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger className="w-full h-11" disabled={disabled || isLoading || isSaving}>
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
              Times are in {lineTimezone}. Quiet hours: {formatTime(quietHoursStart)} -{' '}
              {formatTime(quietHoursEnd)}
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <Button
              type="submit"
              disabled={disabled || isLoading || isSaving || selectedDays.length === 0}
              variant="default"
              size="small"
              className="w-full"
              loading={isLoading || isSaving}
            >
              {isLoading ? 'Loading...' : isSaving ? 'Saving...' : 'Save'}
            </Button>
            <Button
              type="button"
              onClick={handleDiscard}
              disabled={disabled || isLoading || isSaving}
              variant="outline"
              size="small"
              className="w-full"
            >
              Discard
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
