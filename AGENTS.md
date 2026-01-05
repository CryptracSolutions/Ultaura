# Ultaura - AI Voice Companion for Seniors

AI-powered voice companion providing check-in calls for elderly individuals. Built on MakerKit SaaS template with Twilio telephony and xAI Grok Voice Agent.

## Overview

Ultaura makes automated phone calls to seniors at scheduled times for friendly conversation, reminders, activity suggestions, and companionship. Family members (payers) manage lines, schedules, and usage through a web dashboard.

### Key Features

- **Scheduled Check-in Calls**: Configure daily call times with quiet hours
- **Natural Voice Conversations**: Powered by xAI Grok Voice Agent (Ara voice)
- **Recurring Reminders**: RRULE-based with pause/snooze/skip functionality
- **Memory System**: Encrypted storage of conversation context for personalization
- **Safety Monitoring**: Detects distress keywords, logs events with severity tiers
- **Trusted Contacts**: Emergency contacts notified during safety events
- **Multi-Line Support**: Up to 4 lines on Family plan
- **Usage-Based Billing**: Minutes pooled at account level with overage at $0.15/min
- **Answering Machine Detection**: Configurable voicemail behavior when calls reach machines

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js Web   │────▶│  Telephony API   │────▶│  Twilio Voice   │
│   Dashboard     │     │  (Express.js)    │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
        │                       │                         │
        ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Supabase     │     │  xAI Grok Voice  │     │  Media Stream   │
│    Database     │     │  (Realtime API)  │◀────│   WebSocket     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Components

1. **Next.js Dashboard** (`/src/app/dashboard/(app)/lines/`)
   - Line management with phone verification
   - Schedule and reminder configuration
   - Trusted contacts management
   - Usage monitoring and billing

2. **Telephony Backend** (`/telephony/`)
   - Express.js server on port 3001
   - WebSocket bridge: Twilio Media Streams ↔ Grok Realtime API
   - Call scheduler (30-sec polling, RRULE support)
   - Minute metering with Stripe overage reporting
   - 16 Grok tool handlers for reminders, safety, opt-out

3. **Database** (`/supabase/migrations/`)
   - 25 migration files with RLS policies
   - Core tables: accounts, lines, schedules, reminders
   - Billing: subscriptions, minute_ledger
   - Safety: trusted_contacts, safety_events, opt_outs

## Plans & Pricing

| Plan | Monthly | Annual | Minutes | Lines |
|------|---------|--------|---------|-------|
| Free Trial | $0 | - | 20 | 1 |
| Care | $39 | $399 | 300 | 1 |
| Comfort | $99 | $999 | 900 | 2 |
| Family | $199 | $1,999 | 2,200 | 4 |
| PAYG | $0 | - | 0 | 4 |

All overages: $0.15/min (except Free Trial: hard stop)

## Setup Instructions

### Prerequisites

- Node.js 18+
- Supabase project (or local Docker)
- Twilio: Programmable Voice + Verify Service + phone number
- xAI account with Grok Voice Agent API access
- Stripe account

### 1. Environment Configuration

```bash
cp .env.ultaura.example .env.local
```

**Required Environment Variables:**

```bash
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=        # E.164 format
TWILIO_VERIFY_SERVICE_SID=
TWILIO_AMD_ENABLED=true     # Answering machine detection (default: true)

# xAI Grok
XAI_API_KEY=
XAI_REALTIME_URL=wss://api.x.ai/v1/realtime
XAI_GROK_MODEL=grok-3-fast

# Telephony Backend
TELEPHONY_PORT=3001
TELEPHONY_PUBLIC_URL=       # Public URL for Twilio webhooks
TELEPHONY_BACKEND_URL=http://localhost:3001
TELEPHONY_WEBHOOK_SECRET=
TELEPHONY_WEBSOCKET_URL=    # WebSocket URL for Twilio

# Encryption
ULTAURA_KEK_BASE64=         # Key Encryption Key

# Stripe (8 price IDs)
STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_PAYG_PRICE_ID=
STRIPE_ULTAURA_OVERAGE_PRICE_ID=
```

### 2. Database Migration

```bash
npx supabase db push
# Or: npx supabase migration up
```

### 3. Twilio Webhooks

Configure after deploying telephony server:
```
Voice Webhook: https://your-server.com/twilio/voice/inbound
Status Callback: https://your-server.com/twilio/status
```

### 4. Start Telephony Server

```bash
cd telephony && npm install && npm run dev
```

Production:
```bash
docker build -t ultaura-telephony ./telephony
docker run -p 3001:3001 --env-file .env.local ultaura-telephony
```

