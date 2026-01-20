---
title: Reminder Message Encryption
status: Draft
---

# Reminder Message Encryption Implementation Spec

## 1. Objective

Encrypt reminder message content at rest using the existing envelope encryption pattern (AES-256-GCM) with **Line DEKs** (same policy as memories), and remove the denormalized plaintext copy currently stored in `ultaura_call_sessions.reminder_message`.

Preserve functionality:
- Dashboard can create/edit/list reminders (decrypted display server-side).
- Telephony can speak reminders (voice `list_reminders`) and deliver reminder calls (Grok prompt).
- Scheduler can initiate reminder calls without persisting reminder plaintext into call session rows.

## 2. Scope

### In scope
- Add encrypted columns to `ultaura_reminders` and store encrypted reminder message there.
- Transitional **dual-read** until cleanup: decrypt if ciphertext exists; otherwise fallback to plaintext `message`.
- Remove `ultaura_call_sessions.reminder_message` usage and ultimately drop the column.
- Telephony decrypts in-process only (never persists plaintext message content to DB/logs).
- Dashboard decrypts server-side only (never sends ciphertext to the browser).
- One-time backfill script to encrypt existing reminders.
- Reminder events (UI activity feed) continues showing message by decrypting.
- Reminder-call voicemail is **generic** (no decrypted reminder content in voicemail).

### Out of scope
- Encrypting debug log payloads (`ultaura_debug_logs`) (separate spec).
- Audit logging of decrypt events.
- Unencrypted “preview” columns.
- Reversible migration (rollback via backup/restore only).

## 3. Constraints & Key Model

### 3.1 Key hierarchy

```
KEK (ULTAURA_ENCRYPTION_KEY env var)
└── Account DEK (ultaura_account_crypto_keys)  [wrapped in DB; service-role only]
    └── Line DEK (ultaura_line_crypto_keys)   [wrapped in DB; service-role only]
```

Reminders use **the same DEK selection policy as memories**:
- Telephony uses `getMemoryDEK(supabase, accountId, lineId)` from `telephony/src/services/line-encryption.ts`.
  - Legacy lines → Account DEK
  - Newer lines → Line DEK (created if missing)

### 3.2 Dashboard access reality (important)

There are **no user RLS policies** on `ultaura_account_crypto_keys` or `ultaura_line_crypto_keys` (service-role only).

Dashboard must therefore:
1) Use an RLS client (cookie-based) to verify the user can access the line/account.
2) Use an **admin/service-role** client only to access/create keys and encrypt/decrypt.
3) Write reminder rows using the RLS client when possible (to avoid privilege escalation), using ciphertext computed with the admin client.

This matches the existing pattern in `src/lib/ultaura/insights.ts` (admin client for DEK unwrap).

## 4. Data Model

### 4.1 `ultaura_reminders` (encrypted fields)

Add:
```sql
message_ciphertext bytea,
message_iv bytea,
message_tag bytea,
message_alg text default 'AES-256-GCM',
message_kid text default 'kek_v1'
```

Keep `ultaura_reminders.message` temporarily for rollout compatibility; later make nullable, null it out, then drop it.

### 4.2 `ultaura_call_sessions`

Keep:
- `is_reminder_call`
- `reminder_id`

Remove:
- `reminder_message` (stop reading/writing; then drop column)

Rationale: call sessions should not store reminder message content at rest.

## 5. Encryption Format

### 5.1 Algorithm
- AES-256-GCM
- IV: 12 bytes
- Tag: 16 bytes
- Key: 32 bytes

### 5.2 AAD binding

AAD binds ciphertext to the account/line/reminder:
```ts
{
  account_id: string,
  line_id: string,
  reminder_id: string,
  type: 'reminder_message'
}
```

## 6. Telephony Changes

### 6.1 New util: `telephony/src/utils/reminder-crypto.ts`

