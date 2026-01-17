# Spoken Disclaimers and Consent System Specification

## Executive Summary

This specification implements a comprehensive spoken disclaimers and consent system for Ultaura, including:
1. **User type-aware flows** - Different experiences for self-setup vs family-managed accounts
2. Structured first-call and subsequent-call disclosure flows
3. Two-party recording consent with per-call and permanent preferences
4. Four-tier family sharing consent controlled by the senior (family-managed only)
5. Dashboard enhancements for tier selection and consent visibility
6. Enhanced weekly wellness summaries based on sharing tier

---

## Part 1: User Type Detection

### Existing Infrastructure

The system already distinguishes setup type via `ultaura_accounts.user_type`:

| Value | Meaning | Default Sharing |
|-------|---------|-----------------|
| `'self'` | Senior set up service for themselves | `sharing_enabled = false` |
| `'family_managed'` | Family/caregiver set up for a loved one | `sharing_enabled = true` |

### Flow Differences by User Type

| Element | Self User | Family-Managed User |
|---------|-----------|---------------------|
| AI Disclosure | Same | Same |
| Recording Consent | Same | Same |
| Emergency Boundary | Same | Same |
| Memory Consent | Same | Same |
| **Family Sharing Consent** | **SKIP** (no family to share with) | Ask with tier options |
| **Tier Selector in Dashboard** | **HIDE** (not applicable) | Show with 4 options |
| **Weekly Summary** | To self only (if enabled later) | To payer based on tier |

### Self User: Optional Family Sharing Later

A self user can later enable family sharing via:
1. Dashboard toggle: "Share insights with family"
2. Voice command: "I'd like to share updates with my family"

When enabled:
- `sharing_enabled` set to `true`
- `sharing_enabled_at` records the timestamp
- Ultaura asks for tier preference on next call
- Only data from `sharing_enabled_at` onward is shared
- **Dashboard prompts payer to add notification recipient contact info**

### Implementation: Passing User Type to Call

The `user_type` must be passed to the telephony server and GrokBridge:

**File:** `/telephony/src/websocket/media-stream.ts`

When fetching account data, include `user_type`:
```typescript
const account = await getAccountForLine(lineId);
const userType = account.user_type; // 'self' | 'family_managed'
const sharingEnabled = account.sharing_enabled;
```

Pass to GrokBridge:
```typescript
grokBridge = new GrokBridge({
  // ... existing options
  userType,
  sharingEnabled,
});
```

---

## Part 2: Spoken Disclaimers

### First Call Flow (Order Matters)

#### Opening Sequence (~30 seconds)
1. **AI Disclosure**: "Hi [Name], this is your AI companion from Ultaura calling for your check-in."
2. **Recording Consent** (if recording enabled): "This call is being recorded - is that okay with you?"
3. **Emergency Boundary**: "Just so you know, I'm a companion—not an emergency service. If you're ever in immediate danger, please call 911."

#### Main Conversation
- Build rapport naturally
- Learn about interests and topics to avoid
- Store memories silently as they share

#### Near End of Call

**For ALL users:**
- **Memory Consent**: "Can I remember things about you to personalize our calls?"

**For `family_managed` users ONLY:**
- **Family Sharing Consent**: See Section 4 for full script

**For `self` users:**
- Skip family sharing consent entirely
- Use self-focused language: "your personal records" not "family summaries"
- Alternative conversation: "I'll keep track of what we discuss to personalize our future calls."

### Subsequent Calls

| Element | Behavior |
|---------|----------|
| AI Disclosure | Not required (already know) |
| Recording Consent | Required: "Hi [Name], it's Ultaura. Okay if I record today?" |
| Emergency Disclaimer | Only if: distress detected OR asked for medical/emergency help |

### "Are You Real?" Response

When asked if they're real, human, or a person:
> "I'm an AI, but our conversations are real and I genuinely care about how you're doing."

### Consent Response Clarification

If audio quality is poor or response is unclear:
> "I didn't catch that - is it okay if I record?" / "Sorry, I didn't understand. Would you like me to share updates with your family?"

---

## Part 3: Recording Consent System

### Two-Party Consent Requirement
Always ask before recording each call (legal requirement for two-party consent states).

### First Call Script
> "This call is being recorded - is that okay with you?"

### Subsequent Call Script (Brief)
> "Hi [Name], it's Ultaura. Okay if I record today?"

### Denial Handling Flow
1. User says "no" to recording
2. System: Disable recording for that call via Twilio API
3. System: Log to `ultaura_consent_audit_log` with call_session_id
4. Ultaura asks: "No problem at all. Would you like me to stop asking about recording on future calls too?"
   - If **YES** (permanent decline):
     - Set `recording_consent = 'denied'`
     - Set `recording_preference_permanent = true`
     - Never record, never ask again
   - If **NO** (one-time decline):
     - Set `recording_consent = 'denied'` (for this call only)
     - Keep `recording_preference_permanent = false`
     - Ask again on next call

### Mid-Call Recording Revocation

User can revoke consent mid-call by saying:
> "Stop recording" / "Don't record this" / "Turn off recording"

Ultaura responds:
> "I've stopped recording. Would you like me to stop recording all our calls?"

Tool: `revoke_recording_consent` - stops recording immediately and asks about permanent preference.

### Dashboard Display
- Show: "Recording: Declined by [Name]"
- Payer can click "Re-enable" → triggers gentle prompt on next call:
  > "Your family enabled recording again - would you like me to record our calls?"

### Database Changes

