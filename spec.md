# Ultaura Safety and Compliance Gaps - Implementation Specification

This specification outlines 7 safety and compliance gaps to be implemented in the Ultaura codebase. Each gap is self-contained with all necessary context for implementation.

---

## Table of Contents

1. [Gap 1: Emergency Boundary Statement in Onboarding](#gap-1-emergency-boundary-statement-in-onboarding)
2. [Gap 2: trusted_contact_notify Consent Creation](#gap-2-trusted_contact_notify-consent-creation)
3. [Gap 3: Consent Management UI for Trusted Contacts](#gap-3-consent-management-ui-for-trusted-contacts)
4. [Gap 4: Safety Signals Taxonomy (Structured Categories)](#gap-4-safety-signals-taxonomy-structured-categories)
5. [Gap 5: Confidence Score for Safety Events](#gap-5-confidence-score-for-safety-events)
6. [Gap 6: SMS STOP Keyword Handling](#gap-6-sms-stop-keyword-handling)
7. [Gap 7: Call Events Include Safety Category](#gap-7-call-events-include-safety-category)
8. [Database Migration Summary](#database-migration-summary)
9. [Implementation Order](#implementation-order)
10. [Cross-Reference Summary](#cross-reference-summary)

---

## Gap 1: Emergency Boundary Statement in Onboarding

### Summary
Add an emergency boundary statement to the first-call onboarding prompt that clearly sets expectations about Ultaura's role as a companion (not an emergency service).

### Current State
The onboarding prompt in `/packages/prompts/src/golden/sections/onboarding.ts` contains a warm introduction but lacks any explicit emergency/safety boundary statement:

```typescript
export const ONBOARDING_SECTION = {
  tag: 'onboarding',
  full: `## First Call - Onboarding
This is your first call with {userName}. Take time to:
1. Introduce yourself warmly: "Hello! I'm Ultaura, an AI voice companion."
2. Ask what they'd like to be called
3. Learn about their interests
4. Ask about topics to avoid
5. Explain privacy: "Your family doesn't see our conversations."
6. Discuss call schedule if they'd like regular check-ins`,
  compressed: `## First Call
Introduce yourself, ask what they'd like to be called, learn interests + avoid topics, explain privacy, ask about schedule.`,
};
```

### Required Changes

**File: `/packages/prompts/src/golden/sections/onboarding.ts`**

Modify the onboarding section to include an emergency boundary statement after the greeting but before the conversation begins.

**Approved wording:**
> "Hi, I'm Ultaura! Just so you know, I'm a companion—not an emergency service. If you're ever in immediate danger, please call 911."

**Updated implementation:**
```typescript
export const ONBOARDING_SECTION = {
  tag: 'onboarding',
  full: `## First Call - Onboarding
This is your first call with {userName}. Take time to:
1. Introduce yourself warmly: "Hello! I'm Ultaura, an AI voice companion."
2. Provide the emergency boundary statement: "Just so you know, I'm a companion—not an emergency service. If you're ever in immediate danger, please call 911."
3. Ask what they'd like to be called
4. Learn about their interests
5. Ask about topics to avoid
6. Explain privacy: "Your family doesn't see our conversations."
7. Discuss call schedule if they'd like regular check-ins`,
  compressed: `## First Call
Introduce yourself + emergency boundary, ask what they'd like to be called, learn interests + avoid topics, explain privacy, ask about schedule.`,
};
```

### Implementation Notes
- Keep the statement simple and direct (no mention of family notifications)
- The statement should be delivered naturally after the greeting
- Reference `/packages/prompts/src/golden/sections/identity.ts` for the boundary statement style pattern (lines 7-9 show similar boundary statements about not being a therapist/doctor)

---

## Gap 2: trusted_contact_notify Consent Creation

### Summary
When adding a trusted contact via the dashboard, automatically create a `trusted_contact_notify` consent record after the payer acknowledges the notification behavior through a confirmation dialog.

### Current State

**Consent Check Location:** `/telephony/src/routes/tools/safety-event.ts` (lines 26-39)
```typescript
// Check for trusted_contact_notify consent
const { data: consent } = await supabase
  .from('ultaura_consents')
  .select('granted')
  .eq('line_id', lineId)
  .eq('type', 'trusted_contact_notify')
  .eq('granted', true)
  .is('revoked_at', null)
  .maybeSingle();

if (!consent) {
  logger.info({ lineId }, 'No trusted contact consent found, skipping notification');
  return;  // SILENTLY FAILS - notifications never send
}
```

**Missing Consent Creation:** `/src/lib/ultaura/contacts.ts` (lines 28-65)
The `addTrustedContact` function inserts into `ultaura_trusted_contacts` but does NOT create a consent record.

**Reference Pattern:** `/src/lib/ultaura/schedules.ts` (lines 117-124)
```typescript
await client.from('ultaura_consents').insert({
  account_id: input.accountId,
  line_id: parsed.data.lineId,
  type: 'outbound_calls',
  granted: true,
  granted_by: 'payer_ack',
  evidence: { timestamp: new Date().toISOString() },
});
```

### Required Changes

**File: `/src/lib/ultaura/contacts.ts`**

Modify `addTrustedContactWithTrial` to create a consent record after successful contact insertion.

**Updated implementation:**
```typescript
const addTrustedContactWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: {
    lineId: string;
    lineShortId: string;
    contact: unknown;
    consentEvidence: {
      timestamp: string;
      ipAddress?: string;
      userAgent?: string;
      dashboardUserId?: string;
      contactName: string;
    };
  }
): Promise<ActionResult<void>> => {
  const parsed = CreateTrustedContactInputSchema.safeParse(input.contact);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const client = getSupabaseServerComponentClient();

  const { error } = await client.from('ultaura_trusted_contacts').insert({
    account_id: account.id,
    line_id: input.lineId,
    name: parsed.data.name,
    phone_e164: parsed.data.phoneE164,
    relationship: parsed.data.relationship,
    notify_on: parsed.data.notifyOn || ['medium', 'high'],
    enabled: true,
  });

  if (error) {
    logger.error({ error }, 'Failed to add trusted contact');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, error.message || 'Failed to add contact'),
    };
  }

  // Create trusted_contact_notify consent record
  await client.from('ultaura_consents').insert({
    account_id: account.id,
    line_id: input.lineId,
    type: 'trusted_contact_notify',
    granted: true,
    granted_by: 'payer_ack',
    evidence: input.consentEvidence,
  });

  revalidatePath(`/dashboard/lines/${input.lineShortId}/contacts`);
  return { success: true, data: undefined };
});
```

**File: `/src/lib/ultaura/contacts.ts`**

Update the public `addTrustedContact` function signature to accept consent evidence:

```typescript
export async function addTrustedContact(
  lineId: string,
  input: unknown,
  consentEvidence?: {
    ipAddress?: string;
    userAgent?: string;
    dashboardUserId?: string;
  }
): Promise<ActionResult<void>> {
  // ... existing validation ...

  const parsed = CreateTrustedContactInputSchema.safeParse(input);
  const contactName = parsed.success ? parsed.data.name : 'Unknown';

  return addTrustedContactWithTrial(account, {
    lineId,
    lineShortId: line.short_id,
    contact: input,
    consentEvidence: {
      timestamp: new Date().toISOString(),
      ipAddress: consentEvidence?.ipAddress,
      userAgent: consentEvidence?.userAgent,
      dashboardUserId: consentEvidence?.dashboardUserId,
      contactName,
    },
  });
}
```

### Consent Evidence Fields (Full Audit Trail)
- `timestamp`: ISO 8601 timestamp of acknowledgment
- `ipAddress`: Request IP (from headers)
- `userAgent`: Browser user agent
- `dashboardUserId`: ID of the payer user creating the contact
- `contactName`: Name of the trusted contact being added

---

## Gap 3: Consent Management UI for Trusted Contacts

### Summary
Update the trusted contacts UI to include a consent confirmation checkbox and explanatory text clarifying notification triggers.

### Current State

**File: `/src/app/dashboard/(app)/lines/[lineId]/contacts/ContactsClient.tsx`**

The current UI has:
- Basic form with name, phone, relationship fields
- No consent confirmation checkbox/dialog
- Minimal explanatory text (line 96-98):
```typescript
<p className="text-muted-foreground">
  Trusted contacts can be notified if we detect signs of distress during calls
  (only with the caller&apos;s consent).
</p>
```

### Required Changes

**File: `/src/app/dashboard/(app)/lines/[lineId]/contacts/ContactsClient.tsx`**

#### 1. Add consent confirmation checkbox to the add contact form:

```typescript
// Add to state
const [consentAcknowledged, setConsentAcknowledged] = useState(false);

// Add to form (before submit buttons)
<div className="space-y-2">
  <div className="flex items-start gap-2">
    <Checkbox
      id="consent-acknowledgment"
      checked={consentAcknowledged}
      onCheckedChange={(checked) => setConsentAcknowledged(checked === true)}
    />
    <label htmlFor="consent-acknowledgment" className="text-sm leading-tight">
      I understand that this contact will receive SMS notifications when Ultaura detects
      signs of distress during calls (such as expressions of hopelessness or self-harm).
    </label>
  </div>
  <a href="/docs" className="text-xs text-primary hover:underline">
    Learn more about trusted contact notifications
  </a>
</div>
```

#### 2. Disable submit button until consent is acknowledged:
```typescript
<Button type="submit" disabled={!consentAcknowledged}>Add</Button>
```

#### 3. Update explanatory text at the top:
```typescript
<p className="text-muted-foreground">
  Trusted contacts receive SMS alerts when Ultaura detects signs of distress during calls,
  such as expressions of hopelessness, self-harm, or other safety concerns.
  <a href="/docs" className="text-primary hover:underline ml-1">
    Learn more
  </a>
</p>
```

#### 4. Reset consent checkbox when modal closes or form submits:
```typescript
// In handleAddContact success path:
setConsentAcknowledged(false);

// When modal closes:
onOpenChange={(open) => {
  if (!open) setConsentAcknowledged(false);
}}
```

### Implementation Notes
- The "Learn more" link points to `/docs` as a placeholder for now
- Consent checkbox must be checked before the "Add" button is enabled
- Evidence is captured server-side from request headers where possible

---

## Gap 4: Safety Signals Taxonomy (Structured Categories)

### Summary
Add a structured clinical taxonomy for safety signal categories to replace free-text descriptions.

### Current State

**Tool Definition:** `/packages/prompts/src/tools/definitions.ts` (lines 694-725)
The `log_safety_concern` tool only accepts `tier`, `signals` (free text), and `action_taken`.

**Storage:** `/telephony/src/routes/tools/safety-event.ts` (lines 174-184)
```typescript
await recordSafetyEvent({
  accountId,
  lineId,
  callSessionId,
  tier,
  signals: {
    description: signals,  // Free-text, problematic
    source: sourceValue,
  },
  actionTaken,
});
```

**Keywords:** `/packages/prompts/src/safety/keywords.ts`
Maps keywords to tiers but doesn't assign categories.

### Required Changes

#### 1. Define Safety Categories

**File: `/packages/types/src/safety.ts`** (new or update existing)

```typescript
export type SafetyTier = 'low' | 'medium' | 'high';
export type SafetyActionTaken = 'none' | 'suggested_988' | 'suggested_911' | 'notified_contact' | 'transferred_call';

export type SafetyCategory =
  | 'SUICIDAL_IDEATION'      // HIGH tier
  | 'SELF_HARM'               // HIGH tier
  | 'HOPELESSNESS'            // MEDIUM tier
  | 'ISOLATION_DISTRESS'      // LOW tier
  | 'PHYSICAL_DANGER'         // HIGH tier
  | 'MEDICAL_EMERGENCY'       // HIGH tier
  | 'ABUSE_CONCERN'           // HIGH tier
  | 'COGNITIVE_DECLINE'       // LOW tier
  | 'GENERAL_CONCERN';        // Tier determined by model (catch-all)

export const SAFETY_CATEGORY_TIERS: Record<SafetyCategory, SafetyTier | null> = {
  SUICIDAL_IDEATION: 'high',
  SELF_HARM: 'high',
  HOPELESSNESS: 'medium',
  ISOLATION_DISTRESS: 'low',
  PHYSICAL_DANGER: 'high',
  MEDICAL_EMERGENCY: 'high',
  ABUSE_CONCERN: 'high',
  COGNITIVE_DECLINE: 'low',
  GENERAL_CONCERN: null, // Tier determined by model
};
```

#### 2. Update Tool Definition

**File: `/packages/prompts/src/tools/definitions.ts`**

Update `log_safety_concern` tool:
```typescript
{
  type: 'function',
  name: 'log_safety_concern',
  description: `Log when you detect genuine safety concerns during the conversation.

CATEGORIES (with fixed tier mapping):
- SUICIDAL_IDEATION (HIGH): User mentions suicide, wanting to die, ending their life
- SELF_HARM (HIGH): User mentions cutting, hurting themselves, self-injury
- HOPELESSNESS (MEDIUM): User expresses hopelessness, despair, "giving up"
- ISOLATION_DISTRESS (LOW): User seems persistently sad, lonely, isolated
- PHYSICAL_DANGER (HIGH): User in immediate physical danger from others or environment
- MEDICAL_EMERGENCY (HIGH): User describes symptoms requiring immediate medical attention
- ABUSE_CONCERN (HIGH): Signs of elder abuse, neglect, or exploitation
- COGNITIVE_DECLINE (LOW): Concerning changes in memory, confusion, disorientation
- GENERAL_CONCERN: Other concerning behavior not fitting above categories (specify tier)

IMPORTANT: Call this tool AFTER providing an empathetic response, not before.`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: [
          'SUICIDAL_IDEATION',
          'SELF_HARM',
          'HOPELESSNESS',
          'ISOLATION_DISTRESS',
          'PHYSICAL_DANGER',
          'MEDICAL_EMERGENCY',
          'ABUSE_CONCERN',
          'COGNITIVE_DECLINE',
          'GENERAL_CONCERN',
        ],
        description: 'Clinical category of the safety concern',
      },
      tier: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Severity tier (auto-assigned for most categories, required for GENERAL_CONCERN)',
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in the assessment (0.0-1.0)',
      },
      action_taken: {
        type: 'string',
        enum: ['none', 'suggested_988', 'suggested_911'],
        description: 'What action you recommended to the user',
      },
    },
    required: ['category', 'confidence', 'action_taken'],
  },
},
```

#### 3. Update Schema

**File: `/packages/schemas/src/telephony/safety-event.ts`**

```typescript
import { z } from 'zod';

export const SafetyCategorySchema = z.enum([
  'SUICIDAL_IDEATION',
  'SELF_HARM',
  'HOPELESSNESS',
  'ISOLATION_DISTRESS',
  'PHYSICAL_DANGER',
  'MEDICAL_EMERGENCY',
  'ABUSE_CONCERN',
  'COGNITIVE_DECLINE',
  'GENERAL_CONCERN',
]);

export const SafetyEventInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  category: SafetyCategorySchema,
  tier: z.enum(['low', 'medium', 'high']),
  confidence: z.number().min(0).max(1),
  actionTaken: z.enum([
    'none',
    'suggested_988',
    'suggested_911',
    'notified_contact',
    'transferred_call',
  ]),
  source: z.enum(['model', 'keyword_backstop']).optional(),
});