Implement similarly to:
- `telephony/src/utils/life-chapter-crypto.ts` (Line DEK via `getMemoryDEK`)
- `telephony/src/utils/encryption.ts` (use `encryptMemoryValue`/`decryptMemoryValue`)

Expose:
- `buildReminderMessageAAD(accountId, lineId, reminderId)`
- `encryptReminderMessage(accountId, lineId, reminderId, message)` → `{ciphertext, iv, tag, alg, kid}`
- `decryptReminderMessage(accountId, lineId, reminderId, encrypted)` → `string` (caller handles errors)
- Batch helper(s) that decrypt many reminders with a single DEK in memory.

Rules:
- Do not log plaintext message content (even truncated) on errors.

### 6.2 Voice tool handlers

Update tool handlers to select ciphertext and decrypt before speaking:
- `telephony/src/routes/tools/set-reminder.ts`
  - Generate reminder UUID before insert (AAD requires reminder_id).
  - Encrypt message and write ciphertext fields.
  - Transitional: still write plaintext `message` until “stop plaintext” rollout step.
  - Remove any logging of reminder message content.
- `telephony/src/routes/tools/edit-reminder.ts`
  - If `newMessage` provided, encrypt and update ciphertext fields.
  - Build spoken confirmation using `newMessage` (no need to decrypt existing just for equality checks).
- `telephony/src/routes/tools/list-reminders.ts`
  - Select encrypted fields (and `message` only for dual-read fallback).
  - Decrypt in batch (line-scoped).
- `telephony/src/routes/tools/pause-reminder.ts`, `resume-reminder.ts`, `snooze-reminder.ts`, `cancel-reminder.ts`
  - If responses quote the reminder content, decrypt first (dual-read fallback) or switch to a generic confirmation.

### 6.3 Scheduler

Update `telephony/src/scheduler/call-scheduler.ts`:
- Stop sending `reminderMessage` to `/calls/outbound`.
- Keep sending `reminderId` and `schedulerIdempotencyKey`.

### 6.4 Outbound call initiation (`/calls/outbound`)

Update `telephony/src/routes/calls.ts`:
- Remove `reminderMessage` from request contract.
- Compute `isReminderCall` from `reason === 'reminder'` (and optionally `!!reminderId`), not from message presence.
- Create call sessions with `is_reminder_call` and `reminder_id` only.

### 6.5 Call session creation

Update `telephony/src/services/call-session.ts`:
- Remove `reminderMessage` from create options and from insert payload.
- Update `telephony/src/utils/supabase.ts` types to remove `reminder_message`.

### 6.6 Grok prompt injection for reminder calls

Do **not** make `GrokBridge.buildSystemPrompt()` async (it is currently synchronous).

Instead, decrypt earlier:
- In `telephony/src/websocket/media-stream.ts`, after loading the call session and determining `is_reminder_call` and `reminder_id`:
  - If reminder call, load the reminder row and decrypt message (dual-read fallback) *before* instantiating `GrokBridge`.
  - Pass decrypted `reminderMessage` in `GrokBridgeOptions` (in-memory only).
- Do not store plaintext message in any table.

### 6.7 AMD voicemail behavior (generic only)

After removing `call_sessions.reminder_message`, voicemail must not include reminder content.

Update:
- `telephony/src/utils/voicemail-messages.ts`: add reminder-generic templates per language (avoid check-in wording).
- `telephony/src/routes/twilio-outbound.ts`: when machine detected and `session.is_reminder_call`, use reminder-generic voicemail.

## 7. Dashboard (Next.js) Changes

### 7.1 New util: `src/lib/ultaura/reminder-crypto.ts`

Duplicate the minimal KEK/DEK unwrap logic from `src/lib/ultaura/insights.ts`.

Implement dashboard equivalents of the telephony DEK selection policy:
- Respect `ULTAURA_PER_LINE_DEK_ENABLED` and cutoff behavior.
- For post-cutoff lines: **get-or-create** line DEK using an admin client.
- For legacy lines: account DEK.