Reuse existing `ultaura_voice_consent_status` enum (`'pending' | 'granted' | 'denied'`).

Add to `ultaura_line_voice_consent`:
```sql
-- Recording consent (reuses existing enum)
recording_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
recording_consent_at TIMESTAMPTZ,
recording_consent_call_session_id UUID REFERENCES ultaura_call_sessions(id),
-- If denied, this tracks if it's permanent or per-call
recording_preference_permanent BOOLEAN NOT NULL DEFAULT FALSE
```

### Twilio Integration

**IMPORTANT:** Verify Twilio API supports pausing/stopping recordings mid-stream. Options:
1. Use `<Record>` with manual control instead of automatic `record="record-from-answer"`
2. Call `client.recordings(sid).update({ status: 'stopped' })` for active recordings

Add functions to control recording mid-call:
- `pauseRecordingForCall(callSid)` - Pause all active recordings for call
- `stopRecordingForCall(callSid)` - Stop all active recordings for call

**File:** `/telephony/src/utils/twilio.ts`

**Fallback:** If Twilio API doesn't support mid-stream stop, delete the recording after call ends and note in audit log.

---

## Part 4: Family Sharing Consent System

### Applicability

| User Type | Family Sharing Consent |
|-----------|------------------------|
| `self` | **SKIP** - Not applicable unless they later enable sharing |
| `family_managed` | **ASK** - Full consent flow with tier options |

### Four Tiers (Family-Managed Only)

Using numbered internal names for clarity:

| Internal | Display Name | Includes |
|----------|--------------|----------|
| `tier_1` | Basic Updates & Safety | Call stats, operational info, HIGH-tier safety alerts only |
| `tier_2` | Wellness Check | + Mood/wellness indicators (aggregated, no specifics) |
| `tier_3` | Full Summary | + Topic categories ("Family", "Health", "Hobbies") |
| `tier_4` | Complete Visibility | + Concern alerts with severity (mild included) |

### Tier Contents Detail

**All Tiers Include (tier_1+):**
- Call completion/missed
- Service status
- Usage/billing
- High-tier safety alerts to trusted contacts

**Tier 2+ Adds:**
- Mood distribution (positive/neutral/low)
- Engagement trends (talking more/less)
- Answer rate changes

**Tier 3+ Adds:**
- Topic categories (NOT specific content)
- Example: "Talked about family and gardening" ✓
- NOT: "Talked about worrying that daughter doesn't visit" ✗

**Tier 4 Adds:**
- Mild concern alerts
- Follow-up recommendations (generic)
- Social need indicators

### First Call Consent Script (Family-Managed Only)

**Ultaura asks (near end of first call):**
> "Your family set this up because they care about you. I can send them a short weekly note—just that we talked and how you're doing overall. Nothing specific about what we discuss. Is that okay with you?"

**If YES:**
> "Great. If you ever want to share more or less, just tell me."
- Set tier to `tier_2` (Wellness Check - default sharing level)

**If NO:**
> "That's completely fine—our conversations stay between us. If you ever change your mind, just let me know."
- Set tier to `tier_1` (Basic - safety alerts only)
- Do NOT re-ask on a schedule

### Self User Prompt Variant

For `self` users, use alternative language focused on personal records:
> "I'll keep notes from our conversations to make our future chats more personal. Everything stays private to you."

No mention of family, sharing, or summaries to others.

### Self User: Enabling Family Sharing Later

If a `self` user wants to add family sharing:

**Via voice command:**
> "I'd like to share updates with my family"

**Ultaura responds:**
> "I can send someone you trust a weekly note about how you're doing. Would you like to set that up?"

If yes:
1. Set `sharing_enabled = true`
2. Set `sharing_enabled_at = now()`
3. Ask for tier preference
4. **Dashboard shows notification**: "Add a family contact to receive weekly updates"
5. Payer must add notification recipient contact info before summaries are sent

**Dashboard Flow for Adding Contact:**
1. After voice enablement, dashboard shows alert: "[Name] enabled family sharing"
2. Prompt: "Add email address to receive weekly summaries"
3. Verify email via confirmation link
4. Only then do summaries begin

### Payer Notification on Decline

To payer (dashboard/email) - factual, not blaming:
> "Family sharing is not currently enabled for [Name]'s line. You'll still receive: call completion notifications, safety alerts, service status, and usage/billing."

**What Payer Still Receives (regardless of tier):**
- Call completed/missed
- High-tier safety alerts
- Service status
- Usage/billing

### Re-Enable Flow for Sharing

Payer can request sharing re-prompt:
1. Dashboard shows "Request Sharing" button
2. On next call, Ultaura gently asks:
   > "I wanted to check - would you be okay with me sharing a brief weekly update with your family? Just how you're doing, nothing specific."

### Voice Commands for Tier Changes

Senior can change tier anytime during any call:

| Senior Says | Ultaura Response |
|-------------|------------------|
| "Share more with my family" | "I can share more detail—like topics we discuss or if something's worrying you. Would you like that?" |
| "Share less with my family" | "I'll share less going forward. I'll stick to basics like call stats and safety alerts." |
| "Don't share anything with my family" | "Understood—I'll keep our conversations private." |
| "What do you share with my family?" | [Explains current tier] |

**Important:** Senior's voice choice ALWAYS overrides the dashboard default tier. The payer sets an initial default, but the senior has final authority over their sharing preferences.

### Database Changes

