# Timezone Correctness for Scheduling - Implementation Spec

## Executive Summary

This spec addresses timezone handling bugs in Ultaura's call scheduling system where `next_run_at` is computed using server time instead of the user's timezone. This causes calls to fire at wrong local times and creates hard-to-debug trust issues, especially during DST transitions.

---

## 1. Problem Statement

### Current Behavior (Buggy)

There are **two different implementations** for computing `next_run_at`:

| Location | File | Implementation | Status |
|----------|------|----------------|--------|
| Dashboard | `src/lib/ultaura/actions.ts:getNextRunAt()` | Uses Intl.DateTimeFormat with schedule's timezone | ✅ Correct |
| Scheduler | `telephony/src/scheduler/call-scheduler.ts:calculateNextRun()` | Uses `new Date().setHours()` (server time) | ❌ **BUG** |
| Grok Tool | `telephony/src/routes/tools/schedule-call.ts` | Uses `new Date().setHours()` (server time) | ❌ **BUG** |

### Symptoms
- Calls happening at wrong local time for users
- DST transition issues ("why did it start calling an hour early?")
- Inconsistency between dashboard-created and Grok-created schedules
- User trust erosion that's difficult to debug

### Root Cause
The telephony backend ignores the `schedule.timezone` field when computing `next_run_at`, using the server's local timezone instead.

### What Works Correctly (for reference)
- **Quiet hours check** (`line-lookup.ts:isInQuietHours()`) - Properly formats "now" in line's timezone
- **Dashboard schedule creation** (`actions.ts:getNextRunAt()`) - Proper timezone-aware calculation
- **Reminder calculations** - Uses `localToUtc()` helper with timezone parameter

---

## 2. Objectives

1. **Fix timezone handling** in all schedule/reminder calculation paths
2. **Add Luxon library** for robust timezone operations across codebase
3. **Create shared timezone utilities** to eliminate code duplication
4. **Add IANA timezone validation** at API boundaries
5. **Handle DST edge cases** explicitly and predictably
6. **Add comprehensive tests** including DST transition scenarios
7. **Migrate existing data** to recalculate incorrect `next_run_at` values
8. **Add observability** with detailed logging for debugging

---

## 3. Technical Requirements

### 3.1 Library Addition

**Add Luxon** to both packages:

```bash
# Root package (Next.js app)
pnpm add luxon
pnpm add -D @types/luxon

# Telephony package
cd telephony && pnpm add luxon && pnpm add -D @types/luxon
```

**Why Luxon over alternatives:**
- First-class timezone support with IANA identifiers
- Explicit DST handling with `keepLocalTime` options
- Immutable DateTime API prevents mutation bugs
- Lighter than moment-timezone, more comprehensive than date-fns-tz
- `DateTime.fromObject()` handles ambiguous/invalid times gracefully

### 3.2 Shared Timezone Utility

**File:** `telephony/src/utils/timezone.ts`

```typescript
import { DateTime, IANAZone } from 'luxon';

// Timezone validation
export function isValidTimezone(tz: string): boolean;

// Convert local time in timezone to UTC
export function localTimeToUtc(params: {
  hours: number;
  minutes: number;
  timezone: string;
  targetDate?: Date; // defaults to today in that timezone
}): Date;

// Calculate next occurrence of time on specified days
export function getNextOccurrence(params: {
  timeOfDay: string;      // "HH:mm" format
  timezone: string;
  daysOfWeek: number[];   // 0=Sun, 6=Sat
  afterDate?: Date;       // defaults to now
}): Date;

// Calculate next reminder occurrence from RRULE
export function getNextReminderOccurrence(params: {
  rrule: string;
  timezone: string;
  timeOfDay: string;
  currentDueAt: Date;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  intervalDays?: number;
}): Date | null;

// Health check for timezone support
export function validateTimezoneSupport(timezones: string[]): void;
```

### 3.3 DST Edge Case Handling

**Configuration choices (per user requirements):**

