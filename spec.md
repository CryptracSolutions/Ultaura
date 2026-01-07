# Spec: Refactor `actions.ts` into Type-Safe Modules

## Objective

Split `src/lib/ultaura/actions.ts` (2,280 lines, 61KB, `@ts-nocheck`) into domain-specific modules with:
- Zod input validation schemas
- TypeScript strict mode (remove `@ts-nocheck`)
- Comprehensive tests for DST, timezone, and recurrence edge cases
- Shared `@ultaura/schemas` package for cross-app validation

**Impact**: Medium | **Likelihood**: High | **Current Pain**: Silent type regressions, runtime errors in edge cases, inconsistent validation.

---

## Current State Analysis

### File Statistics
- **Lines**: 2,280
- **Size**: 61KB
- **Exported functions**: 43
- **Importing files**: 27 (mix of server and client components)
- **Type safety**: Disabled via `@ts-nocheck`
- **Input validation**: Manual checks only (no Zod)
- **Test coverage**: None (only covered by Cypress E2E)

### Logical Domains in Current File

| Domain | Functions | Lines | Complexity |
|--------|-----------|-------|------------|
| Accounts & Trials | 4 | ~110 | Low |
| Lines & Contacts | 8 | ~320 | Medium |
| Phone Verification | 2 | ~140 | Low |
| Schedules | 6 | ~230 | High (RRULE) |
| Usage & Billing | 5 | ~170 | Medium |
| Test Calls | 1 | ~50 | Low |
| Reminders | 19 | ~970 | High (recurrence, DST) |
| Checkout | 2 | ~130 | Medium |

### Known Type Inconsistencies to Fix

> **Note**: Items 1, 2, and 7 from the original spec are now OUTDATED. Migrations `20260209000001_remove_schedule_rrule.sql` and `20260210000001_remove_language_columns.sql` intentionally removed these columns. Do NOT reintroduce them.

1. ~~**Schedule type missing `rrule` field**~~ - REMOVED: `rrule` moved to reminders system
2. ~~**Line type missing `preferred_language` and `spanish_formality`**~~ - REMOVED: Language columns dropped
3. **EncryptedMemory missing `source`, `version`, `active` fields** - DB has them, add to type
4. **ReminderEvent type not exported** - defined but inaccessible, export it
5. **TrustedContact.notifyOn** - Keep as `SafetyTier[]` (semantic constraint), Zod validates
6. **Reminder deliveryMethod** - Add enum with `'outbound_call'` only (add `'sms'` when needed)
7. ~~**Schedule daysOfWeek/timeOfDay vs rrule**~~ - REMOVED: No longer relevant

**Additional fields to add** (runtime-relevant, not internal scheduler fields):
- `CallSession`: Add `is_reminder_call`, `reminder_id`, `reminder_message` (useful for UI call history)
- Skip internal fields: `scheduler_idempotency_key`, `processing_claimed_at`, `processing_claimed_by`, `retry_count`

---

## Target Architecture

### Directory Structure

```
src/lib/ultaura/
├── index.ts                    # Re-exports for external consumers
├── types.ts                    # Updated with missing fields (uses snake_case Row types)
├── constants.ts                # Unchanged
├── prompts.ts                  # Unchanged
├── helpers.ts                  # NEW: Shared utilities (uses Row types, withTrialCheck)
├── accounts.ts                 # NEW: Account & trial actions
├── lines.ts                    # NEW: Line management actions
├── contacts.ts                 # NEW: Trusted contacts actions
├── verification.ts             # NEW: Phone verification actions
├── schedules.ts                # NEW: Schedule CRUD actions
├── reminders.ts                # NEW: Reminder CRUD + lifecycle (~500 lines)
├── reminder-events.ts          # NEW: Reminder event logging + queries (~150 lines)
├── usage.ts                    # NEW: Billing & analytics actions
├── checkout.ts                 # NEW: Stripe checkout actions
├── __tests__/
│   ├── setup.ts                # Test database setup (service-role client)
│   ├── accounts.test.ts
│   ├── lines.test.ts
│   ├── contacts.test.ts
│   ├── verification.test.ts
│   ├── schedules.test.ts       # DST/timezone tests
│   ├── reminders.test.ts       # Recurrence/snooze tests
│   ├── reminder-events.test.ts
│   ├── usage.test.ts
│   ├── checkout.test.ts
│   └── rls.test.ts             # RLS policy tests (authenticated client)
├── billing.ts                  # Existing - unchanged
├── timezone.ts                 # Existing - export getNextScheduleOccurrence, getNextReminderOccurrence
└── admin-actions.ts            # Existing - unchanged

packages/schemas/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # All exports
│   ├── types.ts                # Shared TypeScript types (snake_case Row types)
│   ├── errors.ts               # Error codes + factory functions
│   ├── constants.ts            # Shared constants (US_TIMEZONES, VALID_SNOOZE_MINUTES, etc.)
│   ├── line.ts                 # Line schemas + validators
│   ├── schedule.ts             # Schedule schemas + validators
│   ├── reminder.ts             # Reminder schemas + validators
│   ├── contact.ts              # Contact schemas + validators
│   ├── account.ts              # Account schemas + validators
│   └── telephony/              # Telephony tool input schemas
│       ├── index.ts            # Re-exports
│       ├── set-reminder.ts     # SetReminderInput schema
│       ├── edit-reminder.ts    # EditReminderInput schema
│       ├── snooze-reminder.ts  # SnoozeReminderInput schema
│       ├── opt-out.ts          # OptOutInput schema
│       └── safety-event.ts     # SafetyEventInput schema
```

