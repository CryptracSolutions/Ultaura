# DST Scheduling + Distributed Lease/Claim Coordination Test Harness

## Objective

Create a deterministic, comprehensive test harness for the telephony backend that ensures:
1. **DST correctness** for schedule/reminder `next_run_at` computations and local-to-UTC conversions
2. **Lease/claim correctness** to prevent duplicate calls, prevent stuck schedulers, and ensure safe takeover on expiry

This spec prioritizes **lease/claim testing first** (production incident risk) followed by **DST correctness** (twice-yearly user impact).

---

## Scope

### In Scope
- Unit tests for DST transitions in `telephony/src/utils/timezone.ts` functions
- Unit tests for lease coordination in `telephony/src/scheduler/call-scheduler.ts`
- Test seams to enable testing private scheduler functions
- Minimal surgical fixes for any bugs discovered during test writing
- Shared test utility for Supabase mocking

### Out of Scope
- Real database integration tests (all tests mock Supabase RPC responses)
- MONTHLY recurrence DST testing
- Refactoring unrelated code
- Performance benchmarking
- Real-timer integration tests (see rationale below)

---

## Technical Context

### Key Files

| File | Purpose |
|------|---------|
| `telephony/src/utils/timezone.ts` | Luxon-based timezone handling, DST-aware `buildZonedDateTime`, `getNextOccurrence`, `getNextReminderOccurrence` |
| `telephony/src/scheduler/call-scheduler.ts` | Main scheduler loop (1044 lines), lease coordination, claim processing. **Only exports `startScheduler` and `stopScheduler`** |
| `telephony/src/__tests__/timezone.test.ts` | Existing timezone tests, DST tests will be added here |
| `supabase/migrations/20260104000004_scheduler_rpc_functions.sql` | Lease and claim RPC definitions |
| `telephony/src/scheduler/__tests__/weekly-summary-scheduler.test.ts` | Reference for existing lease test patterns |

### Current DST Handling

The `buildZonedDateTime` function in `timezone.ts` handles:

**Spring Forward (nonexistent local time):**
- When a local time doesn't exist (e.g., 2:30 AM during spring forward)
- Shifts forward 1-3 hours to find a valid time
- Logs internally but **does not return DST metadata**

**Fall Back (ambiguous local time):**
- When a local time occurs twice (e.g., 1:30 AM during fall back)
- Uses `preferLateAmbiguous` parameter to choose:
  - `true` (default for schedules): Uses the second/later occurrence (Standard Time)
  - `false` (for `localToUtc`): Uses the first/earlier occurrence (Daylight Time)

### Current Lease Coordination

**Two-tier locking:**
1. **Global leases** (`ultaura_scheduler_leases`): Coarse-grained locks per job type
   - 60-second lease duration, 20-second heartbeat interval
   - RPCs: `try_acquire_scheduler_lease`, `heartbeat_scheduler_lease`, `release_scheduler_lease`

2. **Item-level claims** (`processing_claimed_by`, `processing_claimed_at` columns):
   - 120-second claim TTL
   - Uses `FOR UPDATE SKIP LOCKED` for atomic batch claiming (Postgres-level)
   - RPCs: `claim_due_schedules`, `claim_due_reminders`, `complete_*_processing`

**Important:** Unit tests can only validate telephony-side behavior given RPC outputs. They cannot prove Postgres locking semantics. Tests assume RPC contracts are correct.

---

## Test File Structure

```
telephony/src/
├── __tests__/
│   ├── helpers/
│   │   └── supabase-mock.ts          # NEW: Shared Supabase mock utility
│   └── timezone.test.ts              # EXTEND: Add DST transition tests
└── scheduler/
    ├── call-scheduler.ts             # MODIFY: Add __test__ exports
    └── __tests__/
        └── call-scheduler.test.ts    # NEW: Lease/claim coordination tests
```

---

## Part 0: Required Code Changes (Test Seams)

### 0.1 Export Test Seams from call-scheduler.ts

The scheduler's internal functions are not exported. Add test-only exports at the bottom of `call-scheduler.ts`:

```typescript
// At end of telephony/src/scheduler/call-scheduler.ts

// Test exports - only used by tests
export const __test__ = {
  runSchedulerCycle,
  processWithLease,
  processScheduledCalls,
  processReminders,
  processSchedule,
  processReminder,
  completeScheduleWithResult,
  releaseReminderClaim,
  handleRecurringReminderSuccess,
  handleReminderFailure,
  calculateNextRun,
  WORKER_ID,
  // Allow tests to reset state - MUST clear timers to prevent leaks
  resetState: () => {
    // Clear active intervals BEFORE dropping references
    heartbeatIntervals.forEach(interval => clearInterval(interval));
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
    // Reset all module state
    isRunning = false;
    shuttingDown = false;
    heartbeatIntervals = [];
    lastCleanupTimestamp = 0;
    lastBaselineRunDate = null;
    lastPersonaRunDate = null;
  },
  setShuttingDown: (value: boolean) => { shuttingDown = value; },
  setIsRunning: (value: boolean) => { isRunning = value; },
  // Clear cached lease existence checks between tests
  clearLeaseExistenceCache: () => { leaseExistenceCache.clear(); },
  // Expose constants for test assertions
  HEARTBEAT_INTERVAL_MS,
  LEASE_DURATION_SECONDS,
};
```

### 0.2 Modify completeScheduleWithResult to Return RPC Boolean

Currently `completeScheduleWithResult` ignores the RPC return value. Modify to return it:

```typescript
// Change signature and implementation
async function completeScheduleWithResult(
  schedule: ScheduleRow,
  result: 'success' | 'missed' | 'suppressed_quiet_hours' | 'skipped' | 'suppressed_vacation' | 'failed',
  nextRunAt: string | null,
  resetRetryCount: boolean
): Promise<boolean> {  // <-- Change return type
  const supabase = getSupabaseClient();
  scheduleOutcomesTotal.inc({ outcome: result });

  const { data: completed, error } = await supabase.rpc('complete_schedule_processing', {
    p_schedule_id: schedule.id,
    p_worker_id: WORKER_ID,
    p_result: result,
    p_next_run_at: nextRunAt,
    p_reset_retry_count: resetRetryCount,
  });

  if (error) {
    logger.error({ error, scheduleId: schedule.id }, 'Failed to complete schedule processing');
    return false;
  }

  if (!completed) {
    logger.warn({ scheduleId: schedule.id, workerId: WORKER_ID }, 'Claim lost during processing');
    return false;
  }

  return true;
}
```

