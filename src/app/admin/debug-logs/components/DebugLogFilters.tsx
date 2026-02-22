'use client';

import { useEffect, useState } from 'react';
import { TextFieldInput } from '~/core/ui/TextField';
import { DatePicker } from '~/core/ui/DatePicker';
import Button from '~/core/ui/Button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/core/ui/Select';
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
  const [selectedEventType, setSelectedEventType] = useState(currentFilters.eventType ?? '');
  const [selectedToolName, setSelectedToolName] = useState(currentFilters.toolName ?? '');

  useEffect(() => {
    setStartDate(currentFilters.startDate ?? '');
    setEndDate(currentFilters.endDate ?? '');
    setSelectedEventType(currentFilters.eventType ?? '');
    setSelectedToolName(currentFilters.toolName ?? '');
  }, [currentFilters.startDate, currentFilters.endDate, currentFilters.eventType, currentFilters.toolName]);

  return (
    <>
      <form method="GET" id="filter-form" className="flex flex-col min-h-0 flex-1">
        <input type="hidden" name="startDate" value={startDate} />
        <input type="hidden" name="endDate" value={endDate} />
        <input type="hidden" name="eventType" value={selectedEventType} />
        <input type="hidden" name="toolName" value={selectedToolName} />
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
            <Select value={selectedEventType} onValueChange={setSelectedEventType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tool name</label>
            <Select value={selectedToolName} onValueChange={setSelectedToolName}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                {TOOL_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </form>

      <div className="flex gap-3 pt-2 flex-shrink-0">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Discard
        </Button>
        <Button variant="default" type="submit" form="filter-form" className="flex-1">
          Apply filters
        </Button>
      </div>
    </>
  );
}