Add to `ultaura_line_voice_consent` (single source of truth for consent):
```sql
-- Sharing consent (reuses existing enum)
sharing_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
sharing_tier TEXT NOT NULL DEFAULT 'tier_1'
  CHECK (sharing_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
sharing_consent_at TIMESTAMPTZ,
sharing_consent_call_session_id UUID REFERENCES ultaura_call_sessions(id),

-- Onboarding tracking
onboarding_completed_at TIMESTAMPTZ,

-- Future: consent expiry for jurisdictions requiring periodic re-consent
-- consent_expires_at TIMESTAMPTZ
```

**Note:** Do NOT add `default_sharing_tier` to `ultaura_lines` - consent belongs in consent table only.

---

## Part 5: Dashboard Changes

### 5.1 Add Line Modal - Tier Selector

**File:** `/src/app/dashboard/(app)/lines/components/AddLineModal.tsx`

**Conditional display based on `userType`:**

```typescript
// Only show tier selector for family_managed accounts
{userType === 'family_managed' && (
  <div className="space-y-2 pt-4 border-t">
    <label>Default Family Sharing Level</label>
    <p>[Name] can change this during their first call.</p>
    <RadioGroup>
      <RadioGroupItem value="tier_1">Basic Updates & Safety</RadioGroupItem>
      <RadioGroupItem value="tier_2">Wellness Check (Recommended)</RadioGroupItem>
      <RadioGroupItem value="tier_3">Full Summary</RadioGroupItem>
      <RadioGroupItem value="tier_4">Complete Visibility</RadioGroupItem>
    </RadioGroup>
  </div>
)}
```

**For `self` users:** Hide tier selector entirely. Show instead:
> "You can enable family sharing later from your settings if you'd like to share updates with someone you trust."

### 5.2 Line Settings - Consent Status Display

**File:** `/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx`

Add new "Consent Status" section showing:

**Recording Preference:**
- "Declined by [Name] - recordings disabled" with [Re-enable] button
- OR "Ask each call"
- OR "Approved for this session"

**Family Sharing Level (family_managed only):**
- Current tier name and description
- "Set by [Name] during call"
- Note: "[Name] can change this anytime by voice"
- [Request Re-prompt] button if declined (rate limited: once per 30 days to prevent repeated prompting)

**Family Sharing (self users):**
- "Not enabled" with [Enable Sharing] button
- When clicked, shows "Add Family Contact" flow
- Note: "[Name] can also enable this by voice during a call"

### 5.3 Test Call - Full Experience Preview

**File:** `/src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx`

Add test call mode toggle:

```
Test Call Options:

○ Quick Test (default)
  Test audio/connection only. No disclosures.

○ Preview Full Experience
  Hear the complete first-call flow including disclosures.
```

**Implementation:**
- Add `isPreviewMode: boolean` flag to test call API
- When `isPreviewMode: true`:
  - Force `isFirstCall: true` in GrokBridge
  - Enable all consent prompts
  - Don't persist any consent responses (mark as test in audit log)

---

## Part 6: Weekly Wellness Summary

### Delivery Methods
1. **Weekly email digest** (on by default for family_managed, off for self)
2. **Enhance existing `/insights` page** with wellness data

### File Locations
- **Aggregation logic:** `/telephony/src/services/weekly-summary.ts`
- **API route:** `/src/app/api/telephony/weekly-summary/route.ts`

### User Type Behavior

| User Type | Weekly Email | Insights Page |
|-----------|--------------|---------------|
| `self` | To themselves (if enabled) | Their own data |
| `family_managed` | To payer based on tier | Tier-filtered data |

### Email Content Based on Tier

| Tier | Email Includes |
|------|----------------|
| tier_1 (Basic) | Call stats, service status, safety alerts |
| tier_2 (Wellness) | + Mood trend, engagement note |
| tier_3 (Full) | + Topic categories |
| tier_4 (Complete) | + Concern alerts, follow-up suggestions |

### Implementation

**File:** `/telephony/src/services/weekly-summary.ts`

Modify `aggregateWeeklySummary` to:
1. Check `userType` - if `self` and `!sharing_enabled`, skip family summary
2. Filter data based on `sharing_tier`

---

## Part 7: Consent Reliability & Edge Cases

### Tool Fallback Behavior

**Problem:** Grok may not reliably call consent tools (AI unreliability).

**Solution:** System-level consent tracking with re-prompt logic.

```typescript
// In media-stream.ts or call completion handler
// NOTE: This is IN-MEMORY runtime state during the call, NOT database columns.
// Used to track whether consent tools were called before call ends.
interface ConsentState {
  recordingConsentAsked: boolean;
  recordingConsentReceived: boolean;
  sharingConsentAsked: boolean;  // family_managed only
  sharingConsentReceived: boolean;
}
```

**On call completion:**
1. If `isFirstCall` and consent tool NOT called → store `consent_status: 'incomplete'`
2. Next call: Re-attempt full consent flow (treat as first call for consent purposes)
3. Log to audit: `consent_incomplete_retry`

### Call Disconnects Before Consent

| Scenario | Database State | Next Call Behavior |
|----------|----------------|-------------------|
| Disconnect before recording consent | `recording_consent: 'pending'` | Ask again |
| Disconnect before sharing consent | `sharing_consent: 'pending'` | Ask again |
| Consent given but tool not called | `*_consent: 'pending'` | Ask again (safe default) |

### Database Write Failure

If consent tool succeeds but DB write fails:
1. Retry 3 times with exponential backoff
2. If still fails: Log error, treat as not consented (safe default)
3. Ultaura does NOT confirm consent to user until DB write succeeds
4. Next call: Re-ask for consent

