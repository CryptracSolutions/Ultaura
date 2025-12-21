# ULTAURA V1 PRODUCTION READINESS — MEGA PROMPT

This prompt brings Ultaura from its current state to production-ready. Execute each section in order.

---

## EXECUTIVE SUMMARY

The Ultaura codebase is **approximately 70% complete**. Core infrastructure is solid:
- ✅ Database schema with 16 tables, proper RLS, encryption support
- ✅ Telephony backend with Twilio/Grok WebSocket bridge
- ✅ Server actions for lines, schedules, verification
- ✅ Call scheduler with quiet hours enforcement
- ✅ Memory encryption (AES-256-GCM envelope encryption)
- ✅ DTMF handling (1=repeat, 9=opt-out, 0=help)

**Critical gaps that MUST be fixed before launch:**
1. Missing phone verification endpoints (verification flow is broken)
2. No Twilio webhook signature validation (security vulnerability)
3. Stripe overage billing is stubbed (revenue loss)
4. No mid-call minute cutoff (users can exceed trial limits)
5. Broken test call button
6. Missing voice opt-out detection

---

## CRITICAL FIXES (Must fix before launch)

### 1. Add Missing Phone Verification Routes

**Problem:** The web app calls `/verify/send` and `/verify/check` but these endpoints don't exist in the telephony backend. Phone verification is completely broken.

**File to create:** `telephony/src/routes/verify.ts`

```typescript
// Phone verification routes
// Uses Twilio Verify for SMS and voice verification

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { sendVerificationCode, checkVerificationCode } from '../utils/twilio.js';

export const verifyRouter = Router();

// Send verification code
verifyRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const { lineId, phoneNumber, channel } = req.body;

    if (!phoneNumber || !channel) {
      res.status(400).json({ error: 'Missing phoneNumber or channel' });
      return;
    }

    if (!['sms', 'call'].includes(channel)) {
      res.status(400).json({ error: 'Channel must be sms or call' });
      return;
    }

    const sid = await sendVerificationCode(phoneNumber, channel);

    logger.info({ phoneNumber, channel, sid }, 'Verification code sent');

    res.json({ success: true, sid });
  } catch (error) {
    logger.error({ error }, 'Failed to send verification code');
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Check verification code
verifyRouter.post('/check', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      res.status(400).json({ error: 'Missing phoneNumber or code' });
      return;
    }

    const verified = await checkVerificationCode(phoneNumber, code);

    if (verified) {
      res.json({ success: true, verified: true });
    } else {
      res.status(400).json({ error: 'Invalid verification code', verified: false });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check verification code');
    res.status(500).json({ error: 'Verification check failed' });
  }
});
```

**File to modify:** `telephony/src/server.ts`

Add import and route:
```typescript
import { verifyRouter } from './routes/verify.js';

// Add after other routes
app.use('/verify', verifyRouter);
```

---

### 2. Add Twilio Webhook Signature Validation

**Problem:** The `validateTwilioSignature` function exists in `telephony/src/utils/twilio.ts` but is NEVER called. Any attacker can send fake webhook requests.

**File to modify:** `telephony/src/routes/twilio-inbound.ts`

Add middleware before the route handler:

```typescript
import { validateTwilioSignature } from '../utils/twilio.js';

// Twilio signature validation middleware
function validateTwilioWebhook(req: Request, res: Response, next: () => void) {
  // Skip validation in development if configured
  if (process.env.SKIP_TWILIO_SIGNATURE_VALIDATION === 'true') {
    logger.warn('Twilio signature validation skipped (development mode)');
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  // Build the full URL for validation
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const isValid = validateTwilioSignature(url, req.body, signature);

  if (!isValid) {
    logger.warn({ url }, 'Invalid Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  next();
}

// Apply to routes
twilioInboundRouter.use(validateTwilioWebhook);
```

**Also apply to:**
- `telephony/src/routes/twilio-outbound.ts`
- `telephony/src/routes/twilio-status.ts`

---

### 3. Implement Stripe Overage Billing

**Problem:** The `reportOverageToStripe` function in `telephony/src/services/metering.ts` is a TODO stub. Overages are never billed.

**File to modify:** `telephony/src/services/metering.ts`

Replace the stubbed function:

```typescript
import Stripe from 'stripe';

// Initialize Stripe (add to top of file)
function getStripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(key, { apiVersion: '2023-10-16' });
}

// Report overage usage to Stripe
export async function reportOverageToStripe(
  accountId: string,
  overageMinutes: number
): Promise<void> {
  if (overageMinutes <= 0) return;

  const supabase = getSupabaseClient();
  const stripe = getStripeClient();

  // Get the subscription
  const { data: subscription } = await supabase
    .from('ultaura_subscriptions')
    .select('stripe_subscription_id')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .single();

  if (!subscription?.stripe_subscription_id) {
    logger.warn({ accountId }, 'No active subscription for overage reporting');
    return;
  }

  try {
    // Get the subscription to find metered item
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);

    // Find the metered price item (overage)
    const overagePriceId = process.env.STRIPE_ULTAURA_OVERAGE_PRICE_ID;
    const meteredItem = stripeSub.items.data.find(
      item => item.price.id === overagePriceId
    );

    if (!meteredItem) {
      logger.warn({ accountId }, 'No metered overage item on subscription');
      return;
    }

    // Report usage
    const usageRecord = await stripe.subscriptionItems.createUsageRecord(
      meteredItem.id,
      {
        quantity: overageMinutes,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'increment',
      }
    );

    logger.info({
      accountId,
      overageMinutes,
      usageRecordId: usageRecord.id,
    }, 'Reported overage to Stripe');

    // Mark ledger entries as reported
    await markReportedOverageEntries(accountId, usageRecord.id);

  } catch (error) {
    logger.error({ error, accountId }, 'Failed to report overage to Stripe');
    throw error;
  }
}

// Mark ledger entries as reported
async function markReportedOverageEntries(accountId: string, stripeRecordId: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('ultaura_minute_ledger')
    .update({
      stripe_usage_reported: true,
      stripe_usage_record_id: stripeRecordId,
    })
    .eq('account_id', accountId)
    .eq('stripe_usage_reported', false)
    .in('billable_type', ['overage', 'payg']);
}
```

**Add to the recordUsage function (after ledger entry):**

```typescript
// Report overage immediately if applicable
if (billableType === 'overage' || billableType === 'payg') {
  await reportOverageToStripe(accountId, billableMinutes);
}
```

---

### 4. Implement Mid-Call Minute Cutoff for Trial Users

**Problem:** Trial users can exceed their 20-minute limit by staying on a call. No enforcement happens mid-call.

**File to modify:** `telephony/src/websocket/media-stream.ts`

Add periodic minute checking:

```typescript
// Add after grokBridge connection (around line 130)

// Check minutes remaining periodically for trial accounts
let minuteCheckInterval: NodeJS.Timeout | null = null;

if (account.status === 'trial') {
  minuteCheckInterval = setInterval(async () => {
    const minutesStatus = await shouldWarnLowMinutes(account.id);

    if (minutesStatus.remaining <= 0) {
      logger.info({ callSessionId }, 'Trial minutes exhausted mid-call');

      // Send message to Grok to end the call gracefully
      if (grokBridge) {
        grokBridge.sendTextInput(
          'SYSTEM: The user has run out of free trial minutes. Politely wrap up the conversation, tell them their free minutes are used up, and encourage them to ask their family member to upgrade. Say goodbye warmly.'
        );
      }

      // Close connection after a short delay for the goodbye
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Trial minutes exhausted');
        }
      }, 30000); // 30 seconds for goodbye

      // Clear the interval
      if (minuteCheckInterval) {
        clearInterval(minuteCheckInterval);
        minuteCheckInterval = null;
      }
    } else if (minutesStatus.critical && !isConnected) {
      // Warn about low minutes
      if (grokBridge) {
        grokBridge.sendTextInput(
          `SYSTEM: User has only ${minutesStatus.remaining} minutes remaining on their trial. Mention this naturally toward the end of the call.`
        );
      }
    }
  }, 60000); // Check every minute
}

// Clean up on WebSocket close
ws.on('close', () => {
  if (minuteCheckInterval) {
    clearInterval(minuteCheckInterval);
  }
  // ... existing close handling
});
```

---

### 5. Fix Broken Test Call Button

**Problem:** The `/calls/test` endpoint in `telephony/src/routes/calls.ts` is broken - it tries to call `router.handle()` incorrectly.

**File to modify:** `telephony/src/routes/calls.ts`

Replace the broken test endpoint:

```typescript
// Remove this broken code:
// callsRouter.post('/test', async (req: Request, res: Response) => {
//   req.body.reason = 'test';
//   await callsRouter.handle(req, res, () => {});
// });

// Replace with:
callsRouter.post('/test', async (req: Request, res: Response) => {
  // Forward to outbound with test reason
  req.body.reason = 'test';

  // Call the outbound handler logic directly
  const { lineId } = req.body;

  if (!lineId) {
    res.status(400).json({ error: 'Missing lineId' });
    return;
  }

  // Get line info
  const lineWithAccount = await getLineById(lineId);
  if (!lineWithAccount) {
    res.status(404).json({ error: 'Line not found' });
    return;
  }

  const { line, account } = lineWithAccount;

  // Skip opt-out check for test calls
  // Skip quiet hours check for test calls

  // Check access (but allow even if low minutes for testing)
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed && accessCheck.reason !== 'minutes_exhausted') {
    res.status(400).json({ error: 'Access denied', code: accessCheck.reason });
    return;
  }

  // Create call session
  const session = await createCallSession({
    accountId: account.id,
    lineId: line.id,
    direction: 'outbound',
    twilioFrom: process.env.TWILIO_PHONE_NUMBER,
    twilioTo: line.phone_e164,
  });

  if (!session) {
    res.status(500).json({ error: 'Failed to create call session' });
    return;
  }

  const baseUrl = process.env.TELEPHONY_BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

  try {
    const callSid = await initiateOutboundCall({
      to: line.phone_e164,
      from: process.env.TWILIO_PHONE_NUMBER!,
      callbackUrl: `${baseUrl}/twilio/voice/outbound`,
      statusCallbackUrl: `${baseUrl}/twilio/status`,
      callSessionId: session.id,
    });

    logger.info({ sessionId: session.id, callSid, lineId, reason: 'test' }, 'Test call initiated');

    res.json({ success: true, sessionId: session.id, callSid });
  } catch (error) {
    logger.error({ error, sessionId: session.id }, 'Failed to initiate test call');
    await failCallSession(session.id, 'error');
    res.status(500).json({ error: 'Failed to initiate test call' });
  }
});
```

---

### 6. Add Voice Opt-Out Detection

**Problem:** Users can say "stop calling me" but there's no detection. Only DTMF 9 works.

**File to modify:** `telephony/src/websocket/grok-bridge.ts`

Add a new tool for voice opt-out:

```typescript
// In the tools array (around line 140), add:
{
  type: 'function',
  name: 'request_opt_out',
  description: 'User has requested to stop receiving calls. Call this when the user says things like "stop calling me", "don\'t call anymore", "unsubscribe", or similar phrases.',
  parameters: {
    type: 'object',
    properties: {
      confirmed: {
        type: 'boolean',
        description: 'Whether the user confirmed they want to opt out',
      },
    },
    required: ['confirmed'],
  },
},
```

**Add tool handler in handleToolCall:**

```typescript
case 'request_opt_out':
  const confirmed = args.confirmed;
  if (confirmed) {
    // Record the opt-out
    result = await this.callToolEndpoint(`${baseUrl}/tools/opt_out`, {
      callSessionId: this.options.callSessionId,
      lineId: this.options.lineId,
      source: 'voice',
    });
  } else {
    result = JSON.stringify({
      success: true,
      message: 'Ask the user to confirm they want to stop receiving calls.'
    });
  }
  break;
```

**Create the opt-out tool endpoint:** `telephony/src/routes/tools/opt-out.ts`

```typescript
import { Router, Request, Response } from 'express';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../server.js';
import { recordOptOut } from '../../services/line-lookup.js';
import { getCallSession, recordCallEvent } from '../../services/call-session.js';

export const optOutRouter = Router();

optOutRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, source = 'voice' } = req.body;

    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // Record the opt-out
    await recordOptOut(session.account_id, lineId, callSessionId, source as 'voice');

    // Record event
    await recordCallEvent(callSessionId, 'state_change', {
      event: 'opt_out',
      source,
    });

    logger.info({ callSessionId, lineId, source }, 'Voice opt-out recorded');

    res.json({
      success: true,
      message: 'Opt-out recorded. The user will no longer receive outbound calls.',
    });
  } catch (error) {
    logger.error({ error }, 'Error processing opt-out');
    res.status(500).json({ error: 'Failed to process opt-out' });
  }
});
```

**Add to tools index:** `telephony/src/routes/tools/index.ts`

```typescript
import { optOutRouter } from './opt-out.js';

// Add route
toolsRouter.use('/opt_out', optOutRouter);
```