export type SafetyEventInput = z.infer<typeof SafetyEventInputSchema>;
export type SafetyCategory = z.infer<typeof SafetyCategorySchema>;
```

#### 4. Update Keyword Mappings

**File: `/packages/prompts/src/safety/keywords.ts`**

Add category mappings for keyword backstop:
```typescript
import type { SafetyCategory } from '@ultaura/types';

// Map keywords to categories for backstop
export const KEYWORD_CATEGORIES: Record<string, SafetyCategory> = {
  // HIGH - SUICIDAL_IDEATION
  'suicide': 'SUICIDAL_IDEATION',
  'kill myself': 'SUICIDAL_IDEATION',
  'end my life': 'SUICIDAL_IDEATION',
  'end it all': 'SUICIDAL_IDEATION',
  'want to die': 'SUICIDAL_IDEATION',
  'take my own life': 'SUICIDAL_IDEATION',
  'better off dead': 'SUICIDAL_IDEATION',
  "don't want to live": 'SUICIDAL_IDEATION',
  'no reason to live': 'SUICIDAL_IDEATION',
  'suicidio': 'SUICIDAL_IDEATION',
  'matarme': 'SUICIDAL_IDEATION',
  'quiero morir': 'SUICIDAL_IDEATION',
  'acabar con todo': 'SUICIDAL_IDEATION',

  // HIGH - SELF_HARM
  'hurt myself': 'SELF_HARM',
  'harm myself': 'SELF_HARM',
  'self-harm': 'SELF_HARM',
  'self harm': 'SELF_HARM',
  'cut myself': 'SELF_HARM',

  // MEDIUM - HOPELESSNESS
  'hopeless': 'HOPELESSNESS',
  'give up': 'HOPELESSNESS',
  'giving up': 'HOPELESSNESS',
  'not worth living': 'HOPELESSNESS',
  "what's the point": 'HOPELESSNESS',
  'no point in living': 'HOPELESSNESS',
  "can't go on": 'HOPELESSNESS',
  "can't take it anymore": 'HOPELESSNESS',
  "wish i wasn't here": 'HOPELESSNESS',
  'disappear': 'HOPELESSNESS',
  'nobody would miss me': 'HOPELESSNESS',
  'burden to everyone': 'HOPELESSNESS',
  'sin esperanza': 'HOPELESSNESS',
  'no vale la pena': 'HOPELESSNESS',
  'rendirme': 'HOPELESSNESS',

  // LOW - ISOLATION_DISTRESS
  'so lonely': 'ISOLATION_DISTRESS',
  'all alone': 'ISOLATION_DISTRESS',
  'nobody cares': 'ISOLATION_DISTRESS',
  "don't care anymore": 'ISOLATION_DISTRESS',
  'tired of everything': 'ISOLATION_DISTRESS',
  'exhausted with life': 'ISOLATION_DISTRESS',
  'nothing matters': 'ISOLATION_DISTRESS',
  'muy solo': 'ISOLATION_DISTRESS',
  'muy sola': 'ISOLATION_DISTRESS',
  'nadie me quiere': 'ISOLATION_DISTRESS',
};
```

#### 5. Update Safety Event Handler

**File: `/telephony/src/routes/tools/safety-event.ts`**

Update to handle category and confidence:
```typescript
const {
  callSessionId,
  lineId,
  category,
  tier,
  confidence,
  actionTaken,
  source = 'model',
} = parsed.data;

