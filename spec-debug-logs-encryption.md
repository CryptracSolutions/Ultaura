# Spec: Debug Logs Encryption & Hardening

## Objective

Harden the `ultaura_debug_logs` table so it cannot become a plaintext PHI/PII sink, while preserving operational debugging value. Debug logs are admin-only but represent a high-risk leak surface because a single coding mistake could persist sensitive data in database backups indefinitely.

## Scope

- Encrypt debug log payloads at rest using the existing Account DEK envelope encryption
- Enforce payload sanitization at the code level
- Fix retention messaging mismatch (UI says 7 days, code deletes at 3 days)
- Add AAD binding to prevent ciphertext row swapping
- Provide admin UI decryption path

## Non-Goals

- Full HIPAA certification (this is HIPAA-adjacent hygiene)
- Encrypting `metadata` column (kept unencrypted for quick filtering)
- Per-line DEK for debug logs (logs are account-scoped, can include cross-line events)

---

## Current State Audit

### Database Schema
**File**: `supabase/migrations/20260208000001_create_debug_logs.sql`

```sql
create table if not exists ultaura_debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_session_id uuid references ultaura_call_sessions(id) on delete cascade,
  account_id uuid references ultaura_accounts(id) on delete cascade,
  event_type text not null,
  tool_name text,
  payload jsonb not null,  -- PLAINTEXT - the leak risk
  metadata jsonb
);
```

**RLS Policies**:
- Select: `email LIKE '%@ultaura.com'` OR `role = 'super-admin'`
- Insert/Delete: `service_role` only

**Note**: The RLS `LIKE '%@ultaura.com'` correctly requires emails ending with `@ultaura.com`. App code uses `endsWith('@ultaura.com')` which is equivalent.

### Write Paths
**File**: `telephony/src/services/call-session.ts:607-647`

```typescript
export async function recordDebugEvent(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>,  // Currently plaintext
  metadata?: Record<string, unknown>,
  options?: { accountId?: string | null; toolName?: string | null }
): Promise<void>
```

**Current Usage** (`media-stream.ts:423-435`):
```typescript
await recordDebugEvent(
  callSessionId,
  'tool_call',
  { tool: toolName, argsSummary: summarizeArgs(args) },  // Safe summary
  { line_id: line.id, phone_number_last4: phoneLast4 },
  { accountId: account.id, toolName }
);
```

The `summarizeArgs()` function (`telephony/src/utils/redact.ts:137-156`) creates safe summaries with only keys, types, and sizes—no actual values. This is currently safe, but the `payload jsonb` column accepts anything.

**Critical Note**: `recordCallEvent(..., { skipDebugLog: false })` in `call-session.ts:602-603` passes the raw `payload` directly to `recordDebugEvent()`, not a sanitized version. This is the primary vector for accidental PHI leakage.

### Read Path
**File**: `src/lib/ultaura/admin-actions.ts:48-96`

```typescript
export async function getDebugLogs(filters: Filters): Promise<{ data: DebugLog[]; count: number }> {
  // Verifies isUserAdmin() then returns payload as-is
}
```

### Retention
**File**: `telephony/src/scheduler/call-scheduler.ts:25`
```typescript
const DEBUG_LOG_RETENTION_MS = 3 * 24 * 60 * 60 * 1000;  // 3 days
```

**File**: `src/app/ultaura-admin/debug-logs/page.tsx:51`
```tsx
<div>Logs auto-delete after 7 days.</div>  // MISMATCH!
```

### Existing Security Measures
- `summarizeArgs()` prevents raw values in current logging
- `redactSensitive()` available for console logs
- `scripts/check-sensitive-logs.sh` CI script detects dangerous patterns
- Default `skipDebugLog: true` in `recordCallEvent()`

---

## Design Decisions

### A) Storage Strategy: **Encrypt payload at rest with safe summary column**

We will:
1. Add encrypted columns: `payload_ciphertext`, `payload_iv`, `payload_tag`, `payload_alg`, `payload_kid`
2. Add optional `payload_summary jsonb` for quick admin scanning without decryption
3. Keep the original `payload jsonb` column during dual-write transition
4. Eventually drop `payload` column after backfill

**Rationale**: This follows the proven pattern from `ultaura_call_insights` and provides defense-in-depth. Even if sanitization fails, the data is encrypted at rest.

### B) Key Choice: **Account DEK**

Use `getOrCreateAccountDEK()` from `telephony/src/services/account-encryption.ts`.

**Rationale**:
- Debug logs are account-scoped (not line-specific)
- Debug events can span multiple lines within an account
- Simpler key management than per-line DEK
- Consistent with insights encryption

### C) AAD Binding

