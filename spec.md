# Spec: Scheduling Features Parity & Dashboard Enhancements

## Overview

This spec brings schedule management to feature parity with reminders and adds real-time call visibility to the dashboard.

### Goals
1. **Schedule exceptions**: Skip, snooze, or reschedule individual call occurrences
2. **Vacation mode**: Line-level pause for all schedules and reminders
3. **Voice control**: Seniors can manage schedules via phone
4. **Audit trail**: Full event logging for schedules (parity with reminders)
5. **In-progress calls**: Real-time dashboard display of active calls

---

## 1. Database Schema Changes

### 1.1 New Table: `ultaura_schedule_exceptions`

```sql
-- Migration: YYYYMMDD000001_schedule_exceptions.sql

CREATE TYPE ultaura_schedule_exception_type AS ENUM ('skip', 'snooze', 'reschedule');

CREATE TABLE ultaura_schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES ultaura_schedules(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- The specific occurrence date being affected (in line's timezone)
  exception_date date NOT NULL,

  -- Type: skip | snooze | reschedule
  exception_type ultaura_schedule_exception_type NOT NULL,

  -- For snooze: new time on same day
  -- For reschedule: new datetime for the one-time call
  new_datetime timestamptz,

  -- For reschedule: reference to one-time schedule created
  reschedule_schedule_id uuid REFERENCES ultaura_schedules(id) ON DELETE SET NULL,

  -- Who created this exception
  created_by text NOT NULL CHECK (created_by IN ('dashboard', 'voice')),
  call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,

  -- Metadata (snooze duration, original time, etc.)
  metadata jsonb,

  UNIQUE(schedule_id, exception_date)
);

CREATE INDEX idx_schedule_exceptions_schedule_date
  ON ultaura_schedule_exceptions(schedule_id, exception_date);
CREATE INDEX idx_schedule_exceptions_line
  ON ultaura_schedule_exceptions(line_id, exception_date);

-- RLS policies (same pattern as other ultaura tables)
ALTER TABLE ultaura_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access schedule exceptions for their accounts"
  ON ultaura_schedule_exceptions FOR ALL
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Service role has full access"
  ON ultaura_schedule_exceptions FOR ALL
  USING (auth.role() = 'service_role');
```

### 1.2 New Table: `ultaura_schedule_events`

```sql
-- Migration: YYYYMMDD000002_schedule_events.sql

CREATE TABLE ultaura_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES ultaura_schedules(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  event_type text NOT NULL,
  triggered_by text NOT NULL,
  call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,
  metadata jsonb,

  CONSTRAINT chk_schedule_event_type CHECK (event_type IN (
    'created', 'edited', 'enabled', 'disabled',
    'exception_added', 'exception_removed',
    'vacation_started', 'vacation_ended'
  )),
  CONSTRAINT chk_schedule_triggered_by CHECK (triggered_by IN ('dashboard', 'voice', 'system'))
);

CREATE INDEX idx_schedule_events_schedule ON ultaura_schedule_events(schedule_id, created_at DESC);
CREATE INDEX idx_schedule_events_line ON ultaura_schedule_events(line_id, created_at DESC);

-- RLS
ALTER TABLE ultaura_schedule_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedule events for their accounts"
  ON ultaura_schedule_events FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Service role has full access"
  ON ultaura_schedule_events FOR ALL
  USING (auth.role() = 'service_role');
```

### 1.3 Modify `ultaura_lines` Table

```sql
-- Migration: YYYYMMDD000003_lines_vacation_voice_control.sql

-- Vacation ranges: [{start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'}, ...]
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS vacation_ranges jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Voice control toggle (matches allow_voice_reminder_control)
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS allow_voice_schedule_control boolean NOT NULL DEFAULT true;

-- Validate vacation_ranges is an array
ALTER TABLE ultaura_lines
  ADD CONSTRAINT chk_vacation_ranges_format CHECK (jsonb_typeof(vacation_ranges) = 'array');
```

### 1.4 Update Scheduler RPC Functions