// ... existing validation ...

// Determine category for keyword backstop if not provided
let effectiveCategory = category;
let effectiveConfidence = confidence;

if (sourceValue === 'keyword_backstop') {
  // Keyword backstop gets confidence = 1.0
  effectiveConfidence = 1.0;
  // Category derived from keyword mapping if not provided
  if (!category) {
    effectiveCategory = getKeywordCategory(matchedKeyword) || 'GENERAL_CONCERN';
  }
}

await recordSafetyEvent({
  accountId,
  lineId,
  callSessionId,
  tier,
  category: effectiveCategory,
  confidence: effectiveConfidence,
  signals: {
    source: sourceValue,
  },
  actionTaken,
});
```

### New Signals Structure
```json
{
  "source": "model"
}
```

The category and confidence are now stored as separate columns, not inside the signals JSONB.

### Migration Notes
- Forward-only migration, no backfill of historical data
- Historical events retain their existing signals structure
- New events use category + confidence columns

---

## Gap 5: Confidence Score for Safety Events

### Summary
Add model-provided confidence scores (0.0-1.0) for safety events, with keyword backstop matches getting confidence = 1.0.

### Implementation
This gap is fully addressed by Gap 4 implementation. The key additions are:

1. **Schema:** Added `confidence` field (0.0-1.0) to `SafetyEventInputSchema`
2. **Tool definition:** Added `confidence` parameter (required) to `log_safety_concern`
3. **Database:** Added `confidence` column to `ultaura_safety_events`
4. **Storage:** Updated `recordSafetyEvent` to store confidence as separate column

### Confidence Values
- **Model-detected events:** Model provides confidence score (e.g., 0.85)
- **Keyword backstop events:** Always gets `confidence = 1.0` (exact match)

### Database Record Structure (new)
```sql
-- Example row
category: 'SUICIDAL_IDEATION'
tier: 'high'
confidence: 0.92
signals: { "source": "model" }
action_taken: 'suggested_988'
```

---

## Gap 6: SMS STOP Keyword Handling

### Summary
Implement inbound SMS webhook to handle STOP/UNSUBSCRIBE keywords and manage SMS opt-outs at the phone number level.

### Current State

**SMS Sending:** `/telephony/src/utils/twilio.ts` (lines 290-314)
- `sendSms()` function exists but no opt-out checking

**Opt-Out Recording:** `/telephony/src/services/line-lookup.ts` (lines 236-260)
```typescript
export async function recordOptOut(...) {
  const { error } = await supabase.from('ultaura_opt_outs').insert({
    account_id: accountId,
    line_id: lineId,
    channel: 'outbound_calls',  // HARDCODED - needs fix
    source,
    reason,
    call_session_id: callSessionId,
  });
}
```

### Required Changes

#### 1. Create SMS Inbound Route

**File: `/telephony/src/routes/twilio-sms-inbound.ts`** (new file)

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { validateTwilioSignature, sendSms } from '../utils/twilio.js';

export const twilioSmsInboundRouter = Router();

const STOP_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'end', 'quit']);
const START_KEYWORDS = new Set(['start', 'subscribe', 'unstop']);

interface TwilioSmsWebhook {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}

twilioSmsInboundRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    // Validate Twilio signature in production
    if (process.env.NODE_ENV === 'production') {
      const signature = req.headers['x-twilio-signature'] as string;
      const url = `${process.env.ULTAURA_PUBLIC_URL}/twilio/sms/inbound`;
      if (!validateTwilioSignature(url, req.body, signature)) {
        logger.warn('Invalid Twilio signature on SMS webhook');
        res.status(403).send('Forbidden');
        return;
      }
    }

    const { From: from, To: to, Body: body, MessageSid: messageSid } = req.body as TwilioSmsWebhook;
    const normalizedBody = body.trim().toLowerCase();

    logger.info({ from, messageSid, body: normalizedBody }, 'Inbound SMS received');

    if (STOP_KEYWORDS.has(normalizedBody)) {
      await handleSmsOptOut(from);

      // Send confirmation response
      const dashboardUrl = process.env.ULTAURA_DASHBOARD_URL || 'https://ultaura.com';
      await sendSms({
        to: from,
        body: `Unsubscribed from Ultaura SMS. Manage preferences at ${dashboardUrl}/settings. Reply START to re-subscribe.`,
        skipOptOutCheck: true,  // Allow sending opt-out confirmation
      });

      logger.info({ phone: from }, 'SMS opt-out processed');
    } else if (START_KEYWORDS.has(normalizedBody)) {
      await handleSmsOptIn(from);

      await sendSms({
        to: from,
        body: 'You have been re-subscribed to Ultaura SMS notifications.',
        skipOptOutCheck: true,
      });

      logger.info({ phone: from }, 'SMS opt-in processed');
    }

    // Return empty TwiML response
    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    logger.error({ error }, 'Error processing inbound SMS');
    res.status(500).send('Internal Server Error');
  }
});

async function handleSmsOptOut(phoneE164: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Insert into SMS opt-out table (phone-level, not line-level)
  // Use upsert to handle duplicate STOP messages
  await supabase.from('ultaura_sms_opt_outs').upsert({
    phone_e164: phoneE164,
    source: 'sms_keyword',
    keyword: 'STOP',
  }, {
    onConflict: 'phone_e164',
  });
}

async function handleSmsOptIn(phoneE164: string): Promise<void> {
  const supabase = getSupabaseClient();

  // Remove opt-out record
  await supabase
    .from('ultaura_sms_opt_outs')
    .delete()
    .eq('phone_e164', phoneE164);
}
```

