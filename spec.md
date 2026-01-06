# Specification: One-Off Schedule Recurrence Mismatch Fix

**Status**: Ready for Implementation
**Priority**: HIGH
**Type**: Bug Fix
**Impact**: High (users get unexpected repeated calls → churn + trust loss)
**Likelihood**: Medium/High (depends on voice scheduling usage)

---

## 1. Executive Summary

### Problem Statement
When a user says "call me tomorrow at 3pm" during a voice call, the system creates a schedule with `RRULE: 'FREQ=DAILY;COUNT=1'`. However, the scheduler's `calculateNextRun()` function **completely ignores the RRULE** and only uses `days_of_week` and `time_of_day`, causing the one-off call to repeat weekly forever.

### Symptoms
- User requests: "Call me tomorrow at 3pm"
- System creates schedule with `COUNT=1` and `days_of_week: [3]` (e.g., Wednesday)
- First call happens correctly on Wednesday at 3pm
- Scheduler calculates next run using only `days_of_week` → schedules for next Wednesday
- Call repeats every Wednesday indefinitely

### Root Cause Analysis

**File 1: `telephony/src/routes/tools/schedule-call.ts`**
- Voice tool supports `mode: 'one_off'` (lines 78-127)
- Creates schedule with `rrule: 'FREQ=DAILY;COUNT=1'`
- Extracts single day from timestamp into `days_of_week` array

**File 2: `telephony/src/scheduler/call-scheduler.ts`**
- `calculateNextRun()` function (lines 393-422) only uses:
  - `days_of_week` array
  - `time_of_day` string
  - `timezone` string
- **Never parses or checks the `rrule` field**
- After first call, calculates next occurrence based purely on weekday pattern

### Solution Overview
1. Remove `one_off` mode from `schedule_call` voice tool
2. Use existing `set-reminder` tool for one-time calls (already supports this)
3. Update Grok prompt with clear rules for tool selection
4. Remove unused `rrule` column from `ultaura_schedules` table
5. Enforce minimum 5-minute buffer for scheduled calls

---

## 2. Technical Requirements

### 2.1 Current State Analysis

#### Voice Tool: schedule-call.ts

**Location:** `/telephony/src/routes/tools/schedule-call.ts`

```typescript
interface ScheduleCallRequest {
  callSessionId: string;
  lineId: string;
  mode: 'one_off' | 'update_recurring';  // one_off to be REMOVED
  when?: string;                          // ISO timestamp (for one_off)
  daysOfWeek?: number[];                  // 0-6, Sunday-Saturday
  timeLocal?: string;                     // HH:mm format
  timezone?: string;
}
```

**One-off handling (lines 78-127):**
- Validates `when` is a future timestamp
- Creates schedule with:
  - `rrule: 'FREQ=DAILY;COUNT=1'`
  - `days_of_week: [dayOfWeek]` (single day extracted from timestamp)
  - `time_of_day: HH:mm` (extracted from timestamp)
  - `next_run_at: timestamp`

#### Scheduler: call-scheduler.ts

**Location:** `/telephony/src/scheduler/call-scheduler.ts`

**calculateNextRun function (lines 393-422):**
```typescript
function calculateNextRun(schedule: ScheduleRow): string | null {
  const { days_of_week, time_of_day, timezone } = schedule;
  // NOTE: rrule is NEVER used here!

  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  const nextRun = getNextOccurrence({
    timeOfDay: time_of_day,
    timezone,
    daysOfWeek: days_of_week,  // Loops through these days weekly
  });
  return nextRun.toISOString();
}
```

#### Reminder System (Target Solution)

**Location:** `/telephony/src/routes/tools/set-reminder.ts`

The reminder system already supports one-off calls correctly:
- `is_recurring: false` for one-time reminders
- Marks status as 'sent' after delivery (no rescheduling)
- Full voice tool support via `set-reminder`
- Same outbound call flow as schedules

**Database schema (ultaura_reminders):**
- `due_at` - Single future timestamp
- `is_recurring` - Boolean flag (false for one-off)
- `status` - 'scheduled' | 'sent' | 'missed' | 'canceled'
- `message` - Required reminder content (up to 500 chars)

