# Specification: Fix Sensitive Data Leaks in Debug Logging System

## Objective

Fix sensitive data leaks in the Ultaura telephony backend's debug logging system by:
1. Preventing raw tool arguments from being logged to `ultaura_debug_logs` table
2. Changing defaults to prevent accidental sensitive data logging
3. Adding CI guardrails to prevent future regressions
4. Reducing retention period for debug logs

## Scope

This specification covers changes to the telephony backend (`/telephony/`) only. The changes are security-focused and do not affect the call flow, tool functionality, or user-facing features.

---

## Technical Requirements

### Requirement 1: Redact Tool Arguments in Debug Logs

**Problem**: In `/telephony/src/websocket/media-stream.ts` (lines 367-386), the `onToolCall` handler logs raw tool arguments to `recordDebugEvent()`:

```typescript
// Current problematic code (line 374-386):
await recordDebugEvent(
  callSessionId,
  'tool_call',
  { tool: toolName, args },  // <-- RAW ARGS LEAKED
  {
    line_id: line.id,
    phone_number_last4: phoneLast4,
  },
  {
    accountId: account.id,
    toolName,
  }
);
```

Meanwhile, console logging on line 371 correctly uses `redactSensitive(args)`.

**Sensitive data exposed**: Tool arguments contain health mentions, memories, mood/cognitive data, relationship details, reminder messages, and other PII/PHI.

**Solution**: Create a `summarizeArgs()` utility function that generates a safe summary of arguments without exposing actual values.

### Requirement 2: Change `skipDebugLog` Default to `true`

**Problem**: In `/telephony/src/services/call-session.ts` (lines 591-593), `recordCallEvent()` calls `recordDebugEvent()` by default unless `skipDebugLog: true` is passed.

**Current behavior**:
- All 45 tool handlers already pass `{ skipDebugLog: true }` - GOOD
- But the default is `false`, meaning new code or forgotten flags could leak data

**Solution**: Change the default to `true` so debug logging must be explicitly opted-in.

### Requirement 3: Reduce Debug Log Retention

**Problem**: In `/telephony/src/scheduler/call-scheduler.ts` (lines 21-22, 146-168), debug logs are retained for 7 days:

```typescript
const DEBUG_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days
```

**Solution**: Reduce retention to 3 days to minimize exposure window for any leaked data.

### Requirement 4: Add CI Guardrails

**Problem**: No automated checks exist to prevent developers from accidentally logging sensitive data.

**Solution**: Create a shell script that scans for dangerous patterns and add it to the CI workflow.

---

## Implementation Details

### File 1: `/telephony/src/utils/redact.ts`

**Changes**:
1. Add new `summarizeArgs()` function
2. Add inline documentation explaining security rationale
3. Expand `SENSITIVE_KEYS` list

**Add at top of file (after existing imports)**:
```typescript
/**
 * SECURITY NOTE: This module provides data redaction utilities to prevent
 * sensitive information (PII, PHI, conversation content) from being logged
 * to debug tables or external systems.
 *
 * The summarizeArgs() function creates a safe summary of tool arguments
 * that preserves debugging value (key names, types, sizes) without exposing
 * actual values. This is critical because tool arguments may contain:
 * - Health information (medications, conditions)
 * - Memory content (personal stories, relationships)
 * - Mood/cognitive observations
 * - Reminder messages
 * - Relationship details
 */
```

**Add new SENSITIVE_KEYS** (expand existing Set on lines 47-68):
```typescript
const SENSITIVE_KEYS = new Set([
  // Existing keys...
  'transcript',
  'transcripts',
  'memory',
  'memories',
  'value',
  'new_value',
  'what_to_forget',
  'what_to_keep_private',
  'clarification',
  'mood_overall',
  'mood_intensity',
  'engagement_score',
  'social_need_level',
  'topics',
  'concerns',
  'needs_follow_up',
  'follow_up_reasons',
  'private_topics',
  'confidence_overall',
  'topic_code',
  // NEW keys to add:
  'message',
  'content',
  'text',
  'summary',
  'narrative',
  'args',
  'context',
  'response_given',
  'observation',
  'notes',
  'description',
]);
```