### Module Boundaries

Each action module will:
1. Import schemas from `@ultaura/schemas`
2. Export async server action functions
3. Use snake_case Row types (matching current UI consumption pattern)
4. Include colocated Zod schemas at the bottom (for any module-specific schemas)

**Return type conventions:**
- **Getter functions** (getLines, getLine, getSchedules, etc.): Return data directly (`LineRow[]`, `LineRow | null`)
- **Mutating functions** (create*, update*, delete*, pause*, resume*, snooze*, etc.): Return `ActionResult<T>` with error codes

**Trial check conventions:**
- `withTrialCheck` wrapper applies **only to mutating actions**
- Getters work even on expired trials (read-only access allowed)
- Apply to: create*, update*, delete*, startPhoneVerification, checkPhoneVerification, initiateTestCall, snooze*, pause*, resume*, skip*, cancel*, edit*
- Skip for: get*, list*, getAllSchedules, getUsageSummary, getCallSessions, etc.

---

## Implementation Details

### 1. Error Handling Pattern

**New error response structure:**

```typescript
// packages/schemas/src/errors.ts
export const ErrorCodes = {
  // Auth/Trial errors
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',

  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_TIMEZONE: 'INVALID_TIMEZONE',
  INVALID_PHONE: 'INVALID_PHONE',

  // Business logic errors
  LINE_LIMIT_REACHED: 'LINE_LIMIT_REACHED',
  PHONE_NOT_VERIFIED: 'PHONE_NOT_VERIFIED',
  REMINDER_NOT_PAUSABLE: 'REMINDER_NOT_PAUSABLE',
  SNOOZE_LIMIT_REACHED: 'SNOOZE_LIMIT_REACHED',
  SCHEDULE_CONFLICT: 'SCHEDULE_CONFLICT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',

  // System errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export interface ActionError {
  code: ErrorCode;
  message: string;  // User-friendly message for UI display
  details?: Record<string, unknown>;  // Optional structured data
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ActionError };

export function createError(code: ErrorCode, message: string, details?: Record<string, unknown>): ActionError {
  return { code, message, details };
}
```

### 2. Trial Check Wrapper

**Higher-order function for trial validation (mutating actions only):**

```typescript
// src/lib/ultaura/helpers.ts
import { getTrialStatus, type UltauraAccountRow } from './types';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';

type ActionFn<TInput, TOutput> = (
  account: UltauraAccountRow,
  input: TInput
) => Promise<ActionResult<TOutput>>;

export function withTrialCheck<TInput, TOutput>(
  fn: ActionFn<TInput, TOutput>
): (account: UltauraAccountRow, input: TInput) => Promise<ActionResult<TOutput>> {
  return async (account, input) => {
    const trialStatus = getTrialStatus(account);
    if (trialStatus.isExpired) {
      return {
        success: false,
        error: createError(
          ErrorCodes.TRIAL_EXPIRED,
          'Your trial has ended. Subscribe to continue.'
        ),
      };
    }
    return fn(account, input);
  };
}
```

> **Note**: `withTrialCheck` is only used for mutating actions. Getter functions do not use this wrapper - users on expired trials can still view their data.

### 3. Zod Schema Examples

**Line creation schema:**

```typescript
// packages/schemas/src/line.ts
import { z } from 'zod';
import { IANAZone } from 'luxon';

export const LineStatusSchema = z.enum(['active', 'paused', 'disabled']);
export const VoicemailBehaviorSchema = z.enum(['none', 'brief', 'detailed']);

// Phone validation uses TELEPHONY.PHONE_REGEX pattern (rejects invalid area codes starting with 0 or 1)
const PHONE_E164_REGEX = /^\+1[2-9]\d{9}$/;

// Timezone validation accepts any valid IANA timezone (not restricted to US_TIMEZONES)
const isValidIANATimezone = (tz: string) => {
  const normalized = tz.trim();
  if (!normalized || !IANAZone.isValidZone(normalized)) return false;
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
};

export const CreateLineInputSchema = z.object({
  accountId: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  phoneE164: z.string().regex(PHONE_E164_REGEX, 'Must be a valid US phone number'),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone'),
  voicemailBehavior: VoicemailBehaviorSchema.optional().default('brief'),
  seedInterests: z.array(z.string()).optional(),
  seedAvoidTopics: z.array(z.string()).optional(),
});

export type CreateLineInput = z.infer<typeof CreateLineInputSchema>;

export const UpdateLineInputSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone').optional(),
  voicemailBehavior: VoicemailBehaviorSchema.optional(),
  status: LineStatusSchema.optional(),
  // ... other optional fields
}).partial();

export type UpdateLineInput = z.infer<typeof UpdateLineInputSchema>;
```

