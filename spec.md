# Specification: Sensitive Data Removal from ultaura_call_events

**Status**: Ready for Implementation
**Priority**: CRITICAL - ASAP
**Type**: Security/Privacy Fix

---

## 1. Executive Summary

### Problem Statement
The `ultaura_call_events` table currently stores sensitive user content (memory values, reminder messages, safety signals, raw tool arguments) in plaintext JSONB payloads. This violates the "insights without transcripts" privacy model and HIPAA-adjacent posture.

### Impact
- **High Severity**: Breaks privacy expectations
- **High Likelihood**: Currently happening in production

### Symptoms
- Call event payloads contain:
  - Memory values (personal information, health details)
  - Reminder message content
  - Safety signals with distress keywords/user language
  - Raw tool arguments from Grok

### Solution Overview
1. Define strict allowlist schemas per event type/tool - store **metadata only**
2. Create admin-only debug table with 7-day retention for full unredacted data
3. Delete all historical call_events (after encrypted backup)
4. Add admin dashboard page for viewing debug logs

---

## 2. Technical Requirements

### 2.1 Current State Analysis

#### Affected Files

**Primary - Event Recording:**
- `/telephony/src/websocket/media-stream.ts` (line 229) - Records tool calls with unredacted args
- `/telephony/src/services/call-session.ts` (lines 370-386) - `recordCallEvent()` function

**Tool Handlers Storing Sensitive Data:**
- `/telephony/src/routes/tools/update-memory.ts` - Stores `previousValue`, `newValue` in plaintext
- `/telephony/src/routes/tools/store-memory.ts` - Stores memory key and type
- `/telephony/src/routes/tools/safety-event.ts` - Records safety tier
- `/telephony/src/routes/tools/set-reminder.ts` - Records reminder metadata
- `/telephony/src/routes/tools/edit-reminder.ts` - Records reminder changes

**Database:**
- `/supabase/migrations/20241220000001_ultaura_schema.sql` - Table definition (lines 177-185)

#### Current Table Schema
```sql
create table ultaura_call_events (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references ultaura_call_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('dtmf', 'tool_call', 'state_change', 'error', 'safety_tier')),
  payload jsonb
);
```

#### Current RLS Policy
```sql
create policy "Users can view call events for their accounts"
  on ultaura_call_events for select
  using (
    call_session_id in (
      select id from ultaura_call_sessions where can_access_ultaura_account(account_id)
    )
  );
```

### 2.2 Target State

#### New Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                      TELEPHONY SERVER                            │
│                                                                  │
│  Tool Call → sanitizePayload() → recordCallEvent() (metadata)   │
│      │                                                           │
│      └────────────────→ recordDebugEvent() (full data)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATABASE                                  │
│                                                                  │
│  ultaura_call_events          │  ultaura_debug_logs             │
│  ├─ Metadata only             │  ├─ Full unredacted data        │
│  ├─ User-accessible (RLS)     │  ├─ Admin-only (@ultaura.com)   │
│  └─ No retention policy       │  └─ 7-day auto-deletion         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Details

### 3.1 New Database Table: `ultaura_debug_logs`

**Migration file:** `supabase/migrations/YYYYMMDDHHMMSS_create_debug_logs.sql`

```sql
-- Create debug logs table for admin-only access
create table ultaura_debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_session_id uuid references ultaura_call_sessions(id) on delete cascade,
  account_id uuid references ultaura_accounts(id) on delete cascade,
  event_type text not null,
  tool_name text,
  payload jsonb not null,
  metadata jsonb -- For additional context (line_id, etc.)
);

-- Index for efficient querying
create index idx_debug_logs_created on ultaura_debug_logs(created_at desc);
create index idx_debug_logs_session on ultaura_debug_logs(call_session_id);
create index idx_debug_logs_account on ultaura_debug_logs(account_id);
create index idx_debug_logs_type on ultaura_debug_logs(event_type);
create index idx_debug_logs_tool on ultaura_debug_logs(tool_name);

-- Enable RLS
alter table ultaura_debug_logs enable row level security;

-- Admin-only access: users with @ultaura.com email
create policy "Admins can view debug logs"
  on ultaura_debug_logs for select
  using (
    (select email from auth.users where id = auth.uid()) like '%@ultaura.com'
  );

-- Service role can insert
create policy "Service role can insert debug logs"
  on ultaura_debug_logs for insert
  with check (true);

-- 7-day retention via pg_cron
-- Note: Requires pg_cron extension enabled in Supabase
select cron.schedule(
  'cleanup-debug-logs',
  '0 3 * * *', -- Run daily at 3 AM UTC
  $$delete from ultaura_debug_logs where created_at < now() - interval '7 days'$$
);
```