#### 2. Register Route in Server

**File: `/telephony/src/server.ts`**

Add import and registration:
```typescript
import { twilioSmsInboundRouter } from './routes/twilio-sms-inbound.js';

// ... existing routes ...
app.use('/twilio/sms', twilioSmsInboundRouter);
```

#### 3. Fix recordOptOut Channel Parameter

**File: `/telephony/src/services/line-lookup.ts`**

Update `recordOptOut` to accept channel parameter:
```typescript
export async function recordOptOut(
  accountId: string,
  lineId: string,
  callSessionId: string | null,
  source: 'dtmf' | 'voice' | 'dashboard' | 'sms_keyword',
  reason?: string,
  channel: 'outbound_calls' | 'sms' | 'all' = 'outbound_calls'
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('ultaura_opt_outs').insert({
    account_id: accountId,
    line_id: lineId,
    channel,  // Now parameterized
    source,
    reason,
    call_session_id: callSessionId,
  });

  if (error) {
    logger.error({ error, lineId }, 'Failed to record opt-out');
  }

  // Only set do_not_call for call-related opt-outs
  if (channel === 'outbound_calls' || channel === 'all') {
    await setDoNotCall(lineId, true);
  }
}
```

#### 4. Add SMS Opt-Out Check to sendSms

**File: `/telephony/src/utils/twilio.ts`**