Important: key access must be via `getSupabaseServerActionClient({ admin: true })`, but user authorization must be checked via RLS client first.

### 7.2 Update reminder server actions

Update `src/lib/ultaura/reminders.ts`:
- Reads (`getReminders`, `getReminder`, `getUpcomingReminders`, etc.)
  - Fetch rows via RLS client.
  - Decrypt server-side via admin client (batch per line as needed).
  - Return decrypted `message` only.
  - If decrypt fails: return placeholder `"[Unable to decrypt reminder]"`.
- Writes (`createReminder`, `editReminder`)
  - Generate reminder UUID in app code (AAD requires reminder_id).
  - Encrypt using admin client after verifying access via RLS.
  - Insert/update reminder row using RLS client.
  - Transitional: keep writing plaintext `message` until “stop plaintext” rollout step.

Update `src/lib/ultaura/reminder-events.ts`:
- Stop joining `ultaura_reminders(message)`.
- Join/select reminder ciphertext fields (or fetch by reminder ids) and decrypt server-side before returning `reminder_message`.

## 8. Exports

Update `telephony/src/services/exports.ts`:
- When `include_reminders`, select encrypted fields and decrypt server-side.
- Ensure exports keep working after dropping `ultaura_reminders.message`.

## 9. Database Migrations

### 9.1 Migration 1: Add encrypted columns

`supabase/migrations/YYYYMMDDHHMMSS_encrypt_reminder_messages_add_columns.sql`
```sql
alter table ultaura_reminders
  add column if not exists message_ciphertext bytea,
  add column if not exists message_iv bytea,
  add column if not exists message_tag bytea,
  add column if not exists message_alg text default 'AES-256-GCM',
  add column if not exists message_kid text default 'kek_v1';

comment on column ultaura_reminders.message_ciphertext is 'AES-256-GCM encrypted reminder message';
comment on column ultaura_reminders.message_iv is 'IV for reminder message encryption';
comment on column ultaura_reminders.message_tag is 'GCM tag for reminder message encryption';
comment on column ultaura_reminders.message_alg is 'Encryption algorithm label';
comment on column ultaura_reminders.message_kid is 'Key id label';
```

Avoid `CREATE INDEX CONCURRENTLY` inside transactional migrations.

### 9.2 Migration 2: Drop call_sessions denormalized column

`supabase/migrations/YYYYMMDDHHMMSS_drop_call_sessions_reminder_message.sql`
```sql
alter table ultaura_call_sessions
  drop column if exists reminder_message;
```

### 9.3 Migration 3: Stop plaintext-at-rest for reminders

After all services deployed + backfill verified:
```sql
alter table ultaura_reminders
  alter column message drop not null;

update ultaura_reminders
set message = null
where message_ciphertext is not null;
```

### 9.4 Migration 4: Drop plaintext column

`supabase/migrations/YYYYMMDDHHMMSS_drop_plaintext_reminder_message.sql`
```sql
alter table ultaura_reminders
  drop column if exists message;
```

Optionally add `not null` constraints to ciphertext columns after confirming all rows are migrated.

## 10. Backfill Script

Implement in telephony to reuse the exact runtime policy and avoid drift.

### File: `telephony/scripts/encrypt-reminders.ts`

Requirements:
- Uses service-role Supabase client.
- Uses `getMemoryDEK()` (cutoff + get-or-create line DEK behavior) for correctness.
- Batches through reminders where `message_ciphertext is null` and `message is not null`.
- Encrypts `message` into ciphertext fields.
- No plaintext logs.
- Idempotent and resumable.

Run:
```bash
pnpm -C telephony tsx scripts/encrypt-reminders.ts        # dry-run
pnpm -C telephony tsx scripts/encrypt-reminders.ts --execute
```

## 11. Rollout Plan