**Reminder schema with recurrence:**

```typescript
// packages/schemas/src/reminder.ts
import { z } from 'zod';

export const RecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'custom']);
// Note: 'once' is also valid for editReminder (converts recurring to one-time)
export const EditRecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'custom', 'once']);

// Uses `interval` (not `intervalDays`) to match current codebase convention
// This maps to `interval_days` in the database
export const RecurrenceSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  interval: z.number().int().min(1).max(365).optional(),  // Maps to interval_days in DB
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endsAt: z.string().datetime().optional(),
  occurrenceCount: z.number().int().min(1).optional(),
});

export const CreateReminderInputSchema = z.object({
  lineId: z.string().uuid(),
  dueAt: z.string().datetime(),
  message: z.string().min(1).max(500),
  timezone: z.string(),
  recurrence: RecurrenceSchema.optional(),
});

export type CreateReminderInput = z.infer<typeof CreateReminderInputSchema>;

// Snooze validation
export const VALID_SNOOZE_MINUTES = [15, 30, 60, 120, 1440] as const;
export const MAX_SNOOZE_COUNT = 3;

export const SnoozeInputSchema = z.object({
  reminderId: z.string().uuid(),
  minutes: z.number().refine(
    (m) => VALID_SNOOZE_MINUTES.includes(m as any),
    `Minutes must be one of: ${VALID_SNOOZE_MINUTES.join(', ')}`
  ),
});

// Delivery method enum (only 'outbound_call' for now, add 'sms' when implemented)
export const ReminderDeliveryMethodSchema = z.enum(['outbound_call']);
```

### 4. Module Structure Template

**Example: lines.ts**

> **Key patterns**: Getters return `LineRow` directly (snake_case, no mapping). Mutating actions use `withTrialCheck` and return `ActionResult<T>`. Plan lookup uses DB `ultaura_plans` table.

```typescript
// src/lib/ultaura/lines.ts
'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerComponentClient } from '~/core/supabase/server-component-client';
import { getLogger } from '~/core/logger';
import {
  CreateLineInputSchema,
  UpdateLineInputSchema,
  createError,
  ErrorCodes,
  type ActionResult
} from '@ultaura/schemas';
import { withTrialCheck, getPlan } from './helpers';
import type { LineRow, UltauraAccountRow } from './types';

const logger = getLogger();

/**
 * Get all lines for an account (returns snake_case Row type directly)
 */
export async function getLines(accountId: string): Promise<LineRow[]> {
  const client = await getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to fetch lines');
    return [];
  }

  return data;  // Return snake_case rows directly - no mapping needed
}

/**
 * Get a single line by ID (supports both full UUID and 8-char short ID)
 */
export async function getLine(lineId: string): Promise<LineRow | null> {
  const client = await getSupabaseServerComponentClient();

  // Support both full UUID and truncated 8-char ID
  const isShortId = lineId.length === 8;

  let query = client.from('ultaura_lines').select('*');

  if (isShortId) {
    query = query.ilike('id', `${lineId}%`);
  } else {
    query = query.eq('id', lineId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;  // Return snake_case row directly
}

/**
 * Create a new line with phone verification pending (mutating - uses withTrialCheck)
 */
export const createLine = withTrialCheck(async (
  account: UltauraAccountRow,
  input: unknown
): Promise<ActionResult<{ lineId: string }>> => {
  // Validate input with Zod
  const parsed = CreateLineInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const { displayName, phoneE164, timezone, voicemailBehavior, seedInterests, seedAvoidTopics } = parsed.data;

  // Check line limit (uses DB ultaura_plans table)
  const existingLines = await getLines(account.id);
  const plan = await getPlan(account.plan_id);  // DB lookup, not PLANS constant

  if (!plan || existingLines.length >= plan.lines_included) {
    return {
      success: false,
      error: createError(
        ErrorCodes.LINE_LIMIT_REACHED,
        `Your ${plan?.display_name || 'current'} plan supports up to ${plan?.lines_included || 1} lines. Upgrade to add more.`
      ),
    };
  }

  // Insert line
  const client = await getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_lines')
    .insert({
      account_id: account.id,
      display_name: displayName,
      phone_e164: phoneE164,
      timezone,
      voicemail_behavior: voicemailBehavior,
      seed_interests: seedInterests,
      seed_avoid_topics: seedAvoidTopics,
      status: 'active',
      verified_at: null,
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create line');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to create line'),
    };
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true, data: { lineId: data.id } };
});

// ... other line actions (updateLine, deleteLine) - all mutating actions use withTrialCheck
```

### 5. Index.ts Re-exports

**After refactor, maintain the same public API:**