Add opt-out check before sending SMS (for safety alerts only):
```typescript
export async function sendSms(options: {
  to: string;
  body: string;
  skipOptOutCheck?: boolean;  // True for verification codes and opt-out confirmations
}): Promise<string> {
  // Check opt-out status unless explicitly skipped
  if (!options.skipOptOutCheck) {
    const isOptedOut = await checkSmsOptOut(options.to);
    if (isOptedOut) {
      logger.info({ to: redactPhone(options.to) }, 'SMS blocked due to opt-out');
      throw new Error('Recipient has opted out of SMS');
    }
  }

  // ... existing implementation ...
}

async function checkSmsOptOut(phoneE164: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('ultaura_sms_opt_outs')
    .select('id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();

  return !!data;
}
```

#### 5. Update Verification SMS to Skip Opt-Out Check

**File: `/telephony/src/routes/verify.ts`**

Ensure verification codes bypass opt-out check:
```typescript
// When sending verification SMS, use skipOptOutCheck: true
await sendSms({
  to: phoneNumber,
  body: `Your Ultaura verification code is: ${code}`,
  skipOptOutCheck: true,  // Verification codes always go through
});
```

### Twilio Webhook Configuration
Configure in Twilio console:
```
Messaging → Phone Numbers → [Your Number]
Messaging Webhook: https://your-server.com/twilio/sms/inbound
Method: POST
```