1) Deploy Migration 1 (add encrypted columns).
2) Deploy telephony + dashboard code supporting dual-read and writing ciphertext (and temporarily plaintext).
3) Run backfill script.
4) Verify end-to-end:
   - Voice tools (`list_reminders`) speak decrypted content.
   - Reminder calls inject decrypted content into Grok prompt.
   - Dashboard lists and activity feed show decrypted content.
   - Exports include decrypted reminders.
5) Stop plaintext-at-rest:
   - Deploy Migration 3 (drop NOT NULL) and null out plaintext `message`.
   - (Optional) flip code to stop writing plaintext `message`.
6) Deploy Migration 2 (drop call_sessions.reminder_message) if not already.
7) Deploy Migration 4 (drop ultaura_reminders.message).
8) Update/regenerate database type files and TS table types as needed.

## 12. Failure Behavior

If reminder decryption fails (corrupt data, wrong key, etc.):
- Dashboard: show `"[Unable to decrypt reminder]"`, allow edit/cancel/delete.
- Telephony list-reminders: speak a generic placeholder for that item and continue.
- Reminder call prompt: fall back to a generic reminder-call prompt (“I’m calling about a reminder”).

## 13. Testing Strategy

### 13.1 Telephony unit tests (vitest)

Add `telephony/src/utils/__tests__/reminder-crypto.test.ts`:
- AAD determinism.
- Encrypt/decrypt roundtrip using “with-dek” helpers (like `telephony/src/utils/insights-crypto.ts`) to avoid requiring a real Supabase client.
- Wrong-AAD failures.
- Batch decrypt partial failure behavior.

### 13.2 Telephony behavior tests (lightweight)

- `/calls/outbound` marks reminder calls based on `reason`/`reminderId` (not reminderMessage).
- AMD voicemail for reminder calls is generic and contains no reminder content.

### 13.3 Dashboard server-action tests (if present)

- Create reminder: ciphertext populated; decrypted read returns original.
- Edit reminder: ciphertext changes; decrypted read returns updated.
- Reminder events: decrypted message returned; placeholder on decrypt failure.

## 14. Security Notes

- Never log reminder plaintext (even truncated) in telephony or dashboard.
- Never persist decrypted reminder message in `ultaura_call_sessions` or `ultaura_call_events`.
- Reminder voicemail remains generic to avoid disclosure via voicemail systems.

---

# Appendices

## Appendix A: File-by-file Change List

This section is the implementation checklist (surgical, correctness-focused). The intent is to avoid large refactors, especially around the realtime Grok bridge.

### A.1 Database / migrations

- `supabase/migrations/YYYYMMDDHHMMSS_encrypt_reminder_messages_add_columns.sql`
  - Add `message_ciphertext`, `message_iv`, `message_tag`, `message_alg`, `message_kid` to `ultaura_reminders`.

- `supabase/migrations/YYYYMMDDHHMMSS_drop_call_sessions_reminder_message.sql`
  - Drop `ultaura_call_sessions.reminder_message`.

- `supabase/migrations/YYYYMMDDHHMMSS_stop_plaintext_reminders.sql` (or one-off ops step)
  - `alter table ultaura_reminders alter column message drop not null;`
  - `update ultaura_reminders set message = null where message_ciphertext is not null;`

- `supabase/migrations/YYYYMMDDHHMMSS_drop_plaintext_reminder_message.sql`
  - Drop `ultaura_reminders.message`.

Notes:
- Do not use `CREATE INDEX CONCURRENTLY` inside a transactional Supabase migration.

### A.2 Telephony crypto utilities

- `telephony/src/utils/reminder-crypto.ts` (new)
  - Build AAD: `type: 'reminder_message'`.
  - Implement encrypt/decrypt using:
    - `getMemoryDEK(supabase, accountId, lineId)`
    - `encryptMemoryValue` / `decryptMemoryValue` from `telephony/src/utils/encryption.ts`
  - Provide “with-dek” helpers for unit tests:
    - `encryptReminderMessageWithDek(dek, message, aad)`
    - `decryptReminderMessageWithDek(dek, encrypted, aad)`