```sql
-- Migration: YYYYMMDD000004_scheduler_vacation_check.sql

-- Helper: Check if line is on vacation today
CREATE OR REPLACE FUNCTION is_line_on_vacation(p_line_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_vacation_ranges jsonb;
  v_today date;
  v_range jsonb;
BEGIN
  SELECT vacation_ranges, (now() AT TIME ZONE timezone)::date
  INTO v_vacation_ranges, v_today
  FROM ultaura_lines WHERE id = p_line_id;

  IF v_vacation_ranges IS NULL OR jsonb_array_length(v_vacation_ranges) = 0 THEN
    RETURN false;
  END IF;

  FOR v_range IN SELECT * FROM jsonb_array_elements(v_vacation_ranges)
  LOOP
    IF v_today >= (v_range->>'start')::date AND v_today <= (v_range->>'end')::date THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Update claim_due_schedules to exclude vacationing lines and skip exceptions
CREATE OR REPLACE FUNCTION claim_due_schedules(
  p_worker_id text,
  p_batch_size int DEFAULT 10,
  p_claim_ttl_seconds int DEFAULT 120
)
RETURNS SETOF ultaura_schedules
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_stale_threshold timestamptz := v_now - (p_claim_ttl_seconds || ' seconds')::interval;
BEGIN
  -- Clear stale claims
  UPDATE ultaura_schedules
  SET processing_claimed_by = NULL, processing_claimed_at = NULL
  WHERE processing_claimed_by IS NOT NULL
    AND processing_claimed_at < v_stale_threshold;

  -- Claim and return schedules (excluding vacation + skip exceptions)
  RETURN QUERY
  WITH claimed AS (
    SELECT s.id
    FROM ultaura_schedules s
    WHERE s.enabled = true
      AND s.next_run_at IS NOT NULL
      AND s.next_run_at <= v_now
      AND s.processing_claimed_by IS NULL
      AND NOT is_line_on_vacation(s.line_id)
      AND NOT EXISTS (
        SELECT 1 FROM ultaura_schedule_exceptions se
        WHERE se.schedule_id = s.id
          AND se.exception_date = (v_now AT TIME ZONE s.timezone)::date
          AND se.exception_type = 'skip'
      )
    ORDER BY s.next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_schedules s
  SET processing_claimed_by = p_worker_id, processing_claimed_at = v_now
  FROM claimed c WHERE s.id = c.id
  RETURNING s.*;
END;
$$;

-- Update claim_due_reminders to exclude vacationing lines
CREATE OR REPLACE FUNCTION claim_due_reminders(
  p_worker_id text,
  p_batch_size int DEFAULT 10,
  p_claim_ttl_seconds int DEFAULT 120
)
RETURNS SETOF ultaura_reminders
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_stale_threshold timestamptz := v_now - (p_claim_ttl_seconds || ' seconds')::interval;
BEGIN
  UPDATE ultaura_reminders
  SET processing_claimed_by = NULL, processing_claimed_at = NULL
  WHERE processing_claimed_by IS NOT NULL
    AND processing_claimed_at < v_stale_threshold;

  RETURN QUERY
  WITH claimed AS (
    SELECT r.id
    FROM ultaura_reminders r
    WHERE r.status = 'scheduled'
      AND r.is_paused = false
      AND r.due_at <= v_now
      AND (r.snoozed_until IS NULL OR r.snoozed_until <= v_now)
      AND r.processing_claimed_by IS NULL
      AND NOT is_line_on_vacation(r.line_id)
    ORDER BY r.due_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_reminders r
  SET processing_claimed_by = p_worker_id, processing_claimed_at = v_now
  FROM claimed c WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

GRANT EXECUTE ON FUNCTION is_line_on_vacation(uuid) TO service_role;
```

---

## 2. Server Actions

### 2.1 New File: `src/lib/ultaura/schedule-exceptions.ts`

**Functions to implement:**

| Function | Purpose |
|----------|---------|
| `getScheduleExceptions(scheduleId)` | Get all exceptions for a schedule |
| `getUpcomingExceptions(lineId)` | Get future exceptions for a line |
| `createScheduleException(input, lineShortId)` | Create skip/snooze/reschedule exception |
| `deleteScheduleException(exceptionId, lineShortId)` | Remove an exception |