Then update callers in `processSchedule` to check the return value and skip side effects (like updating `ultaura_lines.next_scheduled_call_at`) when `false`.

### 0.3 Distinguish Missing Lease Row from Held Lease

When `try_acquire_scheduler_lease` returns `false`, it could mean "held by another worker" or "lease row doesn't exist". Add a **cached** existence check to avoid DB load on every "held" case:

```typescript
// At module level - cache lease existence to avoid repeated queries
const leaseExistenceCache = new Map<string, boolean>();

// In processWithLease, after if (!acquired):
if (!acquired) {
  // Only check existence once per leaseId to avoid DB load on common "held" case
  if (!leaseExistenceCache.has(leaseId)) {
    const { data: leaseExists, error: existsError } = await supabase
      .from('ultaura_scheduler_leases')
      .select('id')
      .eq('id', leaseId)
      .maybeSingle();

    if (existsError) {
      // Existence check failed - log and assume held (safe default)
      logger.warn({ leaseId, error: existsError }, 'Lease existence check failed');
      leaseAcquisitions.labels(leaseId, WORKER_ID, 'held').inc();
      return;
    }

    leaseExistenceCache.set(leaseId, !!leaseExists);
  }

  const exists = leaseExistenceCache.get(leaseId);
  if (!exists) {
    logger.error({ leaseId }, 'Lease row missing - check migrations/seed data');
    leaseAcquisitions.labels(leaseId, WORKER_ID, 'missing').inc();
  } else {
    leaseAcquisitions.labels(leaseId, WORKER_ID, 'held').inc();
    logger.debug({ leaseId, workerId: WORKER_ID }, 'Lease held by another worker');
  }
  return;
}
```

Update the `__test__` exports to include cache clearing (full object shown in 0.1 above):

```typescript
// Add to __test__ object:
clearLeaseExistenceCache: () => { leaseExistenceCache.clear(); },
```

**Important:** Tests must call `clearLeaseExistenceCache()` in `beforeEach` to ensure each test starts with a clean cache state.

### 0.4 Add Claim Guard to Reminder Updates

**Problem:** Currently `releaseReminderClaim()` is called AFTER reminder status/due_at updates and event inserts. If the claim was lost, detecting `complete_reminder_processing=false` does NOT prevent the side effects already performed.

**Solution:** Add `.eq('processing_claimed_by', WORKER_ID)` guard to reminder update queries and check the update result before proceeding:

```typescript
// In handleRecurringReminderSuccess, replace direct update with guarded version:
const { data: updated, error: updateError } = await supabase
  .from('ultaura_reminders')
  .update({
    due_at: nextDueAt,
    status: 'scheduled',
    occurrence_count: (reminder.occurrence_count || 0) + 1,
    last_delivery_status: 'completed',
    current_snooze_count: 0,
    snoozed_until: null,
    original_due_at: null,
  })
  .eq('id', reminder.id)
  .eq('processing_claimed_by', WORKER_ID)  // <-- Guard: only update if we still hold claim
  .select('id')
  .maybeSingle();

if (updateError) {
  logger.error({ error: updateError, reminderId: reminder.id }, 'Failed to update recurring reminder');
  return;
}

if (!updated) {
  logger.warn({ reminderId: reminder.id, workerId: WORKER_ID }, 'Reminder claim lost, skipping event insert');
  return;  // Skip event insert - claim was lost
}

// Only insert event if update succeeded (claim still held)
await supabase.from('ultaura_reminder_events').insert({
  account_id: reminder.account_id,
  reminder_id: reminder.id,
  line_id: reminder.line_id,
  event_type: 'delivered',
  triggered_by: 'system',
  metadata: { nextDueAt },
});
```

Apply the same guarded pattern to:
- `handleReminderFailure`
- Vacation-suppression reminder updates in `processReminder`
- One-time reminder status updates

**Key principle:** Any update that modifies `due_at`, `status`, or `occurrence_count` MUST include the `.eq('processing_claimed_by', WORKER_ID)` guard and check `updated` before side effects.

### 0.5 Update releaseReminderClaim to Check Boolean and Warn

**Problem:** The current `releaseReminderClaim` only logs on RPC error, NOT when `{ data: false }` (claim already lost). This is inconsistent with the spec's expectation of warning on claim-loss.

**Solution:** Update `releaseReminderClaim` to check the boolean return value:

```typescript
async function releaseReminderClaim(reminderId: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data: released, error } = await supabase.rpc('complete_reminder_processing', {
    p_reminder_id: reminderId,
    p_worker_id: WORKER_ID,
  });

  if (error) {
    logger.error({ error, reminderId }, 'Failed to release reminder claim');
    return false;
  }

  if (!released) {
    logger.warn({ reminderId, workerId: WORKER_ID }, 'Reminder claim already released or lost');
    return false;
  }

  return true;
}
```

Note: This is informational only - the critical protection is the guarded updates in 0.4. By the time `releaseReminderClaim` is called, side effects have already been properly gated.

### 0.6 Gate All Schedule Side Effects on completeScheduleWithResult

**Problem:** Currently, `ultaura_lines.next_scheduled_call_at` updates happen in multiple places in `processSchedule` without checking if the claim was lost.

**Solution:** Every code path that updates `ultaura_lines.next_scheduled_call_at` MUST be gated on `completeScheduleWithResult(...) === true`.

**Affected code paths in `processSchedule`:**

1. **Vacation suppression** (line ~406-414):
   ```typescript
   const completed = await completeScheduleWithResult(schedule, 'suppressed_vacation', nextRun, true);
   if (completed && nextRun) {  // <-- Gate on completed
     await supabase.from('ultaura_lines').update({ next_scheduled_call_at: nextRun }).eq('id', schedule.line_id);
   }
   ```

2. **Skip/reschedule exception** (line ~488-495):
   ```typescript
   const completed = await completeScheduleWithResult(schedule, 'skipped', nextRun, true);
   if (completed && nextRun) {  // <-- Gate on completed
     await supabase.from('ultaura_lines').update({ next_scheduled_call_at: nextRun }).eq('id', schedule.line_id);
   }
   ```

3. **Successful call initiation** (line ~532-542):
   ```typescript
   const completed = await completeScheduleWithResult(schedule, 'success', calculateNextRun(schedule), true);
   if (completed) {  // <-- Gate on completed
     const nextRun = calculateNextRun(schedule);
     if (nextRun) {
       await supabase.from('ultaura_lines').update({ next_scheduled_call_at: nextRun }).eq('id', schedule.line_id);
     }
   }
   ```