Generate debug log UUID in code (not DB default) so AAD can bind to:

```typescript
function buildDebugLogAAD(
  accountId: string,
  callSessionId: string | null,
  debugLogId: string
): Buffer {
  return Buffer.from(JSON.stringify({
    account_id: accountId,
    call_session_id: callSessionId,
    debug_log_id: debugLogId,
    type: 'debug_log_payload',
  }), 'utf8');
}
```

This prevents ciphertext swapping between rows.

### D) Data Minimization: **Enforce safe summary + encrypt full payload**

1. `payload_summary jsonb` (unencrypted): Contains safe summarized data preserving debugging value
2. `payload_ciphertext` (encrypted): Contains the full payload for detailed debugging

**Smart Summary Strategy**: To avoid double-summarizing and losing debugging detail:
- If `payload` already contains `argsSummary` (from `summarizeArgs()`), preserve it directly
- Otherwise, apply `summarizeArgs()` to the payload

```typescript
function buildPayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  // If payload already has argsSummary from summarizeArgs(), preserve it
  if (payload.argsSummary && typeof payload.argsSummary === 'object') {
    return {
      tool: payload.tool,
      argsSummary: payload.argsSummary,  // Preserve detailed summary
    };
  }
  // Otherwise, summarize the raw payload
  return summarizeArgs(payload);
}
```

This preserves the detailed `{ type, size }` breakdown for tool calls instead of collapsing it into `{ argsSummary: { type: 'object', size: 42 } }`.

### E) Retention: **Make configurable via env, default 3 days**

Add `DEBUG_LOG_RETENTION_DAYS` env var (default: 3). UI reads this value dynamically so text and code never drift again. 3 days is appropriate for debug data:
- Short enough to limit exposure window
- Long enough for incident investigation
- Aligns with the code's security comment about short retention

### F) Plaintext Policy During Transition

**Critical**: During the dual-write window, the `payload jsonb` column must NEVER contain sensitive data. All writes must use only safe summaries:
- `payload` column: Safe summary only (output of `summarizeArgs()` or `{ _encrypted: true, summary: {...} }`)
- `payload_ciphertext`: Full payload (encrypted)

This ensures that even during transition, the stated objective "cannot become a plaintext PHI sink" is met.

---

## Schema Changes

### Migration 1: Add Encrypted Columns

```sql
-- Add encrypted payload columns (nullable during transition)
ALTER TABLE ultaura_debug_logs
  ADD COLUMN IF NOT EXISTS payload_ciphertext bytea,
  ADD COLUMN IF NOT EXISTS payload_iv bytea,
  ADD COLUMN IF NOT EXISTS payload_tag bytea,
  ADD COLUMN IF NOT EXISTS payload_alg text DEFAULT 'aes-256-gcm',
  ADD COLUMN IF NOT EXISTS payload_kid text DEFAULT 'kek_v1',
  ADD COLUMN IF NOT EXISTS payload_summary jsonb;
```

### Migration 2: Make Encrypted Columns Required (OPTIONAL - Future)

**Note**: This migration is OPTIONAL and should only be applied after careful consideration. Since:
- Encryption can fail (transient errors, missing account)
- We intentionally allow safe-summary-only rows (when `account_id` is null or encryption fails)
- The `payload` column always contains safe summaries regardless of encryption success

You may choose to never apply this migration, or apply it only after confirming all edge cases are handled.

```sql
-- OPTIONAL: Only apply after confirming encryption failures are rare
-- and you want to enforce ciphertext for all rows
ALTER TABLE ultaura_debug_logs
  ALTER COLUMN payload_ciphertext SET NOT NULL,
  ALTER COLUMN payload_iv SET NOT NULL,
  ALTER COLUMN payload_tag SET NOT NULL;
```

### Migration 3: Drop Plaintext Column (future PR)

```sql
ALTER TABLE ultaura_debug_logs DROP COLUMN payload;
```

---

## Code Changes

### 1. New File: `telephony/src/utils/debug-log-crypto.ts`

**SECURITY REQUIREMENT**: This module must NEVER log decrypted payloads or any payload content.
Only log IDs, error codes/types, and metadata. This is a hard requirement for HIPAA-adjacent hygiene.
Also avoid logging raw crypto buffers (`ciphertext`, `iv`, `tag`) and avoid logging raw error objects if they might contain request/context dumps; prefer logging `error.message`, `error.name`, and stable IDs.