| Scenario | Behavior |
|----------|----------|
| **Fall-back (ambiguous time)** | Use **second occurrence** (later/post-rollback time) |
| **Spring-forward (skipped time)** | Shift **forward** to post-DST time (e.g., 2:30→3:30) |

**Luxon implementation:**
```typescript
// For ambiguous times (fall-back), prefer later occurrence
const dt = DateTime.fromObject(
  { year, month, day, hour, minute },
  { zone: timezone }
);

// If invalid (spring-forward gap), Luxon auto-adjusts forward
if (!dt.isValid) {
  // dt.invalid.reason will be 'unit out of range'
  // Luxon already shifted forward, which is our desired behavior
}
```

### 3.4 Timezone Validation

Add validation in API handlers:

```typescript
import { IANAZone } from 'luxon';

export function validateTimezone(tz: string): void {
  if (!IANAZone.isValidZone(tz)) {
    throw new Error(`Invalid timezone: ${tz}. Must be a valid IANA timezone identifier.`);
  }
}
```

**Apply validation in:**
- `telephony/src/routes/tools/schedule-call.ts` - before creating/updating schedules
- `telephony/src/routes/tools/set-reminder.ts` - before creating reminders
- `telephony/src/routes/tools/edit-reminder.ts` - before updating reminders
- `src/lib/ultaura/actions.ts:createSchedule()` - dashboard schedule creation
- `src/lib/ultaura/actions.ts:updateSchedule()` - dashboard schedule updates
- `src/lib/ultaura/actions.ts:createLine()` - line creation
- `src/lib/ultaura/actions.ts:updateLine()` - line updates

### 3.5 Logging Requirements

**Detailed logging for timezone operations:**

```typescript
logger.info({
  operation: 'calculateNextRun',
  scheduleId: schedule.id,
  lineId: schedule.line_id,
  timezone: schedule.timezone,
  timeOfDay: schedule.time_of_day,
  daysOfWeek: schedule.days_of_week,
  localInterpretation: '2025-03-09T09:00:00', // what we computed in local tz
  utcOffset: '-08:00',
  isDst: true,
  dstNote: 'post-spring-forward', // or 'ambiguous-fall-back-used-later'
  resultUtc: '2025-03-09T17:00:00Z',
  previousNextRunAt: schedule.next_run_at,
}, 'Calculated next_run_at');
```

---

## 4. Files to Modify

### 4.1 New Files

| File | Purpose |
|------|---------|
| `telephony/src/utils/timezone.ts` | Shared Luxon timezone utilities |
| `telephony/src/__tests__/timezone.test.ts` | Comprehensive timezone unit tests |
| `supabase/migrations/YYYYMMDD000001_recalculate_next_run_at.sql` | Data migration |

### 4.2 Files to Modify - Telephony Backend

| File | Changes |
|------|---------|
| `telephony/package.json` | Add luxon dependency |
| `telephony/src/scheduler/call-scheduler.ts` | Replace `calculateNextRun()` and `calculateNextReminderOccurrence()` with shared utils, add logging |
| `telephony/src/routes/tools/schedule-call.ts` | Use shared timezone utils, add validation |
| `telephony/src/routes/tools/set-reminder.ts` | Replace inline `localToUtc()` with shared util, add validation |
| `telephony/src/routes/tools/edit-reminder.ts` | Replace inline `localToUtc()` with shared util, add validation |
| `telephony/src/services/line-lookup.ts` | Optionally refactor `isInQuietHours()` to use Luxon (already works but for consistency) |
| `telephony/src/server.ts` | Add timezone health check on startup |

### 4.3 Files to Modify - Next.js App

| File | Changes |
|------|---------|
| `package.json` (root) | Add luxon dependency |
| `src/lib/ultaura/actions.ts` | Replace custom `getNextRunAt()` with Luxon-based implementation, add timezone validation |
| `src/lib/ultaura/types.ts` | No changes needed (types already correct) |

### 4.4 Files to Remove/Consolidate