- `telephony/src/utils/supabase.ts`
  - Update types:
    - Remove `CallSessionRow.reminder_message`.
    - Update `ReminderRow` to include `message_ciphertext`, `message_iv`, `message_tag` (and keep `message?: string | null` during the dual-read window).

### A.3 Telephony: reminder tools (voice)

Dual-read contract for tool handlers during rollout:
- Prefer ciphertext if present.
- If ciphertext missing, fallback to plaintext `message`.

Files:

- `telephony/src/routes/tools/set-reminder.ts`
  - Generate reminder UUID in code (AAD requires `reminder_id` before insert).
  - Encrypt `finalMessage` and write ciphertext columns.
  - Transitional: also write plaintext `message` until “stop plaintext” step.
  - Ensure logs/events do not include the reminder message content.

- `telephony/src/routes/tools/list-reminders.ts`
  - Update `.select(...)` to fetch encrypted columns (and plaintext `message` only for dual-read).
  - Decrypt in batch (single line) and build voice-friendly response from decrypted messages.

- `telephony/src/routes/tools/edit-reminder.ts`
  - When `newMessage` is provided:
    - Encrypt and update ciphertext columns.
    - Do not compare to `reminder.message` (may be null post-migration); just treat a provided `newMessage` as authoritative.
  - IMPORTANT: prevent plaintext from being written to `ultaura_reminder_events.metadata`.
    - Today the handler builds `oldValues.message = reminder.message` and `newValues.message = ...`.
    - Replace with non-sensitive metadata only, e.g.:
      - `messageChanged: true`
      - `oldMessageLength`, `newMessageLength`

- `telephony/src/routes/tools/pause-reminder.ts`
- `telephony/src/routes/tools/resume-reminder.ts`
- `telephony/src/routes/tools/snooze-reminder.ts`
- `telephony/src/routes/tools/cancel-reminder.ts`
  - Any response that currently repeats `reminder.message` must instead:
    - decrypt (dual-read fallback) and speak it, OR
    - switch to a generic confirmation response that does not repeat the message.
  - Keep behavior consistent across tools (prefer decrypt+repeat only if you accept it as UX; otherwise make all confirmations generic).

### A.4 Telephony: scheduler and outbound call creation

- `telephony/src/scheduler/call-scheduler.ts`
  - Stop sending `reminderMessage` in the internal POST to `/calls/outbound`.
  - Ensure the reminder claim/recurrence logic does not depend on plaintext message.

- `telephony/src/routes/calls.ts`
  - Remove `reminderMessage` from request body.
  - Fix reminder-call identification:
    - `isReminderCall = reason === 'reminder'` (and optionally require `reminderId`)
    - Do NOT key this off message presence.
  - Create call session with:
    - `isReminderCall`
    - `reminderId`

- `telephony/src/services/call-session.ts`
  - Remove `reminderMessage` from the createCallSession options.
  - Remove `reminder_message` from the insert payload.

### A.5 Telephony: decrypt for Grok prompt without async refactor

- `telephony/src/websocket/media-stream.ts`
  - Replace usage of `session.reminder_message`.
  - If `session.is_reminder_call && session.reminder_id`:
    - Load the reminder row (`ultaura_reminders`) including ciphertext fields (and plaintext `message` for dual-read).
    - Decrypt message server-side.
    - Pass decrypted `reminderMessage` into the existing `GrokBridgeOptions`.
  - If decrypt fails:
    - Pass `reminderMessage = null` and let Grok use a generic reminder-call prompt path.

- `telephony/src/websocket/grok-bridge.ts`
  - Keep `buildSystemPrompt()` synchronous.
  - Keep `GrokBridgeOptions.reminderMessage` as an in-memory value.
  - Do not add DB fetch/decrypt inside GrokBridge.

### A.6 Telephony: AMD voicemail (generic reminder message)