4. **Duplicate idempotency** (line ~520-523):
   ```typescript
   const completed = await completeScheduleWithResult(schedule, 'success', calculateNextRun(schedule), true);
   // No line update needed for duplicates - claim should still be gated
   ```

5. **Max retries exceeded** (line ~566-568):
   ```typescript
   const completed = await completeScheduleWithResult(schedule, 'failed', calculateNextRun(schedule), true);
   // Line update omitted on failure - but still gate for consistency
   ```

**Implementation pattern:**
```typescript
// BEFORE (unsafe):
await completeScheduleWithResult(schedule, 'success', nextRun, true);
if (nextRun) {
  await supabase.from('ultaura_lines').update({ next_scheduled_call_at: nextRun }).eq('id', schedule.line_id);
}

// AFTER (safe):
const completed = await completeScheduleWithResult(schedule, 'success', nextRun, true);
if (completed && nextRun) {
  await supabase.from('ultaura_lines').update({ next_scheduled_call_at: nextRun }).eq('id', schedule.line_id);
}
```

---

## Part 1: Lease/Claim Coordination Tests

### File: `telephony/src/scheduler/__tests__/call-scheduler.test.ts`

### Test Naming Convention

All tests must use a scenario prefix for scannable CI output:
- `LEASE:` - Global lease coordination
- `CLAIM:` - Item-level claim processing

### Important Notes on Test Scope

These tests validate **telephony-side behavior given specific RPC outputs**. They do NOT prove:
- Postgres `FOR UPDATE SKIP LOCKED` semantics
- Database-level TTL enforcement
- Atomicity of SQL operations

Those are assumed correct per the RPC contracts.

### Required Scenarios

#### 1. Double-Processing Prevention (Highest Priority)

| Scenario | Mock Setup | Expected Behavior |
|----------|------------|-------------------|
| `CLAIM: completion verifies ownership - returns false when claim lost` | `complete_schedule_processing` returns `{ data: false, error: null }` | `completeScheduleWithResult` returns `false`; no `ultaura_lines` update occurs |
| `CLAIM: completion returns true on success` | `complete_schedule_processing` returns `{ data: true, error: null }` | `completeScheduleWithResult` returns `true`; subsequent `ultaura_lines` update proceeds |
| `CLAIM: completion failure prevents side effects for schedules` | Mock RPC returns `false` during `processSchedule` | Line's `next_scheduled_call_at` is NOT updated |
| `CLAIM: reminder completion returns false when claim lost` | `complete_reminder_processing` returns `{ data: false, error: null }` | `releaseReminderClaim` logs warning; no further updates |

#### 2. Lease Exclusivity and Heartbeat

| Scenario | Mock Setup | Expected Behavior |
|----------|------------|-------------------|
| `LEASE: held by another worker skips processing` | `try_acquire_scheduler_lease` returns `{ data: false, error: null }`; lease row exists (cached) | Debug log "held by another worker"; no schedules/reminders processed |
| `LEASE: heartbeat RPC called during long processing` | Lease acquired; advance timers by 25s during processor execution | `heartbeat_scheduler_lease` RPC called with correct params |
| `LEASE: release always called in finally block` | `processor()` throws an error | `release_scheduler_lease` RPC is still called |
| `LEASE: RPC error logs and returns early` | `try_acquire_scheduler_lease` returns `{ data: null, error: new Error('DB error') }` | Error logged; no processing; metrics incremented with 'error' label |

**Heartbeat test implementation pattern (uses async timer advancement):**
```typescript
it('LEASE: heartbeat RPC called during long processing', async () => {
  // Lease acquired
  supabaseMock.rpcMock.mockResolvedValueOnce(rpcResponses.leaseAcquired);
  // Heartbeat succeeds
  supabaseMock.rpcMock.mockResolvedValue({ data: true, error: null });

  let processorResolved = false;
  const slowProcessor = async () => {
    // Advance time past heartbeat interval (20s) while "processing"
    await vi.advanceTimersByTimeAsync(25_000);
    processorResolved = true;
  };

  await processWithLease('schedules', slowProcessor);

  expect(processorResolved).toBe(true);
  expect(supabaseMock.rpcMock).toHaveBeenCalledWith(
    'heartbeat_scheduler_lease',
    expect.objectContaining({ p_lease_id: 'schedules' })
  );
});
```

#### 3. Missing Lease Rows (Cached Check)

| Scenario | Mock Setup | Expected Behavior |
|----------|------------|-------------------|
| `LEASE: missing lease row logs explicit error` | `try_acquire_scheduler_lease` returns `false`; `.from().select()` returns `{ data: null }` (no row) | Error log "Lease row missing"; metrics label 'missing' |
| `LEASE: existing lease row logs debug for held` | `try_acquire_scheduler_lease` returns `false`; `.select()` returns `{ data: { id: 'schedules' } }` | Debug log "held by another worker"; metrics label 'held' |
| `LEASE: existence check cached after first query` | Two consecutive "held" responses for same leaseId | Only ONE `.from().select()` call (result cached) |
| `LEASE: existence check error logs warning and assumes held` | `try_acquire_scheduler_lease` returns `false`; `.select()` returns `{ error: new Error(...) }` | Warning log "existence check failed"; metrics label 'held'; no crash |

**Cache behavior test pattern:**
```typescript
it('LEASE: existence check cached after first query', async () => {
  // First "held" - triggers existence check
  rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
  fromMock.mockReturnValueOnce(
    createQueryBuilder({ data: { id: 'schedules' }, error: null })
  );
  await processWithLease('schedules', async () => {});

  // Second "held" - should use cached result
  rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
  // Do NOT set up fromMock - should not be called again
  await processWithLease('schedules', async () => {});

  // fromMock should only be called once (first check)
  expect(fromMock).toHaveBeenCalledTimes(1);
});
```

#### 4. Claim TTL Behavior (Telephony-Side Only)

| Scenario | Mock Setup | Expected Behavior |
|----------|------------|-------------------|
| `CLAIM: stale claim cleared by RPC returns fresh item` | `claim_due_schedules` returns schedule that was previously stuck | Schedule is processed normally (RPC handles TTL cleanup) |
| `CLAIM: empty batch triggers daily jobs when past cutoff` | See detailed setup below | `recalculateBaselinesForAllLines` and `runPersonaAnalyzerForAllLines` called |
| `CLAIM: empty batch skips daily jobs when before cutoff` | See detailed setup below | Neither daily job function called |

**Daily jobs test - requires explicit time setup and service mocking:**