```typescript
// src/lib/ultaura/index.ts

// Re-export all actions from domain modules
export * from './accounts';
export * from './lines';
export * from './contacts';
export * from './verification';
export * from './schedules';
export * from './reminders';
export * from './reminder-events';  // Split from reminders for module size
export * from './usage';
export * from './checkout';

// Re-export types
export * from './types';

// Re-export constants
export * from './constants';

// Re-export helpers that consumers might need
export { getTrialStatus, getPlan, getTrialInfo } from './helpers';

// Re-export timezone utilities for testing
export { getNextScheduleOccurrence, getNextReminderOccurrence } from './timezone';
```

---

## Testing Strategy

### Test Database Setup

```typescript
// src/lib/ultaura/__tests__/setup.ts
import { createClient } from '@supabase/supabase-js';

// Use local Supabase Docker for tests
const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const testClient = createClient(supabaseUrl, supabaseServiceKey);

export async function createTestAccount() {
  // Create test organization and account
  const { data: org } = await testClient
    .from('organizations')
    .insert({ name: 'Test Org' })
    .select()
    .single();

  const { data: account } = await testClient
    .from('ultaura_accounts')
    .insert({
      organization_id: org.id,
      name: 'Test Account',
      billing_email: 'test@example.com',
      plan_id: 'care',
      status: 'active',
    })
    .select()
    .single();

  return { org, account };
}

export async function cleanupTestData(accountId: string) {
  // Clean up in reverse dependency order
  await testClient.from('ultaura_reminder_events').delete().eq('account_id', accountId);
  await testClient.from('ultaura_reminders').delete().eq('account_id', accountId);
  await testClient.from('ultaura_schedules').delete().match({ account_id: accountId });
  await testClient.from('ultaura_lines').delete().eq('account_id', accountId);
  await testClient.from('ultaura_accounts').delete().eq('id', accountId);
}
```

### DST Transition Tests

```typescript
// src/lib/ultaura/__tests__/schedules.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DateTime } from 'luxon';
import { createSchedule, getNextRunAt } from '../schedules';
import { createTestAccount, cleanupTestData } from './setup';

describe('Schedule DST Handling', () => {
  let testAccount: any;
  let testLine: any;

  beforeAll(async () => {
    const result = await createTestAccount();
    testAccount = result.account;
    // Create test line...
  });

  afterAll(async () => {
    await cleanupTestData(testAccount.id);
  });

  describe('Spring Forward (2:00 AM -> 3:00 AM)', () => {
    it('should skip 2:30 AM schedule on DST transition day', async () => {
      // March 10, 2024 2:00 AM EST becomes 3:00 AM EDT
      const schedule = await createSchedule(testAccount.id, {
        lineId: testLine.id,
        daysOfWeek: [0], // Sunday
        timeOfDay: '02:30',
        timezone: 'America/New_York',
      });

      // On March 10, 2024, 2:30 AM doesn't exist
      const marchTenth = DateTime.fromISO('2024-03-10T01:59:00', { zone: 'America/New_York' });
      const nextRun = getNextRunAt(schedule, marchTenth);

      // Should skip to next valid occurrence (March 17)
      expect(nextRun.hour).toBe(2);
      expect(nextRun.day).toBe(17);
    });

    it('should handle 2:00 AM schedule gracefully', async () => {
      const schedule = await createSchedule(testAccount.id, {
        lineId: testLine.id,
        daysOfWeek: [0],
        timeOfDay: '02:00',
        timezone: 'America/New_York',
      });

      const marchTenth = DateTime.fromISO('2024-03-10T01:59:00', { zone: 'America/New_York' });
      const nextRun = getNextRunAt(schedule, marchTenth);

      // 2:00 AM becomes 3:00 AM on DST day
      expect(nextRun.hour).toBe(3);
      expect(nextRun.day).toBe(10);
    });
  });

  describe('Fall Back (2:00 AM -> 1:00 AM)', () => {
    it('should not double-fire 1:30 AM schedule', async () => {
      // November 3, 2024 2:00 AM EDT becomes 1:00 AM EST
      const schedule = await createSchedule(testAccount.id, {
        lineId: testLine.id,
        daysOfWeek: [0], // Sunday
        timeOfDay: '01:30',
        timezone: 'America/New_York',
      });

      // Should only fire once despite 1:30 occurring twice
      const novThird = DateTime.fromISO('2024-11-03T00:00:00', { zone: 'America/New_York' });
      const nextRun = getNextRunAt(schedule, novThird);

      // Should use the first occurrence (EDT)
      expect(nextRun.toISO()).toContain('T01:30:00');
    });
  });

  describe('Arizona (No DST)', () => {
    it('should maintain consistent schedule in Arizona timezone', async () => {
      const schedule = await createSchedule(testAccount.id, {
        lineId: testLine.id,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        timeOfDay: '09:00',
        timezone: 'America/Phoenix', // No DST
      });

      // Schedule should always be 9:00 AM local
      const summerDate = DateTime.fromISO('2024-07-15T08:00:00', { zone: 'America/Phoenix' });
      const winterDate = DateTime.fromISO('2024-12-15T08:00:00', { zone: 'America/Phoenix' });

      const summerNext = getNextRunAt(schedule, summerDate);
      const winterNext = getNextRunAt(schedule, winterDate);

      expect(summerNext.hour).toBe(9);
      expect(winterNext.hour).toBe(9);
    });
  });
});
```