### 2.2 Target State

#### Architecture Change

```
BEFORE:
User: "Call me tomorrow at 3pm"
  → schedule_call tool (mode: 'one_off')
  → ultaura_schedules (rrule: 'FREQ=DAILY;COUNT=1')
  → Scheduler ignores COUNT=1, repeats weekly ❌

AFTER:
User: "Call me tomorrow at 3pm"
  → set_reminder tool (is_recurring: false)
  → ultaura_reminders (status: 'scheduled')
  → Scheduler marks 'sent' after delivery ✓
```

---

## 3. Implementation Details

### 3.1 Remove one_off Mode from schedule_call Tool

**File:** `/telephony/src/routes/tools/schedule-call.ts`

**Changes:**
1. Remove `'one_off'` from the `mode` type union
2. Remove lines 78-127 (entire one_off handling block)
3. Update error messages to indicate one-off calls should use `set-reminder`
4. Update TypeScript interface

**Before:**
```typescript
interface ScheduleCallRequest {
  mode: 'one_off' | 'update_recurring';
  when?: string;  // For one_off
  // ...
}
```

**After:**
```typescript
interface ScheduleCallRequest {
  mode: 'update_recurring';  // Only recurring supported
  daysOfWeek: number[];      // Required
  timeLocal: string;         // Required
  timezone?: string;
}
```

**Error handling for legacy one_off requests:**
```typescript
if (mode === 'one_off') {
  return res.status(400).json({
    success: false,
    error: 'One-time calls should use the set_reminder tool instead',
    suggestion: 'Use set_reminder with the desired date/time and message',
  });
}
```

### 3.2 Update Grok Tool Definitions

**File:** `/packages/prompts/src/tools/definitions.ts` (lines 62-90)

**Before:**
```typescript
{
  type: 'function',
  name: 'schedule_call',
  description: 'Update the call schedule for the user',
  parameters: {
    properties: {
      mode: {
        type: 'string',
        enum: ['one_off', 'update_recurring'],
        description: 'Whether to schedule a one-time call or update recurring schedule',
      },
      when: {
        type: 'string',
        description: 'For one_off: ISO 8601 timestamp of when to call',
      },
      // ...
    },
  },
}
```

**After:**
```typescript
{
  type: 'function',
  name: 'schedule_call',
  description: 'Update the RECURRING weekly call schedule. For one-time calls, use set_reminder instead.',
  parameters: {
    properties: {
      days_of_week: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 6 },
        description: 'Days of week for recurring calls (0=Sunday, 6=Saturday). Required.',
      },
      time_local: {
        type: 'string',
        description: 'Time in HH:mm format for the recurring calls. Required.',
      },
    },
    required: ['days_of_week', 'time_local'],
  },
}
```

### 3.3 Update Grok System Prompt

**File:** `/src/lib/ultaura/prompts.ts` or `/packages/prompts/src/system.ts`

**Add to tool usage instructions section:**

```markdown
## Call Scheduling Rules

### One-Time Calls (use set_reminder)
For requests like "call me tomorrow", "call me at 5pm today", "call me next Tuesday at 2pm":
- Use the `set_reminder` tool
- Always ask for a message/reason: "Sure! What should I remind you about when I call?"
- Confirm the scheduled time back to the user

**Examples of one-time requests:**
- "Call me tomorrow at 3pm" → set_reminder
- "Call me in 2 hours" → set_reminder
- "Call me next Friday morning" → set_reminder
- "Just call me later today" → set_reminder

### Recurring Calls (use schedule_call)
For requests with weekly patterns like "call me every Monday", "call me on weekdays":
- Use the `schedule_call` tool
- These calls repeat indefinitely on the specified days

**Examples of recurring requests:**
- "Call me every Monday at 9am" → schedule_call
- "Call me on weekdays at 6pm" → schedule_call
- "Call me every day at noon" → schedule_call (all 7 days)
- "Change my calls to Tuesday and Thursday" → schedule_call

### Minimum Time Buffer
One-time calls must be scheduled at least 5 minutes in the future. If a user asks for a call "right now" or "in 1 minute", explain that you need at least 5 minutes notice.

### When User Wants to Change Schedule to One-Time
If a user with an existing recurring schedule asks for "just tomorrow" or similar:
- Ask: "Do you want to pause your regular schedule and just call tomorrow, or replace it entirely?"
- Based on their answer, either:
  - Create a one-time reminder AND disable the schedule, OR
  - Just create a one-time reminder while keeping the schedule active
```