The daily jobs (`maybeRecalculateBaselines` at 10:00 UTC, `maybeRunPersonaAnalyzer` at 11:00 UTC) are time-gated. Tests MUST:
1. Set system time to past the cutoff (e.g., `2025-01-01T11:30:00Z`)
2. Mock the imported service functions
3. Clear `lastBaselineRunDate` / `lastPersonaRunDate` state via `resetState()`

**Note:** `processScheduledCalls()` does NOT acquire a lease - its first RPC call is `claim_due_schedules`. Test it directly without lease mocking.

```typescript
// Mocks already set up via vi.hoisted() pattern (see "Usage in Tests" section)

it('CLAIM: empty batch triggers daily jobs when past cutoff', async () => {
  // Set time AFTER both cutoffs (10:00 and 11:00 UTC)
  vi.setSystemTime(new Date('2025-01-01T11:30:00.000Z'));

  // Empty schedule batch - processScheduledCalls starts with claim_due_schedules, no lease
  rpcMock.mockResolvedValueOnce(rpcResponses.emptyArray); // claim_due_schedules

  await processScheduledCalls();

  expect(recalculateBaselinesForAllLines).toHaveBeenCalled();
  expect(runPersonaAnalyzerForAllLines).toHaveBeenCalled();
});

it('CLAIM: empty batch skips daily jobs when before cutoff', async () => {
  // Set time BEFORE cutoffs
  vi.setSystemTime(new Date('2025-01-01T08:00:00.000Z'));

  rpcMock.mockResolvedValueOnce(rpcResponses.emptyArray); // claim_due_schedules

  await processScheduledCalls();

  expect(recalculateBaselinesForAllLines).not.toHaveBeenCalled();
  expect(runPersonaAnalyzerForAllLines).not.toHaveBeenCalled();
});
```

#### 5. Concurrent Run Guard

| Scenario | Mock Setup | Expected Behavior |
|----------|------------|-------------------|
| `LEASE: concurrent cycle skipped when already running` | Set `isRunning = true` before calling `runSchedulerCycle` | Returns immediately with debug log |
| `LEASE: cycle skipped when shutting down` | Set `shuttingDown = true` | Returns immediately with debug log |

#### 6. Reminder-Side Claim Tests (with Guarded Updates)

| Scenario | Mock Setup | Expected Behavior |
|----------|------------|-------------------|
| `CLAIM: reminder guarded update returns null when claim lost` | `.update().eq('processing_claimed_by', WORKER_ID).select().maybeSingle()` returns `{ data: null }` | Warning log "claim lost"; NO event insert; no crash |
| `CLAIM: reminder guarded update proceeds when claim held` | Same query returns `{ data: { id: ... } }` | Event insert proceeds; normal completion |
| `CLAIM: recurring reminder advances on guarded success` | Guarded update succeeds; `claim_due_reminders` returns recurring reminder | `due_at` updated; event inserted; `occurrence_count` incremented |

**Guarded update test pattern:**

Note: `handleRecurringReminderSuccess` is exported via `__test__` for direct testing. Use hoisted mocks.

```typescript
// Uses hoisted mocks from test file setup (see "Usage in Tests" section)

it('CLAIM: reminder guarded update returns null when claim lost', async () => {
  // Mock the guarded update to return null (0 rows updated = claim lost)
  fromMock.mockReturnValueOnce(
    createQueryBuilder({ data: null, error: null }) // .update().eq().select().maybeSingle()
  );

  const mockReminder = {
    id: 'rem-123',
    account_id: 'acc-456',
    line_id: 'line-789',
    is_recurring: true,
    rrule: 'FREQ=DAILY;INTERVAL=1',
    time_of_day: '09:00',
    timezone: 'America/New_York',
    due_at: '2025-01-10T14:00:00.000Z',
    occurrence_count: 5,
    ends_at: null,
  };

  // handleRecurringReminderSuccess is exported via __test__
  // Note: function expects (supabase, reminder), pass the mock client
  const supabaseClient = { rpc: rpcMock, from: fromMock };
  await handleRecurringReminderSuccess(supabaseClient, mockReminder);

  // Event insert should NOT have been called - only the guarded update
  expect(fromMock).toHaveBeenCalledTimes(1);
  // Verify warning was logged (logger is mocked via hoisted loggerMock)
  expect(logger.warn).toHaveBeenCalledWith(
    expect.objectContaining({ reminderId: 'rem-123' }),
    expect.stringContaining('claim lost')
  );
});
```

### Real Timer Test Decision

**Decision: Skip real-timer integration test.**

Rationale:
- Timing constants (`LEASE_DURATION_SECONDS`, `HEARTBEAT_INTERVAL_MS`) are hardcoded module-level constants
- Parameterizing them for tests would require refactoring or dependency injection
- Fake timers with deterministic RPC stubs provide sufficient coverage
- Real-timer tests are inherently flaky in CI environments

All timing behavior will be tested with `vi.useFakeTimers()` and **`vi.advanceTimersByTimeAsync()`** (async version required for heartbeat tests).

### Timer Testing Guidance

**Important:** Use `vi.advanceTimersByTimeAsync()` (not `vi.advanceTimersByTime()`) when testing heartbeat behavior. The heartbeat callback is async, and the sync version can miss microtasks.

```typescript
// CORRECT - awaits async callbacks:
await vi.advanceTimersByTimeAsync(25_000);

// WRONG - may miss async heartbeat callback:
vi.advanceTimersByTime(25_000);
```

For tests that don't involve async callbacks (e.g., checking `isRunning` guard), the sync version is fine.

---

## Part 2: DST Transition Tests

### File: `telephony/src/__tests__/timezone.test.ts` (extend existing)

### Test Naming Convention

All tests must use prefix:
- `DST:` - DST transition tests

### Critical Implementation Notes

1. **`afterDate` must be a JS `Date`, not Luxon `DateTime`**
   ```typescript
   // CORRECT:
   const afterDate = new Date('2025-03-09T06:30:00Z');
   const result = getNextOccurrence({ timeOfDay: '02:30', timezone, daysOfWeek: [0], afterDate });

   // WRONG (will fail):
   const afterDate = DateTime.fromISO('2025-03-09T01:30:00', { zone: timezone });
   ```

2. **Do NOT assert on `dstNote` log fields** - They are internal logging only, not returned. Assert on the returned UTC instant.

3. **All assertions must use explicit UTC ISO strings** to be deterministic.

### DST Test Dates (Reference)