The following inline implementations will be **replaced** by the shared utility:
- `localToUtc()` in `call-scheduler.ts` (lines 13-48)
- `localToUtc()` in `set-reminder.ts` (lines 15-57)
- `localToUtc()` in `edit-reminder.ts` (lines 22-57)
- `getNextRunAt()` in `actions.ts` (lines 617-744)

---

## 5. Implementation Details

### 5.1 telephony/src/utils/timezone.ts

```typescript
import { DateTime, IANAZone, Settings } from 'luxon';
import { logger } from './logger'; // adjust import path

// Throw on invalid DateTime creation for safety
Settings.throwOnInvalid = true;

/**
 * Validate that a timezone string is a valid IANA identifier
 */
export function isValidTimezone(tz: string): boolean {
  return IANAZone.isValidZone(tz);
}

/**
 * Validate timezone and throw descriptive error if invalid
 */
export function validateTimezone(tz: string): void {
  if (!isValidTimezone(tz)) {
    throw new Error(
      `Invalid timezone: "${tz}". Must be a valid IANA timezone identifier (e.g., "America/New_York").`
    );
  }
}

/**
 * Health check to validate all configured timezones work correctly.
 * Call on scheduler startup.
 */
export function validateTimezoneSupport(timezones: string[]): void {
  const failed: string[] = [];

  for (const tz of timezones) {
    try {
      const dt = DateTime.now().setZone(tz);
      if (!dt.isValid) {
        failed.push(tz);
      }
    } catch {
      failed.push(tz);
    }
  }

  if (failed.length > 0) {
    throw new Error(
      `Timezone support check failed for: ${failed.join(', ')}. ` +
      `Ensure Node.js has full ICU data installed.`
    );
  }

  logger.info({ timezones }, 'Timezone support validated');
}

interface GetNextOccurrenceParams {
  timeOfDay: string;      // "HH:mm" format
  timezone: string;
  daysOfWeek: number[];   // 0=Sun through 6=Sat
  afterDate?: Date;       // defaults to now
}

/**
 * Calculate the next occurrence of a scheduled time on specified days of week.
 *
 * DST handling:
 * - Spring-forward (skipped time): Shifts forward to post-DST time
 * - Fall-back (ambiguous time): Uses second occurrence (later time)
 */
export function getNextOccurrence(params: GetNextOccurrenceParams): Date {
  const { timeOfDay, timezone, daysOfWeek, afterDate } = params;

  validateTimezone(timezone);

  if (!daysOfWeek || daysOfWeek.length === 0) {
    throw new Error('daysOfWeek must contain at least one day');
  }

  const [hours, minutes] = timeOfDay.split(':').map(Number);
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid timeOfDay format: "${timeOfDay}". Expected "HH:mm".`);
  }

  // Start from "now" in the target timezone
  const now = afterDate
    ? DateTime.fromJSDate(afterDate).setZone(timezone)
    : DateTime.now().setZone(timezone);

  // Build candidate time for today
  let candidate = now.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });

  // If time has passed today, start from tomorrow
  if (candidate <= now) {
    candidate = candidate.plus({ days: 1 });
  }

  // Find the next matching day of week
  // Luxon uses 1=Mon through 7=Sun, but our API uses 0=Sun through 6=Sat
  const luxonToOurDay = (luxonDay: number): number => (luxonDay % 7); // 7(Sun)->0, 1(Mon)->1, etc.

  let attempts = 0;
  while (!daysOfWeek.includes(luxonToOurDay(candidate.weekday)) && attempts < 8) {
    candidate = candidate.plus({ days: 1 });
    attempts++;
  }

  if (attempts >= 8) {
    throw new Error(`Could not find matching day in daysOfWeek: [${daysOfWeek.join(',')}]`);
  }

  // Handle DST edge cases
  // Luxon's .set() already handles spring-forward by shifting forward
  // For fall-back ambiguity, we need to explicitly choose the later occurrence
  if (candidate.isInDST !== now.isInDST) {
    // We're crossing a DST boundary
    // Re-create the datetime to ensure we get the post-transition interpretation
    const postDstCandidate = DateTime.fromObject(
      {
        year: candidate.year,
        month: candidate.month,
        day: candidate.day,
        hour: hours,
        minute: minutes,
        second: 0,
      },
      { zone: timezone }
    );

    // If still valid, use it
    if (postDstCandidate.isValid) {
      candidate = postDstCandidate;
    }
    // If invalid (spring-forward gap), Luxon already shifted forward which is correct
  }

  const result = candidate.toUTC().toJSDate();

  logger.debug({
    operation: 'getNextOccurrence',
    input: { timeOfDay, timezone, daysOfWeek, afterDate: afterDate?.toISOString() },
    localInterpretation: candidate.toISO(),
    utcOffset: candidate.toFormat('ZZ'),
    isDst: candidate.isInDST,
    resultUtc: result.toISOString(),
  }, 'Calculated next occurrence');

  return result;
}