### Consent Response Not Understood

If audio quality is poor or response is unclear, Ultaura asks for clarification:
> "I didn't catch that - is it okay if I record?"
> "Sorry, could you repeat that? Would you like me to share updates with your family?"

Max 2 clarification attempts, then:
> "No problem, we can skip that for now. Just let me know if you'd like to discuss it later."

---

## Part 8: Grok Tool Definitions

### New Tools to Add

**File:** `/packages/prompts/src/tools/definitions.ts`

```typescript
// Recording consent
{ name: 'grant_recording_consent', description: 'Senior agreed to recording for this call' }
{ name: 'deny_recording_consent', description: 'Senior declined recording for this call' }
{ name: 'revoke_recording_consent', description: 'Senior revoked recording consent mid-call' }
{ name: 'set_recording_preference_permanent', params: { never_ask: boolean }, description: 'Set permanent recording preference' }

// Sharing consent (family_managed only, but tool should exist for voice commands)
{ name: 'set_sharing_tier', params: { tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' } }
{ name: 'get_sharing_tier', description: 'Get current tier for explanation' }
{ name: 'enable_family_sharing', description: 'Self user wants to enable sharing' }
```

### New Tool Handlers

**File:** `/telephony/src/routes/tools/recording-consent.ts` (NEW)
- `POST /tools/grant_recording_consent`
- `POST /tools/deny_recording_consent`
- `POST /tools/revoke_recording_consent`
- `POST /tools/set_recording_preference_permanent`

**File:** `/telephony/src/routes/tools/sharing-consent.ts` (NEW)
- `POST /tools/set_sharing_tier`
- `POST /tools/get_sharing_tier`
- `POST /tools/enable_family_sharing` (for self users)

---

## Part 9: Prompt Updates

### 9.1 CompanionPromptParams Interface

**File:** `/packages/prompts/src/profiles/index.ts`

Add to `CompanionPromptParams`:
```typescript
interface CompanionPromptParams {
  // ... existing params
  userType: 'self' | 'family_managed';
  sharingEnabled: boolean;
  recordingEnabled: boolean;
  recordingConsent: 'pending' | 'granted' | 'denied';
  needsRecordingConsent: boolean;
  sharingTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  sharingConsent: 'pending' | 'granted' | 'denied';
  needsSharingConsent: boolean;
  onboardingCompleted: boolean;
}
```

### 9.2 Onboarding Section

**File:** `/packages/prompts/src/golden/sections/onboarding.ts`

Update to include:
- User type awareness
- Conditional family sharing consent
- Structured opening sequence

```typescript
export const ONBOARDING_SECTION = {
  tag: 'onboarding',
  full: `## First Call - Onboarding Flow
This is your first call with {userName}. Follow this sequence precisely:

### Opening Sequence (~30 seconds)
1. **AI Disclosure**: "Hi {userName}, this is your AI companion from Ultaura calling for your check-in."
{recordingConsentSection}
3. **Emergency Boundary**: "Just so you know, I'm a companion—not an emergency service. If you're ever in immediate danger, please call 911."

### Main Conversation
- Build rapport naturally
- Learn about their interests
- Ask about topics to avoid

### Near End of Call
{memoryConsentSection}
{familySharingConsentSection}

### Closing
- Summarize what you learned
- End warmly`,
};
```

### 9.3 Identity Section

**File:** `/packages/prompts/src/golden/sections/identity.ts`

Add "Are you real?" response guidance:
> If asked whether you're real, human, or a person, respond: "I'm an AI, but our conversations are real and I genuinely care about how you're doing."

### 9.4 New Prompt Sections

**File:** `/packages/prompts/src/golden/sections/recording-consent.ts` (NEW)
- First call recording consent prompt
- Subsequent call recording consent prompt
- Never-ask variant
- Mid-call revocation handling

**File:** `/packages/prompts/src/golden/sections/family-sharing-consent.ts` (NEW)
- First call sharing consent script (family_managed only)
- Self user variant (skip or enable later)
- Voice command handling
- Tier explanation scripts

### 9.5 GrokBridge Updates

**File:** `/telephony/src/websocket/grok-bridge.ts`

Add to `GrokBridgeOptions`:
```typescript
interface GrokBridgeOptions {
  // ... existing options
  userType: 'self' | 'family_managed';
  sharingEnabled: boolean;
  recordingEnabled: boolean;
  recordingConsent: 'pending' | 'granted' | 'denied';
  needsRecordingConsent: boolean;
  sharingTier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
  sharingConsent: 'pending' | 'granted' | 'denied';
  needsSharingConsent: boolean; // false for self users
  isPreviewMode: boolean; // for test calls
}
```

Update `buildSystemPrompt()` to conditionally inject consent sections:
```typescript
// Only inject family sharing consent for family_managed users
if (this.options.userType === 'family_managed' && this.options.needsSharingConsent) {
  prompt += FAMILY_SHARING_CONSENT_SECTION.firstCallPrompt;
} else if (this.options.userType === 'self') {
  prompt += FAMILY_SHARING_CONSENT_SECTION.selfUserVariant;
}
```

---

## Part 10: Consent Audit Trail

Extend `ultaura_consent_audit_action` enum (consolidated):
```sql
-- Recording consent actions
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'recording_consent_updated';
-- Sharing consent actions
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'sharing_consent_updated';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'sharing_enabled_by_self_user';
-- Onboarding
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'onboarding_completed';
-- Edge cases
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'consent_incomplete_retry';
```

