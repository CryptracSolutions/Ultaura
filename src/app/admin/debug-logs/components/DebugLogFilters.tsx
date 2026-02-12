'use client';

import { useEffect, useState } from 'react';
import { TextFieldInput } from '~/core/ui/TextField';
import { DatePicker } from '~/core/ui/DatePicker';
import { FilterModal, ActiveFilters, getActiveFilterCount } from './FilterModal';

const EVENT_TYPE_OPTIONS = ['dtmf', 'tool_call', 'state_change', 'error', 'safety_tier'];
const TOOL_OPTIONS = [
  'set_reminder',
  'list_reminders',
  'edit_reminder',
  'pause_reminder',
  'resume_reminder',
  'snooze_reminder',
  'cancel_reminder',
  'schedule_call',
  'store_memory',
  'update_memory',
  'forget_memory',
  'mark_private',
  'choose_overage_action',
  'request_opt_out',
  'log_safety_concern',
  'request_upgrade',
];

const selectClassName =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ' +
  'ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  ' disabled:cursor-not-allowed disabled:opacity-50';

export function DebugLogFilters({
  currentFilters,
}: {
  currentFilters: Record<string, string | undefined>;
}) {
  const activeFilterCount = getActiveFilterCount(currentFilters);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <FilterModal activeFilterCount={activeFilterCount}>
          {({ onClose, startDateInputRef }) => (
            <DebugLogFilterForm
              currentFilters={currentFilters}
              onClose={onClose}
              startDateInputRef={startDateInputRef}
            />
          )}
        </FilterModal>
        <ActiveFilters filters={currentFilters} />
      </div>
    </div>
  );
}

function DebugLogFilterForm({
  currentFilters,
  onClose,
  startDateInputRef,
}: {
  currentFilters: Record<string, string | undefined>;
  onClose: () => void;
  startDateInputRef: React.RefObject<HTMLButtonElement>;
}) {
  const [startDate, setStartDate] = useState(currentFilters.startDate ?? '');
  const [endDate, setEndDate] = useState(currentFilters.endDate ?? '');

  useEffect(() => {
    setStartDate(currentFilters.startDate ?? '');
    setEndDate(currentFilters.endDate ?? '');
  }, [currentFilters.startDate, currentFilters.endDate]);

  return (
    <>
      <form method="GET" id="filter-form" className="flex flex-col min-h-0 flex-1">
        <input type="hidden" name="startDate" value={startDate} />
        <input type="hidden" name="endDate" value={endDate} />
        <div className="flex-1 overflow-y-auto min-h-0 grid gap-4 lg:grid-cols-2 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start date</label>
            <DatePicker
              ref={startDateInputRef}
              value={startDate}
              onChange={setStartDate}
              placeholder="Select date"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">End date</label>
            <DatePicker
              value={endDate}
              onChange={setEndDate}
              placeholder="Select date"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Call session ID</label>
            <TextFieldInput
              type="text"
              name="sessionId"
              placeholder="UUID"
              defaultValue={currentFilters.sessionId ?? ''}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account ID</label>
            <TextFieldInput
              type="text"
              name="accountId"
              placeholder="UUID"
              defaultValue={currentFilters.accountId ?? ''}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Event type</label>
            <select
              name="eventType"
              className={selectClassName}
              defaultValue={currentFilters.eventType ?? ''}
            >
              <option value="">All</option>
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tool name</label>
            <select
              name="toolName"
              className={selectClassName}
              defaultValue={currentFilters.toolName ?? ''}
            >
              <option value="">All</option>
              {TOOL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      <div className="flex gap-3 pt-2 flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 px-4 rounded-lg border border-input bg-background text-foreground text-center font-medium hover:bg-muted transition-colors"
        >
          Discard
        </button>
        <button
          type="submit"
          form="filter-form"
          className="flex-1 py-2 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
        >
          Apply filters
        </button>
      </div>
    </>
  );
}