### 3.2 Allowlist Schema Definitions

**New file:** `/telephony/src/utils/event-sanitizer.ts`

```typescript
/**
 * Allowlist schemas for call event payloads.
 * ONLY these fields will be stored in ultaura_call_events.
 * Everything else goes to ultaura_debug_logs.
 */

// Type definitions for allowed payload shapes
export interface AllowedDtmfPayload {
  digit: string;
}

export interface AllowedToolCallPayload {
  tool: string;
  success: boolean;
  // Tool-specific allowed fields (IDs only, no content)
  reminderId?: string;
  scheduleId?: string;
  memoryKey?: string; // Key name only, NOT value
  action?: string; // For overage, opt-out actions
  planId?: string;
}

export interface AllowedStateChangePayload {
  state: string;
  reason?: string;
}

export interface AllowedErrorPayload {
  errorType: string;
  errorCode?: string;
  // NO error messages - those go to debug logs
}

export interface AllowedSafetyTierPayload {
  tier: 'low' | 'medium' | 'high';
  actionTaken: string;
  // NO signals or keywords - those stay in safety_events table
}

// Tool-specific allowlists
const TOOL_ALLOWLISTS: Record<string, string[]> = {
  // Reminder tools - only IDs
  'set_reminder': ['tool', 'success', 'reminderId'],
  'edit_reminder': ['tool', 'success', 'reminderId'],
  'pause_reminder': ['tool', 'success', 'reminderId'],
  'resume_reminder': ['tool', 'success', 'reminderId'],
  'snooze_reminder': ['tool', 'success', 'reminderId', 'snoozeMinutes'],
  'cancel_reminder': ['tool', 'success', 'reminderId'],
  'list_reminders': ['tool', 'success', 'reminderCount'],

  // Memory tools - key name only, NO values
  'store_memory': ['tool', 'success', 'memoryKey', 'memoryType'],
  'update_memory': ['tool', 'success', 'memoryKey', 'action'],
  'forget_memory': ['tool', 'success'],
  'mark_private': ['tool', 'success'],

  // Schedule tools
  'schedule_call': ['tool', 'success', 'scheduleId', 'mode'],

  // Billing tools
  'choose_overage_action': ['tool', 'success', 'action'],
  'request_upgrade': ['tool', 'success', 'planId'],

  // Privacy tools
  'opt_out': ['tool', 'success', 'source'],

  // Safety tools
  'log_safety_concern': ['tool', 'success', 'tier', 'actionTaken'],
};

// Default allowlist for unknown tools
const DEFAULT_TOOL_ALLOWLIST = ['tool', 'success'];

/**
 * Sanitizes a payload to only include allowed fields.
 * Returns both the sanitized payload and stripped fields for logging.
 */
export function sanitizePayload(
  eventType: 'dtmf' | 'tool_call' | 'state_change' | 'error' | 'safety_tier',
  payload: Record<string, unknown>
): { sanitized: Record<string, unknown>; stripped: Record<string, unknown> } {
  const sanitized: Record<string, unknown> = {};
  const stripped: Record<string, unknown> = {};

  let allowlist: string[];

  switch (eventType) {
    case 'dtmf':
      allowlist = ['digit'];
      break;

    case 'tool_call':
      const toolName = payload.tool as string;
      allowlist = TOOL_ALLOWLISTS[toolName] || DEFAULT_TOOL_ALLOWLIST;
      break;

    case 'state_change':
      allowlist = ['state', 'reason'];
      break;

    case 'error':
      allowlist = ['errorType', 'errorCode'];
      break;

    case 'safety_tier':
      allowlist = ['tier', 'actionTaken'];
      break;

    default:
      allowlist = [];
  }

  for (const [key, value] of Object.entries(payload)) {
    if (allowlist.includes(key)) {
      sanitized[key] = value;
    } else {
      stripped[key] = value;
    }
  }

  return { sanitized, stripped };
}

/**
 * Checks if any fields were stripped and returns info for logging/metrics.
 */
export function getStrippedFieldsInfo(
  stripped: Record<string, unknown>
): { hasStripped: boolean; fieldNames: string[] } {
  const fieldNames = Object.keys(stripped);
  return {
    hasStripped: fieldNames.length > 0,
    fieldNames,
  };
}
```