Audit entries include `old_value` and `new_value` in JSONB to capture state changes:
```json
{
  "old_value": { "consent": "pending" },
  "new_value": { "consent": "granted", "permanent": false }
}
```

All consent changes logged with:
- `call_session_id` for traceability
- `actor_type: 'line_voice'` for in-call changes
- `is_test_call: boolean` for preview mode calls

---

## Part 11: Database Migration

### Full Migration SQL

**File:** `supabase/migrations/YYYYMMDD000001_disclaimer_consent_system.sql`

```sql
-- Recording consent columns (reuses existing ultaura_voice_consent_status enum)
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS recording_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recording_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_consent_call_session_id UUID REFERENCES ultaura_call_sessions(id),
  ADD COLUMN IF NOT EXISTS recording_preference_permanent BOOLEAN NOT NULL DEFAULT FALSE;

-- Sharing consent columns
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS sharing_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sharing_tier TEXT NOT NULL DEFAULT 'tier_1'
    CHECK (sharing_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
  ADD COLUMN IF NOT EXISTS sharing_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sharing_consent_call_session_id UUID REFERENCES ultaura_call_sessions(id);

-- Onboarding tracking
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Audit action enum extensions
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'recording_consent_updated';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'sharing_consent_updated';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'sharing_enabled_by_self_user';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'onboarding_completed';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'consent_incomplete_retry';

-- RLS policies for new columns (inherit from existing table policies)
-- No new policies needed - columns inherit table-level RLS

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_line_voice_consent_recording
  ON ultaura_line_voice_consent(recording_consent) WHERE recording_consent != 'pending';
CREATE INDEX IF NOT EXISTS idx_line_voice_consent_sharing
  ON ultaura_line_voice_consent(sharing_consent) WHERE sharing_consent != 'pending';
CREATE INDEX IF NOT EXISTS idx_line_voice_consent_onboarding
  ON ultaura_line_voice_consent(onboarding_completed_at) WHERE onboarding_completed_at IS NOT NULL;

-- Comment documentation
COMMENT ON COLUMN ultaura_line_voice_consent.recording_consent IS 'Recording consent status: pending (not asked), granted (yes), denied (no)';
COMMENT ON COLUMN ultaura_line_voice_consent.recording_preference_permanent IS 'If true, denied means never ask again; if false, ask each call';
COMMENT ON COLUMN ultaura_line_voice_consent.sharing_tier IS 'Family sharing tier: tier_1 (basic), tier_2 (wellness), tier_3 (full), tier_4 (complete)';
COMMENT ON COLUMN ultaura_line_voice_consent.onboarding_completed_at IS 'Timestamp when first call onboarding was completed';
```

---

## Part 12: Critical Files Summary

| Purpose | File Path |
|---------|-----------|
| Account actions & user type | `/src/lib/ultaura/actions.ts` |
| Onboarding prompts | `/packages/prompts/src/golden/sections/onboarding.ts` |
| Identity/are you real | `/packages/prompts/src/golden/sections/identity.ts` |
| Recording consent section | `/packages/prompts/src/golden/sections/recording-consent.ts` (NEW) |
| Sharing consent section | `/packages/prompts/src/golden/sections/family-sharing-consent.ts` (NEW) |
| Prompt params interface | `/packages/prompts/src/profiles/index.ts` |
| Tool definitions | `/packages/prompts/src/tools/definitions.ts` |
| GrokBridge | `/telephony/src/websocket/grok-bridge.ts` |
| Media stream (pass userType) | `/telephony/src/websocket/media-stream.ts` |
| Recording consent handler | `/telephony/src/routes/tools/recording-consent.ts` (NEW) |
| Sharing consent handler | `/telephony/src/routes/tools/sharing-consent.ts` (NEW) |
| Privacy service | `/telephony/src/services/privacy.ts` |
| Twilio utils | `/telephony/src/utils/twilio.ts` |
| Weekly summary aggregation | `/telephony/src/services/weekly-summary.ts` |
| Weekly summary API | `/src/app/api/telephony/weekly-summary/route.ts` |
| AddLineModal | `/src/app/dashboard/(app)/lines/components/AddLineModal.tsx` |
| Line settings | `/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx` |
| Line detail (test call) | `/src/app/dashboard/(app)/lines/[lineId]/LineDetailClient.tsx` |

---

## Part 13: Implementation Order

### Phase 1: Database Schema (Day 1)
1. Create migration with all schema changes
2. Add RLS policy inheritance verification
3. Update TypeScript types in `/packages/types/`
4. Run migration and verify

### Phase 2: Backend - User Type Awareness (Day 2)
1. Update media-stream.ts to fetch and pass `userType`
2. Update GrokBridge to accept all new options
3. Add conditional logic for consent flow
4. Add consent state tracking for reliability

### Phase 3: Backend - Consent Tools (Days 3-5)
1. Create recording consent tool handlers
2. Create sharing consent tool handlers
3. Add `enable_family_sharing` tool for self users
4. Add `revoke_recording_consent` for mid-call revocation
5. Update privacy service with new functions
6. Add Twilio recording control functions (verify API support first)
7. Register new routes in server.ts

### Phase 4: Prompt System (Days 6-8)
1. Update `CompanionPromptParams` interface
2. Create new prompt sections (recording-consent.ts, family-sharing-consent.ts)
3. Add self-user variant for sharing section
4. Update onboarding section with user type awareness
5. Update identity section with "are you real?" guidance
6. Update GrokBridge to inject consent sections based on userType
7. Update prompt compiler

