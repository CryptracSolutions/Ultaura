# Answering Machine Detection (AMD) Implementation Spec

## Objective

Wire up Twilio's Answering Machine Detection (AMD) for outbound calls in Ultaura. Currently, the codebase checks `AnsweredBy` in the outbound webhook handler, but the `machineDetection` parameter is never passed when creating calls via Twilio API. This means the AMD handling code path never executes.

## Scope

- **Outbound calls only** - Inbound calls are excluded (callers are clearly human)
- Enable AMD via Twilio API parameter
- Make voicemail behavior configurable per line
- Track AMD results in database
- Add environment variable toggle for disabling AMD

---

## Current State Analysis

### Problem Location

**File:** `telephony/src/utils/twilio.ts` (lines 113-134)

```typescript
export async function initiateOutboundCall(options: {
  to: string;
  from: string;
  callbackUrl: string;
  statusCallbackUrl: string;
  callSessionId: string;
}): Promise<string> {
  const client = getTwilioClient();

  const call = await client.calls.create({
    to: options.to,
    from: options.from,
    url: `${options.callbackUrl}?callSessionId=${options.callSessionId}`,
    statusCallback: options.statusCallbackUrl,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    // MISSING: machineDetection parameter
  });

  return call.sid;
}
```

### Existing AMD Handler (Never Executes)

**File:** `telephony/src/routes/twilio-outbound.ts` (lines 126-132)

```typescript
if (AnsweredBy === 'machine_start' || AnsweredBy === 'machine_end_beep') {
  logger.info({ callSessionId, answeredBy: AnsweredBy }, 'Answering machine detected');
  res.type('text/xml').send(generateMessageTwiML(
    `Hello ${line.display_name}, this is Ultaura calling. I'm sorry I missed you. I'll try again later. Take care.`
  ));
  return;
}
```

---

## Technical Requirements

### 1. Enable AMD in Twilio Call Creation

**File:** `telephony/src/utils/twilio.ts`

Add the following parameters to `client.calls.create()`:

```typescript
const call = await client.calls.create({
  to: options.to,
  from: options.from,
  url: `${options.callbackUrl}?callSessionId=${options.callSessionId}`,
  statusCallback: options.statusCallbackUrl,
  statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
  statusCallbackMethod: 'POST',
  // NEW: AMD parameters (only if enabled)
  ...(amdEnabled && {
    machineDetection: 'Enable',
    machineDetectionTimeout: 30,
  }),
});
```

**AMD Mode:** `Enable` (not `DetectMessageEnd`)
- Faster detection - notifies before answering machine beep
- Trade-off: occasional misclassification acceptable

**Timeout:** 30 seconds (Twilio default)

### 2. Environment Variable Toggle

**New env var:** `TWILIO_AMD_ENABLED`

- `true` (default) - AMD enabled for outbound calls
- `false` - AMD disabled (for testing/cost savings)

Add to `.env.ultaura.example`:
```bash
# Answering Machine Detection
TWILIO_AMD_ENABLED=true
```

### 3. Per-Line Voicemail Preference

#### Database Schema Change

**Table:** `ultaura_lines`

Add new column:
```sql
ALTER TABLE ultaura_lines
ADD COLUMN voicemail_behavior TEXT NOT NULL DEFAULT 'brief'
CHECK (voicemail_behavior IN ('none', 'brief', 'detailed'));
```

**Values:**
- `none` - Hang up silently (no message)
- `brief` - Short message (default for new lines)
- `detailed` - Message includes reason for calling

#### Voicemail Messages

**Brief message:**
```
Hi {display_name}, this is Ultaura. I'll call back soon. Take care!
```

**Detailed message (scheduled call):**
```
Hi {display_name}, this is Ultaura. I was calling for your check-in. I'll try again later. Take care!
```

**Detailed message (reminder call):**
```
Hi {display_name}, this is Ultaura. I was calling to remind you about {reminder_message}. I'll try again later. Take care!
```

### 4. Track AMD Results in Database

#### Database Schema Change

**Table:** `ultaura_call_sessions`

Add new column:
```sql
ALTER TABLE ultaura_call_sessions
ADD COLUMN answered_by TEXT
CHECK (answered_by IN ('human', 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax', 'unknown', NULL));
```

**Note:** This column stores raw Twilio `AnsweredBy` value for analytics.

#### Call Status Mapping

When AMD detects a machine:
- Set `answered_by` column to Twilio's value
- Set `end_reason` to `no_answer` (treat same as unanswered)
- Set `status` to `completed`

### 5. Handle Uncertain AMD Results