---

## SECURITY HARDENING

### 7. Add Rate Limiting to Verification Endpoints

**Problem:** No rate limiting on phone verification. Attackers could spam verification codes.

**File to modify:** `telephony/src/routes/verify.ts`

```typescript
// Add in-memory rate limiter (for MVP, use Redis in production)
const verificationAttempts: Map<string, { count: number; resetAt: number }> = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function rateLimitVerification(phoneNumber: string): boolean {
  const now = Date.now();
  const key = phoneNumber;
  const attempts = verificationAttempts.get(key);

  if (!attempts || now > attempts.resetAt) {
    verificationAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    return false;
  }

  attempts.count++;
  return true;
}

// Add to /send handler before sending:
if (!rateLimitVerification(phoneNumber)) {
  logger.warn({ phoneNumber }, 'Rate limit exceeded for verification');
  res.status(429).json({ error: 'Too many verification attempts. Try again later.' });
  return;
}
```

---

### 8. Add CORS Configuration for Telephony Backend

**Problem:** No CORS headers configured. May cause issues with dashboard calls.

**File to modify:** `telephony/src/server.ts`

```typescript
import cors from 'cors';

// Add after app creation
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'https://ultaura.com',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Webhook-Secret', 'Authorization'],
};

app.use(cors(corsOptions));
```

**Add to package.json dependencies:**
```json
"cors": "^2.8.5"
```

---

### 9. Validate Stripe Webhook Signatures

**Problem:** The Stripe webhook handler validates signatures, but check it's using raw body correctly.

**File to verify:** `src/app/api/stripe/webhook/route.ts`

The current implementation looks correct - it uses `request.text()` for raw body and verifies with `stripe.webhooks.constructEvent()`. ✅

---

## MISSING FEATURES

### 10. Add "Forget That" Memory Deletion Tool

**Problem:** The system prompt mentions "forget that" but there's no tool to handle it.

**File to modify:** `telephony/src/websocket/grok-bridge.ts`

Add to tools array:

```typescript
{
  type: 'function',
  name: 'forget_memory',
  description: 'User wants to forget something they previously shared. Call this when user says "forget that", "never mind", "don\'t remember that", etc.',
  parameters: {
    type: 'object',
    properties: {
      what_to_forget: {
        type: 'string',
        description: 'Brief description of what to forget',
      },
    },
    required: ['what_to_forget'],
  },
},
```

**Add handler:**

```typescript
case 'forget_memory':
  result = await this.callToolEndpoint(`${baseUrl}/tools/forget_memory`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    accountId: this.options.accountId,
    whatToForget: args.what_to_forget,
  });
  break;
```

**Create endpoint:** `telephony/src/routes/tools/forget-memory.ts`

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getMemoriesForLine, forgetMemory } from '../../services/memory.js';

export const forgetMemoryRouter = Router();

forgetMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, accountId, whatToForget } = req.body;

    if (!lineId || !accountId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get recent memories to find what to forget
    const memories = await getMemoriesForLine(accountId, lineId, { limit: 50 });

    // Find memory that matches (simple matching for MVP)
    const searchTerms = whatToForget.toLowerCase().split(' ');
    const toForget = memories.find(m => {
      const keyValue = `${m.key} ${String(m.value)}`.toLowerCase();
      return searchTerms.some(term => keyValue.includes(term));
    });

    if (toForget) {
      await forgetMemory(accountId, lineId, toForget.id);
      logger.info({ lineId, memoryId: toForget.id, key: toForget.key }, 'Memory forgotten');
      res.json({
        success: true,
        message: `I've forgotten that. I won't bring it up again.`,
      });
    } else {
      res.json({
        success: true,
        message: `I'll make sure not to reference that.`,
      });
    }
  } catch (error) {
    logger.error({ error }, 'Error forgetting memory');
    res.status(500).json({ error: 'Failed to forget memory' });
  }
});
```

---

### 11. Add "Don't Tell My Family" Privacy Flag Tool

**File to modify:** `telephony/src/websocket/grok-bridge.ts`

Add to tools:

```typescript
{
  type: 'function',
  name: 'mark_private',
  description: 'User wants to keep something private from their family. Call when user says "don\'t tell my family", "keep this between us", "this is private", etc.',
  parameters: {
    type: 'object',
    properties: {
      what_to_keep_private: {
        type: 'string',
        description: 'Brief description of what to keep private',
      },
    },
    required: ['what_to_keep_private'],
  },
},
```

**Create endpoint:** `telephony/src/routes/tools/mark-private.ts`

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getMemoriesForLine, markMemoryPrivate } from '../../services/memory.js';

export const markPrivateRouter = Router();

markPrivateRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { lineId, accountId, whatToKeepPrivate } = req.body;

    if (!lineId || !accountId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Get recent memories
    const memories = await getMemoriesForLine(accountId, lineId, { limit: 50 });

    // Find matching memory
    const searchTerms = whatToKeepPrivate.toLowerCase().split(' ');
    const toMark = memories.find(m => {
      const keyValue = `${m.key} ${String(m.value)}`.toLowerCase();
      return searchTerms.some(term => keyValue.includes(term));
    });

    if (toMark) {
      await markMemoryPrivate(accountId, lineId, toMark.id);
      logger.info({ lineId, memoryId: toMark.id }, 'Memory marked as private');
    }

    res.json({
      success: true,
      message: `Of course, I'll keep that just between us. Your family won't see it.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error marking memory private');
    res.status(500).json({ error: 'Failed to mark as private' });
  }
});
```

---

### 12. Add Safety Event Logging

**Problem:** Safety detection exists in the prompt but no actual logging when keywords are detected.

**File to modify:** `telephony/src/websocket/grok-bridge.ts`

Add safety detection tool:

```typescript
{
  type: 'function',
  name: 'log_safety_concern',
  description: 'INTERNAL: Log when you detect signs of distress, depression, self-harm ideation, or crisis. Do NOT call this for normal sad feelings. Only for genuine safety concerns.',
  parameters: {
    type: 'object',
    properties: {
      tier: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'low=sad/lonely, medium=distress/hopelessness, high=self-harm/crisis',
      },
      signals: {
        type: 'string',
        description: 'Brief description of concerning statements',
      },
      action_taken: {
        type: 'string',
        enum: ['none', 'suggested_988', 'suggested_911'],
        description: 'What action you recommended',
      },
    },
    required: ['tier', 'signals', 'action_taken'],
  },
},
```

**Add handler:**

```typescript
case 'log_safety_concern':
  result = await this.callToolEndpoint(`${baseUrl}/tools/safety_event`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    accountId: this.options.accountId,
    tier: args.tier,
    signals: args.signals,
    actionTaken: args.action_taken,
  });
  break;
```

**Create endpoint:** `telephony/src/routes/tools/safety-event.ts`

```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { recordSafetyEvent } from '../../services/call-session.js';

export const safetyEventRouter = Router();

safetyEventRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, accountId, tier, signals, actionTaken } = req.body;

    await recordSafetyEvent({
      accountId,
      lineId,
      callSessionId,
      tier,
      signals: { description: signals },
      actionTaken,
    });

    // For high-tier events, we could notify trusted contacts here
    if (tier === 'high') {
      logger.warn({ callSessionId, lineId, tier, actionTaken }, 'HIGH SAFETY TIER EVENT');
      // TODO: Notify trusted contacts if consent exists
    }

    res.json({ success: true, message: 'Safety concern logged' });
  } catch (error) {
    logger.error({ error }, 'Error logging safety event');
    res.status(500).json({ error: 'Failed to log safety event' });
  }
});
```

---

### 13. Add Trusted Contacts Management UI

**Problem:** Database tables exist but no UI to manage trusted contacts.

**File to create:** `src/app/dashboard/[organization]/lines/[lineId]/contacts/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Phone, Trash2, Plus } from 'lucide-react';
import {
  getTrustedContacts,
  addTrustedContact,
  removeTrustedContact,
} from '~/lib/ultaura/actions';

interface TrustedContact {
  id: string;
  name: string;
  relationship: string | null;
  phone_e164: string;
  notify_on: string[];
  enabled: boolean;
}