**Add new `summarizeArgs()` function** (add after `redactSensitive()` function, around line 137):
```typescript
/**
 * Creates a safe summary of tool arguments for debug logging.
 *
 * SECURITY: This function prevents sensitive data leakage by only exposing:
 * - Argument key names
 * - Data types (string, number, boolean, array, object, null, undefined)
 * - Approximate byte sizes for strings and arrays
 * - One level deep for nested objects (shown as 'object' type with total size)
 *
 * Example output:
 * {
 *   memoryType: { type: 'string', size: 12 },
 *   key: { type: 'string', size: 8 },
 *   value: { type: 'string', size: 156 },
 *   metadata: { type: 'object', size: 423 }
 * }
 *
 * @param args - The raw tool arguments to summarize
 * @returns A safe summary object suitable for debug logging
 */
export function summarizeArgs(
  args: Record<string, unknown>
): Record<string, { type: string; size?: number }> {
  const summary: Record<string, { type: string; size?: number }> = {};

  for (const [key, value] of Object.entries(args)) {
    summary[key] = summarizeValue(value);
  }

  return summary;
}

/**
 * Summarizes a single value, returning its type and approximate size.
 * For nested objects, only goes one level deep.
 */
function summarizeValue(value: unknown): { type: string; size?: number } {
  if (value === null) {
    return { type: 'null' };
  }

  if (value === undefined) {
    return { type: 'undefined' };
  }

  if (typeof value === 'string') {
    return { type: 'string', size: Buffer.byteLength(value, 'utf8') };
  }

  if (typeof value === 'number') {
    return { type: 'number' };
  }

  if (typeof value === 'boolean') {
    return { type: 'boolean' };
  }

  if (Array.isArray(value)) {
    // Calculate total size of array contents
    const size = estimateSize(value);
    return { type: 'array', size };
  }

  if (typeof value === 'object') {
    // For objects, just report total size (one level deep only)
    const size = estimateSize(value);
    return { type: 'object', size };
  }

  return { type: typeof value };
}

/**
 * Estimates the byte size of a value by JSON stringifying it.
 * Returns 0 if estimation fails (e.g., circular references).
 */
function estimateSize(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch {
    return 0;
  }
}
```

### File 2: `/telephony/src/websocket/media-stream.ts`

**Changes**: Update the `onToolCall` handler (lines 374-386) to use `summarizeArgs()` instead of raw `args`.

**Current code (lines 374-386)**:
```typescript
await recordDebugEvent(
  callSessionId,
  'tool_call',
  { tool: toolName, args },
  {
    line_id: line.id,
    phone_number_last4: phoneLast4,
  },
  {
    accountId: account.id,
    toolName,
  }
);
```

**Updated code**:
```typescript
import { redactSensitive, summarizeArgs } from '../utils/redact.js';

// ... in onToolCall handler ...

await recordDebugEvent(
  callSessionId,
  'tool_call',
  { tool: toolName, argsSummary: summarizeArgs(args) },
  {
    line_id: line.id,
    phone_number_last4: phoneLast4,
  },
  {
    accountId: account.id,
    toolName,
  }
);
```

**Import change** (line 19): Add `summarizeArgs` to the existing import:
```typescript
// Before:
import { redactSensitive } from '../utils/redact.js';

// After:
import { redactSensitive, summarizeArgs } from '../utils/redact.js';
```

### File 3: `/telephony/src/services/call-session.ts`

**Changes**:
1. Change `skipDebugLog` default to `true`
2. Add inline documentation explaining the security rationale

**Current code (lines 547-551)**:
```typescript
export async function recordCallEvent(
  sessionId: string,
  type: CallEventType,
  payload?: Record<string, unknown>,
  options?: { skipDebugLog?: boolean }
): Promise<void> {
```

**Updated code**:
```typescript
/**
 * Records a call event to the ultaura_call_events table.
 *
 * SECURITY: By default, debug logging is disabled (skipDebugLog: true) to prevent
 * accidental leakage of sensitive data. Debug events should only be recorded
 * when explicitly needed and after ensuring the payload is properly sanitized.
 *
 * @param sessionId - The call session ID
 * @param type - The event type (dtmf, tool_call, state_change, error, safety_tier)
 * @param payload - Optional event payload (will be sanitized before storage)
 * @param options.skipDebugLog - Skip recording to debug_logs table (default: true)
 */
export async function recordCallEvent(
  sessionId: string,
  type: CallEventType,
  payload?: Record<string, unknown>,
  options?: { skipDebugLog?: boolean }
): Promise<void> {
```

**Current code (lines 591-593)**:
```typescript
if (!options?.skipDebugLog) {
  await recordDebugEvent(sessionId, type, payload);
}
```

**Updated code**:
```typescript
// SECURITY: Default to skipping debug logs to prevent accidental sensitive data leakage.
// Only record to debug_logs if explicitly opted in with skipDebugLog: false.
if (options?.skipDebugLog === false) {
  await recordDebugEvent(sessionId, type, payload);
}
```

### File 4: `/telephony/src/scheduler/call-scheduler.ts`

