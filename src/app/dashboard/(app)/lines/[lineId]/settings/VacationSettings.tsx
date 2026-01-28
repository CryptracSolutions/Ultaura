'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';
import { CheckCircle, Palmtree, Plus, Trash2, X } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import type { VacationRange } from '~/lib/ultaura/vacation-utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';
import { ConfirmationDialog } from '~/core/ui/ConfirmationDialog';
import {
  modalIconButtonClass,
  modalPrimaryButtonClass,
  modalSecondaryButtonClass,
} from '~/core/ui/modal-button-classes';
import { DatePicker } from '~/core/ui/DatePicker';

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPastVacations, setShowPastVacations] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const startDateInputRef = useRef<HTMLButtonElement>(null);

  const today = useMemo(() => {
    return DateTime.now().setZone(line.timezone).toISODate();
  }, [line.timezone]);

  const sortedRanges = useMemo(
    () => [...ranges].sort((a, b) => a.start.localeCompare(b.start)),
    [ranges]
  );

  const getStatus = useCallback((range: VacationRange) => {
    if (!today) return 'upcoming';
    if (range.end < today) return 'past';
    if (range.start <= today && range.end >= today) return 'active';
    return 'upcoming';
  }, [today]);

  const pastVacations = useMemo(
    () => sortedRanges.filter((range) => getStatus(range) === 'past'),
    [getStatus, sortedRanges]
  );
  const activeAndUpcoming = useMemo(
    () => sortedRanges.filter((range) => getStatus(range) !== 'past'),
    [getStatus, sortedRanges]
  );
  const displayedRanges = showPastVacations ? sortedRanges : activeAndUpcoming;

  const openAddModal = useCallback(() => {
    if (disabled) return;
    setAddSuccess(false);
    setError(null);
    setShowAddModal(true);
  }, [disabled]);

  const closeModal = useCallback(() => {
    setShowAddModal(false);
    setAddSuccess(false);
    setStartDate('');
    setEndDate('');
    setError(null);
  }, []);

  const hasVacationFormChanges = !addSuccess && (startDate !== '' || endDate !== '');

  const attemptCloseVacation = useCallback(() => {
    if (hasVacationFormChanges) {
      setShowDiscardConfirm(true);
    } else {
      closeModal();
    }
  }, [closeModal, hasVacationFormChanges]);

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled) return;
    setError(null);

    if (!startDate || !endDate) {
      setError('Select a start and end date');
      return;
    }

    const todayInLineTimezone = DateTime.now()
      .setZone(line.timezone)
      .toFormat('yyyy-MM-dd');
    if (startDate < todayInLineTimezone) {
      setError('Start date cannot be in the past');
      return;
    }

    if (startDate > endDate) {
      setError('Start date must be before end date');
      return;
    }

    const overlaps = ranges.some(
      (range) => range.start <= endDate && range.end >= startDate
    );
    if (overlaps) {
      setError('Vacation range overlaps an existing range');
      return;
    }

    const updated = [...ranges, { start: startDate, end: endDate }].sort((a, b) =>
      a.start.localeCompare(b.start)
    );
    onRangesChange(updated);
    setAddSuccess(true);
  };

  const handleAddAnother = () => {
    setAddSuccess(false);
    setStartDate('');
    setEndDate('');
    setError(null);
    requestAnimationFrame(() => {
      startDateInputRef.current?.focus();
    });
  };

  const handleRemove = (range: VacationRange) => {
    if (disabled) return;
    onRangesChange(ranges.filter((r) => r.start !== range.start));
  };

  return (
    <div className="space-y-4">
      {showHeader ? (
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Palmtree className="w-4 h-4 text-muted-foreground" />
              Vacation Mode
            </div>
            <p className="text-sm text-muted-foreground">
              Pause all scheduled calls and reminders during vacations. Dates are based on{' '}
              {line.timezone}.
            </p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            disabled={disabled}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Add Vacation
          </button>
        </div>
      ) : null}

      {!showHeader ? (
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-medium text-foreground">Vacation ranges</div>
          <div className="flex items-center gap-3">
            {pastVacations.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowPastVacations(!showPastVacations)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                {showPastVacations
                  ? 'Hide past vacations'
                  : `Show ${pastVacations.length} past vacation${pastVacations.length !== 1 ? 's' : ''}`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={openAddModal}
              disabled={disabled}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add Vacation
            </button>
          </div>
        </div>
      ) : null}

      {activeAndUpcoming.length === 0 && !showPastVacations ? (
        <div className="text-center py-8 rounded-lg border border-dashed border-border">
          <Palmtree className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          {pastVacations.length === 0 ? (
            <p className="text-sm text-muted-foreground mb-4">No vacation ranges yet.</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-2">No upcoming vacations.</p>
              <button
                type="button"
                onClick={() => setShowPastVacations(true)}
                className="text-xs text-primary hover:underline mb-4"
              >
                Show {pastVacations.length} past vacation
                {pastVacations.length !== 1 ? 's' : ''}
              </button>
            </>
          )}
          {!disabled ? (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              {pastVacations.length === 0 ? 'Add First Vacation' : 'Add Vacation'}
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          {showHeader && pastVacations.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowPastVacations(!showPastVacations)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {showPastVacations
                ? 'Hide past vacations'
                : `Show ${pastVacations.length} past vacation${pastVacations.length !== 1 ? 's' : ''}`}
            </button>
          ) : null}

          {displayedRanges.map((range) => {
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
                  <span
                    className={`inline-flex mt-1 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
                  >
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

      <Dialog
        open={showAddModal}
        onOpenChange={(open) => {
          if (open) {
            setShowAddModal(true);
          } else {
            attemptCloseVacation();
          }
        }}
      >
        <DialogContent
          className="max-w-[468px] max-h-[85vh] overflow-y-auto"
          overlayClassName="bg-black/50 backdrop-blur-none"
          onInteractOutside={(event) => {
            if (hasVacationFormChanges) {
              event.preventDefault();
              attemptCloseVacation();
            }
          }}
          onEscapeKeyDown={(event) => {
            if (hasVacationFormChanges) {
              event.preventDefault();
              attemptCloseVacation();
            }
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            startDateInputRef.current?.focus();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="truncate">Add vacation</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Pause all scheduled calls during this period.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={attemptCloseVacation}
              className={modalIconButtonClass}
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {addSuccess ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900/30 dark:bg-green-900/10 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-green-800 dark:text-green-300">
                  <CheckCircle className="w-4 h-4" />
                  Added to pending changes
                </div>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  Remember to click <strong>Save Changes</strong> to apply.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleAddAnother}
                  className={modalSecondaryButtonClass}
                >
                  Add another
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  className={modalPrimaryButtonClass}
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Start date
                  </label>
                  <DatePicker
                    ref={startDateInputRef}
                    value={startDate}
                    onChange={setStartDate}
                    min={today ?? undefined}
                    disabled={disabled}
                    placeholder="Select start date"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    End date
                  </label>
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    min={startDate || today || undefined}
                    disabled={disabled}
                    placeholder="Select end date"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Dates are based on {line.timezone}.</p>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={attemptCloseVacation}
                  className={modalSecondaryButtonClass}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disabled}
                  className={modalPrimaryButtonClass}
                >
                  Add Vacation
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={showDiscardConfirm}
        onOpenChange={(open) => {
          if (!open) setShowDiscardConfirm(false);
        }}
        title="Unsaved changes"
        description="You have unsaved changes. Leave without saving?"
        confirmLabel="Discard & leave"
        cancelLabel="Stay here"
        variant="default"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          closeModal();
        }}
      />
    </div>
  );
}