### 3.3 Updated recordCallEvent Function

**Modify:** `/telephony/src/services/call-session.ts`

```typescript
import { sanitizePayload, getStrippedFieldsInfo } from '../utils/event-sanitizer';

/**
 * Records a sanitized call event (metadata only) and optionally
 * a debug event with full data for admin investigation.
 */
export async function recordCallEvent(
  sessionId: string,
  type: 'dtmf' | 'tool_call' | 'state_change' | 'error' | 'safety_tier',
  payload?: Record<string, unknown>,
  options?: { skipDebugLog?: boolean }
): Promise<void> {
  const supabase = getSupabaseClient();

  if (!payload) {
    // No payload, just record the event type
    const { error } = await supabase.from('ultaura_call_events').insert({
      call_session_id: sessionId,
      type,
      payload: null,
    });
    if (error) {
      logger.error({ error, sessionId, type }, 'Failed to record call event');
    }
    return;
  }

  // Sanitize the payload
  const { sanitized, stripped } = sanitizePayload(type, payload);
  const { hasStripped, fieldNames } = getStrippedFieldsInfo(stripped);

  // Log warning if fields were stripped (for monitoring)
  if (hasStripped) {
    logger.warn({
      sessionId,
      type,
      strippedFields: fieldNames,
      // Prepare for future metrics emission
      metric: 'call_event_fields_stripped',
      metricValue: fieldNames.length,
    }, 'Fields stripped from call event payload');
  }

  // Insert sanitized event to user-accessible table
  const { error: eventError } = await supabase.from('ultaura_call_events').insert({
    call_session_id: sessionId,
    type,
    payload: Object.keys(sanitized).length > 0 ? sanitized : null,
  });

  if (eventError) {
    logger.error({ error: eventError, sessionId, type }, 'Failed to record call event');
  }

  // Insert full payload to admin debug table
  if (!options?.skipDebugLog) {
    await recordDebugEvent(sessionId, type, payload);
  }
}

/**
 * Records full unredacted event data to admin-only debug table.
 */
export async function recordDebugEvent(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabaseClient();

  // Get account_id and tool_name for filtering
  let accountId: string | null = null;
  let toolName: string | null = null;

  try {
    const { data: session } = await supabase
      .from('ultaura_call_sessions')
      .select('account_id')
      .eq('id', sessionId)
      .single();

    accountId = session?.account_id || null;
  } catch {
    // Session lookup failed, continue without account_id
  }

  if (payload.tool) {
    toolName = payload.tool as string;
  }

  const { error } = await supabase.from('ultaura_debug_logs').insert({
    call_session_id: sessionId,
    account_id: accountId,
    event_type: eventType,
    tool_name: toolName,
    payload,
    metadata: metadata || null,
  });

  if (error) {
    logger.error({ error, sessionId, eventType }, 'Failed to record debug event');
  }
}
```

### 3.4 Update Tool Handlers

Each tool handler needs to be updated to:
1. Pass a `success: boolean` field
2. Remove sensitive content from the recorded payload
3. Use appropriate field names matching the allowlist

**Example - update-memory.ts:**