- `telephony/src/routes/twilio-outbound.ts`
  - After dropping `reminder_message`, do not attempt decryption here.
  - For machine detection and `session.is_reminder_call === true`, use a generic reminder voicemail.

- `telephony/src/utils/voicemail-messages.ts`
  - Add per-language templates for a reminder-generic voicemail (no reminder content).
  - Ensure reminder voicemail does not accidentally fall back to “check-in” wording.

### A.7 Telephony: exports

- `telephony/src/services/exports.ts`
  - When exporting reminders, decrypt from ciphertext fields.
  - Do not rely on `ultaura_reminders.message`.

### A.8 Dashboard: crypto + server actions

- `src/lib/ultaura/reminder-crypto.ts` (new)
  - Copy KEK handling + unwrap logic from `src/lib/ultaura/insights.ts`.
  - Implement the same DEK selection policy as telephony:
    - Respect per-line enabled flag + cutoff.
    - For post-cutoff lines, ensure **line DEK exists** (get-or-create via admin client).
  - Provide batch decrypt helper that can reuse a single DEK per line.

- `src/lib/ultaura/reminders.ts`
  - READS:
    - Use RLS client (`getSupabaseServerComponentClient`) to fetch reminders.
    - Use `getSupabaseServerActionClient({ admin: true })` for decrypt operations.
    - Return decrypted `message` only (never ciphertext) to the UI.
  - WRITES:
    - Verify user authorization via RLS (line/account ownership).
    - Encrypt using admin client (key access) after authorization.
    - Insert/update reminder rows via RLS client.
    - During dual-write, keep writing plaintext `message`; after “stop plaintext” step, stop.
  - Update any reminder-event metadata writing so it does not store plaintext reminder content.

- `src/lib/ultaura/reminder-events.ts`
  - Replace `ultaura_reminders!inner(message)` join.
  - Fetch events and associated reminder ciphertext fields, then decrypt server-side.

- UI components
  - `src/app/dashboard/(app)/lines/[lineId]/reminders/ReminderActivity.tsx`
  - `src/app/dashboard/(app)/lines/[lineId]/reminders/RemindersClient.tsx`
  - Should continue to receive plain `message` strings from server actions; no client-side crypto.

### A.9 Tests that must be updated

- `src/lib/ultaura/__tests__/reminder-events.test.ts`
  - Currently expects plaintext `reminder_message` from the join; will need to reflect server-side decrypt behavior or placeholder behavior.

## Appendix B: Dual-read / Dual-write Rules (Rollout Correctness)

This appendix prevents “works in staging, fails in prod” issues during the transition.

### B.1 Storage phases

Phase 0 (today):
- `ultaura_reminders.message` is authoritative plaintext.
- `ultaura_call_sessions.reminder_message` stores denormalized plaintext.

Phase 1 (after Migration 1 + code deploy):
- Writes:
  - Always write ciphertext fields.
  - Also write plaintext `message` (temporary).
- Reads:
  - If ciphertext exists and decrypt succeeds → use decrypted.
  - Else if plaintext message exists → use plaintext.
  - Else → placeholder.

Phase 2 (after backfill + verification):
- Stop persisting plaintext:
  - Allow `message` to be nullable.
  - Null out plaintext where ciphertext exists.
  - Flip writes to stop setting `message`.

Phase 3 (cleanup):
- Drop `ultaura_call_sessions.reminder_message`.
- Drop `ultaura_reminders.message`.
- Code must not reference plaintext columns.

### B.2 Reminder events metadata (important)

`ultaura_reminder_events.metadata` must never contain plaintext reminder content.

Rules:
- Do not store `oldValues.message` or `newValues.message`.
- Store only non-sensitive fields:
  - `messageChanged: true`
  - `oldMessageLength` / `newMessageLength`
  - Time changes, snooze minutes, etc.

Rationale: reminder_events is an audit trail table and otherwise becomes a new plaintext-at-rest leak.

## Appendix C: Backfill Script Algorithm (Telephony)