### Timezone Boundary Tests

```typescript
// src/lib/ultaura/__tests__/reminders.test.ts
import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { createReminder, getNextReminderOccurrence } from '../reminders';

describe('Reminder Timezone Handling', () => {
  describe('Cross-timezone scheduling', () => {
    it('should store in UTC and display in user timezone', async () => {
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-06-15T14:00:00', // 2 PM user local
        message: 'Take medication',
        timezone: 'America/Los_Angeles', // PDT (UTC-7)
      });

      // Stored as UTC
      const storedUtc = DateTime.fromISO(reminder.dueAt, { zone: 'UTC' });
      expect(storedUtc.hour).toBe(21); // 2 PM PDT = 9 PM UTC

      // Displayed in user timezone
      const displayLocal = storedUtc.setZone('America/Los_Angeles');
      expect(displayLocal.hour).toBe(14);
    });

    it('should handle midnight crossing correctly', async () => {
      // 11 PM Pacific = 6 AM UTC next day
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-06-15T23:00:00',
        message: 'Evening reminder',
        timezone: 'America/Los_Angeles',
      });

      const storedUtc = DateTime.fromISO(reminder.dueAt, { zone: 'UTC' });
      expect(storedUtc.day).toBe(16); // Next day in UTC
      expect(storedUtc.hour).toBe(6);
    });
  });

  describe('Hawaii timezone edge cases', () => {
    it('should handle Hawaii-Aleutian time (no DST)', async () => {
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-06-15T10:00:00',
        message: 'Aloha reminder',
        timezone: 'Pacific/Honolulu', // HST (UTC-10, no DST)
      });

      const storedUtc = DateTime.fromISO(reminder.dueAt, { zone: 'UTC' });
      expect(storedUtc.hour).toBe(20); // 10 AM HST = 8 PM UTC
    });
  });
});
```

### RRULE Recurrence Tests

```typescript
// src/lib/ultaura/__tests__/reminders.test.ts (continued)

describe('RRULE Recurrence Edge Cases', () => {
  describe('Monthly on 31st', () => {
    it('should skip months without 31st day', async () => {
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-01-31T09:00:00',
        message: 'Monthly on 31st',
        timezone: 'America/New_York',
        recurrence: {
          frequency: 'monthly',
          dayOfMonth: 31,
        },
      });

      // Jan 31 -> Mar 31 (skip Feb)
      const afterJan = await getNextReminderOccurrence(reminder, '2024-02-01');
      expect(afterJan.month).toBe(3);
      expect(afterJan.day).toBe(31);

      // Mar 31 -> May 31 (skip Apr with 30 days)
      const afterMar = await getNextReminderOccurrence(reminder, '2024-04-01');
      expect(afterMar.month).toBe(5);
      expect(afterMar.day).toBe(31);
    });
  });

  describe('Yearly on Feb 29', () => {
    it('should only fire on leap years', async () => {
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-02-29T09:00:00', // 2024 is leap year
        message: 'Leap year reminder',
        timezone: 'America/New_York',
        recurrence: {
          frequency: 'custom',
          intervalDays: 365, // Yearly approximation
        },
      });

      // 2025 is not a leap year - Feb 29 doesn't exist
      const next2025 = await getNextReminderOccurrence(reminder, '2025-02-01');
      // Should either skip to 2028 or adjust to Feb 28
      expect([28, 29]).toContain(next2025.day);
    });
  });

  describe('Weekly crossing year boundary', () => {
    it('should continue weekly pattern across year end', async () => {
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-12-30T10:00:00', // Monday
        message: 'Weekly Monday',
        timezone: 'America/New_York',
        recurrence: {
          frequency: 'weekly',
          daysOfWeek: [1], // Monday
        },
      });

      const nextAfterYearEnd = await getNextReminderOccurrence(reminder, '2025-01-01');
      expect(nextAfterYearEnd.year).toBe(2025);
      expect(nextAfterYearEnd.weekday).toBe(1); // Monday
      expect(nextAfterYearEnd.day).toBe(6); // First Monday of 2025
    });
  });

  describe('Snooze with recurrence', () => {
    it('should preserve original due time after snooze expires', async () => {
      const reminder = await createReminder({
        lineId: testLine.id,
        dueAt: '2024-06-15T09:00:00',
        message: 'Daily 9 AM',
        timezone: 'America/New_York',
        recurrence: { frequency: 'daily' },
      });

      // Snooze for 1 hour
      await snoozeReminder(reminder.id, 60);

      // Snoozed until 10 AM
      const snoozed = await getReminder(reminder.id);
      expect(snoozed.snoozedUntil).toContain('10:00');
      expect(snoozed.originalDueAt).toContain('09:00');

      // After snooze expires, next occurrence should be 9 AM tomorrow
      const nextOccurrence = await getNextReminderOccurrence(snoozed, '2024-06-15T11:00:00');
      expect(nextOccurrence.hour).toBe(9);
      expect(nextOccurrence.day).toBe(16);
    });
  });
});
```