**Key logic for `createScheduleException`:**

```typescript
interface CreateExceptionInput {
  scheduleId: string;
  exceptionDate: string; // YYYY-MM-DD
  exceptionType: 'skip' | 'snooze' | 'reschedule';
  snoozeMinutes?: number; // 5-1440 (5 min to 24 hours)
  newDatetime?: string; // ISO string for reschedule
}
```

- **Skip**: Just creates exception row, no `new_datetime`
- **Snooze**: Calculates `new_datetime` = original time + snooze minutes (same day)
- **Reschedule**: Creates exception + one-time schedule at new datetime

### 2.2 New File: `src/lib/ultaura/schedule-events.ts`

**Functions:**

```typescript
export async function logScheduleEvent(params: {
  accountId: string;
  scheduleId: string;
  lineId: string;
  eventType: 'created' | 'edited' | 'enabled' | 'disabled' | 'exception_added' | 'exception_removed' | 'vacation_started' | 'vacation_ended';
  triggeredBy: 'dashboard' | 'voice' | 'system';
  callSessionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void>

export async function getScheduleEvents(scheduleId: string): Promise<ScheduleEvent[]>
```

### 2.3 New File: `src/lib/ultaura/vacation.ts`

**Functions:**

```typescript
export interface VacationRange {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

export async function getVacationRanges(lineId: string): Promise<VacationRange[]>
export async function isLineOnVacation(lineId: string): Promise<boolean>
export async function addVacationRange(lineId: string, range: VacationRange): Promise<ActionResult<void>>
export async function removeVacationRange(lineId: string, start: string): Promise<ActionResult<void>>
```

**Validation rules:**
- Start date must be before end date
- Ranges cannot overlap with existing ranges
- Log `vacation_started` event for all schedules on the line

### 2.4 Update `src/lib/ultaura/schedules.ts`

Add event logging to existing functions:
- `createSchedule` → log `created` event
- `updateSchedule` → log `edited` event (if time/days changed) or `enabled`/`disabled` event

---

## 3. Telephony Changes

### 3.1 Update Scheduler: `telephony/src/scheduler/call-scheduler.ts`

In `processSchedule()`, add snooze exception handling:

```typescript
async function processSchedule(schedule: ScheduleRow): Promise<void> {
  // ... existing checks ...

  // Check for snooze exception
  const today = DateTime.now().setZone(schedule.timezone).toISODate();
  const { data: exception } = await supabase
    .from('ultaura_schedule_exceptions')
    .select('*')
    .eq('schedule_id', schedule.id)
    .eq('exception_date', today)
    .eq('exception_type', 'snooze')
    .single();

  if (exception?.new_datetime) {
    const snoozeTime = DateTime.fromISO(exception.new_datetime);
    if (DateTime.now() < snoozeTime) {
      // Not yet time for snoozed call, release and skip
      await releaseScheduleClaim(schedule.id);
      return;
    }
    // Snooze time passed, proceed with call
  }

  // ... rest of existing logic ...
}
```

### 3.2 New Grok Tool: `telephony/src/routes/tools/skip-schedule.ts`

**Endpoint**: `POST /tools/skip_schedule`

**Input Schema:**
```typescript
{
  callSessionId: string;
  lineId: string;
  scheduleId?: string; // Optional - if omitted, skip next upcoming schedule
}
```

**Logic:**
1. Check `allow_voice_schedule_control` on line
2. Find target schedule (specified or next upcoming)
3. Calculate exception_date from schedule's next_run_at
4. Insert skip exception
5. Log `exception_added` event with triggered_by='voice'
6. Return confirmation: "Okay, I've skipped your call on [date]. Your next call will be at the regular time after that."

### 3.3 New Grok Tool: `telephony/src/routes/tools/snooze-schedule.ts`

**Endpoint**: `POST /tools/snooze_schedule`

**Input Schema:**
```typescript
{
  callSessionId: string;
  lineId: string;
  scheduleId?: string;
  snoozeMinutes: number; // 5-1440 (flexible, parsed from natural language)
}
```