### 5. Development Tunnel

```bash
ngrok http 3001
```
Update `TELEPHONY_PUBLIC_URL` with ngrok URL.

## Call Flow

1. Scheduler triggers outbound call via Twilio (with AMD enabled)
2. Twilio performs Answering Machine Detection:
   - **Human/Unknown**: Proceeds to conversation
   - **Machine**: Applies line's `voicemail_behavior` setting (none/brief/detailed)
   - **Fax**: Hangs up immediately
3. If human, Twilio opens Media Stream WebSocket at `/twilio/media`
4. Telephony bridges audio to Grok Realtime API
5. Grok converses using 16 available tools (reminders, safety, etc.)
6. Call ends, usage recorded in minute ledger
7. Memory summaries encrypted and stored
8. Overage reported to Stripe if applicable

## Database Tables

**Core:**
- `ultaura_accounts` - Account records tied to organizations
- `ultaura_lines` - Phone number profiles with preferences (includes `voicemail_behavior`)
- `ultaura_subscriptions` - Stripe subscription records

**Calling:**
- `ultaura_schedules` - Recurring call schedules (RRULE support)
- `ultaura_call_sessions` - Individual call records (includes `answered_by` for AMD tracking)
- `ultaura_call_events` - Call event log (DTMF, tools, errors)

**Reminders:**
- `ultaura_reminders` - Reminders with recurrence, pause, snooze
- `ultaura_reminder_events` - Reminder action audit trail

**Billing:**
- `ultaura_minute_ledger` - Call minute tracking for billing

**Safety & Privacy:**
- `ultaura_trusted_contacts` - Emergency contacts
- `ultaura_safety_events` - Safety incidents (low/medium/high tiers)
- `ultaura_consents` - Consent records (calls, SMS, data)
- `ultaura_opt_outs` - Do-not-call tracking

**Encryption:**
- `ultaura_account_crypto_keys` - DEKs wrapped with KEK
- `ultaura_memories` - Encrypted memory storage

## API Reference

### Server Actions (`/src/lib/ultaura/actions.ts`)

**Account & Lines:** getOrCreateUltauraAccount, getUltauraAccount, getLines, getLine, createLine, updateLine, deleteLine

**Phone Verification:** startPhoneVerification, checkPhoneVerification

**Schedules:** getSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, getUpcomingScheduledCalls, getAllSchedules

**Reminders:** getReminders, getReminder, createReminder, editReminder, pauseReminder, resumeReminder, snoozeReminder, cancelReminder, skipNextOccurrence, getUpcomingReminders, getAllReminders

**Trusted Contacts:** getTrustedContacts, addTrustedContact, removeTrustedContact

**Usage & Billing:** getUsageSummary, getCallSessions, getLineActivity, updateOverageCap, initiateTestCall

**Checkout:** createUltauraCheckout, getUltauraPriceId

### Telephony API Endpoints

```
POST /twilio/voice/inbound   - Inbound call webhook
POST /twilio/voice/outbound  - Outbound call TwiML
POST /twilio/status          - Call status callback
WS   /twilio/media           - Twilio Media Stream WebSocket
POST /calls/outbound         - Initiate outbound call
POST /calls/test             - Test call endpoint
POST /verify/*               - Phone verification
```

**Grok Tool Endpoints (`/tools/*`):**
- Reminders: set-reminder, list-reminders, edit-reminder, pause-reminder, resume-reminder, snooze-reminder, cancel-reminder
- Scheduling: schedule-call
- Billing: overage-action, request-upgrade
- Privacy: opt-out, forget-memory, mark-private
- Safety: safety-event

## Security

### Phone Verification
All lines must be verified via Twilio Verify before receiving calls.

### Memory Encryption
AES-256-GCM envelope encryption:
- KEK (Key Encryption Key) in environment
- DEK (Data Encryption Key) per account, wrapped with KEK
- AAD binding includes account and line IDs

### Safety Monitoring
- Detects distress keywords (suicide, self-harm, hopeless, etc.)
- Logs events with tiers: low, medium, high
- Actions: none, suggested_988, suggested_911, notified_contact

### Consent & Opt-out
- Tracks payer/line consent for calls, SMS, data retention
- Respects opt-out requests by channel (calls, SMS, all)

### RLS Policies
All tables have Row Level Security:
- Users access only their organization's data
- Service role required for telephony operations

## Answering Machine Detection (AMD)

Ultaura uses Twilio's AMD to detect when outbound calls reach voicemail or fax machines.

### Configuration