**Twilio `AnsweredBy` values:**
- `human` - Proceed with Grok conversation
- `machine_start` - Apply voicemail preference
- `machine_end_beep` - Apply voicemail preference
- `machine_end_silence` - Apply voicemail preference
- `machine_end_other` - Apply voicemail preference
- `fax` - Hang up immediately
- `unknown` - **Assume human**, proceed with conversation

### 6. Billing

Machine-answered calls are billed normally (by actual seconds used). No special billing logic needed.

---

## Implementation Details

### Files to Modify

1. **`telephony/src/utils/twilio.ts`**
   - Add AMD parameters to `initiateOutboundCall()`
   - Accept `voicemailBehavior` option
   - Read `TWILIO_AMD_ENABLED` env var

2. **`telephony/src/routes/twilio-outbound.ts`**
   - Update AMD handler to use per-line voicemail preference
   - Record `answered_by` in call session
   - Set `end_reason` to `no_answer` for machines
   - Handle `unknown` as human

3. **`telephony/src/routes/calls.ts`**
   - Pass `voicemailBehavior` from line to `initiateOutboundCall()`

4. **`telephony/src/services/call-session.ts`**
   - Add `answered_by` to `updateCallSession()` function
   - Add `answered_by` to `CallSessionRow` type

5. **`src/lib/ultaura/types.ts`**
   - Add `voicemail_behavior` to `Line` type
   - Add `VoicemailBehavior` type: `'none' | 'brief' | 'detailed'`

6. **`src/lib/ultaura/actions.ts`**
   - Update `updateLine()` to accept `voicemail_behavior`
   - Add validation for voicemail_behavior values

7. **`src/app/dashboard/(app)/lines/[lineId]/settings/page.tsx`**
   - Add voicemail preference UI control
   - Three-option radio/select: "Don't leave message", "Leave brief message", "Leave detailed message"

8. **`supabase/migrations/` (new migration)**
   - Add `voicemail_behavior` column to `ultaura_lines`
   - Add `answered_by` column to `ultaura_call_sessions`

9. **`.env.ultaura.example`**
   - Add `TWILIO_AMD_ENABLED=true`

### Function Signature Changes

**`initiateOutboundCall()` - New signature:**
```typescript
export async function initiateOutboundCall(options: {
  to: string;
  from: string;
  callbackUrl: string;
  statusCallbackUrl: string;
  callSessionId: string;
  amdEnabled?: boolean;  // NEW
}): Promise<string>
```

**Note:** `voicemailBehavior` is NOT passed here - it's handled in the webhook when AMD result arrives.

---

## Call Flow (Updated)

```
1. Scheduler/Dashboard triggers call
   ↓
2. POST /calls/outbound
   - Creates call session (status: 'created')
   - Calls initiateOutboundCall() with amdEnabled=true
   ↓
3. Twilio initiates call with machineDetection: 'Enable'
   ↓
4. Recipient's phone rings
   ↓
5. POST /twilio/status (status: 'ringing')
   ↓
6. Call answered (human or machine)
   ↓
7. POST /twilio/voice/outbound
   - Receives AnsweredBy: 'human' | 'machine_*' | 'unknown' | 'fax'
   ↓
   ├── If AnsweredBy = 'human' or 'unknown':
   │   - Update session: answered_by = value
   │   - Return TwiML to connect WebSocket stream
   │   - Grok conversation begins
   │
   ├── If AnsweredBy = 'fax':
   │   - Update session: answered_by = 'fax', end_reason = 'no_answer'
   │   - Return <Hangup/> TwiML
   │
   └── If AnsweredBy = 'machine_*':
       - Lookup line.voicemail_behavior
       ├── If 'none': Return <Hangup/> TwiML
       ├── If 'brief': Return <Say> brief message </Say><Hangup/>
       └── If 'detailed': Return <Say> detailed message </Say><Hangup/>
       - Update session: answered_by = value, end_reason = 'no_answer'
   ↓
8. POST /twilio/status (status: 'completed')
   - Records final duration
```

---

## Database Migration

**Migration file:** `supabase/migrations/YYYYMMDDHHMMSS_add_amd_support.sql`

```sql
-- Add voicemail preference to lines
ALTER TABLE ultaura_lines
ADD COLUMN voicemail_behavior TEXT NOT NULL DEFAULT 'brief'
CHECK (voicemail_behavior IN ('none', 'brief', 'detailed'));

COMMENT ON COLUMN ultaura_lines.voicemail_behavior IS
  'What to do when call reaches answering machine: none (hang up), brief (short message), detailed (includes call reason)';

-- Add AMD tracking to call sessions
ALTER TABLE ultaura_call_sessions
ADD COLUMN answered_by TEXT
CHECK (answered_by IS NULL OR answered_by IN ('human', 'machine_start', 'machine_end_beep', 'machine_end_silence', 'machine_end_other', 'fax', 'unknown'));

COMMENT ON COLUMN ultaura_call_sessions.answered_by IS
  'Twilio AMD result: human, machine_*, fax, unknown, or NULL if AMD disabled';

-- Index for analytics queries
CREATE INDEX idx_call_sessions_answered_by ON ultaura_call_sessions(answered_by) WHERE answered_by IS NOT NULL;
```