Goal: encrypt all existing reminders with plaintext messages, using the exact same DEK policy as runtime.

### C.1 Script location

- `telephony/scripts/encrypt-reminders.ts`

Run via:
```bash
pnpm -C telephony tsx scripts/encrypt-reminders.ts
pnpm -C telephony tsx scripts/encrypt-reminders.ts --execute
```

### C.2 Query + update approach

- Select batch where:
  - `message_ciphertext is null`
  - `message is not null`
- Recommended select columns:
  - `id, account_id, line_id, message`

For each reminder:
1) Compute AAD from account_id, line_id, reminder_id.
2) Resolve DEK by calling `getMemoryDEK(supabase, accountId, lineId)`.
   - This ensures cutoff behavior and will create missing line DEKs for newer lines.
3) Encrypt message to ciphertext/iv/tag.
4) Update row with ciphertext fields.
   - Keep plaintext `message` intact until Phase 2.

Idempotency:
- Each update should include a guard like:
  - `.eq('id', reminder.id).is('message_ciphertext', null)`
  - so reruns don’t overwrite ciphertext.

Batching:
- Default batch size 100.
- Loop until no matching rows.

Error handling:
- Do not log plaintext message.
- On error encrypting/updating a single reminder:
  - log only reminder id and error code
  - continue processing the batch

### C.3 Performance notes

- Cache DEKs in-memory per lineId (or per accountId for legacy lines) to reduce repeated key unwrap.
- Keep caching keyed by the *policy result* (e.g., `dekCache.set('line:'+lineId, dek)`), not by “line always uses line DEK”, because legacy lines will use account DEK.

## Appendix D: Detailed Test Matrix

These are the specific scenarios to validate (unit + integration + manual).

### D.1 Telephony unit tests (`vitest`)

`telephony/src/utils/__tests__/reminder-crypto.test.ts`:
- Encrypt/decrypt roundtrip with a fixed DEK.
- Unicode input roundtrip.
- AAD mismatch failures:
  - wrong account_id
  - wrong line_id
  - wrong reminder_id
- Corruption failures:
  - wrong tag
  - truncated iv
  - random ciphertext
- Batch decrypt:
  - 10 reminders decrypt successfully
  - 1 corrupted reminder returns placeholder while others still decrypt

### D.2 Telephony route/behavior tests

- `/calls/outbound`:
  - Given `reason='reminder'` and `reminderId` present, call session is created with `is_reminder_call=true` even without a reminderMessage.

- AMD voicemail:
  - For reminder calls with machine detected, TwiML contains reminder-generic voicemail text.
  - TwiML does not contain the reminder content.

- Voice tool `list_reminders`:
  - Returns/speaks decrypted content when ciphertext present.
  - Falls back to plaintext `message` during Phase 1 for legacy rows.
  - Uses placeholder when both ciphertext+plaintext are unavailable.

### D.3 Dashboard server-action tests (if test infra exists)

- Create reminder:
  - Ciphertext fields set.
  - Decrypted read returns the same message.

- Edit reminder message:
  - Ciphertext changes.
  - Decrypted read returns updated message.
  - Reminder event metadata does not include message content.

- Reminder activity feed (`getLineReminderEvents`):
  - Decrypts reminder message for display.
  - If decrypt fails, shows placeholder.

### D.4 Exports

- Export with `include_reminders=true`:
  - Includes decrypted reminder message text in the export payload.
  - Does not require plaintext column.

### D.5 Backfill script

- Dry-run produces counts only.
- Execute mode:
  - encrypts all matching rows
  - is idempotent on rerun
  - does not crash on one bad row

### D.6 Manual end-to-end checks

- Create a reminder via dashboard.
- Trigger a reminder call via scheduler/test call.
- Confirm Grok reminder prompt includes reminder message (human answered call).
- Confirm voicemail (machine detected) is generic and contains no message.
- Confirm reminder list in dashboard shows message.