```typescript
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptMemoryValue, decryptMemoryValue } from './encryption.js';
import { getOrCreateAccountDEK } from '../services/account-encryption.js';
import { logger } from '../server.js';

const DEBUG_LOG_ALG = 'aes-256-gcm';  // Lowercase, consistent with insights
const DEBUG_LOG_KID = 'kek_v1';

export interface EncryptedDebugPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
  alg: string;
  kid: string;
}

export function buildDebugLogAAD(
  accountId: string,
  callSessionId: string | null,
  debugLogId: string
): Buffer {
  return Buffer.from(JSON.stringify({
    account_id: accountId,
    call_session_id: callSessionId,
    debug_log_id: debugLogId,
    type: 'debug_log_payload',
  }), 'utf8');
}

export function encryptDebugPayloadWithDek(
  dek: Buffer,
  payload: Record<string, unknown>,
  aad: Buffer
): EncryptedDebugPayload {
  const { ciphertext, iv, tag } = encryptMemoryValue(dek, payload, aad);
  return { ciphertext, iv, tag, alg: DEBUG_LOG_ALG, kid: DEBUG_LOG_KID };
}

export function decryptDebugPayloadWithDek(
  dek: Buffer,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array },
  aad: Buffer
): Record<string, unknown> {
  return decryptMemoryValue(
    dek,
    Buffer.from(encrypted.ciphertext),
    Buffer.from(encrypted.iv),
    Buffer.from(encrypted.tag),
    aad
  ) as Record<string, unknown>;
}

export async function encryptDebugPayload(
  supabase: SupabaseClient,
  accountId: string,
  callSessionId: string | null,
  debugLogId: string,
  payload: Record<string, unknown>
): Promise<EncryptedDebugPayload> {
  // getOrCreateAccountDEK creates the DEK if it doesn't exist
  const dek = await getOrCreateAccountDEK(supabase, accountId);
  const aad = buildDebugLogAAD(accountId, callSessionId, debugLogId);
  return encryptDebugPayloadWithDek(dek, payload, aad);
}

export async function decryptDebugPayload(
  supabase: SupabaseClient,
  accountId: string,
  callSessionId: string | null,
  debugLogId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<Record<string, unknown> | null> {
  try {
    // NOTE: Prefer a "get existing DEK" read to avoid side effects (creating DEKs)
    // during admin/debug browsing. If `getOrCreateAccountDEK()` is used, ensure
    // this decrypt path is not called in hot paths and accept the side effect.
    const dek = await getOrCreateAccountDEK(supabase, accountId);
    const aad = buildDebugLogAAD(accountId, callSessionId, debugLogId);
    return decryptDebugPayloadWithDek(dek, encrypted, aad);
  } catch (err) {
    logger.error({ accountId, debugLogId }, 'Failed to decrypt debug payload');
    return null;  // Graceful failure for decrypt
  }
}
```

### 2. New File: `telephony/src/utils/payload-summary.ts`

Extracted to its own module for testability:

```typescript
import { summarizeArgs } from './redact.js';

/**
 * Build a payload summary that preserves debugging detail.
 * If payload already has argsSummary (from summarizeArgs()), preserve it.
 * Otherwise, summarize the raw payload.
 */
export function buildPayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  // If payload already has argsSummary from a prior summarizeArgs() call, preserve it
  if (payload.argsSummary && typeof payload.argsSummary === 'object') {
    return {
      tool: payload.tool,
      argsSummary: payload.argsSummary,  // Preserve detailed { type, size } breakdown
    };
  }
  // Otherwise, summarize the raw payload
  return summarizeArgs(payload);
}
```

### 3. Update: `telephony/src/services/call-session.ts`

```typescript
import crypto from 'crypto';
import { encryptDebugPayload } from '../utils/debug-log-crypto.js';
import { buildPayloadSummary } from '../utils/payload-summary.js';

export async function recordDebugEvent(
  sessionId: string,
  eventType: string,
  payload: Record<string, unknown>,
  metadata?: Record<string, unknown>,
  options?: { accountId?: string | null; toolName?: string | null }
): Promise<void> {
  const supabase = getSupabaseClient();

  let accountId = options?.accountId ?? null;
  const toolName =
    options?.toolName ??
    (typeof payload.tool === 'string' ? payload.tool : null);

  if (!accountId) {
    try {
      const { data: session } = await supabase
        .from('ultaura_call_sessions')
        .select('account_id')
        .eq('id', sessionId)
        .single();
      accountId = session?.account_id ?? null;
    } catch {
      accountId = null;
    }
  }

  // Generate UUID in code for AAD binding
  const debugLogId = crypto.randomUUID();

  // CRITICAL: Create safe summary - preserves detail for tool calls
  const payloadSummary = buildPayloadSummary(payload);

  // Encrypt full payload (only if we have an accountId)
  let encrypted: { ciphertext: Buffer; iv: Buffer; tag: Buffer; alg: string; kid: string } | null = null;
  if (accountId) {
    try {
      encrypted = await encryptDebugPayload(supabase, accountId, sessionId, debugLogId, payload);
    } catch (err) {
      logger.error({ error: err, sessionId, eventType }, 'Failed to encrypt debug payload');
      // Continue without encrypted payload - summary is still safe
    }
  }

  // CRITICAL: payload column contains ONLY safe summary, never raw payload
  // This ensures the table cannot become a plaintext PHI sink even during transition
  const safePayload = {
    _encrypted: encrypted !== null,
    summary: payloadSummary,
  };

  const { error } = await supabase.from('ultaura_debug_logs').insert({
    id: debugLogId,
    call_session_id: sessionId,
    account_id: accountId,
    event_type: eventType,
    tool_name: toolName,
    payload: safePayload,  // SAFE: Only summary, never raw data
    payload_ciphertext: encrypted?.ciphertext ?? null,
    payload_iv: encrypted?.iv ?? null,
    payload_tag: encrypted?.tag ?? null,
    payload_alg: encrypted?.alg ?? null,
    payload_kid: encrypted?.kid ?? null,
    payload_summary: payloadSummary,
    metadata: metadata || null,
  });

  if (error) {
    logger.error({ error, sessionId, eventType }, 'Failed to record debug event');
  }
}
```