---

## UI Design

### Line Settings Page

**Location:** `/lines/[lineId]/settings`

**New Section:** "Voicemail Settings" (add below existing settings)

```
┌─────────────────────────────────────────────────────────┐
│ Voicemail Settings                                      │
│                                                         │
│ When I don't answer a call:                            │
│                                                         │
│ ○ Don't leave a message                                │
│   Ultaura will hang up quietly                         │
│                                                         │
│ ● Leave a brief message (Recommended)                  │
│   "Hi [name], this is Ultaura. I'll call back soon."   │
│                                                         │
│ ○ Leave a detailed message                             │
│   Includes why Ultaura was calling                     │
│                                                         │
│                                          [Save Changes] │
└─────────────────────────────────────────────────────────┘
```

---

## Edge Cases & Error Handling

### 1. AMD Disabled via Environment
- If `TWILIO_AMD_ENABLED=false`, do not pass `machineDetection` to Twilio
- `AnsweredBy` will be null/undefined in webhook
- Proceed directly to Grok conversation (current behavior)

### 2. Line Missing voicemail_behavior
- Should not happen due to `DEFAULT 'brief'` constraint
- If somehow null, default to 'brief' in code as safety net

### 3. AMD Timeout
- If Twilio can't determine within 30 seconds, `AnsweredBy` = `unknown`
- Treat as human - proceed with conversation

### 4. Call Session Not Found in Webhook
- Existing error handling applies
- Return 404 error TwiML

### 5. Fax Machine Detection
- Twilio may return `AnsweredBy: 'fax'`
- Hang up immediately (no voicemail)
- Record as `answered_by: 'fax'`, `end_reason: 'no_answer'`

---

## Testing Considerations

### Unit Tests
1. `initiateOutboundCall()` includes AMD params when enabled
2. `initiateOutboundCall()` excludes AMD params when disabled
3. Outbound webhook correctly handles each `AnsweredBy` value
4. Voicemail messages correctly interpolate names and reasons

### Integration Tests
1. End-to-end call with AMD enabled reaches webhook with `AnsweredBy`
2. Machine detection triggers appropriate voicemail behavior
3. `answered_by` column populated correctly in database
4. Dashboard voicemail setting persists and loads correctly

### Manual Testing
1. Call a phone with voicemail, verify detection and message
2. Call a phone answered by human, verify conversation starts
3. Toggle `TWILIO_AMD_ENABLED=false`, verify calls proceed without detection
4. Test all three voicemail preference settings

---

## Assumptions

1. Twilio's AMD feature is available on the account (may require Twilio plan upgrade)
2. The Polly.Joanna voice (currently used) is acceptable for voicemail messages
3. 30-second AMD timeout is appropriate for senior users who may answer slowly
4. `Enable` mode (not `DetectMessageEnd`) provides acceptable accuracy
5. No retry logic needed for machine-answered calls (wait for next scheduled time)
6. Billing all calls normally (including machine-detected) is acceptable

---

## Dependencies

- **Twilio Programmable Voice** - AMD feature enabled on account
- **Supabase** - Database migration for new columns
- **Next.js Dashboard** - UI changes for settings page

---

## Rollout Notes

1. Deploy database migration first
2. Deploy telephony backend with `TWILIO_AMD_ENABLED=false` initially
3. Deploy dashboard UI changes
4. Enable AMD: Set `TWILIO_AMD_ENABLED=true` in production
5. Monitor logs for AMD results and adjust if needed

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| `telephony/src/utils/twilio.ts` | Add `machineDetection` and `machineDetectionTimeout` params |
| `telephony/src/routes/twilio-outbound.ts` | Update AMD handler for per-line preference, record `answered_by` |
| `telephony/src/routes/calls.ts` | Pass AMD enabled flag |
| `telephony/src/services/call-session.ts` | Add `answered_by` to update function |
| `src/lib/ultaura/types.ts` | Add `voicemail_behavior` type |
| `src/lib/ultaura/actions.ts` | Update line actions for voicemail pref |
| `src/app/.../settings/page.tsx` | Add voicemail preference UI |
| `supabase/migrations/` | New migration for both columns |
| `.env.ultaura.example` | Add `TWILIO_AMD_ENABLED` |

**Estimated files touched:** 9
**New database columns:** 2
**New environment variables:** 1