```typescript
// BEFORE (lines 59-64):
await recordCallEvent(callSessionId, 'tool_call', {
  tool: 'update_memory',
  key: existingKey,
  action: 'created',
  newValue,  // SENSITIVE - should not be here
});

// AFTER:
await recordCallEvent(callSessionId, 'tool_call', {
  tool: 'update_memory',
  success: true,
  memoryKey: existingKey,
  action: 'created',
  // newValue is automatically stripped and sent to debug logs
});
```

**Files to update:**
- `/telephony/src/routes/tools/update-memory.ts` - Remove `previousValue`, `newValue`
- `/telephony/src/routes/tools/store-memory.ts` - Remove value, keep only key and type
- `/telephony/src/routes/tools/set-reminder.ts` - Remove `dueAt` details, keep only ID
- `/telephony/src/routes/tools/edit-reminder.ts` - Remove change details
- `/telephony/src/routes/tools/safety-event.ts` - Keep tier only
- `/telephony/src/routes/tools/schedule-call.ts` - Remove time details
- `/telephony/src/routes/tools/snooze-reminder.ts` - Keep ID and snooze minutes
- All other tool handlers - Add `success: true/false` field

### 3.5 Update media-stream.ts

**Modify:** `/telephony/src/websocket/media-stream.ts` (around line 229)

```typescript
// BEFORE:
await recordCallEvent(callSessionId, 'tool_call', { tool: toolName, args });

// AFTER:
await recordCallEvent(callSessionId, 'tool_call', {
  tool: toolName,
  success: true, // or false if tool failed
  ...extractAllowedArgs(toolName, args),
});

// The full args are automatically logged to debug table by recordCallEvent
```

### 3.6 Migration Script: Export and Delete Historical Data

**New file:** `/supabase/migrations/YYYYMMDDHHMMSS_cleanup_call_events.sql`

```sql
-- This migration:
-- 1. Creates a temporary export table
-- 2. Copies all data to it
-- 3. Truncates the original table
-- 4. The export will be extracted and encrypted via a separate script

-- Step 1: Create export table
create table ultaura_call_events_export_backup (
  like ultaura_call_events including all
);

-- Step 2: Copy all existing data
insert into ultaura_call_events_export_backup
select * from ultaura_call_events;

-- Step 3: Record backup metadata
create table if not exists ultaura_migration_log (
  id uuid primary key default gen_random_uuid(),
  migration_name text not null,
  executed_at timestamptz not null default now(),
  record_count bigint,
  notes text
);

insert into ultaura_migration_log (migration_name, record_count, notes)
select
  'call_events_privacy_cleanup',
  count(*),
  'Pre-deletion backup created in ultaura_call_events_export_backup'
from ultaura_call_events;

-- Step 4: Truncate original table
truncate table ultaura_call_events;
```

**Export Script:** `/scripts/export-call-events-backup.ts`

```typescript
/**
 * Export call_events backup to encrypted JSON in Supabase Storage.
 * Run this AFTER the migration but BEFORE dropping the backup table.
 */
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

async function exportAndEncryptBackup() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all backup data
  const { data, error } = await supabase
    .from('ultaura_call_events_export_backup')
    .select('*');

  if (error) throw error;

  // Encrypt with AES-256-GCM
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  // Create encrypted package
  const package = JSON.stringify({
    encrypted,
    iv: iv.toString('base64'),
    authTag,
    recordCount: data.length,
    exportedAt: new Date().toISOString(),
  });

  // Upload to Supabase Storage
  const filename = `call-events-backup-${Date.now()}.enc.json`;
  const { error: uploadError } = await supabase.storage
    .from('backups')
    .upload(filename, package, {
      contentType: 'application/json',
    });

  if (uploadError) throw uploadError;

  // Save encryption key separately (print to console for secure storage)
  console.log('=== ENCRYPTION KEY (STORE SECURELY) ===');
  console.log(key.toString('base64'));
  console.log('=== END KEY ===');
  console.log(`Backup uploaded to: backups/${filename}`);
  console.log(`Record count: ${data.length}`);
}

exportAndEncryptBackup().catch(console.error);
```

### 3.7 Safety Events Review

The `ultaura_safety_events` table stores `signals` JSONB with distress keywords. Per requirements, these should **stay in place** for legitimate safety oversight, but with proper access controls.