### Opt-Out Scope
- **Global phone-level**: If +15551234567 sends STOP, they're opted out from ALL Ultaura SMS
- **Check before**: Safety alerts only (verification codes and upgrade links are exempt)
- **Recipients covered**: Trusted contacts AND payers

---

## Gap 7: Call Events Include Safety Category

### Summary
Extend call event logging to include safety category and confidence alongside tier for per-call analytics.

### Current State

**File: `/telephony/src/routes/tools/safety-event.ts` (lines 185-194)**
```typescript
await recordCallEvent(
  callSessionId,
  'tool_call',
  {
    tool: 'log_safety_concern',
    success: true,
    tier,
    actionTaken,
  },
  { skipDebugLog: true }
);
```

### Required Changes

**File: `/telephony/src/routes/tools/safety-event.ts`**

Update call event recording to include category and confidence:
```typescript
await recordCallEvent(
  callSessionId,
  'tool_call',
  {
    tool: 'log_safety_concern',
    success: true,
    tier,
    category: effectiveCategory,
    confidence: effectiveConfidence,
    actionTaken,
  },
  { skipDebugLog: true }
);
```

### Event Payload Structure (new)
```json
{
  "tool": "log_safety_concern",
  "success": true,
  "tier": "high",
  "category": "SUICIDAL_IDEATION",
  "confidence": 0.92,
  "actionTaken": "suggested_988"
}
```