interface GetNextReminderOccurrenceParams {
  rrule: string;
  timezone: string;
  timeOfDay: string;
  currentDueAt: Date;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  intervalDays?: number;
}

/**
 * Calculate the next reminder occurrence based on RRULE.
 * Supports FREQ=DAILY, FREQ=WEEKLY, FREQ=MONTHLY with optional INTERVAL.
 */
export function getNextReminderOccurrence(params: GetNextReminderOccurrenceParams): Date | null {
  const { rrule, timezone, timeOfDay, currentDueAt, daysOfWeek, dayOfMonth, intervalDays } = params;

  validateTimezone(timezone);

  // Parse RRULE
  const freqMatch = rrule.match(/FREQ=(\w+)/);
  const intervalMatch = rrule.match(/INTERVAL=(\d+)/);

  const freq = freqMatch?.[1] || 'DAILY';
  const interval = intervalMatch ? parseInt(intervalMatch[1]) : (intervalDays || 1);

  const [hours, minutes] = timeOfDay.split(':').map(Number);

  // Get current due date in the reminder's timezone
  const currentDt = DateTime.fromJSDate(currentDueAt).setZone(timezone);

  let nextDt: DateTime;

  switch (freq) {
    case 'DAILY':
      nextDt = currentDt.plus({ days: interval }).set({
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0
      });
      break;

    case 'WEEKLY':
      if (daysOfWeek && daysOfWeek.length > 0) {
        // Start from tomorrow
        let tempDt = currentDt.plus({ days: 1 });
        const luxonToOurDay = (d: number) => d % 7;

        let attempts = 0;
        while (!daysOfWeek.includes(luxonToOurDay(tempDt.weekday)) && attempts < 14) {
          tempDt = tempDt.plus({ days: 1 });
          attempts++;
        }

        // Apply interval (skip weeks)
        if (interval > 1) {
          tempDt = tempDt.plus({ weeks: interval - 1 });
        }

        nextDt = tempDt.set({ hour: hours, minute: minutes, second: 0, millisecond: 0 });
      } else {
        nextDt = currentDt.plus({ weeks: interval }).set({
          hour: hours,
          minute: minutes,
          second: 0,
          millisecond: 0
        });
      }
      break;

    case 'MONTHLY':
      nextDt = currentDt.plus({ months: interval });

      // Use specified day of month or current day
      const targetDay = dayOfMonth || currentDt.day;
      const maxDays = nextDt.daysInMonth;
      const actualDay = Math.min(targetDay, maxDays);

      nextDt = nextDt.set({
        day: actualDay,
        hour: hours,
        minute: minutes,
        second: 0,
        millisecond: 0
      });
      break;

    default:
      logger.warn({ freq, rrule }, 'Unknown frequency in RRULE');
      return null;
  }

  const result = nextDt.toUTC().toJSDate();

  logger.debug({
    operation: 'getNextReminderOccurrence',
    input: { rrule, timezone, timeOfDay, currentDueAt: currentDueAt.toISOString() },
    freq,
    interval,
    localInterpretation: nextDt.toISO(),
    utcOffset: nextDt.toFormat('ZZ'),
    isDst: nextDt.isInDST,
    resultUtc: result.toISOString(),
  }, 'Calculated next reminder occurrence');

  return result;
}