### 3.4 Update set-reminder Tool for One-Time Calls

**File:** `/telephony/src/routes/tools/set-reminder.ts`

**Add validation for minimum 5-minute buffer:**

```typescript
const MIN_BUFFER_MINUTES = 5;

// In the handler:
const dueAt = new Date(request.dueAt);
const now = new Date();
const bufferMs = MIN_BUFFER_MINUTES * 60 * 1000;

if (dueAt.getTime() - now.getTime() < bufferMs) {
  return res.status(400).json({
    success: false,
    error: `Reminders must be scheduled at least ${MIN_BUFFER_MINUTES} minutes in the future`,
    earliestAllowed: new Date(now.getTime() + bufferMs).toISOString(),
  });
}
```

### 3.5 Database Migration: Remove rrule Column

**File:** `/supabase/migrations/YYYYMMDDHHMMSS_remove_schedule_rrule.sql`

```sql
-- Migration: Remove unused rrule column from ultaura_schedules
--
-- Background: The rrule column was intended for RFC 5545 recurrence rules,
-- but the scheduler never parsed it. Schedules use days_of_week + time_of_day
-- for weekly recurrence. One-off calls now use the reminders system.

-- Step 1: Verify no schedules exist with COUNT=1 (one-off)
-- This is a safety check - should return 0 rows in pre-launch environment
DO $$
DECLARE
  count_one_off INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_one_off
  FROM ultaura_schedules
  WHERE rrule LIKE '%COUNT=1%';

  IF count_one_off > 0 THEN
    RAISE WARNING 'Found % schedules with COUNT=1. These will lose their rrule data.', count_one_off;
  END IF;
END $$;

-- Step 2: Drop the rrule column
ALTER TABLE ultaura_schedules DROP COLUMN IF EXISTS rrule;

-- Step 3: Update any indexes that referenced rrule (none expected)
-- No action needed as rrule was not indexed

-- Step 4: Log migration
INSERT INTO ultaura_migration_log (migration_name, notes)
VALUES ('remove_schedule_rrule', 'Removed unused rrule column. One-off calls now use reminders system.');
```

### 3.6 Update TypeScript Types

**File:** `/src/lib/ultaura/types.ts`

**Remove rrule from Schedule interface:**

```typescript
// BEFORE:
export interface Schedule {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  enabled: boolean;
  timezone: string;
  rrule: string;  // REMOVE THIS
  daysOfWeek: number[];
  timeOfDay: string;
  nextRunAt: string | null;
  // ...
}

// AFTER:
export interface Schedule {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  enabled: boolean;
  timezone: string;
  daysOfWeek: number[];
  timeOfDay: string;
  nextRunAt: string | null;
  // ...
}
```

**File:** `/telephony/src/scheduler/call-scheduler.ts`

**Update ScheduleRow type:**
```typescript
// Remove rrule from ScheduleRow interface
export interface ScheduleRow {
  id: string;
  account_id: string;
  line_id: string;
  enabled: boolean;
  timezone: string;
  // rrule: string;  // REMOVED
  days_of_week: number[];
  time_of_day: string;
  next_run_at: string | null;
  // ...
}
```

### 3.7 Update Server Actions

**File:** `/src/lib/ultaura/actions.ts`

**Update createSchedule function to remove rrule:**

```typescript
// In createSchedule function, remove rrule from insert:
const { data, error } = await supabase
  .from('ultaura_schedules')
  .insert({
    account_id: accountId,
    line_id: input.lineId,
    timezone: input.timezone,
    // rrule: `FREQ=WEEKLY;BYDAY=${dayNames}`,  // REMOVE THIS LINE
    days_of_week: input.daysOfWeek,
    time_of_day: input.timeOfDay,
    next_run_at: nextRunAt,
    retry_policy: input.retryPolicy || { max_retries: 2, retry_window_minutes: 30 },
  })
  .select()
  .single();
```