### Benefits
- Enables per-call analytics without querying `ultaura_safety_events` table
- Category information available in call event stream
- Supports real-time dashboards and alerting

---

## Database Migration Summary

A single migration file should be created combining Gaps 4, 5, and 6:

**File: `/supabase/migrations/YYYYMMDD000001_safety_compliance_gaps.sql`**

```sql
-- ============================================
-- Safety Categories and Confidence (Gaps 4 & 5)
-- ============================================

-- Create safety category enum
CREATE TYPE ultaura_safety_category AS ENUM (
  'SUICIDAL_IDEATION',
  'SELF_HARM',
  'HOPELESSNESS',
  'ISOLATION_DISTRESS',
  'PHYSICAL_DANGER',
  'MEDICAL_EMERGENCY',
  'ABUSE_CONCERN',
  'COGNITIVE_DECLINE',
  'GENERAL_CONCERN'
);

-- Add category column to safety_events (nullable for backward compatibility)
ALTER TABLE ultaura_safety_events
ADD COLUMN category ultaura_safety_category;

-- Add confidence column to safety_events
ALTER TABLE ultaura_safety_events
ADD COLUMN confidence numeric(3,2) CHECK (confidence >= 0 AND confidence <= 1);

-- Index for category filtering
CREATE INDEX idx_ultaura_safety_events_category
ON ultaura_safety_events(category, created_at DESC);

COMMENT ON COLUMN ultaura_safety_events.category IS 'Clinical taxonomy category for the safety concern';
COMMENT ON COLUMN ultaura_safety_events.confidence IS 'Model confidence score (0.0-1.0), 1.0 for keyword backstop matches';

-- ============================================
-- SMS Opt-Out Table (Gap 6)
-- ============================================

-- Create phone-level SMS opt-out table
CREATE TABLE ultaura_sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('sms_keyword', 'dashboard', 'api')),
  keyword text
);

-- Index for fast lookup
CREATE INDEX idx_ultaura_sms_opt_outs_phone ON ultaura_sms_opt_outs(phone_e164);

-- Enable RLS (service role only for now)
ALTER TABLE ultaura_sms_opt_outs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ultaura_sms_opt_outs IS 'Phone-level SMS opt-out tracking. Applies to all Ultaura SMS (safety alerts, etc.) except verification codes.';

-- ============================================
-- Update opt_outs source constraint (Gap 6)
-- ============================================

-- Update source constraint to include sms_keyword
ALTER TABLE ultaura_opt_outs
DROP CONSTRAINT IF EXISTS ultaura_opt_outs_source_check;

ALTER TABLE ultaura_opt_outs
ADD CONSTRAINT ultaura_opt_outs_source_check
CHECK (source IN ('dtmf', 'voice', 'dashboard', 'sms_keyword'));
```