/**
 * Convert a local time in a specific timezone to UTC.
 * Used for one-off datetime conversions.
 */
export function localToUtc(localDateTimeStr: string, timezone: string): Date {
  validateTimezone(timezone);

  const dt = DateTime.fromISO(localDateTimeStr, { zone: timezone });

  if (!dt.isValid) {
    throw new Error(`Invalid datetime: "${localDateTimeStr}" in timezone "${timezone}": ${dt.invalidReason}`);
  }

  return dt.toUTC().toJSDate();
}

/**
 * Format a UTC date in a specific timezone for display.
 */
export function formatInTimezone(utcDate: Date, timezone: string, format: string = 'yyyy-MM-dd HH:mm'): string {
  validateTimezone(timezone);
  return DateTime.fromJSDate(utcDate).setZone(timezone).toFormat(format);
}
```

### 5.2 Scheduler Modification (call-scheduler.ts)

Replace the buggy `calculateNextRun()` function:

```typescript
// BEFORE (buggy):
function calculateNextRun(schedule: ScheduleRow): string | null {
  const { days_of_week, time_of_day } = schedule;
  const [hours, minutes] = time_of_day.split(':').map(Number);
  const now = new Date();
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(hours, minutes, 0, 0); // BUG: Uses server time!
  // ...
}

// AFTER (fixed):
import { getNextOccurrence } from '../utils/timezone';

function calculateNextRun(schedule: ScheduleRow): string | null {
  const { days_of_week, time_of_day, timezone } = schedule;

  if (!days_of_week || days_of_week.length === 0) {
    return null;
  }

  try {
    const nextRun = getNextOccurrence({
      timeOfDay: time_of_day,
      timezone: timezone,
      daysOfWeek: days_of_week,
    });

    return nextRun.toISOString();
  } catch (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to calculate next run');
    return null;
  }
}
```

### 5.3 Schedule-Call Tool Fix (schedule-call.ts)

Replace inline calculation with shared utility:

```typescript
// BEFORE (buggy):
const now = new Date();
const [hours, minutes] = timeLocal.split(':').map(Number);
let nextRun = new Date();
nextRun.setHours(hours, minutes, 0, 0);
// ...

// AFTER (fixed):
import { getNextOccurrence, validateTimezone } from '../utils/timezone';

// Validate timezone early
validateTimezone(tz);

const nextRun = getNextOccurrence({
  timeOfDay: timeLocal,
  timezone: tz,
  daysOfWeek: validDays,
});
```

### 5.4 Data Migration SQL

**File:** `supabase/migrations/YYYYMMDD000001_recalculate_next_run_at.sql`

```sql
-- Migration: Recalculate all next_run_at values using correct timezone logic
-- This runs after the code fix is deployed

-- Note: PostgreSQL doesn't have Luxon, so we use AT TIME ZONE for recalculation
-- This is a best-effort fix; the application code handles DST edge cases more precisely

-- Recalculate for enabled schedules
UPDATE ultaura_schedules
SET next_run_at = (
  -- Get current date in the schedule's timezone
  WITH tz_now AS (
    SELECT
      id,
      timezone,
      time_of_day,
      days_of_week,
      (NOW() AT TIME ZONE timezone)::date AS local_date,
      (NOW() AT TIME ZONE timezone)::time AS local_time
    FROM ultaura_schedules s2
    WHERE s2.id = ultaura_schedules.id
  )
  SELECT
    -- Build next occurrence: local date + time_of_day, then convert to UTC
    CASE
      -- If time hasn't passed today and today matches days_of_week
      WHEN tz_now.local_time < tz_now.time_of_day
           AND EXTRACT(DOW FROM tz_now.local_date) = ANY(tz_now.days_of_week)
      THEN (tz_now.local_date || ' ' || tz_now.time_of_day)::timestamp AT TIME ZONE tz_now.timezone

      -- Otherwise, find next matching day (simplified: just add days)
      ELSE (
        SELECT ((tz_now.local_date + i) || ' ' || tz_now.time_of_day)::timestamp AT TIME ZONE tz_now.timezone
        FROM generate_series(1, 7) AS i
        WHERE EXTRACT(DOW FROM tz_now.local_date + i) = ANY(tz_now.days_of_week)
        ORDER BY i
        LIMIT 1
      )
    END
  FROM tz_now
  WHERE tz_now.id = ultaura_schedules.id
)
WHERE enabled = true
  AND days_of_week IS NOT NULL
  AND array_length(days_of_week, 1) > 0;