---

## 4. Grok Conversation Flow Examples

### Example 1: One-Time Call Request

```
User: "Call me tomorrow at 3pm"

Grok: "Sure! What should I remind you about when I call tomorrow at 3pm?"

User: "Just a check-in"

Grok: [Calls set_reminder tool with:
  - dueAt: tomorrow 3pm ISO timestamp
  - message: "Check-in call"
  - is_recurring: false
]

Grok: "I've scheduled a call for tomorrow at 3:00 PM for your check-in. I'll talk to you then!"
```

### Example 2: Recurring Schedule Request

```
User: "Call me every Monday and Wednesday at 9am"

Grok: [Calls schedule_call tool with:
  - days_of_week: [1, 3]  // Monday, Wednesday
  - time_local: "09:00"
]

Grok: "I've updated your schedule. I'll call you every Monday and Wednesday at 9:00 AM."
```

### Example 3: Same-Day Request

```
User: "Call me in 2 hours"

Grok: "Sure! What should I remind you about when I call?"

User: "To take my medication"

Grok: [Calls set_reminder with dueAt = now + 2 hours]

Grok: "I've scheduled a call for 4:30 PM today to remind you to take your medication. Talk to you then!"
```

### Example 4: Buffer Validation

```
User: "Call me right now"

Grok: "I need at least 5 minutes notice to schedule a call. Would you like me to call you in 5 minutes, or at a specific time?"
```

### Example 5: Converting Schedule to One-Time

```
User: "Actually, don't call me on Monday this week, just call me tomorrow"

Grok: "Do you want to pause your regular Monday calls and just call tomorrow, or keep your regular schedule and add an extra call tomorrow?"

User: "Just pause Monday and call tomorrow"

Grok: [Disables existing schedule, creates one-time reminder]

Grok: "I've paused your regular Monday calls and scheduled a one-time call for tomorrow. Would you like me to resume your regular schedule after that?"
```

---

## 5. Files to Modify

### Primary Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `/telephony/src/routes/tools/schedule-call.ts` | Modify | Remove one_off mode, add error for legacy requests |
| `/packages/prompts/src/tools/definitions.ts` | Modify | Update schedule_call tool definition, remove mode/when params |
| `/src/lib/ultaura/prompts.ts` | Modify | Add call scheduling rules to Grok prompt |
| `/telephony/src/routes/tools/set-reminder.ts` | Modify | Add 5-minute minimum buffer validation |
| `/supabase/migrations/XXXXXX_remove_schedule_rrule.sql` | Create | Migration to drop rrule column |
| `/src/lib/ultaura/types.ts` | Modify | Remove rrule from Schedule interface |
| `/src/lib/ultaura/actions.ts` | Modify | Remove rrule from createSchedule insert |
| `/telephony/src/scheduler/call-scheduler.ts` | Modify | Remove rrule from ScheduleRow type |

### Files to Review (No Changes Expected)

| File | Reason |
|------|--------|
| `/telephony/src/scheduler/call-scheduler.ts` | Verify no rrule usage in calculateNextRun |
| `/telephony/src/routes/tools/list-reminders.ts` | Ensure one-off reminders display correctly |
| `/src/app/dashboard/(app)/lines/[lineId]/reminders/` | Verify UI shows one-time reminders |

---

## 6. Testing Plan

### Manual E2E Testing Checklist

#### One-Time Call Creation
- [ ] Voice: Say "call me tomorrow at 3pm" → should create reminder, not schedule
- [ ] Voice: Say "call me in 2 hours" → should work with same-day timing
- [ ] Voice: Say "call me in 3 minutes" → should reject (under 5-min buffer)
- [ ] Verify Grok asks for message/reason before creating reminder
- [ ] Verify Grok confirms the scheduled time back to user

#### Recurring Schedule (Unchanged Behavior)
- [ ] Voice: Say "call me every Monday at 9am" → should create schedule
- [ ] Voice: Say "call me on weekdays at 6pm" → should create schedule with 5 days
- [ ] Verify schedule repeats correctly week over week