---

## Implementation Order

Recommended implementation sequence:

| Order | Gap | Complexity | Dependencies |
|-------|-----|------------|--------------|
| 1 | Gap 1 | Low | None |
| 2 | Gap 4 & 5 | Medium | DB migration |
| 3 | Gap 7 | Low | Gap 4/5 |
| 4 | Gap 2 | Medium | None |
| 5 | Gap 3 | Medium | Gap 2 |
| 6 | Gap 6 | High | DB migration |

### Rationale
1. **Gap 1** - Single file edit, no dependencies
2. **Gap 4 & 5** - Schema + types + tool definition (combined, DB migration needed)
3. **Gap 7** - Simple extension of Gap 4/5 work
4. **Gap 2** - Backend consent creation (independent)
5. **Gap 3** - Frontend consent UI (depends on Gap 2 backend)
6. **Gap 6** - SMS infrastructure (independent but most complex)

---

## Cross-Reference Summary

| Gap | Primary Files | Changes |
|-----|---------------|---------|
| 1 | `/packages/prompts/src/golden/sections/onboarding.ts` | Add emergency boundary statement |
| 2 | `/src/lib/ultaura/contacts.ts` | Add consent creation on contact add |
| 3 | `/src/app/dashboard/(app)/lines/[lineId]/contacts/ContactsClient.tsx` | Add consent checkbox, update text |
| 4 | `/packages/types/src/safety.ts` (new), `/packages/prompts/src/tools/definitions.ts`, `/packages/schemas/src/telephony/safety-event.ts`, `/telephony/src/routes/tools/safety-event.ts`, `/packages/prompts/src/safety/keywords.ts` | Add category taxonomy, update tool |
| 5 | Same as Gap 4 | Add confidence field |
| 6 | `/telephony/src/routes/twilio-sms-inbound.ts` (new), `/telephony/src/server.ts`, `/telephony/src/utils/twilio.ts`, `/telephony/src/services/line-lookup.ts` | New inbound SMS route, opt-out handling |
| 7 | `/telephony/src/routes/tools/safety-event.ts` | Add category/confidence to call events |

---

## Summary of User Decisions

| Decision Point | Choice |
|----------------|--------|
| Boundary statement timing | After greeting, before conversation |
| Boundary statement content | Simple, no family mention |
| Consent creation model | Show dialog + auto-create on confirm |
| Consent evidence | Full audit trail (timestamp, IP, userAgent, userId, contactName) |
| Safety categories | Clinical taxonomy (9 categories) |
| Category-tier mapping | Fixed mapping (except GENERAL_CONCERN) |
| Confidence source | Model-provided (0.0-1.0), keyword backstop = 1.0 |
| Catch-all category | Yes, GENERAL_CONCERN |
| STOP response | Confirmation with dashboard link |
| SMS recipients | Trusted contacts AND payers |
| SMS opt-out scope | Global phone-level |
| SMS opt-out check | Safety alerts only (verification exempt) |
| Call events category | Yes, include category + confidence |
| Data migration | Forward-only, no backfill |
| Help article | Link to /docs for now |