**Changes**: Reduce debug log retention from 7 days to 3 days.

**Current code (line 22)**:
```typescript
const DEBUG_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
```

**Updated code**:
```typescript
// SECURITY: Short retention period to minimize exposure window for debug data.
// Debug logs may contain operational metadata that could be sensitive.
const DEBUG_LOG_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;
```

### File 5: `/scripts/check-sensitive-logs.sh` (NEW FILE)

**Create this new file**:
```bash
#!/usr/bin/env bash
#
# check-sensitive-logs.sh
#
# SECURITY: This script checks for potentially dangerous logging patterns
# that could leak sensitive data (PII, PHI, conversation content) to logs.
#
# Patterns checked:
# 1. Direct logging of 'args' to recordDebugEvent without summarization
# 2. Logging sensitive keys without redaction
# 3. skipDebugLog: false (explicit opt-in to debug logging should be reviewed)
#
# Exit codes:
# 0 - No issues found
# 1 - Potential sensitive data logging detected

set -euo pipefail

TELEPHONY_DIR="${1:-telephony/src}"
FOUND_ISSUES=0

echo "Checking for sensitive data logging patterns in $TELEPHONY_DIR..."
echo ""

# Pattern 1: Check for raw 'args' being passed to recordDebugEvent
# This catches: recordDebugEvent(..., { ...args }) or recordDebugEvent(..., { args: args })
# But should NOT flag: { argsSummary: summarizeArgs(args) }
echo "=== Checking for raw args in recordDebugEvent ==="
if grep -rn 'recordDebugEvent.*\bargs\b' "$TELEPHONY_DIR" | grep -v 'argsSummary' | grep -v 'summarizeArgs' | grep -v '\.test\.ts'; then
  echo "ERROR: Found recordDebugEvent calls with potentially raw 'args'"
  echo "       Use summarizeArgs(args) to create a safe summary instead."
  FOUND_ISSUES=1
else
  echo "OK: No raw args in recordDebugEvent"
fi
echo ""

# Pattern 2: Check for sensitive fields being logged without redaction
# These are fields that commonly contain PII/PHI
SENSITIVE_FIELDS="message|content|text|summary|narrative|transcript|memory|memories|value|context|response_given|observation"

echo "=== Checking for sensitive fields in console.log/logger calls ==="
if grep -rn "logger\.\(info\|debug\|warn\)\s*(" "$TELEPHONY_DIR" | grep -E "\b($SENSITIVE_FIELDS)\b" | grep -v 'redact' | grep -v '\.test\.ts' | head -20; then
  echo ""
  echo "WARNING: Found logger calls that may include sensitive fields."
  echo "         Ensure these are properly redacted using redactSensitive()."
  # This is a warning, not a blocking error - review needed
fi
echo ""

# Pattern 3: Check for explicit skipDebugLog: false
# This is intentional opt-in, but should be reviewed
echo "=== Checking for explicit debug log opt-in (skipDebugLog: false) ==="
OPTINS=$(grep -rn 'skipDebugLog:\s*false' "$TELEPHONY_DIR" 2>/dev/null | grep -v '\.test\.ts' || true)
if [ -n "$OPTINS" ]; then
  echo "INFO: Found explicit skipDebugLog: false (requires review):"
  echo "$OPTINS"
  echo ""
  echo "       These locations explicitly enable debug logging."
  echo "       Ensure payloads are properly sanitized."
  # Not blocking, but should be audited
fi
echo ""

# Pattern 4: Check for new tool handlers without skipDebugLog
echo "=== Checking for recordCallEvent without skipDebugLog ==="
if grep -rn "recordCallEvent(" "$TELEPHONY_DIR/routes/tools" 2>/dev/null | grep -v 'skipDebugLog' | grep -v '\.test\.ts' | head -10; then
  echo ""
  echo "WARNING: Found recordCallEvent calls without skipDebugLog option."
  echo "         The default is now skipDebugLog: true, but explicit is better."
fi
echo ""

if [ $FOUND_ISSUES -eq 1 ]; then
  echo "=============================================="
  echo "FAILED: Sensitive data logging issues detected"
  echo "=============================================="
  exit 1
fi

echo "=============================================="
echo "PASSED: No sensitive data logging issues found"
echo "=============================================="
exit 0
```

### File 6: `/.github/workflows/build.yml`

**Changes**: Add a new job for the sensitive logging check.