| Timezone | Spring Forward | Fall Back |
|----------|---------------|-----------|
| America/New_York | March 9, 2025 02:00 → 03:00 (UTC-5 → UTC-4) | November 2, 2025 02:00 → 01:00 (UTC-4 → UTC-5) |
| America/Phoenix | No DST | No DST |
| Europe/London | March 30, 2025 01:00 → 02:00 (UTC+0 → UTC+1) | October 26, 2025 02:00 → 01:00 (UTC+1 → UTC+0) |

### Required Scenarios

#### 1. Spring Forward (Nonexistent Time)

| Scenario | Input | Expected UTC Output |
|----------|-------|---------------------|
| `DST: spring-forward 02:30 shifts to 03:30 America/New_York` | `timeOfDay: '02:30'`, March 9, 2025 | `2025-03-09T07:30:00.000Z` (03:30 EDT = UTC-4) |
| `DST: spring-forward 02:00 shifts to 03:00 America/New_York` | `timeOfDay: '02:00'`, March 9, 2025 | `2025-03-09T07:00:00.000Z` (03:00 EDT = UTC-4) |
| `DST: spring-forward Europe/London 01:30 shifts to 02:30` | `timeOfDay: '01:30'`, March 30, 2025 | `2025-03-30T01:30:00.000Z` (02:30 BST = UTC+1) |

**Test Implementation Pattern:**
```typescript
it('DST: spring-forward 02:30 shifts to 03:30 America/New_York', () => {
  // March 9, 2025 at 01:30 EST (before transition)
  const afterDate = new Date('2025-03-09T06:30:00.000Z'); // 01:30 EST

  const result = getNextOccurrence({
    timeOfDay: '02:30',
    timezone: 'America/New_York',
    daysOfWeek: [0], // Sunday
    afterDate,
  });

  // 02:30 doesn't exist; shifted to 03:30 EDT (UTC-4)
  expect(result.toISOString()).toBe('2025-03-09T07:30:00.000Z');
});
```

#### 2. Fall Back (Ambiguous Time)

| Scenario | Input | Expected UTC Output |
|----------|-------|---------------------|
| `DST: fall-back 01:30 uses later occurrence (default)` | `timeOfDay: '01:30'`, Nov 2, 2025, `preferLateAmbiguous: true` | `2025-11-02T06:30:00.000Z` (01:30 EST = UTC-5) |
| `DST: fall-back 01:30 uses earlier occurrence (explicit)` | Same with `preferLateAmbiguous: false` via `localToUtc` | `2025-11-02T05:30:00.000Z` (01:30 EDT = UTC-4) |
| `DST: fall-back Europe/London 01:30 uses later occurrence` | `timeOfDay: '01:30'`, Oct 26, 2025 | `2025-10-26T01:30:00.000Z` (01:30 GMT = UTC+0) |

**Test Implementation Pattern:**
```typescript
it('DST: fall-back 01:30 uses later occurrence (default) America/New_York', () => {
  // November 2, 2025 at 00:30 EDT (before fall-back)
  const afterDate = new Date('2025-11-02T04:30:00.000Z'); // 00:30 EDT

  const result = getNextOccurrence({
    timeOfDay: '01:30',
    timezone: 'America/New_York',
    daysOfWeek: [0], // Sunday
    afterDate,
  });

  // 01:30 is ambiguous; default prefers later (EST, UTC-5)
  expect(result.toISOString()).toBe('2025-11-02T06:30:00.000Z');
});

it('DST: fall-back 01:30 uses earlier occurrence via localToUtc', () => {
  // localToUtc uses preferLateAmbiguous: false
  const result = localToUtc('2025-11-02T01:30:00', 'America/New_York');

  // Earlier occurrence = EDT (UTC-4)
  expect(result.toISOString()).toBe('2025-11-02T05:30:00.000Z');
});
```

#### 3. No-DST Zone

| Scenario | Input | Expected UTC Output |
|----------|-------|---------------------|
| `DST: America/Phoenix no shift on March 9` | `timeOfDay: '02:30'`, March 9, 2025 | `2025-03-09T09:30:00.000Z` (02:30 MST = UTC-7) |
| `DST: America/Phoenix no shift on November 2` | `timeOfDay: '01:30'`, Nov 2, 2025 | `2025-11-02T08:30:00.000Z` (01:30 MST = UTC-7) |

#### 4. Recurrence During DST (DAILY and WEEKLY)

| Scenario | Input | Expected UTC Output |
|----------|-------|---------------------|
| `DST: DAILY recurrence crosses spring-forward` | Daily at 02:30, current due March 8 | Next: `2025-03-09T07:30:00.000Z` (shifted to 03:30 EDT) |
| `DST: DAILY recurrence crosses fall-back` | Daily at 01:30, current due Nov 1 | Next: `2025-11-02T06:30:00.000Z` (later 01:30 EST) |
| `DST: WEEKLY recurrence on spring-forward day` | Weekly Sunday at 02:30, current due March 2 | Next: `2025-03-09T07:30:00.000Z` |
| `DST: WEEKLY recurrence on fall-back day` | Weekly Sunday at 01:30, current due Oct 26 | Next: `2025-11-02T06:30:00.000Z` |

**Test Implementation Pattern:**
```typescript
it('DST: DAILY recurrence crosses spring-forward', () => {
  // March 8, 2025 at 02:30 EST
  const currentDueAt = new Date('2025-03-08T07:30:00.000Z');

  const result = getNextReminderOccurrence({
    rrule: 'FREQ=DAILY;INTERVAL=1',
    timezone: 'America/New_York',
    timeOfDay: '02:30',
    currentDueAt,
  });

  // March 9: 02:30 doesn't exist, shifts to 03:30 EDT
  expect(result?.toISOString()).toBe('2025-03-09T07:30:00.000Z');
});
```

#### 5. WEEKLY Interval Bug Investigation

The current code for `FREQ=WEEKLY;INTERVAL=2` with multiple days may be incorrect:

```typescript
// Current logic in timezone.ts lines 413-414:
if (interval > 1) {
  tempDate = tempDate.plus({ weeks: interval - 1 });
}
```

This adds weeks **after** finding the next matching day, which may skip to the wrong week.