### Permission Tests

```typescript
// src/lib/ultaura/__tests__/reminders.test.ts (continued)

describe('Reminder State Machine', () => {
  it('should only allow pausing scheduled reminders', async () => {
    const reminder = await createReminder({
      lineId: testLine.id,
      dueAt: '2024-06-15T09:00:00',
      message: 'Test',
      timezone: 'America/New_York',
    });

    // Can pause scheduled reminder
    const pauseResult = await pauseReminder(reminder.id);
    expect(pauseResult.success).toBe(true);

    // Cannot pause already paused reminder
    const doublePause = await pauseReminder(reminder.id);
    expect(doublePause.success).toBe(false);
    expect(doublePause.error.code).toBe('REMINDER_NOT_PAUSABLE');
  });

  it('should enforce snooze limit', async () => {
    const reminder = await createReminder({
      lineId: testLine.id,
      dueAt: '2024-06-15T09:00:00',
      message: 'Test',
      timezone: 'America/New_York',
    });

    // First 3 snoozes should succeed
    await snoozeReminder(reminder.id, 15);
    await snoozeReminder(reminder.id, 15);
    await snoozeReminder(reminder.id, 15);

    // 4th snooze should fail
    const fourthSnooze = await snoozeReminder(reminder.id, 15);
    expect(fourthSnooze.success).toBe(false);
    expect(fourthSnooze.error.code).toBe('SNOOZE_LIMIT_REACHED');
  });

  it('should validate snooze duration', async () => {
    const reminder = await createReminder({...});

    // Invalid duration
    const result = await snoozeReminder(reminder.id, 45); // Not in allowed list
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('INVALID_INPUT');
  });
});
```

---

## Migration Plan

### Step 1: Create @ultaura/schemas Package

1. Create `packages/schemas/` directory structure
2. Move and enhance type definitions
3. Create Zod schemas for all input types
4. Add error codes and factory functions
5. Configure package.json and tsconfig.json
6. Update pnpm-workspace.yaml

### Step 2: Fix Type Inconsistencies

Update `src/lib/ultaura/types.ts`:
1. ~~Add `rrule` field to Schedule type~~ - SKIP (column removed from DB)
2. ~~Add `preferredLanguage` and `spanishFormality` to Line type~~ - SKIP (columns removed from DB)
3. Add `source`, `version`, `active` to EncryptedMemory type
4. Export ReminderEvent type
5. Keep TrustedContact.notifyOn as `SafetyTier[]` (Zod validates at runtime)
6. Add `ReminderDeliveryMethod` enum with `'outbound_call'`
7. Add `is_reminder_call`, `reminder_id`, `reminder_message` to CallSessionRow

### Step 3: Create Helper Module

Create `src/lib/ultaura/helpers.ts`:
1. Move `getTrialStatus()`, `getPlan()`, `getUltauraAccountById()` from actions.ts
2. Add `withTrialCheck()` HOF wrapper (for mutating actions only)
3. Use `UltauraAccountRow` (snake_case) - no camelCase mapping needed
4. `getPlan()` queries DB `ultaura_plans` table (not PLANS constant)

### Step 4: Split Action Modules

For each domain, create a new file:

| File | Functions to Move | Est. Lines |
|------|-------------------|------------|
| accounts.ts | getOrCreateUltauraAccount, getUltauraAccount, isTrialExpired, getTrialInfo | ~150 |
| lines.ts | getLines, getLine, createLine, updateLine, deleteLine | ~280 |
| contacts.ts | getTrustedContacts, addTrustedContact, removeTrustedContact | ~120 |
| verification.ts | startPhoneVerification, checkPhoneVerification | ~150 |
| schedules.ts | getSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, getUpcomingScheduledCalls, getAllSchedules | ~300 |
| reminders.ts | getReminders, getReminder, createReminder, editReminder, pauseReminder, resumeReminder, snoozeReminder, cancelReminder, skipNextOccurrence, getPendingReminderCount, getNextReminder, getUpcomingReminders, getAllReminders | ~500 |
| reminder-events.ts | logReminderEvent, getReminderEvents, getLineReminderEvents | ~150 |
| usage.ts | getUsageSummary, updateOverageCap, getCallSessions, getLineActivity, initiateTestCall | ~200 |
| checkout.ts | createUltauraCheckout, getUltauraPriceId | ~150 |

### Step 5: Update All Imports

Update all 27 consuming files:

```typescript
// Before
import { getLines, createLine, getSchedules } from '~/lib/ultaura/actions';

// After
import { getLines, createLine } from '~/lib/ultaura/lines';
import { getSchedules } from '~/lib/ultaura/schedules';
```