**Add after the existing `lint` job (around line 34)**:
```yaml
  sensitive-logs-check:
    name: Sensitive Logs Check
    runs-on: ${{ vars.RUNNER || 'ubuntu-latest' }}
    steps:
      - name: Cancel Previous Runs
        uses: styfle/cancel-workflow-action@0.12.1

      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Check for sensitive data logging
        run: |
          chmod +x scripts/check-sensitive-logs.sh
          ./scripts/check-sensitive-logs.sh telephony/src
```

### File 7: `/telephony/src/utils/__tests__/redact.test.ts` (NEW FILE)

**Create this new test file**:
```typescript
import { describe, it, expect } from 'vitest';
import { summarizeArgs, redactSensitive } from '../redact.js';

describe('summarizeArgs', () => {
  it('should summarize string arguments with byte size', () => {
    const args = {
      key: 'preferred_name',
      value: 'This is a longer string value',
    };

    const summary = summarizeArgs(args);

    expect(summary.key).toEqual({ type: 'string', size: 14 });
    expect(summary.value).toEqual({ type: 'string', size: 30 });
  });

  it('should summarize number arguments without size', () => {
    const args = {
      confidence: 0.95,
      count: 42,
    };

    const summary = summarizeArgs(args);

    expect(summary.confidence).toEqual({ type: 'number' });
    expect(summary.count).toEqual({ type: 'number' });
  });

  it('should summarize boolean arguments', () => {
    const args = {
      isRecurring: true,
      suggestReminder: false,
    };

    const summary = summarizeArgs(args);

    expect(summary.isRecurring).toEqual({ type: 'boolean' });
    expect(summary.suggestReminder).toEqual({ type: 'boolean' });
  });

  it('should summarize arrays with total size', () => {
    const args = {
      topics: ['health', 'family', 'hobbies'],
      items: [1, 2, 3, 4, 5],
    };

    const summary = summarizeArgs(args);

    expect(summary.topics.type).toBe('array');
    expect(summary.topics.size).toBeGreaterThan(0);
    expect(summary.items.type).toBe('array');
    expect(summary.items.size).toBeGreaterThan(0);
  });

  it('should summarize nested objects with total size (one level deep)', () => {
    const args = {
      metadata: {
        source: 'conversation',
        nested: {
          deep: 'value',
        },
      },
    };

    const summary = summarizeArgs(args);

    expect(summary.metadata.type).toBe('object');
    expect(summary.metadata.size).toBeGreaterThan(0);
    // Should NOT expose nested structure
    expect(summary).not.toHaveProperty('metadata.nested');
  });

  it('should handle null and undefined values', () => {
    const args = {
      nullValue: null,
      undefinedValue: undefined,
    };

    const summary = summarizeArgs(args);

    expect(summary.nullValue).toEqual({ type: 'null' });
    expect(summary.undefinedValue).toEqual({ type: 'undefined' });
  });

  it('should handle empty objects', () => {
    const args = {};

    const summary = summarizeArgs(args);

    expect(summary).toEqual({});
  });

  it('should not expose actual string values', () => {
    const sensitiveArgs = {
      message: 'Take your heart medication at 9am',
      value: 'My daughter Sarah lives in Boston',
      context: 'User mentioned feeling lonely today',
    };

    const summary = summarizeArgs(sensitiveArgs);

    // Verify no actual values are in the summary
    const summaryStr = JSON.stringify(summary);
    expect(summaryStr).not.toContain('medication');
    expect(summaryStr).not.toContain('Sarah');
    expect(summaryStr).not.toContain('Boston');
    expect(summaryStr).not.toContain('lonely');
  });

  it('should handle large nested objects efficiently', () => {
    const largeArgs = {
      memories: Array(100).fill({ key: 'test', value: 'x'.repeat(100) }),
      metadata: {
        nested1: { nested2: { nested3: 'deep' } },
      },
    };

    const summary = summarizeArgs(largeArgs);

    expect(summary.memories.type).toBe('array');
    expect(summary.memories.size).toBeGreaterThan(1000); // Should capture total size
    expect(summary.metadata.type).toBe('object');
  });

  it('should handle unicode strings correctly', () => {
    const args = {
      name: '日本語テキスト',
      emoji: '😀🎉👋',
    };

    const summary = summarizeArgs(args);

    // UTF-8 byte sizes should be accurate
    expect(summary.name.type).toBe('string');
    expect(summary.name.size).toBe(Buffer.byteLength('日本語テキスト', 'utf8'));
    expect(summary.emoji.type).toBe('string');
    expect(summary.emoji.size).toBe(Buffer.byteLength('😀🎉👋', 'utf8'));
  });

  it('should handle circular reference gracefully', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj; // Circular reference

    const args = { circular: obj };
    const summary = summarizeArgs(args);

    // Should not throw, and should return size of 0 for unparseable
    expect(summary.circular.type).toBe('object');
    expect(summary.circular.size).toBe(0);
  });
});

describe('redactSensitive', () => {
  it('should redact sensitive keys from SENSITIVE_KEYS set', () => {
    const data = {
      id: '123',
      message: 'This is sensitive',
      content: 'Also sensitive',
      text: 'And this too',
    };

    const redacted = redactSensitive(data);

    expect(redacted.id).toBe('123');
    expect(redacted.message).toBe('[REDACTED]');
    expect(redacted.content).toBe('[REDACTED]');
    expect(redacted.text).toBe('[REDACTED]');
  });

  it('should redact nested sensitive keys', () => {
    const data = {
      outer: {
        message: 'Nested sensitive',
        safe: 'This is fine',
      },
    };

    const redacted = redactSensitive(data);

    expect(redacted.outer.message).toBe('[REDACTED]');
    expect(redacted.outer.safe).toBe('This is fine');
  });
});
```