### Phase 5: Dashboard Updates (Days 9-11)
1. Update AddLineModal - conditional tier selector based on userType
2. Update SettingsClient with consent status and user-type-specific options
3. Add test call mode toggle with isPreviewMode flag
4. Add "Add Family Contact" flow for self users enabling sharing
5. Add "Request Re-prompt" button for sharing
6. Update server actions for new fields

### Phase 6: Weekly Summary (Days 12-13)
1. Update aggregation for user-type awareness
2. Update aggregation for tier-based filtering
3. Update email template to conditionally render sections
4. Test email rendering at each tier and user type

### Phase 7: Testing & QA (Days 14-16)
1. End-to-end first call testing (both user types)
2. Subsequent call testing with recording consent
3. Voice command testing for tier changes
4. Mid-call recording revocation testing
5. Self user enabling sharing later
6. Dashboard testing (both user types)
7. Weekly summary testing at each tier
8. Edge case testing (disconnects, unclear responses, DB failures)

---

## Part 14: Verification Plan

### Test Cases

1. **First Call Flow - Family Managed**
   - [ ] AI disclosure spoken at call start
   - [ ] Recording consent asked (if enabled)
   - [ ] Emergency boundary stated
   - [ ] Memory consent asked near end
   - [ ] Family sharing consent asked near end
   - [ ] Consents stored correctly in database
   - [ ] `onboarding_completed_at` set

2. **First Call Flow - Self User**
   - [ ] AI disclosure spoken at call start
   - [ ] Recording consent asked (if enabled)
   - [ ] Emergency boundary stated
   - [ ] Memory consent asked near end
   - [ ] Family sharing consent **NOT** asked
   - [ ] No mention of "your family"
   - [ ] Uses self-focused language

3. **Subsequent Call Flow**
   - [ ] Brief recording consent asked
   - [ ] No AI disclosure repeated
   - [ ] Emergency disclaimer only on distress/help request

4. **Recording Denial**
   - [ ] Recording stops mid-call via Twilio API
   - [ ] Preference question asked
   - [ ] Preference stored correctly
   - [ ] Dashboard shows decline status

5. **Mid-Call Recording Revocation**
   - [ ] "Stop recording" recognized
   - [ ] Recording stops immediately
   - [ ] Permanent preference question asked
   - [ ] Audit log entry created

6. **Sharing Tier Changes (Family Managed)**
   - [ ] Voice commands recognized
   - [ ] Tier updated in database
   - [ ] Weekly summary respects tier

7. **Self User Enables Sharing**
   - [ ] Voice command "share with my family" recognized
   - [ ] `sharing_enabled` set to true
   - [ ] `sharing_enabled_at` recorded
   - [ ] Dashboard shows "Add Family Contact" prompt
   - [ ] Tier preference asked on next call
   - [ ] Summaries only sent after contact added

8. **Dashboard - Family Managed**
   - [ ] Tier selector visible in AddLineModal
   - [ ] Consent status in line settings
   - [ ] Test call preview mode works
   - [ ] "Request Re-prompt" button works

9. **Dashboard - Self User**
   - [ ] Tier selector hidden in AddLineModal
   - [ ] "Enable sharing" option in settings
   - [ ] "Add Family Contact" flow works
   - [ ] Test call preview mode works

10. **Weekly Summary**
    - [ ] Family managed: Email sent with correct tier filtering
    - [ ] Self user (sharing off): No family email
    - [ ] Self user (sharing on): Email sent to designated contact
    - [ ] Insights page shows tier-appropriate data

11. **Edge Cases**
    - [ ] Call disconnect before consent → re-asks next call
    - [ ] Unclear response → clarification asked (max 2x)
    - [ ] DB write failure → retries, treats as not consented
    - [ ] Tool not called → consent_incomplete logged, re-asks next call

12. **Test Call Preview Mode**
    - [ ] isPreviewMode triggers full first-call flow
    - [ ] Consent responses NOT persisted
    - [ ] Audit log marked as test call