**Verify existing RLS policy in migration:**

```sql
-- Verify safety_events RLS is properly configured
-- Users should only see safety events for their accounts
-- This query checks the existing policy

-- If needed, tighten the policy:
drop policy if exists "Users can view safety events for their accounts" on ultaura_safety_events;

create policy "Users can view safety events for their accounts"
  on ultaura_safety_events for select
  using (
    account_id in (
      select account_id from ultaura_accounts
      where can_access_ultaura_account(account_id)
    )
  );
```

---

## 4. Admin Dashboard Page

### 4.1 New Route Structure

**New files:**
- `/src/app/dashboard/(app)/admin/debug-logs/page.tsx`
- `/src/app/dashboard/(app)/admin/debug-logs/components/DebugLogTable.tsx`
- `/src/app/dashboard/(app)/admin/debug-logs/components/DebugLogFilters.tsx`

### 4.2 Server Actions

**New file:** `/src/lib/ultaura/admin-actions.ts`

```typescript
'use server';

import { getSupabaseServerClient } from '~/lib/supabase/server';
import { redirect } from 'next/navigation';

/**
 * Check if current user is an admin (has @ultaura.com email)
 */
export async function isUltauraAdmin(): Promise<boolean> {
  const client = await getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user?.email) return false;
  return user.email.endsWith('@ultaura.com');
}

/**
 * Require admin access or redirect
 */
export async function requireAdmin(): Promise<void> {
  const isAdmin = await isUltauraAdmin();
  if (!isAdmin) {
    redirect('/dashboard');
  }
}

/**
 * Fetch debug logs with filters
 */
export async function getDebugLogs(filters: {
  startDate?: string;
  endDate?: string;
  callSessionId?: string;
  eventType?: string;
  toolName?: string;
  accountId?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: DebugLog[]; count: number }> {
  await requireAdmin();

  const client = await getSupabaseServerClient();

  let query = client
    .from('ultaura_debug_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (filters.startDate) {
    query = query.gte('created_at', filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte('created_at', filters.endDate);
  }
  if (filters.callSessionId) {
    query = query.eq('call_session_id', filters.callSessionId);
  }
  if (filters.eventType) {
    query = query.eq('event_type', filters.eventType);
  }
  if (filters.toolName) {
    query = query.eq('tool_name', filters.toolName);
  }
  if (filters.accountId) {
    query = query.eq('account_id', filters.accountId);
  }

  query = query
    .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

  const { data, error, count } = await query;

  if (error) throw error;

  return { data: data || [], count: count || 0 };
}

export interface DebugLog {
  id: string;
  created_at: string;
  call_session_id: string | null;
  account_id: string | null;
  event_type: string;
  tool_name: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown> | null;
}
```

### 4.3 Page Component

**File:** `/src/app/dashboard/(app)/admin/debug-logs/page.tsx`

```tsx
import { requireAdmin, getDebugLogs } from '~/lib/ultaura/admin-actions';
import { DebugLogTable } from './components/DebugLogTable';
import { DebugLogFilters } from './components/DebugLogFilters';

export const metadata = {
  title: 'Debug Logs | Admin',
};

export default async function DebugLogsPage({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  await requireAdmin();

  const filters = {
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    callSessionId: searchParams.sessionId,
    eventType: searchParams.eventType,
    toolName: searchParams.toolName,
    accountId: searchParams.accountId,
    limit: 50,
    offset: parseInt(searchParams.offset || '0'),
  };

  const { data, count } = await getDebugLogs(filters);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Debug Logs</h1>
        <p className="text-muted-foreground">
          Admin-only view of full call event data. Auto-deleted after 7 days.
        </p>
      </div>

      <DebugLogFilters currentFilters={searchParams} />

      <DebugLogTable logs={data} totalCount={count} />
    </div>
  );
}
```

### 4.4 Filter Options

Standard filters to implement:
- **Date range**: Start date, End date (date pickers)
- **Call Session ID**: Text input (UUID)
- **Event Type**: Dropdown (dtmf, tool_call, state_change, error, safety_tier)
- **Tool Name**: Dropdown (dynamically populated from distinct values)
- **Account ID**: Text input (UUID)