**Logic:**
1. Check `allow_voice_schedule_control`
2. Validate snooze duration (min 5 min, max 24 hours / 1440 min)
3. Calculate new_datetime = now + snoozeMinutes
4. Insert snooze exception
5. Log event
6. Return confirmation with exact new time: "Got it! I'll call you back in [duration], around [time]."

### 3.4 New Grok Tool: `telephony/src/routes/tools/reschedule-schedule.ts`

**Endpoint**: `POST /tools/reschedule_schedule`

**Input Schema:**
```typescript
{
  callSessionId: string;
  lineId: string;
  scheduleId?: string;
  newDatetime: string; // ISO string - the new time for this call
}
```

**Logic:**
1. Check `allow_voice_schedule_control`
2. Validate newDatetime is in the future
3. Create one-time schedule at newDatetime
4. Insert reschedule exception with `reschedule_schedule_id`
5. Log event
6. Return confirmation: "Okay, I've moved your call to [new date/time]."

### 3.5 Register Tools

In `telephony/src/routes/tools/index.ts`:

```typescript
import { skipScheduleRouter } from './skip-schedule.js';
import { snoozeScheduleRouter } from './snooze-schedule.js';
import { rescheduleScheduleRouter } from './reschedule-schedule.js';

toolsRouter.use('/skip_schedule', skipScheduleRouter);
toolsRouter.use('/snooze_schedule', snoozeScheduleRouter);
toolsRouter.use('/reschedule_schedule', rescheduleScheduleRouter);
```

---

## 4. Dashboard UI Components

### 4.1 In-Progress Call Banner

**New file**: `src/components/ultaura/InProgressCallBanner.tsx`

**Behavior:**
- Positioned at top of main content area (below nav, above page content)
- Uses Supabase Realtime subscription to `ultaura_call_sessions` table
- Filters for `status = 'in_progress'` AND `account_id = current`
- Displays: Line name, duration (live ticking), call type (Scheduled/Reminder/Inbound)
- Duration calculated from `connected_at` timestamp, updates every 1 second
- No end call button

**Key implementation:**

```typescript
// Subscribe to realtime changes
const channel = supabase
  .channel('call_sessions_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'ultaura_call_sessions',
    filter: `account_id=eq.${accountId}`,
  }, handleChange)
  .subscribe();

// Update duration every second when call active
useEffect(() => {
  if (!activeCall?.connected_at) return;
  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - new Date(connected_at).getTime()) / 1000);
    setDuration(elapsed);
  }, 1000);
  return () => clearInterval(interval);
}, [activeCall?.connected_at]);
```

### 4.2 Vacation Settings Component

**New file**: `src/app/dashboard/(app)/lines/[lineId]/settings/VacationSettings.tsx`

**Features:**
- List existing vacation ranges with status (active/upcoming/past)
- Add new range with date pickers (start + end)
- Remove upcoming/active ranges
- Active vacation shows prominent amber badge
- Validation: no overlapping ranges, start before end

### 4.3 Exception Management UI

**Location**: `src/app/dashboard/(app)/lines/[lineId]/schedule/`

**Features:**
- List upcoming exceptions for schedules
- Create exception modal with:
  - Date picker (which occurrence)
  - Type selector (Skip / Snooze / Reschedule)
  - Time picker for snooze (shows resulting time)
  - DateTime picker for reschedule
- Delete exception button

### 4.4 Update Line Card

**File**: `src/app/dashboard/(app)/lines/components/LineCard.tsx`

Add vacation indicator:
```tsx
{isOnVacation && (
  <span className="badge bg-amber-100 text-amber-800">
    <Palmtree className="w-3 h-3 mr-1" />
    Vacation
  </span>
)}
```

Add in-progress call indicator:
```tsx
{hasActiveCall && (
  <span className="badge bg-green-100 text-green-800 animate-pulse">
    <Phone className="w-3 h-3 mr-1" />
    On call
  </span>
)}
```

### 4.5 Voice Control Toggle

**Location**: Line settings page

Add toggle for `allow_voice_schedule_control` alongside existing `allow_voice_reminder_control`:

```tsx
<SettingRow
  label="Voice schedule control"
  description="Allow [Name] to skip, snooze, or reschedule calls by phone"
  checked={line.allow_voice_schedule_control}
  onChange={handleToggle}
/>
```