export default function TrustedContactsPage() {
  const params = useParams();
  const lineId = params.lineId as string;
  const [contacts, setContacts] = useState<TrustedContact[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    relationship: '',
  });

  useEffect(() => {
    loadContacts();
  }, [lineId]);

  async function loadContacts() {
    const data = await getTrustedContacts(lineId);
    setContacts(data);
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    await addTrustedContact(lineId, {
      name: newContact.name,
      phoneE164: newContact.phone,
      relationship: newContact.relationship || undefined,
    });
    setNewContact({ name: '', phone: '', relationship: '' });
    setIsAdding(false);
    loadContacts();
  }

  async function handleRemoveContact(contactId: string) {
    await removeTrustedContact(contactId);
    loadContacts();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Trusted Contacts</h1>
        <Button onClick={() => setIsAdding(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Contact
        </Button>
      </div>

      <p className="text-muted-foreground">
        Trusted contacts can be notified if we detect signs of distress during calls
        (only with the caller's consent).
      </p>

      {isAdding && (
        <Card>
          <CardHeader>
            <CardTitle>Add Trusted Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddContact} className="space-y-4">
              <Input
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                required
              />
              <Input
                placeholder="Phone Number"
                type="tel"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                required
              />
              <Input
                placeholder="Relationship (optional)"
                value={newContact.relationship}
                onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
              />
              <div className="flex gap-2">
                <Button type="submit">Add</Button>
                <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {contacts.map((contact) => (
          <Card key={contact.id}>
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {contact.phone_e164}
                    {contact.relationship && ` · ${contact.relationship}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveContact(contact.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}

        {contacts.length === 0 && !isAdding && (
          <p className="text-center py-8 text-muted-foreground">
            No trusted contacts added yet.
          </p>
        )}
      </div>
    </div>
  );
}
```

**Add server actions to:** `src/lib/ultaura/actions.ts`

```typescript
// Trusted Contacts Actions
export async function getTrustedContacts(lineId: string) {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function addTrustedContact(
  lineId: string,
  input: {
    name: string;
    phoneE164: string;
    relationship?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerComponentClient();

  // Get account from line
  const line = await getLine(lineId);
  if (!line) return { success: false, error: 'Line not found' };

  const { error } = await client.from('ultaura_trusted_contacts').insert({
    account_id: line.account_id,
    line_id: lineId,
    name: input.name,
    phone_e164: input.phoneE164,
    relationship: input.relationship,
    notify_on: ['medium', 'high'],
    enabled: true,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/[organization]/lines/${lineId}/contacts`);
  return { success: true };
}

export async function removeTrustedContact(contactId: string): Promise<{ success: boolean }> {
  const client = getSupabaseServerComponentClient();
  await client.from('ultaura_trusted_contacts').delete().eq('id', contactId);
  return { success: true };
}
```

---

## ERROR HANDLING & RESILIENCE

### 14. Add Graceful Degradation When Grok Is Down

**File to modify:** `telephony/src/websocket/media-stream.ts`

Around line 137 in the catch block:

```typescript
} catch (error) {
  logger.error({ error, callSessionId }, 'Failed to initialize Grok bridge');

  // Send fallback message via Twilio TTS
  const fallbackMessage = "I'm sorry, I'm having some technical difficulties right now. Please try calling back in a few minutes, or press 0 for help.";

  // We can't easily send TTS through the WebSocket, so we need to close and let Twilio handle it
  // Update session to reflect the error
  await updateCallStatus(callSessionId, 'failed', {
    endReason: 'error',
  });

  await recordCallEvent(callSessionId, 'error', {
    type: 'grok_connection_failed',
    error: error instanceof Error ? error.message : 'Unknown error',
  });

  ws.close(1011, 'AI service unavailable');
}
```

---

### 15. Add Error Boundaries in React Components

**File to create:** `src/components/ultaura/ErrorBoundary.tsx`

```tsx
'use client';

import { Component, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class UltauraErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Ultaura Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="text-muted-foreground mb-4">
              We encountered an error loading this section.
            </p>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false })}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
```

**Wrap dashboard pages with the error boundary in layouts.**

---

### 16. Add Retry Logic for Failed Outbound Calls

**File to modify:** `telephony/src/scheduler/call-scheduler.ts`

Improve the retry logic around line 150:

```typescript
} catch (error) {
  logger.error({ error, scheduleId: schedule.id }, 'Failed to initiate scheduled call');

  const retryPolicy = schedule.retry_policy || { max_retries: 2, retry_window_minutes: 30 };

  // Check if we should retry
  const currentRetries = schedule.retry_count || 0;

  if (currentRetries < retryPolicy.max_retries) {
    // Schedule a retry
    const retryAt = new Date(Date.now() + (15 * 60 * 1000)); // 15 minutes

    await supabase
      .from('ultaura_schedules')
      .update({
        last_run_at: new Date().toISOString(),
        last_result: 'failed',
        next_run_at: retryAt.toISOString(),
        retry_count: currentRetries + 1,
      })
      .eq('id', schedule.id);

    logger.info({ scheduleId: schedule.id, retryAt, attempt: currentRetries + 1 }, 'Scheduled retry');
  } else {
    // Max retries exceeded, move to next scheduled time
    await updateScheduleResult(schedule.id, 'failed', calculateNextRun(schedule));

    // Reset retry count
    await supabase
      .from('ultaura_schedules')
      .update({ retry_count: 0 })
      .eq('id', schedule.id);

    logger.warn({ scheduleId: schedule.id }, 'Max retries exceeded for scheduled call');
  }
}
```

**Add retry_count column if not exists:**

```sql
ALTER TABLE ultaura_schedules ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
```

---

## DEPLOYMENT PREPARATION

### 17. Add Health Check with Dependency Checks

**File to modify:** `telephony/src/server.ts`

Replace the basic health check:

```typescript
// Enhanced health check
app.get('/health', async (req, res) => {
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: Record<string, { status: string; latency?: number }>;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check Supabase
  try {
    const start = Date.now();
    const { error } = await getSupabaseClient().from('ultaura_plans').select('id').limit(1);
    health.checks.database = {
      status: error ? 'unhealthy' : 'healthy',
      latency: Date.now() - start,
    };
  } catch {
    health.checks.database = { status: 'unhealthy' };
    health.status = 'degraded';
  }

  // Check Twilio credentials
  try {
    const client = getTwilioClient();
    health.checks.twilio = { status: client ? 'healthy' : 'unhealthy' };
  } catch {
    health.checks.twilio = { status: 'unhealthy' };
    health.status = 'degraded';
  }

  // Check xAI API key
  health.checks.xai = {
    status: process.env.XAI_API_KEY ? 'healthy' : 'unhealthy'
  };

  // Determine overall status
  const unhealthyChecks = Object.values(health.checks).filter(c => c.status === 'unhealthy');
  if (unhealthyChecks.length > 0) {
    health.status = unhealthyChecks.length >= 2 ? 'unhealthy' : 'degraded';
  }

  const statusCode = health.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(health);
});
```

---

### 18. Document All Environment Variables

**File to verify:** `.env.ultaura.example`

Ensure all required variables are documented. The current file appears complete. Add these if missing:

```bash
# Rate Limiting (optional)
SKIP_TWILIO_SIGNATURE_VALIDATION=false  # Set true only in development

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://your-app.vercel.app

# Observability (recommended for production)
SENTRY_DSN=
LOG_LEVEL=info
```

---

### 19. Add Database Migrations Test

**File to create:** `supabase/seed.sql`

```sql
-- Seed data for testing
-- Insert test account
INSERT INTO ultaura_accounts (
  id,
  organization_id,
  name,
  billing_email,
  status,
  plan_id,
  minutes_included,
  cycle_start,
  cycle_end
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  1,  -- Replace with actual org ID
  'Test Account',
  'test@example.com',
  'trial',
  'free_trial',
  20,
  NOW(),
  NOW() + INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

-- Insert test line
INSERT INTO ultaura_lines (
  id,
  account_id,
  display_name,
  phone_e164,
  phone_verified_at,
  status,
  timezone
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Test User',
  '+15555550100',
  NOW(),
  'active',
  'America/Los_Angeles'
) ON CONFLICT (id) DO NOTHING;
```

---

## TESTING REQUIREMENTS

### 20. Create Manual Testing Checklist

**File to create:** `docs/TESTING_CHECKLIST.md`

```markdown
# Ultaura Manual Testing Checklist

## Pre-Flight Checks
- [ ] All environment variables set
- [ ] Database migrations applied
- [ ] Telephony server running
- [ ] ngrok tunnel active (development)
- [ ] Stripe test mode enabled

## Account & Lines
- [ ] Create new account via signup
- [ ] Add a line with real phone number
- [ ] Receive SMS verification code
- [ ] Receive voice verification code (test fallback)
- [ ] Enter code and verify line becomes "Active"
- [ ] Attempt to add line beyond plan limit (should fail)
- [ ] Update line settings (timezone, quiet hours)
- [ ] Delete a line

## Inbound Calling
- [ ] Call Twilio number from verified phone
- [ ] Hear greeting with your name
- [ ] Have 2-minute conversation
- [ ] Hang up
- [ ] Check dashboard shows call in activity
- [ ] Check usage minutes updated

## Outbound Calling
- [ ] Create a schedule (e.g., every day at current time + 5 min)
- [ ] Wait for scheduled call
- [ ] Receive incoming call
- [ ] Verify conversation works
- [ ] Check schedule updated to next run time

## Test Call
- [ ] Click "Test call now" button
- [ ] Receive call within 30 seconds
- [ ] Verify conversation works

## DTMF
- [ ] During call, press 1 — should repeat last response
- [ ] Press 9 — should ask to confirm opt-out
- [ ] Press 9 again — should confirm and end call
- [ ] Check line shows do_not_call = true
- [ ] Re-enable calling from dashboard

## Voice Commands
- [ ] Say "stop calling me" — should trigger opt-out flow
- [ ] Say "forget that" after sharing info — should acknowledge
- [ ] Say "don't tell my family about that" — should confirm privacy

## Billing
- [ ] Click "Upgrade Plan"
- [ ] Complete Stripe checkout (use test card 4242 4242 4242 4242)
- [ ] Verify subscription appears in dashboard
- [ ] Check minutes increased to new plan

## Trial Limits
- [ ] Use trial account until < 5 minutes remaining
- [ ] Make call and verify low minutes warning
- [ ] Continue until 0 minutes
- [ ] Verify call ends gracefully
- [ ] Verify cannot make new calls

## Overage (Paid Plans)
- [ ] On paid plan, use beyond included minutes
- [ ] Verify call continues (overage allowed)
- [ ] Check Stripe dashboard for usage record

## Quiet Hours
- [ ] Set quiet hours to current time
- [ ] Trigger outbound call
- [ ] Verify call is suppressed

## Safety Detection
- [ ] During call, express sadness
- [ ] Check safety_events table for low-tier event

## Error Handling
- [ ] Stop telephony server, attempt call
- [ ] Verify graceful error message
- [ ] Start telephony server, retry call
- [ ] Verify works correctly

## Performance
- [ ] Make 5 concurrent test calls (use multiple verified numbers)
- [ ] Verify all connect successfully
- [ ] Check for any timeout errors in logs
```

---

## POLISH & UX

### 21. Add Loading States to Dashboard

**File to modify:** `src/app/dashboard/[organization]/lines/page.tsx`

Add Suspense boundaries and loading skeletons for lines list.

### 22. Add Toast Notifications for Actions

Ensure all server actions show success/error toasts using the existing toast system.

### 23. Improve Error Messages

Replace generic "Failed to..." messages with specific, actionable errors.

---

## EXECUTION ORDER

1. **Day 1 - Critical Fixes:**
   - Phone verification routes (#1)
   - Twilio signature validation (#2)
   - Fix test call button (#5)

2. **Day 2 - Security & Billing:**
   - Stripe overage billing (#3)
   - Mid-call minute cutoff (#4)
   - Rate limiting (#7)
   - CORS (#8)

3. **Day 3 - Voice Features:**
   - Voice opt-out (#6)
   - Forget memory tool (#10)
   - Privacy flag tool (#11)
   - Safety logging (#12)

4. **Day 4 - Resilience:**
   - Graceful degradation (#14)
   - Error boundaries (#15)
   - Retry logic (#16)
   - Health checks (#17)

5. **Day 5 - Testing & Polish:**
   - Trusted contacts UI (#13)
   - Manual testing (#20)
   - Polish items (#21-23)

---

## VERIFICATION COMMANDS

After implementing all fixes, run these checks:

```bash
# Build check
cd telephony && npm run build
cd .. && npm run build

# Type check
npm run typecheck

# Start services
npm run dev &
cd telephony && npm run dev &

# Test health endpoint
curl http://localhost:3001/health

# Test verification endpoint
curl -X POST http://localhost:3001/verify/send \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+15555550100","channel":"sms"}'
```

---

## SUCCESS CRITERIA

After completing all items:

1. ✅ User can sign up, add a line, verify phone, and make a test call
2. ✅ Scheduled calls work reliably
3. ✅ Billing works end-to-end with overage tracking
4. ✅ Trial limits are enforced mid-call
5. ✅ Security (signatures, rate limits) is in place
6. ✅ Errors are handled gracefully
7. ✅ Ready to deploy to Vercel + Fly.io
8. ✅ A real user could use it without hitting critical bugs

---

*Generated by Claude Code production readiness audit - December 2024*