---

## 5. Testing Requirements

### 5.1 Unit Tests

**File:** `/telephony/src/utils/__tests__/event-sanitizer.test.ts`

```typescript
describe('sanitizePayload', () => {
  describe('tool_call events', () => {
    it('should strip memory values from update_memory', () => {
      const payload = {
        tool: 'update_memory',
        memoryKey: 'favorite_food',
        previousValue: 'pizza',
        newValue: 'pasta',
        success: true,
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'update_memory',
        memoryKey: 'favorite_food',
        success: true,
      });
      expect(stripped).toEqual({
        previousValue: 'pizza',
        newValue: 'pasta',
      });
    });

    it('should strip reminder message from set_reminder', () => {
      const payload = {
        tool: 'set_reminder',
        reminderId: 'uuid-123',
        message: 'Take medication at 9am',
        dueAt: '2024-01-15T09:00:00Z',
        success: true,
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized.message).toBeUndefined();
      expect(stripped.message).toBe('Take medication at 9am');
    });

    it('should handle unknown tools with default allowlist', () => {
      const payload = {
        tool: 'unknown_future_tool',
        sensitiveData: 'should be stripped',
        success: true,
      };

      const { sanitized, stripped } = sanitizePayload('tool_call', payload);

      expect(sanitized).toEqual({
        tool: 'unknown_future_tool',
        success: true,
      });
      expect(stripped.sensitiveData).toBe('should be stripped');
    });
  });

  describe('safety_tier events', () => {
    it('should keep only tier and actionTaken', () => {
      const payload = {
        tier: 'high',
        actionTaken: 'suggested_911',
        signals: 'User mentioned self-harm',
      };

      const { sanitized, stripped } = sanitizePayload('safety_tier', payload);

      expect(sanitized.signals).toBeUndefined();
      expect(stripped.signals).toBe('User mentioned self-harm');
    });
  });

  describe('error events', () => {
    it('should keep only error type and code, strip message', () => {
      const payload = {
        errorType: 'grok_connection_failed',
        errorCode: 'WS_CLOSE_1006',
        errorMessage: 'Connection closed unexpectedly with user data...',
        stack: 'Error: at line 123...',
      };

      const { sanitized, stripped } = sanitizePayload('error', payload);

      expect(sanitized).toEqual({
        errorType: 'grok_connection_failed',
        errorCode: 'WS_CLOSE_1006',
      });
      expect(stripped.errorMessage).toBeDefined();
      expect(stripped.stack).toBeDefined();
    });
  });
});
```

### 5.2 Integration Tests

```typescript
describe('recordCallEvent integration', () => {
  it('should write sanitized data to call_events and full data to debug_logs', async () => {
    const sessionId = 'test-session-id';
    const payload = {
      tool: 'update_memory',
      memoryKey: 'health_condition',
      newValue: 'diabetes', // Should be stripped
      success: true,
    };

    await recordCallEvent(sessionId, 'tool_call', payload);

    // Check call_events has sanitized data
    const { data: callEvent } = await supabase
      .from('ultaura_call_events')
      .select('*')
      .eq('call_session_id', sessionId)
      .single();

    expect(callEvent.payload.newValue).toBeUndefined();
    expect(callEvent.payload.memoryKey).toBe('health_condition');

    // Check debug_logs has full data
    const { data: debugLog } = await supabase
      .from('ultaura_debug_logs')
      .select('*')
      .eq('call_session_id', sessionId)
      .single();

    expect(debugLog.payload.newValue).toBe('diabetes');
  });
});
```

### 5.3 Manual Testing Checklist

- [ ] Make a test call with memory updates - verify call_events shows metadata only
- [ ] Verify debug_logs contains full payload
- [ ] Test admin dashboard access with @ultaura.com email
- [ ] Test admin dashboard denial with non-admin email
- [ ] Verify 7-day retention by checking pg_cron job status
- [ ] Test all 16 tool handlers produce correctly sanitized events
- [ ] Verify safety events show tier only in call_events
- [ ] Test backup export script runs successfully
- [ ] Verify backup file is encrypted and uploadable