---

## Dependencies and Integrations

### Dependencies
- No new npm dependencies required
- Uses existing `vitest` for testing
- Uses existing `Buffer` from Node.js (already available)

### Integration Points
1. **media-stream.ts** imports `summarizeArgs` from `redact.ts`
2. **CI workflow** runs the new `check-sensitive-logs.sh` script
3. **call-scheduler.ts** cleanup job continues to run with new 3-day retention

---

## Edge Cases and Error Handling

### Edge Case 1: Circular References
The `summarizeArgs()` function handles circular references in objects by catching JSON.stringify errors and returning size of 0.

### Edge Case 2: Very Large Arguments
The function handles large arguments efficiently by only computing sizes without copying values.

### Edge Case 3: Missing or Invalid Arguments
- `null` and `undefined` values are handled explicitly with their type names
- Empty objects return empty summaries
- Non-object values at the top level are handled by the type checks

### Error Handling
- `estimateSize()` catches all exceptions from JSON.stringify and returns 0
- The function never throws - it always returns a valid summary object

---

## Testing Considerations

### Unit Tests
1. Run existing tests to ensure no regression: `cd telephony && npm test`
2. Run new redact tests: `cd telephony && npm test src/utils/__tests__/redact.test.ts`

### Manual Testing
1. Start telephony server in dev mode
2. Make a test call
3. Check `ultaura_debug_logs` table to verify:
   - Tool call events contain `argsSummary` not raw `args`
   - Summary shows types and sizes, not values

### CI Verification
1. Push changes to a branch
2. Verify the "Sensitive Logs Check" job passes
3. Intentionally break the check (add raw `args` to recordDebugEvent) and verify it fails

---

## Assumptions

1. **Existing skipDebugLog usage is correct**: All 45 tool handlers already use `skipDebugLog: true`, which is verified by grep showing 124 occurrences across 48 files.

2. **No external consumers of recordCallEvent rely on debug logging**: Changing the default to `true` should not break any functionality since debug logging is only for internal debugging.

3. **Retention reduction is acceptable**: Reducing from 7 to 3 days should be sufficient for debugging purposes while reducing exposure window.

4. **Existing data will age out naturally**: The 3-day retention cleanup will naturally purge any previously leaked data within 3 days.

5. **CI runners have bash available**: The check script uses bash and common Unix tools (grep).

---

## Files to Modify (Summary)

| File | Action | Description |
|------|--------|-------------|
| `/telephony/src/utils/redact.ts` | Modify | Add `summarizeArgs()` function and expand `SENSITIVE_KEYS` |
| `/telephony/src/websocket/media-stream.ts` | Modify | Fix `onToolCall` handler to use `summarizeArgs()` |
| `/telephony/src/services/call-session.ts` | Modify | Change `skipDebugLog` default to `true` |
| `/telephony/src/scheduler/call-scheduler.ts` | Modify | Reduce retention from 7 to 3 days |
| `/scripts/check-sensitive-logs.sh` | Create | New CI check script |
| `/.github/workflows/build.yml` | Modify | Add sensitive logs check job |
| `/telephony/src/utils/__tests__/redact.test.ts` | Create | Unit tests for `summarizeArgs()` |

---

## Implementation Order

1. Add `summarizeArgs()` function to `redact.ts` with expanded `SENSITIVE_KEYS`
2. Update import in `media-stream.ts` and fix `onToolCall` handler
3. Change `skipDebugLog` default in `call-session.ts`
4. Reduce retention in `call-scheduler.ts`
5. Create CI check script
6. Update CI workflow
7. Add unit tests
8. Test manually and via CI