Files to update:
- `/src/app/dashboard/(app)/lines/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/settings/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/verify/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/verify/VerifyPhoneClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/contacts/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/contacts/ContactsClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/reminders/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/reminders/ReminderActivity.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/schedule/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/schedule/ScheduleClient.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/page.tsx`
- `/src/app/dashboard/(app)/lines/[lineId]/schedule/[scheduleId]/EditScheduleClient.tsx`
- `/src/app/dashboard/(app)/lines/components/AddLineModal.tsx`
- `/src/app/dashboard/(app)/lines/components/LineCard.tsx`
- `/src/app/dashboard/(app)/calls/page.tsx`
- `/src/app/dashboard/(app)/calls/CallsPageClient.tsx`
- `/src/app/dashboard/(app)/reminders/page.tsx`
- `/src/app/dashboard/(app)/reminders/RemindersPageClient.tsx`
- `/src/app/dashboard/(app)/usage/page.tsx`
- `/src/app/dashboard/(app)/usage/components/UsageCapControl.tsx`
- `/src/app/dashboard/(app)/settings/subscription/page.tsx`
- `/src/components/ultaura/PricingTable.tsx`
- `/src/app/dashboard/(app)/page.tsx`

### Step 6: Update index.ts

Create barrel exports in `src/lib/ultaura/index.ts` to maintain backwards compatibility for any external consumers.

### Step 7: Remove @ts-nocheck

1. Remove `// @ts-nocheck` from all new module files
2. Run `pnpm typecheck` to identify remaining type errors
3. Fix all type errors
4. Ensure strict mode works across all modules

### Step 8: Write Tests

Create test files in `src/lib/ultaura/__tests__/`:
1. Setup test database utilities
2. Write unit tests for each module
3. Focus on DST, timezone, and recurrence edge cases
4. Add permission/state machine tests

### Step 9: Update Telephony to Use Shared Schemas

Update `telephony/src/routes/tools/` to import from `@ultaura/schemas`:
1. Replace manual validation with Zod schemas from `@ultaura/schemas/telephony`
2. Add error codes to responses (preserve existing message strings for voice):
   ```typescript
   // Before
   res.json({ success: false, message: "You've already snoozed this 3 times." });

   // After
   res.json({
     success: false,
     code: 'SNOOZE_LIMIT_REACHED',  // NEW - enables programmatic handling
     message: "You've already snoozed this 3 times."  // KEEP - for voice output
   });
   ```