### 4. Update: `src/lib/ultaura/admin-actions.ts`

```typescript
import { decryptDebugPayload } from '~/lib/ultaura/debug-log-decrypt';
import getLogger from '~/core/logger';

const logger = getLogger();

export async function getDebugLogs(
  filters: Filters
): Promise<{ data: DebugLog[]; count: number }> {
  // ... existing auth checks ...

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  // Decrypt payloads for display
  const decryptedLogs = await Promise.all(
    (data || []).map(async (log) => {
      // If encrypted columns exist, decrypt
      if (log.payload_ciphertext && log.payload_iv && log.payload_tag && log.account_id) {
        const decrypted = await decryptDebugPayload(
          adminClient,
          log.account_id,
          log.call_session_id,
          log.id,
          {
            ciphertext: log.payload_ciphertext,
            iv: log.payload_iv,
            tag: log.payload_tag,
          }
        );

        if (decrypted) {
          return {
            ...log,
            payload: decrypted,
            payload_encrypted: true,
          };
        } else {
          // Decryption failed - logged inside decryptDebugPayload
          return {
            ...log,
            payload: { _error: 'Unable to decrypt debug payload' },
            payload_summary: log.payload_summary,
            payload_encrypted: true,
            payload_decrypt_failed: true,
          };
        }
      }

      // Plaintext payload (legacy or encryption skipped)
      return {
        ...log,
        payload_encrypted: false,
      };
    })
  );

  return { data: decryptedLogs as DebugLog[], count: count || 0 };
}
```

### 5. New File: `src/lib/ultaura/debug-log-decrypt.ts`

Server-side decryption helper for Next.js (mirrors telephony pattern but uses Next.js Supabase client):

```typescript
import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import getLogger from '~/core/logger';

const logger = getLogger();
const ALGORITHM = 'aes-256-gcm';
const TAG_LENGTH = 16;

function getKEK(): Buffer {
  const kekHex = process.env.ULTAURA_ENCRYPTION_KEY;
  if (!kekHex || kekHex.length !== 64) {
    throw new Error('Invalid ULTAURA_ENCRYPTION_KEY');
  }
  return Buffer.from(kekHex, 'hex');
}

function unwrapDEK(wrapped: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const kek = getKEK();
  const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(wrapped), decipher.final()]);
}

async function getAccountDEK(adminClient: SupabaseClient, accountId: string): Promise<Buffer | null> {
  const { data, error } = await adminClient
    .from('ultaura_account_crypto_keys')
    .select('dek_wrapped, dek_wrap_iv, dek_wrap_tag')
    .eq('account_id', accountId)
    .single();

  if (error || !data) {
    logger.warn({ accountId }, 'No DEK found for account');
    return null;
  }

  return unwrapDEK(
    Buffer.from(data.dek_wrapped),
    Buffer.from(data.dek_wrap_iv),
    Buffer.from(data.dek_wrap_tag)
  );
}

function buildDebugLogAAD(
  accountId: string,
  callSessionId: string | null,
  debugLogId: string
): Buffer {
  return Buffer.from(JSON.stringify({
    account_id: accountId,
    call_session_id: callSessionId,
    debug_log_id: debugLogId,
    type: 'debug_log_payload',
  }), 'utf8');
}

export async function decryptDebugPayload(
  adminClient: SupabaseClient,
  accountId: string,
  callSessionId: string | null,
  debugLogId: string,
  encrypted: { ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }
): Promise<Record<string, unknown> | null> {
  try {
    const dek = await getAccountDEK(adminClient, accountId);
    if (!dek) {
      return null;
    }

    const aad = buildDebugLogAAD(accountId, callSessionId, debugLogId);

    const decipher = crypto.createDecipheriv(ALGORITHM, dek, Buffer.from(encrypted.iv), {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(Buffer.from(encrypted.tag));
    decipher.setAAD(aad);

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext)),
      decipher.final(),
    ]);

    return JSON.parse(plaintext.toString('utf8'));
  } catch (err) {
    // Log error without exposing any payload data
    logger.error({ debugLogId, accountId }, 'Failed to decrypt debug payload');
    return null;
  }
}
```