**Environment Variable:**
- `TWILIO_AMD_ENABLED` - Enable/disable AMD (default: `true`)
- Set to `false`, `0`, or `no` to disable

**Per-Line Setting:**
- `voicemail_behavior` column in `ultaura_lines` table
- Configurable in Dashboard: Lines → [Line] → Settings → Voicemail Settings
- Options:
  - `none` - Hang up silently
  - `brief` - Leave short message: "Hi [name], this is Ultaura. I'll call back soon. Take care!"
  - `detailed` - Include call reason: "...I was calling for your check-in/reminder..."

### AMD Results

Stored in `ultaura_call_sessions.answered_by`:
- `human` - Human answered
- `machine_start` - Machine detected at start
- `machine_end_beep` - Machine detected after beep
- `machine_end_silence` - Machine detected after silence
- `machine_end_other` - Machine detected (other)
- `fax` - Fax machine detected
- `unknown` - Could not determine (treated as human)
- `NULL` - AMD disabled or not attempted

### Behavior

| AMD Result | Action | end_reason |
|------------|--------|------------|
| human | Proceed to Grok conversation | - |
| unknown | Proceed to Grok conversation | - |
| machine_* | Apply `voicemail_behavior` | `no_answer` |
| fax | Hang up immediately | `no_answer` |

## File Structure

```
/
├── src/
│   ├── lib/ultaura/
│   │   ├── types.ts          # TypeScript types
│   │   ├── constants.ts      # Plans, settings
│   │   ├── prompts.ts        # Grok system prompts
│   │   ├── actions.ts        # Server actions (61KB)
│   │   ├── billing.ts        # Stripe integration
│   │   └── index.ts          # Exports
│   ├── app/dashboard/(app)/
│   │   ├── lines/
│   │   │   ├── page.tsx              # Lines list
│   │   │   ├── components/           # LineCard, AddLineModal
│   │   │   └── [lineId]/
│   │   │       ├── page.tsx          # Line detail
│   │   │       ├── settings/         # Line settings
│   │   │       ├── verify/           # Phone verification
│   │   │       ├── schedule/         # Schedule management
│   │   │       ├── contacts/         # Trusted contacts
│   │   │       └── reminders/        # Line reminders
│   │   ├── reminders/                # All reminders view
│   │   ├── calls/                    # Call history
│   │   └── usage/                    # Usage dashboard
│   └── components/ultaura/
│       ├── PricingTable.tsx
│       └── ErrorBoundary.tsx
├── telephony/
│   ├── src/
│   │   ├── server.ts                 # Express server (port 3001)
│   │   ├── routes/
│   │   │   ├── twilio-inbound.ts
│   │   │   ├── twilio-outbound.ts
│   │   │   ├── twilio-status.ts
│   │   │   ├── calls.ts
│   │   │   ├── verify.ts
│   │   │   └── tools/                # 16 Grok tool handlers
│   │   ├── services/
│   │   │   ├── call-session.ts       # Call lifecycle
│   │   │   ├── metering.ts           # Minute tracking
│   │   │   ├── memory.ts             # Memory encryption
│   │   │   └── line-lookup.ts
│   │   ├── websocket/
│   │   │   ├── media-stream.ts       # Twilio WS handler
│   │   │   └── grok-bridge.ts        # xAI Realtime bridge
│   │   └── scheduler/
│   │       └── call-scheduler.ts     # 30-sec cron
│   ├── Dockerfile
│   └── package.json
├── supabase/migrations/              # 25 migration files
└── .env.ultaura.example
```

## Troubleshooting

### Call Not Connecting
1. Check Twilio console for errors
2. Verify webhook URL accessible (use ngrok in dev)
3. Check telephony server logs
4. Ensure phone is verified

### Grok Not Responding
1. Verify XAI_API_KEY is correct
2. Check WebSocket connection in logs
3. Audio format: mulaw, 8kHz

### Usage Not Tracking
1. Check `ultaura_minute_ledger` entries
2. Verify call session created
3. Check metering service logs

### Verification Code Not Received
1. Check Twilio Verify logs
2. Phone format must be E.164
3. Verify TWILIO_VERIFY_SERVICE_SID

### AMD Not Working
1. Check `TWILIO_AMD_ENABLED` is not set to `false`/`0`/`no`
2. Verify Twilio account supports AMD (may require upgrade)
3. Check `answered_by` column in `ultaura_call_sessions` - NULL means AMD not attempted
4. Review telephony logs for AMD-related entries

## Support

- Check this file and telephony server logs
- Supabase logs for database errors
- Twilio console for call issues
- MakerKit docs: https://makerkit.dev/docs/next-supabase-turbo