3. Ensure consistency between frontend and backend validation

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `packages/schemas/package.json` | Package configuration |
| `packages/schemas/tsconfig.json` | TypeScript config |
| `packages/schemas/src/index.ts` | Exports |
| `packages/schemas/src/types.ts` | Shared types (snake_case Row types) |
| `packages/schemas/src/errors.ts` | Error codes + factory |
| `packages/schemas/src/constants.ts` | Shared constants (US_TIMEZONES, VALID_SNOOZE_MINUTES, etc.) |
| `packages/schemas/src/line.ts` | Line schemas |
| `packages/schemas/src/schedule.ts` | Schedule schemas |
| `packages/schemas/src/reminder.ts` | Reminder schemas |
| `packages/schemas/src/contact.ts` | Contact schemas |
| `packages/schemas/src/account.ts` | Account schemas |
| `packages/schemas/src/telephony/index.ts` | Telephony tool exports |
| `packages/schemas/src/telephony/set-reminder.ts` | SetReminderInput schema |
| `packages/schemas/src/telephony/edit-reminder.ts` | EditReminderInput schema |
| `packages/schemas/src/telephony/snooze-reminder.ts` | SnoozeReminderInput schema |
| `packages/schemas/src/telephony/opt-out.ts` | OptOutInput schema |
| `packages/schemas/src/telephony/safety-event.ts` | SafetyEventInput schema |
| `src/lib/ultaura/helpers.ts` | Shared utilities (uses Row types) |
| `src/lib/ultaura/accounts.ts` | Account actions |
| `src/lib/ultaura/lines.ts` | Line actions |
| `src/lib/ultaura/contacts.ts` | Contact actions |
| `src/lib/ultaura/verification.ts` | Verification actions |
| `src/lib/ultaura/schedules.ts` | Schedule actions |
| `src/lib/ultaura/reminders.ts` | Reminder CRUD + lifecycle (~500 lines) |
| `src/lib/ultaura/reminder-events.ts` | Reminder event logging (~150 lines) |
| `src/lib/ultaura/usage.ts` | Usage actions |
| `src/lib/ultaura/checkout.ts` | Checkout actions |
| `src/lib/ultaura/__tests__/setup.ts` | Test utilities (service-role client) |
| `src/lib/ultaura/__tests__/rls.test.ts` | RLS policy tests (authenticated client) |
| `src/lib/ultaura/__tests__/*.test.ts` | Test files (9 total) |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/ultaura/types.ts` | Add EncryptedMemory fields, export ReminderEvent, add CallSession reminder fields |
| `src/lib/ultaura/index.ts` | Update re-exports to include new modules |
| `src/lib/ultaura/timezone.ts` | Export getNextScheduleOccurrence, getNextReminderOccurrence for testing |
| `pnpm-workspace.yaml` | No change needed (packages/* glob already includes packages/schemas) |
| 27 dashboard files | Update imports to use new module paths |

### Deleted Files

| File | Reason |
|------|--------|
| `src/lib/ultaura/actions.ts` | Split into domain modules |

---

## Acceptance Criteria

### Functional
- [ ] All 43 exported functions work identically to before
- [ ] All 27 consuming files compile without errors
- [ ] No runtime behavior changes for end users
- [ ] Error messages remain user-friendly

### Type Safety
- [ ] `@ts-nocheck` removed from all modules
- [ ] `pnpm typecheck` passes with no errors
- [ ] All inputs validated via Zod schemas
- [ ] Type inconsistencies fixed (EncryptedMemory, ReminderEvent export, CallSession reminder fields)
- [ ] Uses snake_case Row types throughout (matching current UI consumption)

### Testing
- [ ] Unit tests for each module
- [ ] DST transition tests (spring forward, fall back)
- [ ] Timezone boundary tests (midnight crossing, Hawaii)
- [ ] RRULE edge case tests (31st, Feb 29, year boundary)
- [ ] Permission/state machine tests
- [ ] Tests run with real database (RLS verified)

### Code Quality
- [ ] Each module under 500 lines (reminders.ts ~500, others smaller)
- [ ] Reminders split into reminders.ts + reminder-events.ts
- [ ] Minimal JSDoc on all exported functions
- [ ] Consistent error code usage
- [ ] `withTrialCheck` wrapper used on mutating actions only
- [ ] Getters return Row types directly (no ActionResult wrapping)

### Cross-Package
- [ ] `@ultaura/schemas` package created with dashboard + telephony schemas
- [ ] Schemas importable from both Next.js and telephony
- [ ] Telephony validation updated to use shared schemas
- [ ] Telephony responses include error codes (preserving message strings for voice)

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing imports | Medium | High | Update all 27 files atomically; run full E2E suite |
| Type errors after removing @ts-nocheck | High | Medium | Fix incrementally; start with simpler modules |
| DST edge cases not fully covered | Medium | Medium | Use real timezone library (Luxon) in tests |
| Test database setup complexity | Medium | Low | Reuse existing Cypress/Supabase setup patterns |
| Telephony schema divergence | Low | Medium | Enforce shared package usage in CI |

---

## Dependencies

- `zod` (already installed)
- `luxon` (already used in telephony)
- `vitest` (already installed)
- `@supabase/supabase-js` (already installed)

No new dependencies required.

---

## Key Implementation Decisions (Q&A Summary)

This section summarizes decisions made during spec review to resolve ambiguities:

| Question | Decision | Rationale |
|----------|----------|-----------|
| **rrule/language columns** | Do NOT reintroduce | Removed by migrations 20260209/20260210 - intentional |
| **Extra DB columns** | Add runtime-relevant only | Skip internal scheduler fields (processing_claimed_*, retry_count) |
| **ActionResult scope** | Mutating actions only | Getters return data directly to avoid breaking 27 consuming files |
| **Entity shape** | Keep snake_case Row types | UI already consumes snake_case; camelCase types are unused |
| **Helper types** | Use UltauraAccountRow | Matches actual usage pattern |
| **Plan lookup** | Keep DB ultaura_plans | Current behavior, allows plan changes without deployment |
| **@ultaura/schemas scope** | Dashboard + telephony | Include telephony tool inputs for consistency |
| **constants.ts in package** | Create new file | Re-export or move shared constants |
| **Timezone validation** | Any IANA timezone | Current behavior; US_TIMEZONES is UI dropdown only |
| **Phone validation** | TELEPHONY.PHONE_REGEX | Stricter regex rejects invalid area codes |
| **Recurrence naming** | Keep `interval` | Current convention; maps to interval_days in DB |
| **Delivery method enum** | `'outbound_call'` only | Add `'sms'` when feature is implemented |
| **TrustedContact.notifyOn** | Keep SafetyTier[] | Zod validates at runtime; semantic constraint |
| **Test harness** | Root vitest + service-role | Add rls.test.ts with authenticated client |
| **Test APIs** | Export from timezone.ts | getNextScheduleOccurrence, getNextReminderOccurrence |
| **Module size** | Split reminders | reminders.ts (~500) + reminder-events.ts (~150) |
| **actions.ts removal** | Delete outright | No shim; update all 27 imports atomically |
| **Telephony error codes** | Add codes, keep messages | Enables programmatic handling + voice output |
| **withTrialCheck scope** | Mutating actions only | Getters work on expired trials (read-only access) |
| **pnpm-workspace.yaml** | No change needed | packages/* glob already includes packages/schemas |