### 6. Update: `src/app/ultaura-admin/debug-logs/page.tsx`

Read retention from env and display dynamically:

```tsx
const retentionDays = parseInt(process.env.DEBUG_LOG_RETENTION_DAYS || '3', 10);

// In the component:
<div className="text-sm text-muted-foreground">
  Admin-only view of full call event payloads. Logs auto-delete after {retentionDays} day{retentionDays !== 1 ? 's' : ''}.
</div>
```

### 7. Update: `telephony/src/scheduler/call-scheduler.ts`

Read retention from env:

```typescript
const DEBUG_LOG_RETENTION_DAYS = parseInt(process.env.DEBUG_LOG_RETENTION_DAYS || '3', 10);
const DEBUG_LOG_RETENTION_MS = DEBUG_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
```

### 8. Update: `src/lib/ultaura/admin-types.ts`

```typescript
export interface DebugLog {
  id: string;
  created_at: string;
  call_session_id: string | null;
  account_id: string | null;
  event_type: string;
  tool_name: string | null;
  payload: Record<string, unknown>;
  payload_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  // Runtime flags from decryption
  payload_encrypted?: boolean;
  payload_decrypt_failed?: boolean;
}
```

### 9. Update: `src/app/ultaura-admin/debug-logs/components/DebugLogTable.tsx`

Add visual indicator for encrypted/decryption-failed state:

```tsx
{
  header: 'Payload',
  id: 'payload',
  cell: ({ row }) => {
    const { payload, payload_summary, payload_encrypted, payload_decrypt_failed } = row.original;

    if (payload_decrypt_failed) {
      return (
        <div className="text-destructive text-xs">
          [Unable to decrypt]
          {payload_summary && <pre className="mt-1">{JSON.stringify(payload_summary, null, 2)}</pre>}
        </div>
      );
    }

    return (
      <div>
        {payload_encrypted && <span className="text-xs text-muted-foreground mr-2">[Encrypted]</span>}
        {renderJsonCell(payload)}
      </div>
    );
  },
},
```

---

## Backfill Script Plan

### File: `telephony/scripts/backfill-debug-log-encryption.ts`

**Location**: Place in `telephony/scripts/` to cleanly import telephony utilities (ESM).
This matches the existing pattern for telephony scripts.

**Run command**: `cd telephony && npx tsx scripts/backfill-debug-log-encryption.ts`