**Test to confirm/refute bug:**
```typescript
describe('DST: WEEKLY interval correctness', () => {
  it('DST: WEEKLY interval=2 Mon/Wed/Fri - mid-week advances within same week', () => {
    // Monday of week 1 at 09:00
    const currentDueAt = new Date('2025-01-06T14:00:00.000Z'); // Mon 09:00 EST

    const result = getNextReminderOccurrence({
      rrule: 'FREQ=WEEKLY;INTERVAL=2',
      timezone: 'America/New_York',
      timeOfDay: '09:00',
      currentDueAt,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    });

    // Expected: Wednesday of week 1 (same week), NOT Wednesday of week 3
    // Wed Jan 8, 2025 at 09:00 EST = 14:00 UTC
    expect(result?.toISOString()).toBe('2025-01-08T14:00:00.000Z');
  });

  it('DST: WEEKLY interval=2 Mon/Wed/Fri - end of week advances by interval', () => {
    // Friday of week 1 at 09:00
    const currentDueAt = new Date('2025-01-10T14:00:00.000Z'); // Fri 09:00 EST

    const result = getNextReminderOccurrence({
      rrule: 'FREQ=WEEKLY;INTERVAL=2',
      timezone: 'America/New_York',
      timeOfDay: '09:00',
      currentDueAt,
      daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
    });

    // Expected: Monday of week 3 (skip week 2)
    // Mon Jan 20, 2025 at 09:00 EST = 14:00 UTC
    expect(result?.toISOString()).toBe('2025-01-20T14:00:00.000Z');
  });
});
```

**If tests fail:** Fix the recurrence logic with a minimal surgical change. The fix should:
1. Track whether we've crossed a week boundary
2. Only add `weeks: interval - 1` when moving to a new week

#### 6. Snooze + DST Combination

This tests the `localToUtc` function (used by snooze-schedule tool) with a nonexistent time:

```typescript
it('DST: snooze into nonexistent time shifts forward', () => {
  // Snoozing to 02:30 AM on March 9, 2025 (doesn't exist)
  const result = localToUtc('2025-03-09T02:30:00', 'America/New_York');

  // Should shift to 03:30 EDT (UTC-4)
  expect(result.toISOString()).toBe('2025-03-09T07:30:00.000Z');
});
```

Note: This tests the timezone utility only, not the full exception pipeline.

---

## Part 3: Shared Test Utility

### File: `telephony/src/__tests__/helpers/supabase-mock.ts`

```typescript
import { vi, type Mock } from 'vitest';

/**
 * Minimal Supabase mock helper for scheduler tests.
 * Supports RPC calls and query builder chains.
 */

export interface SupabaseMockResult {
  client: {
    rpc: Mock;
    from: Mock;
  };
  rpcMock: Mock;
  fromMock: Mock;
  reset: () => void;
}

/**
 * Creates a mock Supabase client.
 * Use with: vi.mock('../../utils/supabase.js', () => ({ getSupabaseClient: () => mock.client }))
 */
export function createSupabaseMock(): SupabaseMockResult {
  const rpcMock = vi.fn();
  const fromMock = vi.fn();

  const client = {
    rpc: rpcMock,
    from: fromMock,
  };

  return {
    client,
    rpcMock,
    fromMock,
    reset: () => {
      rpcMock.mockReset();
      fromMock.mockReset();
    },
  };
}

/**
 * Creates a chainable query builder that resolves to the given result.
 * Supports: select, insert, update, delete, eq, neq, gt, lt, gte, lte,
 *           is, in, not, order, limit, single, maybeSingle
 */
export function createQueryBuilder(result: { data: unknown; error: unknown }): Record<string, Mock> {
  const builder: Record<string, Mock> = {};

  // Chainable methods return the builder
  const chainableMethods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte',
    'is', 'in', 'not', 'order', 'limit',
    'match', 'filter', 'contains', 'containedBy',
    'range', 'textSearch', 'or', 'and',
  ];

  for (const method of chainableMethods) {
    builder[method] = vi.fn(() => builder);
  }

  // Terminal methods return the result
  builder.single = vi.fn().mockResolvedValue(result);
  builder.maybeSingle = vi.fn().mockResolvedValue(result);

  // Make builder thenable for direct await
  builder.then = (resolve: (value: { data: unknown; error: unknown }) => void) => {
    resolve(result);
    return Promise.resolve(result);
  };

  return builder;
}

/**
 * Common RPC response factories.
 */
export const rpcResponses = {
  leaseAcquired: { data: true, error: null },
  leaseHeld: { data: false, error: null },
  leaseReleased: { data: true, error: null },
  completionSuccess: { data: true, error: null },
  completionClaimLost: { data: false, error: null },
  error: (msg: string) => ({ data: null, error: new Error(msg) }),
  emptyArray: { data: [], error: null },
};

/**
 * Creates a mock for globalThis.fetch.
 * Use with: vi.stubGlobal('fetch', createFetchMock(...))
 */
export function createFetchMock(responses: Array<{ ok: boolean; json: unknown }>): Mock {
  let callIndex = 0;
  return vi.fn().mockImplementation(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({
      ok: response.ok,
      json: () => Promise.resolve(response.json),
    });
  });
}
```

### Usage in Tests

**IMPORTANT: ESM + vi.mock Hoisting**

Vitest hoists `vi.mock()` calls to the top of the file, but the mock factory runs before imports. To avoid TDZ (Temporal Dead Zone) issues when referencing variables inside mock factories, use `vi.hoisted()`:

```typescript
// telephony/src/scheduler/__tests__/call-scheduler.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================
// 1. HOISTED MOCKS - Create mock functions BEFORE vi.mock calls
// ============================================================
const rpcMock = vi.hoisted(() => vi.fn());
const fromMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
const recalculateBaselinesForAllLines = vi.hoisted(() => vi.fn());
const runPersonaAnalyzerForAllLines = vi.hoisted(() => vi.fn());
const getLineById = vi.hoisted(() => vi.fn());
const checkLineAccess = vi.hoisted(() => vi.fn());
const isInQuietHours = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

// ============================================================
// 2. vi.mock CALLS - Reference hoisted variables in factories
// ============================================================
vi.mock('../../utils/supabase.js', () => ({
  getSupabaseClient: () => ({
    rpc: rpcMock,
    from: fromMock,
  }),
}));

vi.mock('../../utils/logger.js', () => ({
  logger: loggerMock,
}));

vi.mock('../../services/baseline.js', () => ({
  recalculateBaselinesForAllLines,
}));

vi.mock('../../services/persona-analyzer.js', () => ({
  runPersonaAnalyzerForAllLines,
}));

// Required for processSchedule/processReminder tests
vi.mock('../../utils/env.js', () => ({
  getBackendUrl: () => 'http://localhost:3001',
  getInternalApiSecret: () => 'test-secret',
}));

vi.mock('../../services/line-lookup.js', () => ({
  getLineById,
  checkLineAccess,
  isInQuietHours,
}));

// Stub global fetch
vi.stubGlobal('fetch', fetchMock);

// ============================================================
// 3. IMPORTS - After all vi.mock calls
// ============================================================
import {
  createQueryBuilder,
  rpcResponses,
} from '../../__tests__/helpers/supabase-mock.js';
import { __test__ } from '../call-scheduler.js';
import { logger } from '../../utils/logger.js';  // Will be the mocked version

const {
  runSchedulerCycle,
  processWithLease,
  processScheduledCalls,
  processSchedule,
  completeScheduleWithResult,
  handleRecurringReminderSuccess,
  resetState,
  clearLeaseExistenceCache,
  HEARTBEAT_INTERVAL_MS,
} = __test__;

// ============================================================
// 4. TEST SUITE
// ============================================================
describe('call-scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset all hoisted mocks
    rpcMock.mockReset();
    fromMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
    recalculateBaselinesForAllLines.mockReset();
    runPersonaAnalyzerForAllLines.mockReset();
    getLineById.mockReset();
    checkLineAccess.mockReset();
    isInQuietHours.mockReset();
    fetchMock.mockReset();
    // Reset module state
    resetState();                    // Clears timers + resets module state
    clearLeaseExistenceCache();      // Clear cached lease existence checks
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('LEASE: global lease coordination', () => {
    it('LEASE: held by another worker skips processing', async () => {
      // Lease not acquired
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseHeld);
      // Lease row exists (distinguish from missing) - first call triggers check
      fromMock.mockReturnValueOnce(
        createQueryBuilder({ data: { id: 'schedules' }, error: null })
      );

      await processWithLease('schedules', async () => {
        throw new Error('Should not be called');
      });

      expect(rpcMock).toHaveBeenCalledWith(
        'try_acquire_scheduler_lease',
        expect.objectContaining({ p_lease_id: 'schedules' })
      );
      // Processor was not called (no error thrown)
    });

    it('LEASE: heartbeat RPC called during long processing', async () => {
      // Lease acquired
      rpcMock.mockResolvedValueOnce(rpcResponses.leaseAcquired);
      // Heartbeat succeeds
      rpcMock.mockResolvedValue({ data: true, error: null });

      let processorResolved = false;
      const slowProcessor = async () => {
        // Advance time past heartbeat interval while "processing"
        // Use ASYNC version to properly handle async heartbeat callback
        await vi.advanceTimersByTimeAsync(HEARTBEAT_INTERVAL_MS + 5000);
        processorResolved = true;
      };

      await processWithLease('schedules', slowProcessor);

      expect(processorResolved).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith(
        'heartbeat_scheduler_lease',
        expect.objectContaining({ p_lease_id: 'schedules' })
      );
    });
  });

  describe('CLAIM: completion ownership', () => {
    it('CLAIM: completion returns false when claim lost', async () => {
      rpcMock.mockResolvedValueOnce(rpcResponses.completionClaimLost);

      const schedule = {
        id: 'sched-123',
        line_id: 'line-456',
        // ... other required fields
      };

      const result = await completeScheduleWithResult(
        schedule as any,
        'success',
        '2025-01-10T15:00:00.000Z',
        true
      );

      expect(result).toBe(false);
    });
  });
});
```

### Mocking Required Dependencies for processSchedule/processReminder Tests

Tests that exercise `processSchedule()` or `processReminder()` directly (to prove `ultaura_lines.next_scheduled_call_at` gating) require additional mocks:

| Module | Functions | Mock Setup |
|--------|-----------|------------|
| `../../utils/env.js` | `getBackendUrl`, `getInternalApiSecret` | Return test values |
| `../../services/line-lookup.js` | `getLineById`, `checkLineAccess`, `isInQuietHours` | Return controlled line/account data |
| `globalThis.fetch` | - | Stub with `vi.stubGlobal('fetch', fetchMock)` |

**Example test for gating verification:**
```typescript
it('CLAIM: completion failure prevents ultaura_lines update', async () => {
  // Setup: line exists, access allowed, not in quiet hours
  getLineById.mockResolvedValueOnce({
    line: { id: 'line-456', do_not_call: false, vacation_ranges: [] },
    account: { id: 'acc-789' },
  });
  checkLineAccess.mockResolvedValueOnce({ allowed: true });
  isInQuietHours.mockReturnValueOnce(false);

  // Fetch succeeds (call initiated)
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ sessionId: 'sess-123' }),
  });

  // complete_schedule_processing returns FALSE (claim lost)
  rpcMock.mockResolvedValueOnce({ data: false, error: null });

  const schedule = {
    id: 'sched-123',
    line_id: 'line-456',
    next_run_at: '2025-01-10T14:00:00.000Z',
    days_of_week: [1, 2, 3, 4, 5],
    time_of_day: '09:00',
    timezone: 'America/New_York',
    retry_count: 0,
    retry_policy: { max_retries: 2, retry_window_minutes: 30 },
  };

  await processSchedule(schedule as any);

  // Verify ultaura_lines was NOT updated (fromMock should not have been called with 'ultaura_lines')
  const lineUpdateCalls = fromMock.mock.calls.filter(
    ([table]: [string]) => table === 'ultaura_lines'
  );
  expect(lineUpdateCalls).toHaveLength(0);

  // Verify warning was logged
  expect(logger.warn).toHaveBeenCalledWith(
    expect.objectContaining({ scheduleId: 'sched-123' }),
    expect.stringContaining('Claim lost')
  );
});
```

---

## Part 4: Summary of Required Changes

### Code Changes

| File | Change | Rationale |
|------|--------|-----------|
| `telephony/src/scheduler/call-scheduler.ts` | Add `__test__` export object (with timer cleanup, cache clear, helper exports) | Enable testing of private functions without leaking intervals |
| `telephony/src/scheduler/call-scheduler.ts` | `completeScheduleWithResult` returns `Promise<boolean>` | Allow callers to detect claim loss |
| `telephony/src/scheduler/call-scheduler.ts` | Gate ALL `ultaura_lines.next_scheduled_call_at` updates on `completed === true` | Prevent side effects on claim loss (vacation, skip, success, etc.) |
| `telephony/src/scheduler/call-scheduler.ts` | Add cached lease existence check in `processWithLease` | Distinguish "held" from "missing" without DB load on every "held" |
| `telephony/src/scheduler/call-scheduler.ts` | Add `.eq('processing_claimed_by', WORKER_ID)` guard to reminder updates | Prevent side effects when reminder claim lost |
| `telephony/src/scheduler/call-scheduler.ts` | Check guarded update result before event inserts | Skip events if claim was lost |
| `telephony/src/scheduler/call-scheduler.ts` | Update `releaseReminderClaim` to check boolean and warn | Log when claim already lost (informational) |
| `telephony/src/utils/timezone.ts` | Fix WEEKLY interval logic (if bug confirmed) | Correct multi-day interval recurrence |