#### Legacy one_off Mode Handling
- [ ] Direct API call with `mode: 'one_off'` → should return 400 error with helpful message
- [ ] Verify error message suggests using set_reminder instead

#### Reminder Delivery
- [ ] Create one-time reminder → verify call triggers at scheduled time
- [ ] After call completes → verify reminder status is 'sent' (not rescheduled)
- [ ] Verify no duplicate calls occur

#### Schedule to One-Time Conversion
- [ ] User with existing schedule says "just call me tomorrow" → verify Grok asks about preference
- [ ] Test both paths: pause schedule + one-time, or keep schedule + add one-time

#### Database Migration
- [ ] Run migration on dev environment → verify rrule column removed
- [ ] Verify existing schedules still function (use days_of_week)
- [ ] Verify new schedules can be created without rrule

---

## 7. Edge Cases & Error Handling

### Edge Case 1: Timezone Boundaries
**Scenario:** User says "call me tomorrow at 3pm" at 11:59 PM their time.
**Handling:** Use line's timezone for all calculations. The reminder system already handles this via `timezone` field.

### Edge Case 2: Past Time Today
**Scenario:** User says "call me at 9am" when it's already 10am.
**Handling:** Grok should recognize this and ask: "It's already past 9am today. Would you like me to call you at 9am tomorrow instead?"

### Edge Case 3: Ambiguous Time References
**Scenario:** User says "call me Tuesday" without specifying time.
**Handling:** Grok should ask: "What time on Tuesday would you like me to call?"

### Edge Case 4: User Has No Existing Schedule
**Scenario:** User says "change my schedule to just tomorrow" but has no recurring schedule.
**Handling:** Grok creates a one-time reminder. No schedule to modify.

### Edge Case 5: Multiple One-Time Requests
**Scenario:** User creates several one-time calls: "call me tomorrow at 3pm, and also Thursday at 10am"
**Handling:** Grok creates multiple reminders. Each is independent.

---

## 8. Rollback Plan

### If Issues Discovered

1. **Grok using wrong tool:** Update prompt with clearer examples
2. **5-minute buffer too restrictive:** Reduce to 2 minutes or remove
3. **Migration issues:** rrule column removal is non-destructive; no rollback needed
4. **Reminder delivery issues:** Fall back to schedule system temporarily

### Revert Procedure

If critical issues require full revert:

1. Re-add `one_off` mode to schedule_call tool
2. Revert Grok prompt changes
3. Add rrule column back (if needed for other purposes)

Note: Pre-launch environment means no production data to migrate back.

---

## 9. Success Criteria

- [ ] One-time call requests ("call me tomorrow") create reminders, not schedules
- [ ] Reminders are marked 'sent' after delivery (no repeat calls)
- [ ] Recurring requests ("call me every Monday") still create schedules correctly
- [ ] Schedules continue to repeat weekly as expected
- [ ] Grok asks for message/reason for one-time calls
- [ ] Grok confirms scheduled time back to user
- [ ] 5-minute minimum buffer enforced for one-time calls
- [ ] rrule column successfully removed from database
- [ ] No errors in tool handlers or scheduler
- [ ] User trust maintained - no unexpected repeated calls

---

## 10. Dependencies & Integrations

### No External Dependencies Required

This fix uses existing infrastructure:
- Reminder system (already implemented)
- set-reminder voice tool (already implemented)
- Reminder scheduler (already implemented)
- Reminder delivery via outbound calls (already implemented)

### Integration Points

| System | Integration | Notes |
|--------|-------------|-------|
| Grok Voice Agent | Prompt update | Tool selection rules |
| Telephony Backend | Tool handler update | Remove one_off mode |
| Scheduler | No changes needed | Already handles reminders correctly |
| Database | Migration | Drop rrule column |
| Dashboard | No changes needed | Reminders already displayed |
| Billing | No changes needed | Reminder calls already metered |

---

## 11. Assumptions

