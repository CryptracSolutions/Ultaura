'use client';

import { useMemo, useState } from 'react';
import { DateTime } from 'luxon';
import { Palmtree, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { LineRow } from '~/lib/ultaura/types';
import type { VacationRange } from '~/lib/ultaura/vacation-utils';

export function VacationSettings({
  line,
  ranges,
  onRangesChange,
  disabled = false,
  showHeader = true,
}: {
  line: LineRow;
  ranges: VacationRange[];
  onRangesChange: (ranges: VacationRange[]) => void;
  disabled?: boolean;
  showHeader?: boolean;
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const today = useMemo(() => {
    return DateTime.now().setZone(line.timezone).toISODate();
  }, [line.timezone]);

  const sortedRanges = useMemo(
    () => [...ranges].sort((a, b) => a.start.localeCompare(b.start)),
    [ranges]
  );

  const getStatus = (range: VacationRange) => {
    if (!today) return 'upcoming';
    if (range.end < today) return 'past';
    if (range.start <= today && range.end >= today) return 'active';
    return 'upcoming';
  };

  const handleAdd = () => {
    if (disabled) return;
    if (!startDate || !endDate) {
      toast.error('Select a start and end date');
      return;
    }
    if (startDate > endDate) {
      toast.error('Start date must be before end date');
      return;
    }

    const overlaps = ranges.some(
      (range) => range.start <= endDate && range.end >= startDate
    );
    if (overlaps) {
      toast.error('Vacation range overlaps an existing range');
      return;
    }

    const updated = [...ranges, { start: startDate, end: endDate }].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
    onRangesChange(updated);
    setStartDate('');
    setEndDate('');
  };

  const handleRemove = (range: VacationRange) => {
    if (disabled) return;
    onRangesChange(ranges.filter((r) => r.start !== range.start));
  };

  return (
    <div className="space-y-4">
      {showHeader ? (
        <>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Palmtree className="w-4 h-4 text-muted-foreground" />
            Vacation Mode
          </div>
          <p className="text-sm text-muted-foreground">
            Pause all scheduled calls and reminders during vacations. Dates are based on {line.timezone}.
          </p>
        </>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            min={today ?? undefined}
            disabled={disabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">End date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || today || undefined}
            disabled={disabled}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Add Vacation
        </button>
      </div>

      {sortedRanges.length === 0 ? (
        <p className="text-sm text-muted-foreground">No vacation ranges yet.</p>
      ) : (
        <div className="space-y-2">
          {sortedRanges.map((range) => {
            const status = getStatus(range);
            const statusLabel =
              status === 'active' ? 'Active' : status === 'past' ? 'Past' : 'Upcoming';
            const statusClass =
              status === 'active'
                ? 'bg-amber-100 text-amber-800'
                : status === 'past'
                ? 'bg-muted text-muted-foreground'
                : 'bg-blue-100 text-blue-800';

            return (
              <div
                key={`${range.start}-${range.end}`}
                className="flex items-center justify-between rounded-lg border border-input px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {range.start} → {range.end}
                  </div>
                  <span className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(range)}
                  disabled={disabled || status === 'past'}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
                  title={status === 'past' ? 'Past vacations cannot be removed' : 'Remove vacation'}
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