### New Files

| File | Purpose |
|------|---------|
| `telephony/src/__tests__/helpers/supabase-mock.ts` | Shared test utility |
| `telephony/src/scheduler/__tests__/call-scheduler.test.ts` | Lease/claim coordination tests |

### Extended Files

| File | Changes |
|------|---------|
| `telephony/src/__tests__/timezone.test.ts` | Add DST transition test cases |

---

## How to Run

Use existing vitest configuration. No new npm scripts required.

```bash
# Run all telephony tests
pnpm -C telephony test

# Run only timezone tests (including new DST tests)
pnpm -C telephony test -- src/__tests__/timezone.test.ts

# Run only scheduler tests (new lease/claim tests)
pnpm -C telephony test -- src/scheduler/__tests__/call-scheduler.test.ts

# Run specific test by name pattern
pnpm -C telephony test -- -t "DST:"
pnpm -C telephony test -- -t "LEASE:"
pnpm -C telephony test -- -t "CLAIM:"

# Run with verbose output
pnpm -C telephony test -- --reporter=verbose
```

---

## Success Criteria (Scenario Coverage)

### Lease/Claim Tests Must Cover:

**Schedule Claims:**
- [ ] `CLAIM: completion returns false when claim lost` (schedules)
- [ ] `CLAIM: completion returns true on success` (schedules)
- [ ] `CLAIM: completion failure prevents side effects` (no `next_scheduled_call_at` update)

**Reminder Claims (Guarded Updates):**
- [ ] `CLAIM: reminder guarded update returns null when claim lost`
- [ ] `CLAIM: reminder guarded update proceeds when claim held`
- [ ] `CLAIM: recurring reminder advances on guarded success`

**Lease Exclusivity and Heartbeat:**
- [ ] `LEASE: held by another worker skips processing`
- [ ] `LEASE: heartbeat RPC called during long processing` (uses `advanceTimersByTimeAsync`)
- [ ] `LEASE: release always called in finally block`
- [ ] `LEASE: RPC error logs and returns early`

**Missing Lease Rows (Cached Check):**
- [ ] `LEASE: missing lease row logs explicit error`
- [ ] `LEASE: existing lease row logs debug for held`
- [ ] `LEASE: existence check cached after first query`
- [ ] `LEASE: existence check error logs warning and assumes held`

**Concurrent Run Guards:**
- [ ] `LEASE: concurrent cycle skipped when already running`
- [ ] `LEASE: cycle skipped when shutting down`

**Daily Jobs (Time-Gated):**
- [ ] `CLAIM: empty batch triggers daily jobs when past cutoff`
- [ ] `CLAIM: empty batch skips daily jobs when before cutoff`

### DST Tests Must Cover:

- [ ] `DST: spring-forward 02:30 shifts to 03:30 America/New_York` (assert UTC: `2025-03-09T07:30:00.000Z`)
- [ ] `DST: spring-forward 02:00 shifts to 03:00 America/New_York`
- [ ] `DST: spring-forward Europe/London 01:30 shifts to 02:30`
- [ ] `DST: fall-back 01:30 uses later occurrence (default)` (assert UTC: `2025-11-02T06:30:00.000Z`)
- [ ] `DST: fall-back 01:30 uses earlier occurrence via localToUtc` (assert UTC: `2025-11-02T05:30:00.000Z`)
- [ ] `DST: fall-back Europe/London 01:30 uses later occurrence`
- [ ] `DST: America/Phoenix no shift on March 9`
- [ ] `DST: America/Phoenix no shift on November 2`
- [ ] `DST: DAILY recurrence crosses spring-forward`
- [ ] `DST: DAILY recurrence crosses fall-back`
- [ ] `DST: WEEKLY recurrence on spring-forward day`
- [ ] `DST: WEEKLY recurrence on fall-back day`
- [ ] `DST: WEEKLY interval=2 Mon/Wed/Fri mid-week correctness`
- [ ] `DST: WEEKLY interval=2 Mon/Wed/Fri end-of-week correctness`
- [ ] `DST: snooze into nonexistent time shifts forward`

---

## Assumptions

1. **vitest** is already configured and working in `telephony/`
2. Supabase RPC contracts are correct (tests validate telephony behavior, not DB semantics)
3. Luxon's IANA timezone database is reliable for historical dates
4. No real database or Twilio connections needed for these tests
5. The `__test__` export pattern is acceptable for this codebase

---

## Dependencies

- `vitest` (already installed in telephony)
- `luxon` (already used for timezone handling)
- No new dependencies required

---

## Review Checklist

Before considering implementation complete:

1. [ ] All scenario coverage checkboxes above are checked
2. [ ] Tests use correct prefixes (DST:/LEASE:/CLAIM:)
3. [ ] Tests use `vi.hoisted()` pattern for mocks referenced in `vi.mock()` factories
3. [ ] No real network calls or database connections
4. [ ] Fake timers used correctly (reset in afterEach via `resetState()`)
5. [ ] All DST assertions use explicit UTC ISO strings
6. [ ] `afterDate` parameters use JS `Date`, not Luxon `DateTime`
7. [ ] `globalThis.fetch` is stubbed via `vi.stubGlobal('fetch', fetchMock)`
8. [ ] Tests calling `processSchedule`/`processReminder` mock env.js and line-lookup.js
9. [ ] Any discovered bugs have minimal surgical fixes with tests
10. [ ] Shared mock utility matches actual query builder usage
11. [ ] `resetState()` clears intervals before dropping references (prevents leaks)
12. [ ] Heartbeat tests use `vi.advanceTimersByTimeAsync()` (not sync version)
13. [ ] Daily job tests set explicit `vi.setSystemTime()` past cutoffs
14. [ ] Reminder updates include `.eq('processing_claimed_by', WORKER_ID)` guard
15. [ ] Lease existence check is cached per leaseId
16. [ ] ALL `ultaura_lines.next_scheduled_call_at` updates gated on `completeScheduleWithResult() === true`
17. [ ] `releaseReminderClaim` checks boolean and logs warning on claim-loss
18. [ ] All tests pass in CI