1. **Pre-launch environment:** No existing schedules with COUNT=1 need migration
2. **Reminder system works correctly:** One-off reminders already mark 'sent' after delivery
3. **Grok prompt updates are effective:** AI will follow tool selection rules
4. **5-minute buffer is acceptable:** Users won't frequently need calls within 5 minutes
5. **Message requirement is acceptable:** Users expect to provide a reason for one-time calls

---

## 12. Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Auto-route one-off to reminder or ask user? | Auto-route (cleaner UX) |
| Keep or remove one_off mode from schedule_call? | Remove entirely |
| Data migration needed? | No (pre-launch) |
| What message for one-time calls? | Ask user for reason |
| Update Grok prompt with examples? | Yes, include examples |
| Remove rrule column? | Yes, remove entirely |
| Minimum time buffer? | 5 minutes |
| Same-day calls allowed? | Yes |
| How to test? | Manual E2E testing only |

---

## Appendix A: Code Snippets for Reference

### Current one_off Handling (TO BE REMOVED)

From `/telephony/src/routes/tools/schedule-call.ts` lines 78-127:

```typescript
if (mode === 'one_off') {
  if (!when) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: when (ISO timestamp)',
    });
  }

  const callTime = new Date(when);
  if (isNaN(callTime.getTime())) {
    return res.status(400).json({
      success: false,
      error: 'Invalid timestamp format. Use ISO 8601.',
    });
  }

  if (callTime <= new Date()) {
    return res.status(400).json({
      success: false,
      error: 'Scheduled time must be in the future',
    });
  }

  // Create one-off schedule
  const { data: schedule, error } = await supabase
    .from('ultaura_schedules')
    .insert({
      account_id: session.account_id,
      line_id: lineId,
      enabled: true,
      timezone: tz,
      rrule: 'FREQ=DAILY;COUNT=1',  // This is IGNORED by scheduler!
      days_of_week: [callTime.getDay()],
      time_of_day: callTime.toTimeString().slice(0, 5),
      next_run_at: callTime.toISOString(),
    })
    .select()
    .single();

  // ... rest of handler
}
```

### Current calculateNextRun (Shows RRULE is Unused)

From `/telephony/src/scheduler/call-scheduler.ts` lines 393-422:

```typescript
function calculateNextRun(schedule: ScheduleRow): string | null {
  const { days_of_week, time_of_day, timezone } = schedule;
  // NOTE: schedule.rrule is available but NEVER used!

  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  try {
    const nextRun = getNextOccurrence({
      timeOfDay: time_of_day,
      timezone,
      daysOfWeek: days_of_week,
    });
    return nextRun.toISOString();
  } catch (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to calculate next run');
    return null;
  }
}
```

### Reminder One-Off Handling (CORRECT - Already Implemented)

From `/telephony/src/scheduler/call-scheduler.ts` lines 544-565:

```typescript
// After successful reminder delivery:
if (reminder.is_recurring) {
  await handleRecurringReminderSuccess(supabase, reminder);
} else {
  // One-time reminder: mark as sent - NO RESCHEDULING
  await supabase
    .from('ultaura_reminders')
    .update({
      status: 'sent',
      last_delivery_status: 'completed',
      current_snooze_count: 0,
      snoozed_until: null,
      original_due_at: null,
    })
    .eq('id', reminder.id);
}
```

---

## Appendix B: Interview Summary

| Topic | Decision |
|-------|----------|
| One-off routing | Auto-create reminder (no user choice) |
| schedule_call one_off mode | Remove entirely |
| Migration needed | No (pre-launch) |
| Reminder message | Grok asks user for reason |
| Grok prompt | Update with clear rules + examples |
| rrule column | Remove entirely |
| No-context one-off | Ask for reason/message |
| Confirmation | Always confirm scheduled time |
| Tool design | Use existing set-reminder tool |
| Daily patterns | Treat as recurring (all 7 days) |
| Schedule frequency | Keep weekly only |
| Schedule→one-time conversion | Ask user preference |
| rrule removal timing | Include in this fix |
| Testing approach | Manual E2E only |
| Analytics | Use existing reminder event logging |
| Example phrases | Include in Grok prompt |
| Same-day calls | Allowed |
| Minimum buffer | 5 minutes |
