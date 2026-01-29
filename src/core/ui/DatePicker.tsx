'use client';

import { useState, useCallback, useMemo, forwardRef, useEffect, useId } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import { Dialog, DialogContent } from './Dialog';
import { cn } from '~/core/generic/shadcn-utils';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateStr: string): string {
  const date = parseDate(dateStr);
  if (!date) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatAriaDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMonthData(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const totalCells = Math.ceil((daysInMonth + firstDayOfMonth) / 7) * 7;

  return { daysInMonth, firstDayOfMonth, totalCells };
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function isDateDisabled(date: Date, min?: string, max?: string): boolean {
  const minDate = min ? parseDate(min) : null;
  const maxDate = max ? parseDate(max) : null;

  if (minDate) {
    minDate.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    if (compareDate < minDate) return true;
  }
  if (maxDate) {
    maxDate.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    if (compareDate > maxDate) return true;
  }
  return false;
}

export const DatePicker = forwardRef<HTMLButtonElement, DatePickerProps>(function DatePicker(
  {
    value,
    onChange,
    min,
    max,
    disabled = false,
    placeholder = 'Select date',
    className,
  },
  ref
) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const monthLabelId = useId();

  const selectedDate = useMemo(() => parseDate(value), [value]);
  const today = useMemo(() => new Date(), []);

  const [viewMonth, setViewMonth] = useState(() => {
    if (selectedDate) return selectedDate.getMonth();
    const minDate = min ? parseDate(min) : null;
    if (minDate && minDate > today) return minDate.getMonth();
    return today.getMonth();
  });

  const [viewYear, setViewYear] = useState(() => {
    if (selectedDate) return selectedDate.getFullYear();
    const minDate = min ? parseDate(min) : null;
    if (minDate && minDate > today) return minDate.getFullYear();
    return today.getFullYear();
  });

  // Sync view with selected date when picker opens
  useEffect(() => {
    if (open && selectedDate) {
      setViewMonth(selectedDate.getMonth());
      setViewYear(selectedDate.getFullYear());
    }
  }, [open, selectedDate]);

  const { daysInMonth, firstDayOfMonth, totalCells } = useMemo(
    () => getMonthData(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const handlePrevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  }, [viewMonth]);

  const handleNextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  }, [viewMonth]);

  const handleSelectDate = useCallback((year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    if (isDateDisabled(date, min, max)) return;
    onChange(formatDate(date));
    setOpen(false);
  }, [min, max, onChange]);

  // Touch swipe handling for mobile
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchStart({ x: touch.clientX, y: touch.clientY });
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0];
    const diffX = touchStart.x - touchEnd.clientX;
    const diffY = touchStart.y - touchEnd.clientY;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
      if (diffX > 0) {
        handleNextMonth();
      } else {
        handlePrevMonth();
      }
    }
    setTouchStart(null);
  }, [touchStart, handleNextMonth, handlePrevMonth]);

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
        <span className="truncate">{value ? formatDisplayDate(value) : placeholder}</span>
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          aria-labelledby={titleId}
          className={cn(
            'w-full max-w-full sm:w-[min(90vw,380px)]',
            'sm:max-w-[380px] max-h-[90vh] overflow-hidden p-0 gap-0 rounded-t-2xl sm:rounded-xl',
            '!left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0',
            'sm:!left-[50%] sm:!right-auto sm:!bottom-auto sm:!top-[50%] sm:!-translate-x-1/2 sm:!-translate-y-1/2'
          )}
          overlayClassName="bg-black/60"
        >
          <div
            className="p-3 sm:p-4 max-h-[80vh] overflow-y-auto overscroll-contain touch-pan-y"
            style={{ WebkitOverflowScrolling: 'touch' }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <h3 id={titleId} className="text-sm font-semibold text-foreground">Select Date</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 -mr-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors touch-manipulation"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span id={monthLabelId} className="text-sm font-semibold text-foreground select-none">
                {MONTH_NAMES[viewMonth]} {viewYear}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Day Labels */}
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="h-6 flex items-center justify-center text-xs font-medium text-muted-foreground select-none"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div
              role="grid"
              aria-labelledby={monthLabelId}
              className="grid grid-cols-7 gap-0.5"
            >
              {Array.from({ length: totalCells }).map((_, index) => {
                const day = index - firstDayOfMonth + 1;

                if (day < 1 || day > daysInMonth) {
                  return <div key={`empty-${index}`} className="aspect-square" />;
                }

                const date = new Date(viewYear, viewMonth, day);
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                const isToday = isSameDay(date, today);
                const isDisabled = isDateDisabled(date, min, max);

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleSelectDate(viewYear, viewMonth, day)}
                    disabled={isDisabled}
                    aria-label={formatAriaDate(date)}
                    aria-selected={isSelected}
                    aria-disabled={isDisabled}
                    aria-current={isToday ? 'date' : undefined}
                    data-selected={isSelected ? 'true' : 'false'}
                    className={cn(
                      'aspect-square min-h-[36px] w-full rounded-md text-sm font-medium transition-all',
                      'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1',
                      'touch-manipulation select-none',
                      'data-[selected=true]:animate-[pulse_200ms_ease-out_1] motion-reduce:animate-none',
                      isSelected && 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30 ring-offset-1 ring-offset-background',
                      !isSelected && !isDisabled && 'hover:bg-primary/10 hover:text-primary active:bg-primary/20',
                      !isSelected && isToday && 'border-2 border-primary text-primary font-semibold',
                      !isSelected && !isToday && !isDisabled && 'text-foreground',
                      isDisabled && 'text-muted-foreground/40 cursor-not-allowed'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Today Button */}
            <div className="mt-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => {
                  if (!isDateDisabled(today, min, max)) {
                    onChange(formatDate(today));
                    setOpen(false);
                  }
                }}
                disabled={isDateDisabled(today, min, max)}
                aria-label="Select today"
                className="w-full py-2 min-h-[40px] text-sm font-medium text-primary hover:bg-primary/10 active:bg-primary/20 rounded-lg transition-colors disabled:text-muted-foreground disabled:cursor-not-allowed touch-manipulation"
              >
                Today
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