---

## 6. Deployment Plan

### Phase 1: Preparation (Day 1)
1. Create and test the event-sanitizer utility
2. Create and test the recordDebugEvent function
3. Update all tool handlers to use new payload format
4. Create admin dashboard page

### Phase 2: Database Migration (Day 1-2)
1. Deploy migration to create `ultaura_debug_logs` table
2. Deploy migration to create `ultaura_call_events_export_backup` table
3. Run export script to encrypt and upload backup
4. Deploy truncate migration

### Phase 3: Code Deployment (Day 2)
1. Deploy updated telephony server with sanitization
2. Deploy admin dashboard
3. Monitor for any stripped field warnings

### Phase 4: Cleanup (Day 3+)
1. Verify backup is accessible and decryptable
2. Drop `ultaura_call_events_export_backup` table
3. Monitor pg_cron job execution

---

## 7. Rollback Plan

If issues are discovered:

1. **Sanitization too aggressive**: Expand allowlist in event-sanitizer.ts
2. **Admin access broken**: Check email domain matching in RLS policy
3. **Debug logs not writing**: Check service role permissions
4. **Performance issues**: Add database indexes, optimize queries

The backup can be restored if needed:
```typescript
// Decrypt and restore backup
const decrypted = decrypt(encryptedPackage, key);
await supabase.from('ultaura_call_events').insert(decrypted);
```

---

## 8. Success Criteria

- [ ] No sensitive content (memory values, messages, signals) in `ultaura_call_events.payload`
- [ ] Full debug data available in `ultaura_debug_logs` for admin investigation
- [ ] Historical data successfully backed up and deleted
- [ ] Admin dashboard functional with @ultaura.com access control
- [ ] pg_cron job successfully deletes logs older than 7 days
- [ ] All existing functionality continues to work (calls, reminders, safety detection)
- [ ] Warning logs emitted when fields are stripped (for monitoring)

---

## 9. Open Questions / Future Considerations

1. **Metrics infrastructure**: When a metrics system is added, emit `call_event_fields_stripped` metric
2. **Audit logging**: Consider adding read access logging for the debug table
3. **Data retention policies**: Should call_events also have a retention policy?
4. **Encryption at rest**: Consider enabling Supabase column encryption for debug_logs
5. **GDPR/data export**: How do debug logs factor into data subject access requests?

---

## Appendix A: Complete File Change List

### New Files
- `/telephony/src/utils/event-sanitizer.ts`
- `/supabase/migrations/YYYYMMDDHHMMSS_create_debug_logs.sql`
- `/supabase/migrations/YYYYMMDDHHMMSS_cleanup_call_events.sql`
- `/scripts/export-call-events-backup.ts`
- `/src/lib/ultaura/admin-actions.ts`
- `/src/app/dashboard/(app)/admin/debug-logs/page.tsx`
- `/src/app/dashboard/(app)/admin/debug-logs/components/DebugLogTable.tsx`
- `/src/app/dashboard/(app)/admin/debug-logs/components/DebugLogFilters.tsx`
- `/telephony/src/utils/__tests__/event-sanitizer.test.ts`

### Modified Files
- `/telephony/src/services/call-session.ts` - Update recordCallEvent, add recordDebugEvent
- `/telephony/src/websocket/media-stream.ts` - Update tool call recording
- `/telephony/src/routes/tools/update-memory.ts` - Remove sensitive fields
- `/telephony/src/routes/tools/store-memory.ts` - Remove sensitive fields
- `/telephony/src/routes/tools/set-reminder.ts` - Add success field
- `/telephony/src/routes/tools/edit-reminder.ts` - Remove sensitive fields
- `/telephony/src/routes/tools/safety-event.ts` - Ensure tier-only recording
- All other tool handlers in `/telephony/src/routes/tools/` - Add success field

### Database Changes
- New table: `ultaura_debug_logs`
- New pg_cron job: `cleanup-debug-logs`
- Truncated table: `ultaura_call_events` (after backup)
- New Supabase Storage bucket: `backups` (if not exists)
