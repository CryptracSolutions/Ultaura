'use client';

import { useState, useRef } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '~/core/ui/Dialog';

interface FilterModalProps {
  children: React.ReactNode | ((props: {
    onClose: () => void;
    startDateInputRef: React.RefObject<HTMLInputElement>;
  }) => React.ReactNode);
  activeFilterCount: number;
}

export function FilterModal({ children, activeFilterCount }: FilterModalProps) {
  const [open, setOpen] = useState(false);
  const startDateInputRef = useRef<HTMLInputElement>(null!);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-input bg-background text-foreground hover:bg-muted transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary text-primary-foreground">
            {activeFilterCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[468px] flex flex-col max-h-[85vh]"
          overlayClassName="bg-black/50 backdrop-blur-none"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            startDateInputRef.current?.focus();
          }}
        >
          <div className="flex items-start justify-between gap-4 flex-shrink-0">
            <div className="min-w-0">
              <DialogTitle className="truncate">Filter Debug Logs</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Narrow down logs by date, session, or event type.
              </DialogDescription>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {typeof children === 'function'
            ? children({ onClose: () => setOpen(false), startDateInputRef })
            : children}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface ActiveFiltersProps {
  filters: Record<string, string | undefined>;
}

const FILTER_LABELS: Record<string, string> = {
  startDate: 'Start date',
  endDate: 'End date',
  sessionId: 'Session ID',
  accountId: 'Account ID',
  eventType: 'Event type',
  toolName: 'Tool',
};

export function ActiveFilters({ filters }: ActiveFiltersProps) {
  const activeFilters = Object.entries(filters).filter(
    ([, value]) => value !== undefined && value !== ''
  );

  if (activeFilters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {activeFilters.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-muted text-sm"
        >
          <span className="text-muted-foreground">{FILTER_LABELS[key] || key}:</span>
          <span className="font-medium text-foreground">{value}</span>
        </span>
      ))}
    </div>
  );
}

export function getActiveFilterCount(filters: Record<string, string | undefined>): number {
  return Object.values(filters).filter((v) => v !== undefined && v !== '').length;
}