```typescript
// Node.js script to encrypt existing plaintext debug logs
// Run with: cd telephony && npx tsx scripts/backfill-debug-log-encryption.ts
//
// Pagination strategy: Fetch N unencrypted rows, update them, loop until none remain.
// This avoids UUID cursor issues and is naturally idempotent.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
// Import from relative paths within telephony package
import { encryptDebugPayload } from '../src/utils/debug-log-crypto.js';
import { summarizeArgs } from '../src/utils/redact.js';

// Copy of buildPayloadSummary from call-session.ts (or import if exported)
function buildPayloadSummary(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload.argsSummary && typeof payload.argsSummary === 'object') {
    return { tool: payload.tool, argsSummary: payload.argsSummary };
  }
  return summarizeArgs(payload);
}

const BATCH_SIZE = 100;
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log(`Starting debug log encryption backfill (dry_run=${DRY_RUN})`);

  let processed = 0;
  let encrypted = 0;
  let skipped = 0;
  let failed = 0;

  while (true) {
    // Fetch batch of unencrypted logs (no cursor needed - we update then re-query)
    const { data: logs, error } = await supabase
      .from('ultaura_debug_logs')
      .select('id, account_id, call_session_id, payload')
      .is('payload_ciphertext', null)
      .not('account_id', 'is', null)  // Skip logs without account (can't encrypt)
      .limit(BATCH_SIZE);

    if (error) {
      console.error('Failed to fetch logs:', error);
      break;
    }

    if (!logs || logs.length === 0) {
      console.log('No more unencrypted logs to process');
      break;
    }

    for (const log of logs) {
      processed++;

      // Extract original payload (might be legacy raw or new safe format)
      const originalPayload = log.payload;
      if (!originalPayload || typeof originalPayload !== 'object') {
        skipped++;
        continue;
      }

      try {
        // For backfill, we encrypt whatever is in the payload column
        // New writes already use safe summaries, but legacy rows may have raw data
        const encryptedPayload = await encryptDebugPayload(
          supabase,
          log.account_id,
          log.call_session_id,
          log.id,
          originalPayload
        );

        // Create safe summary preserving argsSummary if present
        const payloadSummary = buildPayloadSummary(originalPayload);

        // Safe payload for the plaintext column going forward
        const safePayload = {
          _encrypted: true,
          _backfilled: true,
          summary: payloadSummary,
        };

        if (!DRY_RUN) {
          // Idempotency guard: only update if still unencrypted
          const { error: updateError } = await supabase
            .from('ultaura_debug_logs')
            .update({
              payload: safePayload,  // Replace raw with safe summary
              payload_ciphertext: encryptedPayload.ciphertext,
              payload_iv: encryptedPayload.iv,
              payload_tag: encryptedPayload.tag,
              payload_alg: encryptedPayload.alg,
              payload_kid: encryptedPayload.kid,
              payload_summary: payloadSummary,
            })
            .eq('id', log.id)
            .is('payload_ciphertext', null);  // Idempotency guard

          if (updateError) {
            console.error(`Failed to update log ${log.id}:`, updateError);
            failed++;
            continue;
          }
        }

        encrypted++;
      } catch (err) {
        console.error(`Failed to encrypt log ${log.id}:`, err);
        failed++;
      }

      if (processed % 100 === 0) {
        console.log(`Progress: processed=${processed}, encrypted=${encrypted}, skipped=${skipped}, failed=${failed}`);
      }
    }
  }

  console.log(`Backfill complete: processed=${processed}, encrypted=${encrypted}, skipped=${skipped}, failed=${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
```

**Features**:
- **Correct pagination**: Fetches unencrypted rows, updates them, loops until none remain
- **Idempotent**: Update includes `.is('payload_ciphertext', null)` guard
- **Replaces raw payload**: Backfill also sanitizes the plaintext column
- **Dry-run mode**: Set `DRY_RUN=true` for testing
- **Progress logging**: Reports every 100 rows
- **Exit code**: Non-zero on failures for CI integration

---

## Rollout Plan

### Phase 1: Add Columns (Non-Breaking)
1. Deploy Migration 1 (add encrypted columns)
2. No code changes yet - columns are nullable

### Phase 2: Deploy Safe-Write Code
1. Deploy updated `recordDebugEvent()` that:
   - Writes **only safe summary** to `payload` column (never raw data)
   - Writes encrypted full payload to `payload_ciphertext`
2. Deploy updated `getDebugLogs()` that decrypts ciphertext when available
3. Update admin UI to read retention from env
4. Update scheduler to read retention from env
5. Add `DEBUG_LOG_RETENTION_DAYS=3` to env config
6. Monitor for encryption errors in logs

**Critical**: From this point forward, no raw PHI/PII can enter the `payload` column.

### Phase 3: Backfill
1. Run backfill script in dry-run mode: `DRY_RUN=true npx tsx scripts/backfill-debug-log-encryption.ts`
2. Run backfill script for real
3. Verify: `SELECT COUNT(*) FROM ultaura_debug_logs WHERE payload_ciphertext IS NULL AND account_id IS NOT NULL` returns 0
4. Backfill also replaces legacy raw payloads with safe summaries

### Phase 4: Continue Safe Writes
No code changes needed - Phase 2 code already writes safe payloads.
The `payload` column continues to receive `{ _encrypted: true, summary: {...} }`.

### Phase 5: Drop Plaintext Column (Separate PR, Later)
1. Wait for all legacy data to age out (3 days minimum)
2. Deploy Migration 3 to drop `payload` column
3. Update code to stop writing to `payload`
4. Update types to remove `payload` field

**Note**: This phase can be delayed indefinitely since the `payload` column now only contains safe summaries.

---

## Failure Behavior

### Encryption Failure (Write Path)
- Log error but continue storing with safe summary only
- `payload` column receives `{ _encrypted: false, summary: {...} }`
- `payload_ciphertext` remains NULL
- Backfill can retry later if needed
- **No PHI exposed** - summary is always safe

### Decryption Failure (Admin UI Read Path)
- `decryptDebugPayload()` returns `null` on failure
- Show `[Unable to decrypt debug payload]` message
- Display `payload_summary` for triage
- Log error (without payload data) for investigation

### Missing Account DEK
- `getOrCreateAccountDEK()` auto-creates the DEK
- Write path: DEK created on first call, encryption succeeds
- Read path (rare edge case): Returns `null`, shows summary
- No silent failures - always logged

---

## Test Plan

### Unit Tests: `telephony/src/utils/__tests__/debug-log-crypto.test.ts`

Tests use the `*WithDek` helpers to avoid live DB dependencies (same pattern as `reminder-crypto.test.ts`):

```typescript
import {
  encryptDebugPayloadWithDek,
  decryptDebugPayloadWithDek,
  buildDebugLogAAD,
} from '../debug-log-crypto.js';
import { generateDEK } from '../crypto.js';

describe('debug-log-crypto', () => {
  const accountId = 'test-account-id';
  const sessionId = 'test-session-id';
  const logId = 'test-log-id';

  it('encrypts and decrypts payload correctly with WithDek helpers', () => {
    const dek = generateDEK();
    const payload = { tool: 'test', argsSummary: { foo: { type: 'string', size: 10 } } };
    const aad = buildDebugLogAAD(accountId, sessionId, logId);

    const encrypted = encryptDebugPayloadWithDek(dek, payload, aad);
    const decrypted = decryptDebugPayloadWithDek(dek, encrypted, aad);

    expect(decrypted).toEqual(payload);
  });

  it('throws on decryption with wrong AAD (wrong log ID)', () => {
    const dek = generateDEK();
    const payload = { tool: 'test' };
    const aad = buildDebugLogAAD(accountId, sessionId, logId);
    const encrypted = encryptDebugPayloadWithDek(dek, payload, aad);

    const wrongAad = buildDebugLogAAD(accountId, sessionId, 'wrong-log-id');

    expect(() =>
      decryptDebugPayloadWithDek(dek, encrypted, wrongAad)
    ).toThrow();
  });

  it('throws on decryption with wrong DEK', () => {
    const dek1 = generateDEK();
    const dek2 = generateDEK();
    const payload = { tool: 'test' };
    const aad = buildDebugLogAAD(accountId, sessionId, logId);

    const encrypted = encryptDebugPayloadWithDek(dek1, payload, aad);

    expect(() =>
      decryptDebugPayloadWithDek(dek2, encrypted, aad)
    ).toThrow();
  });

  it('builds correct AAD structure', () => {
    const aad = buildDebugLogAAD(accountId, sessionId, logId);
    const parsed = JSON.parse(aad.toString('utf8'));

    expect(parsed).toEqual({
      account_id: accountId,
      call_session_id: sessionId,
      debug_log_id: logId,
      type: 'debug_log_payload',
    });
  });
});
```

### Unit Tests: `telephony/src/utils/__tests__/payload-summary.test.ts`

Move `buildPayloadSummary` to its own util module for testability:

```typescript
import { buildPayloadSummary } from '../payload-summary.js';

describe('buildPayloadSummary', () => {
  it('preserves existing argsSummary for tool call payloads', () => {
    const toolCallPayload = {
      tool: 'store-memory',
      argsSummary: {
        memoryType: { type: 'string', size: 12 },
        key: { type: 'string', size: 8 },
        value: { type: 'string', size: 156 },
      },
    };

    const summary = buildPayloadSummary(toolCallPayload);

    // Should preserve the detailed argsSummary, not double-summarize it
    expect(summary).toEqual({
      tool: 'store-memory',
      argsSummary: {
        memoryType: { type: 'string', size: 12 },
        key: { type: 'string', size: 8 },
        value: { type: 'string', size: 156 },
      },
    });
  });

  it('summarizes raw payloads without argsSummary', () => {
    const rawPayload = { foo: 'bar', count: 42 };

    const summary = buildPayloadSummary(rawPayload);

    // Should apply summarizeArgs to create type/size summary
    expect(summary).toHaveProperty('foo');
    expect(summary.foo).toHaveProperty('type', 'string');
  });

  it('handles missing tool field gracefully', () => {
    const payload = {
      argsSummary: { key: { type: 'string', size: 5 } },
    };

    const summary = buildPayloadSummary(payload);

    expect(summary).toEqual({
      tool: undefined,
      argsSummary: { key: { type: 'string', size: 5 } },
    });
  });
});
```

### Integration Tests

1. **recordDebugEvent writes encrypted**: Insert via `recordDebugEvent()`, verify `payload_ciphertext` is not null
2. **getDebugLogs decrypts**: Insert encrypted log, call `getDebugLogs()`, verify payload is decrypted
3. **Fallback to summary-only**: Insert log with null ciphertext, verify `getDebugLogs()` returns it with `payload_encrypted: false`
4. **Backfill idempotency**: Run backfill twice, verify no errors
5. **Summary preserves argsSummary**: Insert tool call log, verify `payload_summary.argsSummary` has detailed breakdown

### CI Checks

1. Verify `scripts/check-sensitive-logs.sh` still passes
2. Add test for `buildPayloadSummary()` preserving argsSummary detail

---

## Operational Notes

### Retention
- Debug logs auto-delete after **`DEBUG_LOG_RETENTION_DAYS`** (default: 3 days)
- Configurable via env var to prevent UI/code drift
- Cleanup runs via `maybeCleanupDebugLogs()` in scheduler
- Retention applies to both encrypted and summary data

### Access Controls
- Admin UI requires `@ultaura.com` email OR `super-admin` role
- RLS enforces same check at database level
- Service role required for inserts (telephony only)

### Key Rotation
- Uses `kek_v1` key identifier
- Future key rotation follows same pattern as memories/insights
- Old data remains readable until retention deletes it

### Monitoring
- Log encryption failures to Sentry/observability
- Track `payload_ciphertext IS NULL WHERE account_id IS NOT NULL` as backfill metric
- Alert if encryption failure rate exceeds threshold

### Logging Guardrails (Implementation-Time Checklist)
- Never write plaintext payload values (or decrypted payload) to application logs.
- Never log `payload_ciphertext`, `payload_iv`, `payload_tag`, or any derived buffers.
- Prefer logging only stable identifiers (`debugLogId`, `callSessionId`, `accountId`, `event_type`, `tool_name`) and minimal error info (`error.name`/`error.message`).
- Treat `metadata` as potentially sensitive; keep it minimal (e.g., `line_id`, `phone_number_last4`) and avoid free-form user content.

### Key Side-Effects
- Avoid creating encryption keys as a side effect of *reading* debug logs. The Next.js decrypt helper already reads an existing wrapped DEK and returns `null` if missing.
- If you keep a telephony `decryptDebugPayload()` helper, do not use it in production read paths unless it is guaranteed not to create DEKs (or you explicitly accept the side effect).

### Environment Variables
```bash
# Required (existing)
ULTAURA_ENCRYPTION_KEY=  # 64 hex chars

# New (optional)
DEBUG_LOG_RETENTION_DAYS=3  # Default: 3
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDD_debug_logs_encryption.sql` | Add encrypted columns |
| `telephony/src/utils/debug-log-crypto.ts` | New file: encryption utilities |
| `telephony/src/utils/payload-summary.ts` | New file: buildPayloadSummary helper |
| `telephony/src/services/call-session.ts` | Update `recordDebugEvent()` to write safe payload |
| `telephony/src/scheduler/call-scheduler.ts` | Read `DEBUG_LOG_RETENTION_DAYS` from env |
| `src/lib/ultaura/debug-log-decrypt.ts` | New file: Next.js decryption helper |
| `src/lib/ultaura/admin-actions.ts` | Update `getDebugLogs()` to decrypt |
| `src/lib/ultaura/admin-types.ts` | Add new fields to `DebugLog` type |
| `src/app/ultaura-admin/debug-logs/page.tsx` | Read retention from env |
| `src/app/ultaura-admin/debug-logs/components/DebugLogTable.tsx` | Show encryption status |
| `src/database.types.ts` | Regenerate after migration |
| `src/lib/database.types.ts` | Regenerate after migration |
| `telephony/scripts/backfill-debug-log-encryption.ts` | New file: backfill script |
| `.env.ultaura.example` | Add `DEBUG_LOG_RETENTION_DAYS` |

---

## Verification

After implementation, verify the following:

1. **New writes are safe**: Insert a debug log via `recordDebugEvent()`, verify:
   - `payload` contains only `{ _encrypted: true, summary: {...} }` (no raw values)
   - `payload_ciphertext` is not null
   - `payload_summary` matches expected output of `summarizeArgs()`

2. **Decryption works**: Via admin UI, view the debug log, verify:
   - Full payload is decrypted and displayed
   - `[Encrypted]` indicator is shown

3. **Backfill works**:
   - Create a legacy-style log with raw payload (for testing)
   - Run backfill script
   - Verify payload is replaced with safe summary
   - Verify ciphertext columns are populated

4. **Retention is configurable**:
   - Set `DEBUG_LOG_RETENTION_DAYS=1`
   - Verify UI shows "1 day"
   - Verify scheduler uses 1 day for cleanup

5. **Failure cases**:
   - Test encryption failure (mock DEK retrieval failure)
   - Verify log is still created with safe payload, no ciphertext
   - Test decryption failure
   - Verify admin UI shows `[Unable to decrypt]` with summary

---

## Open Questions

None - all decisions made based on existing patterns and requirements.