-- Log migration
DO $$
BEGIN
  RAISE NOTICE 'Recalculated next_run_at for % schedules',
    (SELECT COUNT(*) FROM ultaura_schedules WHERE enabled = true);
END $$;
```

**Note:** The SQL migration provides a reasonable fix but the application code handles DST edge cases more precisely. After this migration runs, the fixed application code will maintain correctness going forward.

### 5.5 Startup Health Check

**In `telephony/src/server.ts`:**

```typescript
import { validateTimezoneSupport } from './utils/timezone';

// US timezones we must support
const REQUIRED_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
];

async function startServer() {
  // Validate timezone support before accepting requests
  try {
    validateTimezoneSupport(REQUIRED_TIMEZONES);
    logger.info('Timezone support validated successfully');
  } catch (error) {
    logger.fatal({ error }, 'Timezone support validation failed');
    process.exit(1);
  }

  // ... rest of server startup
}
```

---

## 6. Testing Requirements

### 6.1 Test File Structure

**File:** `telephony/src/__tests__/timezone.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest'; // or jest
import {
  isValidTimezone,
  validateTimezone,
  getNextOccurrence,
  getNextReminderOccurrence,
  localToUtc,
  validateTimezoneSupport,
} from '../utils/timezone';

describe('Timezone Utilities', () => {
  describe('isValidTimezone', () => {
    it('returns true for valid IANA timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('America/Los_Angeles')).toBe(true);
      expect(isValidTimezone('Pacific/Honolulu')).toBe(true);
    });

    it('returns false for invalid timezones', () => {
      expect(isValidTimezone('America/NewYork')).toBe(false); // missing underscore
      expect(isValidTimezone('EST')).toBe(false); // abbreviation
      expect(isValidTimezone('GMT-5')).toBe(false); // offset format
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('getNextOccurrence', () => {
    it('calculates next occurrence for simple case', () => {
      const result = getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/New_York',
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        afterDate: new Date('2025-01-06T12:00:00Z'), // Monday noon UTC
      });

      // Next 9am ET would be Tuesday Jan 7 at 14:00 UTC (ET is UTC-5)
      expect(result.toISOString()).toBe('2025-01-07T14:00:00.000Z');
    });

    it('handles weekend skip correctly', () => {
      const result = getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/New_York',
        daysOfWeek: [1], // Monday only
        afterDate: new Date('2025-01-07T12:00:00Z'), // Tuesday
      });

      // Next Monday is Jan 13
      expect(result.toISOString()).toBe('2025-01-13T14:00:00.000Z');
    });
  });

  describe('DST Spring Forward', () => {
    // March 9, 2025: 2:00 AM becomes 3:00 AM in America/New_York

    it('shifts skipped time forward to post-DST', () => {
      const result = getNextOccurrence({
        timeOfDay: '02:30', // This time doesn't exist on March 9
        timezone: 'America/New_York',
        daysOfWeek: [0], // Sunday
        afterDate: new Date('2025-03-08T12:00:00Z'), // Saturday before
      });

      // Should shift to 3:30 AM EDT (UTC-4), which is 07:30 UTC
      expect(result.toISOString()).toBe('2025-03-09T07:30:00.000Z');
    });

    it('handles time after DST gap normally', () => {
      const result = getNextOccurrence({
        timeOfDay: '10:00',
        timezone: 'America/New_York',
        daysOfWeek: [0], // Sunday
        afterDate: new Date('2025-03-08T12:00:00Z'),
      });

      // 10:00 AM EDT (UTC-4) = 14:00 UTC
      expect(result.toISOString()).toBe('2025-03-09T14:00:00.000Z');
    });
  });

  describe('DST Fall Back', () => {
    // November 2, 2025: 2:00 AM EDT becomes 1:00 AM EST (1:30 AM occurs twice)

    it('uses second occurrence for ambiguous time', () => {
      const result = getNextOccurrence({
        timeOfDay: '01:30', // This time occurs twice on Nov 2
        timezone: 'America/New_York',
        daysOfWeek: [0], // Sunday
        afterDate: new Date('2025-11-01T12:00:00Z'), // Saturday before
      });

      // Should use 1:30 AM EST (second occurrence, UTC-5) = 06:30 UTC
      // NOT 1:30 AM EDT (first occurrence, UTC-4) = 05:30 UTC
      expect(result.toISOString()).toBe('2025-11-02T06:30:00.000Z');
    });
  });

  describe('Edge Cases', () => {
    it('throws on invalid timezone', () => {
      expect(() => getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'Invalid/Timezone',
        daysOfWeek: [1],
      })).toThrow('Invalid timezone');
    });

    it('throws on empty daysOfWeek', () => {
      expect(() => getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/New_York',
        daysOfWeek: [],
      })).toThrow('daysOfWeek must contain at least one day');
    });

    it('throws on invalid timeOfDay format', () => {
      expect(() => getNextOccurrence({
        timeOfDay: '9:00', // missing leading zero
        timezone: 'America/New_York',
        daysOfWeek: [1],
      })).toThrow(); // or handle gracefully
    });

    it('handles Arizona (no DST) correctly', () => {
      // Arizona doesn't observe DST
      const result = getNextOccurrence({
        timeOfDay: '09:00',
        timezone: 'America/Phoenix',
        daysOfWeek: [0],
        afterDate: new Date('2025-03-08T12:00:00Z'),
      });

      // 9:00 AM MST (always UTC-7) = 16:00 UTC
      expect(result.toISOString()).toBe('2025-03-09T16:00:00.000Z');
    });
  });

  describe('getNextReminderOccurrence', () => {
    it('calculates daily recurrence', () => {
      const result = getNextReminderOccurrence({
        rrule: 'FREQ=DAILY',
        timezone: 'America/New_York',
        timeOfDay: '08:00',
        currentDueAt: new Date('2025-01-06T13:00:00Z'), // Jan 6 at 8am ET
      });

      // Next day same time
      expect(result?.toISOString()).toBe('2025-01-07T13:00:00.000Z');
    });

    it('respects INTERVAL in daily', () => {
      const result = getNextReminderOccurrence({
        rrule: 'FREQ=DAILY;INTERVAL=3',
        timezone: 'America/New_York',
        timeOfDay: '08:00',
        currentDueAt: new Date('2025-01-06T13:00:00Z'),
      });

      // 3 days later
      expect(result?.toISOString()).toBe('2025-01-09T13:00:00.000Z');
    });
  });

  describe('validateTimezoneSupport', () => {
    it('passes for all US timezones', () => {
      expect(() => validateTimezoneSupport([
        'America/New_York',
        'America/Chicago',
        'America/Denver',
        'America/Phoenix',
        'America/Los_Angeles',
        'America/Anchorage',
        'Pacific/Honolulu',
      ])).not.toThrow();
    });

    it('throws for invalid timezone in list', () => {
      expect(() => validateTimezoneSupport([
        'America/New_York',
        'Invalid/Zone',
      ])).toThrow('Timezone support check failed');
    });
  });
});
```

### 6.2 Integration Tests

Add integration tests for:
1. Creating schedule via dashboard, verifying `next_run_at` is correct
2. Creating schedule via Grok tool, verifying `next_run_at` matches dashboard
3. Schedule execution and recalculation cycle
4. Reminder creation and recurrence across DST boundary

---

## 7. Rollout Plan

### Phase 1: Code Changes (No Risk)
1. Add Luxon to both packages
2. Create `telephony/src/utils/timezone.ts`
3. Create test file with comprehensive tests
4. Run tests, ensure all pass

### Phase 2: Update Telephony Backend
1. Update `call-scheduler.ts` to use new utilities
2. Update `schedule-call.ts` tool
3. Update `set-reminder.ts` and `edit-reminder.ts` tools
4. Add startup health check
5. Deploy to staging
6. Manually verify scheduling behavior

### Phase 3: Update Dashboard
1. Update `actions.ts` to use Luxon
2. Add timezone validation to create/update functions
3. Deploy to staging
4. Test dashboard schedule creation

### Phase 4: Data Migration
1. Create migration SQL file
2. Test on staging database
3. Deploy migration to production
4. Verify affected schedules have correct `next_run_at`

### Phase 5: Monitoring
1. Monitor logs for timezone-related errors
2. Track DST-related log entries during March/November
3. Respond to any user reports of timing issues

---

## 8. Success Criteria

1. **All unit tests pass**, including DST edge cases
2. **Dashboard and Grok-created schedules** have identical `next_run_at` for same inputs
3. **Existing schedules** correctly recalculated after migration
4. **Startup health check** passes on all deployed environments
5. **Detailed logs** available for debugging any reported issues
6. **No user reports** of calls at wrong times after rollout

---

## 9. Dependencies

### External
- `luxon` package (both packages)
- `@types/luxon` (dev dependency)

### Internal
- Existing logger utility in telephony
- Supabase migration system

---

## 10. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Luxon bundle size impact on frontend | Low | Low | Luxon is ~70KB gzipped, acceptable for dashboard |
| Migration recalculates to wrong values | Medium | High | Test migration on staging first, verify sample of schedules |
| DST test cases miss edge case | Low | Medium | Use known DST transition dates from 2025 calendar |
| Node.js environment lacks ICU data | Low | High | Startup health check catches this immediately |
| Timezone string validation too strict | Low | Low | Only validate IANA format, not specific zones |

---

## 11. Appendix

### A. Key File Paths

**Telephony Backend:**
- `telephony/src/scheduler/call-scheduler.ts` - Main scheduler (lines 370-400 buggy)
- `telephony/src/routes/tools/schedule-call.ts` - Grok tool (lines 146-162 buggy)
- `telephony/src/routes/tools/set-reminder.ts` - Has inline `localToUtc()`
- `telephony/src/routes/tools/edit-reminder.ts` - Has inline `localToUtc()`
- `telephony/src/services/line-lookup.ts` - `isInQuietHours()` (works correctly)
- `telephony/src/utils/timezone.ts` - NEW shared utility

**Next.js Dashboard:**
- `src/lib/ultaura/actions.ts` - `getNextRunAt()` (lines 617-744, works but should use Luxon)
- `src/lib/ultaura/types.ts` - Type definitions
- `src/lib/ultaura/constants.ts` - `US_TIMEZONES` array

**Database:**
- `supabase/migrations/20241220000001_ultaura_schema.sql` - Core schema
- `supabase/migrations/20251226000001_recurring_reminders.sql` - Reminder recurrence

### B. 2025 DST Dates (US)

- **Spring Forward:** Sunday, March 9, 2025 at 2:00 AM → 3:00 AM
- **Fall Back:** Sunday, November 2, 2025 at 2:00 AM → 1:00 AM

### C. Luxon Quick Reference

```typescript
import { DateTime, IANAZone } from 'luxon';

// Create from components in timezone
const dt = DateTime.fromObject(
  { year: 2025, month: 3, day: 9, hour: 9, minute: 0 },
  { zone: 'America/New_York' }
);

// Convert to UTC
const utc = dt.toUTC();

// Get offset
const offset = dt.offset; // minutes from UTC

// Check DST
const isDst = dt.isInDST;

// Validate timezone
IANAZone.isValidZone('America/New_York'); // true
```
