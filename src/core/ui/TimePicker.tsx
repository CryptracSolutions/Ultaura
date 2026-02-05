'use client';

import { useState, useCallback, useMemo, useRef, useEffect, forwardRef, useId } from 'react';
import { Clock, X } from 'lucide-react';
import { Dialog, DialogContent } from './Dialog';
import { cn } from '~/core/generic/shadcn-utils';

interface TimePickerProps {
  value: string;
  onChange: (time: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function formatTimeDisplay(time: string): string {
  if (!time) return '';

  const [hours, minutes] = time.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes)) return time;

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(2000, 0, 1, hours, minutes));
}

// Generate arrays for hours (1-12) and minutes (0-59)
const HOURS_12 = Array.from({ length: 12 }, (_, i) => i === 0 ? 12 : i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

interface ScrollColumnProps {
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
  formatValue?: (value: number) => string;
  label: string;
  onStep?: (direction: 1 | -1) => void;
}

function ScrollColumn({ values, selected, onSelect, formatValue, label, onStep }: ScrollColumnProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const labelId = useId();

  // Scroll selected item into view when column mounts or selection changes
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      const container = containerRef.current;
      const item = selectedRef.current;
      const itemTop = item.offsetTop;
      const itemHeight = item.offsetHeight;
      const containerHeight = container.clientHeight;

      // Center the selected item
      const scrollTop = itemTop - (containerHeight / 2) + (itemHeight / 2);
      container.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
    }
  }, [selected]);

  return (
    <div className="flex flex-col w-[72px]">
      <div
        id={labelId}
        className="text-xs font-medium text-muted-foreground text-center py-1.5 border-b border-border bg-muted/30"
      >
        {label}
      </div>
      <div
        ref={containerRef}
        className="relative overflow-y-auto scrollbar-hide snap-y snap-mandatory touch-pan-y"
        style={{ height: '176px', WebkitOverflowScrolling: 'touch' }}
        role="listbox"
        aria-labelledby={labelId}
        tabIndex={0}
        onKeyDown={(event) => {
          if (!onStep) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onStep(1);
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            onStep(-1);
          }
        }}
      >
        <div className="flex flex-col gap-0.5 p-1">
          {values.map((value) => {
            const isSelected = value === selected;
            const displayValue = formatValue ? formatValue(value) : String(value).padStart(2, '0');

            return (
              <button
                key={value}
                ref={isSelected ? selectedRef : undefined}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSelect(value)}
                data-selected={isSelected ? 'true' : 'false'}
                className={cn(
                  'w-full py-2 min-h-[44px] rounded-md text-sm font-medium transition-all snap-center',
                  'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                  'touch-manipulation select-none',
                  'data-[selected=true]:animate-[pulse_200ms_ease-out_1] motion-reduce:animate-none',
                  isSelected && 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30 ring-offset-1 ring-offset-background',
                  !isSelected && 'text-foreground hover:bg-primary/10 active:bg-primary/20'
                )}
              >
                {displayValue}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const TimePicker = forwardRef<HTMLButtonElement, TimePickerProps>(function TimePicker(
  {
    value,
    onChange,
    disabled = false,
    placeholder = 'Select time',
    className,
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  // Parse current value into hour, minute, period
  const { hour12, minute, period } = useMemo(() => {
    if (!value) {
      return { hour12: 12, minute: 0, period: 'AM' as const };
    }

    const [hoursStr, minutesStr] = value.split(':');
    const hours24 = parseInt(hoursStr, 10);
    const mins = parseInt(minutesStr, 10);

    if (isNaN(hours24) || isNaN(mins)) {
      return { hour12: 12, minute: 0, period: 'AM' as const };
    }

    const isPM = hours24 >= 12;
    let h12 = hours24 % 12;
    if (h12 === 0) h12 = 12;

    return {
      hour12: h12,
      minute: mins,
      period: isPM ? 'PM' as const : 'AM' as const,
    };
  }, [value]);

  const [selectedHour, setSelectedHour] = useState(hour12);
  const [selectedMinute, setSelectedMinute] = useState(minute);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(period);

  // Sync internal state with value prop when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedHour(hour12);
      setSelectedMinute(minute);
      setSelectedPeriod(period);
    }
  }, [open, hour12, minute, period]);

  const stepHour = useCallback((direction: 1 | -1) => {
    setSelectedHour((prev) => {
      const index = HOURS_12.indexOf(prev);
      const nextIndex = (index + direction + HOURS_12.length) % HOURS_12.length;
      return HOURS_12[nextIndex];
    });
  }, []);

  const stepMinute = useCallback((direction: 1 | -1) => {
    setSelectedMinute((prev) => {
      const next = (prev + direction + 60) % 60;
      return next;
    });
  }, []);

  const handlePeriodStep = useCallback((direction: 1 | -1) => {
    setSelectedPeriod((prev) => {
      if (direction === 1) return prev === 'AM' ? 'PM' : 'AM';
      return prev === 'PM' ? 'AM' : 'PM';
    });
  }, []);

  const handleConfirm = useCallback(() => {
    // Convert 12-hour to 24-hour
    let hours24 = selectedHour;
    if (selectedPeriod === 'AM') {
      if (selectedHour === 12) hours24 = 0;
    } else {
      if (selectedHour !== 12) hours24 = selectedHour + 12;
    }

    const timeStr = `${String(hours24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    onChange(timeStr);
    setOpen(false);
  }, [selectedHour, selectedMinute, selectedPeriod, onChange]);

  const displayValue = useMemo(() => formatTimeDisplay(value), [value]);

  return (
    <>
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          'flex h-11 min-h-[44px] w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm',
          'ring-offset-background focus:outline-none focus:ring-2 focus:ring-primary',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'transition-colors hover:border-primary/50 active:bg-muted/50',
          'touch-manipulation',
          !value && 'text-muted-foreground',
          className
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="truncate">{displayValue || placeholder}</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-labelledby={titleId}
          className={cn(
            'w-full max-w-full sm:w-[min(90vw,360px)] md:w-[min(90vw,360px)]',
            'sm:max-w-[360px] max-h-[90vh] overflow-hidden p-0 gap-0 rounded-t-2xl sm:rounded-xl',
            '!left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0',
            'sm:!left-[50%] sm:!right-auto sm:!bottom-auto sm:!top-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2'
          )}
          overlayClassName="bg-black/60"
        >
          <div className="p-3 sm:p-4 max-h-[80vh] overflow-y-auto overscroll-contain">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <h3 id={titleId} className="text-sm font-semibold text-foreground">Select Time</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-w-[44px] min-h-[44px] -mr-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation flex items-center justify-center"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Time Display Preview */}
            <div className="text-center mb-3 py-2 bg-muted/30 rounded-lg" aria-live="polite">
              <span className="text-2xl font-semibold text-foreground tabular-nums">
                {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')}
              </span>
              <span className="text-lg font-medium text-muted-foreground ml-2">
                {selectedPeriod}
              </span>
            </div>

            {/* Scroll Columns */}
            <div className="flex w-fit mx-auto border rounded-lg border-border overflow-hidden" role="group" aria-label="Time selector">
              {/* Hours */}
              <ScrollColumn
                values={HOURS_12}
                selected={selectedHour}
                onSelect={setSelectedHour}
                formatValue={(v) => String(v)}
                label="Hour"
                onStep={stepHour}
              />

              {/* Divider */}
              <div className="w-px bg-border" />

              {/* Minutes */}
              <ScrollColumn
                values={MINUTES}
                selected={selectedMinute}
                onSelect={setSelectedMinute}
                formatValue={(v) => String(v).padStart(2, '0')}
                label="Min"
                onStep={stepMinute}
              />

              {/* Divider */}
              <div className="w-px bg-border" />

              {/* AM/PM */}
              <div
                className="flex flex-col w-[72px]"
                role="listbox"
                aria-label="Select period"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    handlePeriodStep(1);
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    handlePeriodStep(-1);
                  }
                }}
              >
                <div className="text-xs font-medium text-muted-foreground text-center py-1.5 border-b border-border bg-muted/30">
                  Period
                </div>
                <div className="flex flex-col gap-0.5 p-1 justify-center" style={{ height: '176px' }}>
                  {(['AM', 'PM'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="option"
                      aria-selected={selectedPeriod === p}
                      data-selected={selectedPeriod === p ? 'true' : 'false'}
                      onClick={() => setSelectedPeriod(p)}
                      className={cn(
                        'w-full py-3 min-h-[44px] rounded-md text-sm font-semibold transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset',
                        'touch-manipulation select-none',
                        'data-[selected=true]:animate-[pulse_200ms_ease-out_1] motion-reduce:animate-none',
                        selectedPeriod === p && 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30 ring-offset-1 ring-offset-background',
                        selectedPeriod !== p && 'text-foreground hover:bg-primary/10 active:bg-primary/20'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 py-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-foreground border border-input rounded-lg hover:bg-muted transition-colors touch-manipulation"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2 min-h-[44px] text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 rounded-lg transition-colors touch-manipulation"
              >
                Confirm
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