---

## 5. Critical Files Reference

| File | Purpose |
|------|---------|
| `supabase/migrations/20241220000001_ultaura_schema.sql` | Base schema patterns |
| `supabase/migrations/20260104000004_scheduler_rpc_functions.sql` | Scheduler RPC functions to update |
| `telephony/src/scheduler/call-scheduler.ts` | Scheduler logic for vacation/exception handling |
| `src/lib/ultaura/reminders.ts` | Reference for pause/snooze/skip patterns |
| `src/lib/ultaura/schedules.ts` | Existing schedule actions to enhance |
| `telephony/src/routes/tools/snooze-reminder.ts` | Template for new Grok tools |
| `src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx` | Reference for exception UI patterns |

---

## 6. Implementation Order

### Phase 1: Database (Migrations)
1. Create `ultaura_schedule_exceptions` table
2. Create `ultaura_schedule_events` table
3. Add `vacation_ranges` and `allow_voice_schedule_control` to `ultaura_lines`
4. Update scheduler RPC functions

### Phase 2: Server Actions
1. Implement `schedule-exceptions.ts`
2. Implement `schedule-events.ts`
3. Implement `vacation.ts`
4. Update `schedules.ts` to log events

### Phase 3: Telephony
1. Update `call-scheduler.ts` for snooze exception handling
2. Implement `skip-schedule.ts` tool
3. Implement `snooze-schedule.ts` tool
4. Implement `reschedule-schedule.ts` tool
5. Register tools in index

### Phase 4: Dashboard UI
1. Implement `InProgressCallBanner.tsx` with Supabase Realtime
2. Implement `VacationSettings.tsx`
3. Add exception management UI to schedule page
4. Update `LineCard.tsx` with vacation/active-call badges
5. Add voice control toggle to settings

---

## 7. Edge Cases & Error Handling

### Exceptions
- **Duplicate exception**: Return friendly error "An exception already exists for this date"
- **Past date**: Reject with "Cannot create exception for past dates"
- **Exception during vacation**: Skip processing (vacation takes precedence)

### Vacation
- **Overlapping ranges**: Reject with "Vacation range overlaps with existing range"
- **Active call during vacation start**: Let call complete, vacation applies to next occurrence
- **Vacation ends silently**: No notification, calls resume automatically

### Voice Control
- **Control disabled**: "I'm sorry, but your caregiver has disabled schedule changes by phone"
- **No upcoming schedule**: "I couldn't find any upcoming scheduled calls to skip"
- **Invalid snooze duration**: "Please tell me how long - anywhere from 5 minutes to 24 hours"

### Real-time Banner
- **Multiple active calls**: Show most recent (latest connected_at)
- **Quick connect/disconnect**: Handle rapid state changes gracefully
- **Subscription failure**: Fall back to polling every 10 seconds

---

## 8. Testing Considerations

### Unit Tests
- Schedule exception CRUD operations
- Vacation range validation (overlaps, ordering)
- Snooze duration parsing and validation
- Duration formatting (0:00 to 99:59+)

### Integration Tests
- Scheduler skips calls during vacation
- Scheduler respects skip exceptions
- Snooze exception delays call to correct time
- Voice tools create proper exceptions
- Realtime subscription receives updates

### E2E Tests
- Dashboard: Create vacation → verify schedules paused
- Dashboard: Create snooze exception → verify call delayed
- Voice: "Skip tomorrow's call" → verify exception created
- Voice: "Call me back in 30 minutes" → verify snooze exception
- Banner: Appears when call connects, disappears when ends

---

## 9. Verification Plan

After implementation:

1. **Database**: Run migrations, verify tables exist with correct columns/indexes
2. **Server Actions**: Test CRUD operations via dashboard
3. **Scheduler**: Trigger test calls, verify vacation/exception filtering
4. **Voice Tools**: Make test call, try skip/snooze commands
5. **Dashboard**:
   - Create vacation, verify badge shows
   - Start test call, verify banner appears with ticking duration
   - Create exception, verify it appears in list
6. **Edge cases**: Test overlapping vacations, past dates, disabled voice control
