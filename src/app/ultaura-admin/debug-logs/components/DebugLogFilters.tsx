import Button from '~/core/ui/Button';
import { TextFieldInput } from '~/core/ui/TextField';

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
  'focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

export function DebugLogFilters({
  currentFilters,
}: {
  currentFilters: Record<string, string | undefined>;
}) {
  return (
    <form
      method="GET"
      className="grid gap-4 rounded-xl border border-border bg-card p-4 lg:grid-cols-3"
    >
      <div className="space-y-2">
        <label className="text-sm font-medium">Start date</label>
        <TextFieldInput
          type="date"
          name="startDate"
          defaultValue={currentFilters.startDate ?? ''}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">End date</label>
        <TextFieldInput
          type="date"
          name="endDate"
          defaultValue={currentFilters.endDate ?? ''}
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

      <div className="flex items-end gap-2">
        <Button type="submit">Apply filters</Button>
        <Button variant="ghost" href="/ultaura-admin/debug-logs">
          Reset
        </Button>
      </div>
    </form>
  );
}