13. **User Type Mismatch**
    - [ ] If `family_managed` but senior says "I set this up myself" → Ultaura acknowledges gracefully, continues call normally
    - [ ] Note in audit log for potential account type review
    - [ ] Do NOT change `user_type` automatically during call (requires dashboard action)
    - [ ] Inform payer via dashboard notification: "[Name] mentioned they set up the service themselves. You may want to review account settings."


  ### Questions and Responses exchanged during preparation for implementation
  1. Recording start/stop

  Current state: Recording uses TwiML attribute record="record-from-answer" on <Connect>, which starts recording automatically when the call connects (before any consent is obtained).

  Recommendation: Switch to API-based recording that starts only after grant_recording_consent is called:

  // After grant_recording_consent tool is called:
  await twilioClient.calls(callSid).recordings.create({
    recordingStatusCallback: `${publicUrl}/twilio/recording-status`,
    recordingStatusCallbackEvent: ['completed']
  });

  // To stop mid-call after deny/revoke:
  await twilioClient.recordings(recordingSid).update({ status: 'stopped' });

  This ensures we never record before consent. The recording_sid is already stored in ultaura_call_sessions.

  ---
  2. Preview call flag

  Recommendation: Add a database column is_preview_mode BOOLEAN DEFAULT FALSE to ultaura_call_sessions.

  Rationale:
  - Audit trail: You can query which calls were previews
  - Consent tools need to know not to persist
  - Avoids memory leak concerns with in-memory maps
  - Recording status callback needs to know to handle differently
  - Consistent with existing patterns (session data is in DB)

  ---
  3. Default tier conflict

  Recommendation: The spec already says "Senior's voice choice ALWAYS overrides the dashboard default tier."

  Implementation flow:
  1. Payer selects default tier in AddLineModal → stored in ultaura_line_voice_consent.sharing_tier as initial value
  2. On first call, if senior says YES → keep the payer's default tier (don't force tier_2)
  3. If senior says NO → set to tier_1
  4. If senior later uses voice commands to change → that tier wins

  Change the spec: Remove "If YES set tier_2" and instead say "If YES, honor the payer-selected default tier."

  ---
  4. Sharing re-prompt cooldown

  Recommendation: Reuse the existing pattern - use a dedicated column sharing_last_prompt_at TIMESTAMPTZ.

  Rationale:
  - sharing_consent_at records when consent was given/denied
  - You need a separate timestamp for when the last re-prompt was made (which could be a re-prompt after decline)
  - Matches the existing last_consent_prompt_at pattern for memory consent

  ---
  5. Recording re-enable

  Recommendation: When payer clicks "Re-enable":
  1. Set recording_consent = 'pending' (not 'granted' - senior must consent)
  2. Set recording_preference_permanent = false
  3. Add a column recording_reenable_requested_at TIMESTAMPTZ
  4. On next call, if recording_consent = 'pending' AND recording_reenable_requested_at IS NOT NULL, prompt with: "Your family enabled recording again - would you like me to record our calls?"
  5. Clear recording_reenable_requested_at after prompting

  This respects senior autonomy while allowing family to request reconsideration.

  ---
  6. Memory consent re-ask

  Current state: 30-day cooldown after denial, using last_consent_prompt_at.

  Recommendation: Keep the 30-day re-ask after denial. Rationale:
  - Seniors may change their mind over time
  - Matches the existing proven pattern
  - The spec's onboarding flow handles the initial ask; the 30-day is for follow-up
  - Don't remove it - memory personalization is a core value proposition

  ---
  7. Consent incomplete state

  Recommendation: Use onboarding_completed_at + audit log only. Don't add a separate column.

  Logic:
  - If onboarding_completed_at IS NULL after a call ends → treat next call as first call for consent purposes
  - Log consent_incomplete_retry to audit log
  - The in-memory ConsentState tracks during the call; DB state is checked at call start

  This avoids adding yet another status column and uses existing infrastructure.

  ---
  8. Weekly summary for self + sharing

  Recommendation: Generate two separate versions:

  1. Self recipient (when self user or family_managed payer): Full summary - all data they're entitled to see
  2. Family recipients (when sharing enabled): Tier-clamped + sharing_enabled_at-clamped

  The existing shareStartUtc logic already clamps data for self users who enabled sharing later. Extend this to also apply tier filtering for family recipients.

  Self users viewing their own insights page = full access to their own data (no tier restriction).

  ---
  9. Insights gating

  Recommendation: For family-managed accounts on the insights page:
  Sharing Status: tier_1 (basic)
  Behavior: Show call stats only. Other sections show
    "Detailed insights require a higher sharing
     level. [Name] controls this setting."
  ────────────────────────────────────────
  Sharing Status: tier_2+
  Behavior: Show sections appropriate to tier
  ────────────────────────────────────────
  Sharing Status: Denied/pending
  Behavior: Same as tier_1
  Don't hide the page entirely - always show call stats (completion/missed) since that's tier_1 baseline. Use visual indicators for unavailable sections rather than hiding them completely (better UX, less confusion).

  ---
  10. Tier data scope

  Current state: Weekly summaries include mood, topics, concerns, call stats, but NOT safety alerts or usage/billing data.

  Recommendation: Add to weekly summary:
  - Safety alerts: Pull from ultaura_safety_events table (already exists)
  - Usage/billing: Add minutesUsed, minutesRemaining, overageAmount from minute ledger

  Format suggestion:
  interface WeeklySummaryData {
    // Add:
    safetyEvents: Array<{
      severity: 'low' | 'medium' | 'high';
      timestamp: string;
      actionTaken: string;
    }>;
    usageSummary: {
      minutesUsed: number;
      minutesRemaining: number;
      overageMinutes: number;
      overageCost: number;
    };
  }

  Include safety events (high tier only) and usage in all tiers.

  ---
  11. Prompt conflicts

  Current prompts say:
  - Privacy policy: "family cannot see transcripts" / "only basic call information (time, duration) is visible"
  - Health-wellness: "ALL health mentions are PRIVATE. Never share with family."

  Recommendation: Update prompts to be tier-aware:

  Privacy policy update:
  Based on {userName}'s sharing preferences, family may receive:
  - Tier 1: Call stats only (when answered, duration)
  - Tier 2: + General mood and wellness trends (no specifics)
  - Tier 3: + Topic categories discussed (no content)
  - Tier 4: + Mild concern observations

  Regardless of tier, NEVER share:
  - Exact words or quotes from conversations
  - Specific health symptoms or medication names
  - Topics {userName} marked as private

  Health-wellness update:
  Health mentions are handled carefully:
  - Specific symptoms/medications are NEVER shared verbatim
  - General wellness trends (e.g., "mentioned feeling tired") may be aggregated if tier 2+
  - Severe concerns (falls, medication confusion) trigger safety alerts regardless of tier

  ---
  12. Self user enabling sharing

  Recommendation: When enabled by voice:
  1. Set sharing_consent = 'pending' (not granted yet)
  2. Set sharing_enabled = true on account
  3. Immediately ask for tier preference in same call
  4. Only after tier is chosen → set sharing_consent = 'granted' + sharing_tier = chosen_tier
  5. Summaries suppressed until:
    - sharing_consent = 'granted'
    - AND family contact is added via dashboard

  This ensures explicit tier consent, not just a blanket "yes."

  ---
  13. Dashboard location

  Recommendation: Reuse the existing Privacy Center UI at /src/app/dashboard/(app)/privacy/PrivacyCenterClient.tsx.

  It already has:
  - Family Sharing Section (for self users)
  - Family Recipients Section (invite up to 5 family members)
  - Toggle controls

  Add the tier selector and consent status display to this existing UI rather than duplicating in line settings. Line settings can link to Privacy Center for sharing management.

  ---
  14. Weekly summary default

  Current state: weekly_summary_enabled defaults to true in ultaura_notification_preferences.

  Recommendation:
  - Change default to false for new self-user accounts (they have no one to send to)
  - Keep true for family_managed accounts
  - Don't backfill existing accounts - they may have already configured preferences

  Implementation:
  -- In account creation logic, not migration
  INSERT INTO ultaura_notification_preferences (account_id, weekly_summary_enabled, ...)
  VALUES (
    new_account_id,
    CASE WHEN user_type = 'family_managed' THEN true ELSE false END,
    ...
  );

  ---
  15. Emergency boundary on later calls

  Recommendation: Prompt-only guidance is correct. No tool/logic trigger required.

  The existing safety policy handles distress detection separately. The emergency boundary disclaimer is conversational guidance for Ultaura to mention 911 when:
  - Distress keywords detected (already triggers safety-event tool)
  - User asks for medical/emergency help

  No new tool needed - just update the prompt to include this as situational guidance. The safety-event tool already handles the automated alerting path.

  ---
  16. Preview mode recordings

  Recommendation: Skip recording entirely for preview/test calls.

  Rationale:
  - Preview calls are for the payer to experience the flow, not the senior
  - Recording the payer's voice serves no purpose and creates unnecessary data
  - Consent obtained in preview mode isn't persisted anyway, so recording would lack valid consent
  - Avoids complexity of auto-delete logic and Twilio costs
  - Simpler implementation: when is_preview_mode = true, don't initiate recording regardless of account settings

  Implementation:
  const shouldRecord = recordingEnabled &&
    recordingConsent === 'granted' &&
    !isPreviewMode;  // <-- Skip for previews

  ---
  17. Privacy Center tier selector

  Recommendation: Read-only display of senior's current tier, with a "Request Change" button.

  Rationale:
  - The spec explicitly states "Senior's voice choice ALWAYS overrides"
  - Allowing payer to directly edit undermines senior autonomy
  - Creates trust issues if senior discovers family changed their settings
  - Consistent with the recording re-enable pattern (request, not force)

  UI design:
  Family Sharing Level
  ────────────────────
  Current: Wellness Check (Tier 2)
  Set by: Mom during call on Jan 15

  [Request Change]

  ℹ️ Mom controls this setting. Clicking "Request Change"
  will prompt her on the next call to review sharing options.

  When clicked:
  1. Set sharing_reprompt_requested_at = now() on ultaura_line_voice_consent
  2. On next call, if this flag is set, Ultaura says: "Your family asked if you'd like to adjust what I share with them. Would you like to share more, less, or keep things as they are?"
  3. Clear the flag after prompting

  Exception: Payer CAN set the initial default in AddLineModal before the first call (when sharing_consent = 'pending'). After senior has made their choice, it becomes read-only.

  ---
  18. Detailed line insights (/dashboard/lines/[lineId]/insights)

  Recommendation: Allow access with tier-filtered content, don't block or redirect.

  Rationale:
  - Per-line insights are useful when managing multiple lines (Family plan with 4 lines)
  - Redirecting to /dashboard/insights loses context of which line you're viewing
  - Blocking entirely is poor UX and creates confusion
  - Tier filtering is already needed for the main insights page anyway - reuse the same logic

  Tier-based section visibility:
  Section: Call Stats (answered/missed/duration)
  tier_1: ✓
  tier_2: ✓
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Call Activity Chart
  tier_1: ✓
  tier_2: ✓
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Safety Alerts History
  tier_1: ✓
  tier_2: ✓
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Mood Summary
  tier_1: —
  tier_2: ✓
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Mood Trend Chart
  tier_1: —
  tier_2: ✓
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Engagement Metrics
  tier_1: —
  tier_2: ✓
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Topics Chart
  tier_1: —
  tier_2: —
  tier_3: ✓
  tier_4: ✓
  ────────────────────────────────────────
  Section: Concerns List
  tier_1: —
  tier_2: —
  tier_3: —
  tier_4: ✓
  ────────────────────────────────────────
  Section: Follow-up Recommendations
  tier_1: —
  tier_2: —
  tier_3: —
  tier_4: ✓
  For unavailable sections, show a subtle message:
  Mood Trends
  ───────────
  This section requires Wellness Check sharing level or higher.
  [Name] controls sharing preferences during calls.

  This approach:
  - Respects senior's tier choice
  - Gives payer visibility into what's available at each tier (encourages conversation with senior)
  - Consistent experience across both insights routes
  - Single filtering implementation reused in both places