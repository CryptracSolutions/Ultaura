'use client';

import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import TextField from '~/core/ui/TextField';
import type { ApproximateDate, ApproximateDatePrecision } from '@ultaura/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface HealthApproximateDateInputProps {
  value: ApproximateDate | null;
  onChange: (date: ApproximateDate | null) => void;
  disabled?: boolean;
  id?: string;
}

function parseParts(value: ApproximateDate | null): {
  precision: ApproximateDatePrecision;
  year: string;
  month: string;
  day: string;
} {
  if (!value) {
    return { precision: 'year', year: '', month: '', day: '' };
  }

  const parts = value.value.split('-');
  return {
    precision: value.precision,
    year: parts[0] ?? '',
    month: parts[1] ?? '',
    day: parts[2] ?? '',
  };
}

export function HealthApproximateDateInput({
  value,
  onChange,
  disabled,
  id,
}: HealthApproximateDateInputProps) {
  const initial = parseParts(value);
  const [precision, setPrecision] = useState<ApproximateDatePrecision>(initial.precision);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [day, setDay] = useState(initial.day);

  // Sync inbound value changes (e.g. when form resets)
  useEffect(() => {
    const next = parseParts(value);
    setPrecision(next.precision);
    setYear(next.year);
    setMonth(next.month);
    setDay(next.day);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);

  function emit(
    nextPrecision: ApproximateDatePrecision,
    nextYear: string,
    nextMonth: string,
    nextDay: string,
  ) {
    if (!nextYear) {
      onChange(null);
      return;
    }

    const y = nextYear.padStart(4, '0');

    if (nextPrecision === 'year') {
      onChange({ precision: 'year', value: y as ApproximateDate['value'] });
      return;
    }

    if (nextPrecision === 'month') {
      if (!nextMonth) { onChange(null); return; }
      onChange({ precision: 'month', value: `${y}-${nextMonth}` as ApproximateDate['value'] });
      return;
    }

    // day
    if (!nextMonth || !nextDay) { onChange(null); return; }
    onChange({ precision: 'day', value: `${y}-${nextMonth}-${nextDay}` as ApproximateDate['value'] });
  }

  const handlePrecisionChange = (next: ApproximateDatePrecision) => {
    setPrecision(next);
    // Reset sub-fields that no longer apply
    const newMonth = next === 'year' ? '' : month;
    const newDay = next === 'day' ? day : '';
    setMonth(newMonth);
    setDay(newDay);
    emit(next, year, newMonth, newDay);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 4);
    setYear(next);
    // Only emit with the raw value while typing — padStart happens on blur
    if (next.length === 4) {
      emit(precision, next, month, day);
    } else if (!next) {
      emit(precision, '', month, day);
    }
  };

  const handleYearBlur = () => {
    if (year && year.length < 4) {
      const padded = year.padStart(4, '0');
      setYear(padded);
      emit(precision, padded, month, day);
    }
  };

  const handleMonthChange = (nextMonth: string) => {
    setMonth(nextMonth);
    emit(precision, year, nextMonth, day);
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value.replace(/\D/g, '').slice(0, 2);
    setDay(next);
    emit(precision, year, month, next);
  };

  const maxDays = month && year
    ? new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
    : 31;

  return (
    <div className="space-y-3">
      {/* Precision selector */}
      <Select
        value={precision}
        onValueChange={(v) => handlePrecisionChange(v as ApproximateDatePrecision)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full" id={id}>
          <SelectValue placeholder="Select precision" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="year">Year only</SelectItem>
          <SelectItem value="month">Month &amp; Year</SelectItem>
          <SelectItem value="day">Full date</SelectItem>
        </SelectContent>
      </Select>

      {/* Year input — always shown */}
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Year</label>
        <TextField.Input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 2019"
          value={year}
          onChange={handleYearChange}
          onBlur={handleYearBlur}
          disabled={disabled}
          maxLength={4}
          className="w-28"
          aria-label="Year"
        />
      </div>

      {/* Month — for month and day precision */}
      {(precision === 'month' || precision === 'day') && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Month</label>
          <Select
            value={month}
            onValueChange={handleMonthChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {MONTH_NAMES.map((name, i) => {
                const mm = String(i + 1).padStart(2, '0');
                return (
                  <SelectItem key={mm} value={mm}>
                    {name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Day — only for day precision */}
      {precision === 'day' && (
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Day</label>
          <TextField.Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 15"
            value={day}
            onChange={handleDayChange}
            disabled={disabled}
            maxLength={2}
            className="w-20"
            aria-label="Day"
          />
          {day && (parseInt(day, 10) < 1 || parseInt(day, 10) > maxDays) && (
            <p className="text-xs text-destructive mt-1">
              Enter a day between 1 and {maxDays}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
