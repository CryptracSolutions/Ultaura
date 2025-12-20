# Ultaura - AI Voice Companion for Seniors

Ultaura is an AI-powered voice companion service designed to provide daily check-in calls for elderly individuals. Built on the MakerKit SaaS template, it integrates Twilio for telephony and xAI's Grok Voice Agent for natural conversations.

## Overview

Ultaura makes automated phone calls to seniors at scheduled times, engaging them in friendly conversation, providing medication reminders, activity suggestions, and companionship. Family members (payers) can manage lines, schedules, and view usage through a web dashboard.

### Key Features

- **Scheduled Check-in Calls**: Configure daily call times with quiet hours
- **Natural Voice Conversations**: Powered by xAI Grok Voice Agent
- **Medication Reminders**: AI can remind about medications during calls
- **Memory System**: Remembers previous conversations for personalized interactions
- **Safety Monitoring**: Detects concerning language and can alert caregivers
- **Multi-Line Support**: Family plans support up to 6 phone lines
- **Usage-Based Billing**: Minutes pooled at account level with overage billing

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Next.js Web   │────▶│  Telephony API   │────▶│  Twilio Voice   │
│   Dashboard     │     │  (Express.js)    │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
        │                       │                         │
        │                       │                         │
        ▼                       ▼                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│    Supabase     │     │  xAI Grok Voice  │     │  Media Stream   │
│    Database     │     │     Agent        │◀────│   WebSocket     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Components

1. **Next.js Dashboard** (`/src/app/dashboard/[organization]/lines/`)
   - Line management (add/edit/delete phone lines)
   - Schedule configuration
   - Usage monitoring
   - Phone verification

2. **Telephony Backend** (`/telephony/`)
   - Express.js server handling Twilio webhooks
   - WebSocket bridge between Twilio Media Streams and Grok
   - Call scheduling and minute metering
   - Memory encryption/decryption

3. **Database** (`/supabase/migrations/`)
   - Ultaura-specific tables with RLS policies
   - Minute ledger for usage tracking
   - Encrypted memory storage

## Setup Instructions

### Prerequisites

- Node.js 18+
- Supabase project (or local Docker)
- Twilio account with:
  - Programmable Voice enabled
  - Phone number capable of making calls
  - Verify service for phone verification
- xAI account with Grok Voice Agent API access
- Stripe account (for billing)

### 1. Environment Configuration

Copy the Ultaura environment template:

```bash
cp .env.ultaura.example .env.local
```

Fill in all required values. See `.env.ultaura.example` for detailed descriptions.

### 2. Database Migration

Apply the Ultaura database schema:

```bash
npx supabase db push
# Or if using migrations:
npx supabase migration up
```

This creates all Ultaura tables with proper RLS policies.

### 3. Stripe Products Setup

Create the following products and prices in Stripe Dashboard:

| Plan | Monthly Price | Annual Price | Minutes |
|------|--------------|--------------|---------|
| Care | $40/month | $400/year | 300 |
| Comfort | $100/month | $1,000/year | 600 |
| Family | $200/month | $2,000/year | 1,200 |
| Pay As You Go | $0.15/min | - | 0 |

For metered billing (overages), create a metered price at $0.15/min.

Copy the price IDs to your `.env.local` file.

### 4. Twilio Configuration

1. Get a phone number capable of making outbound calls
2. Create a Verify Service for phone verification
3. Configure webhooks (after deploying telephony server):

```
Voice Webhook: https://your-telephony-server.com/twilio/inbound
Status Callback: https://your-telephony-server.com/twilio/status
```

### 5. Start the Telephony Server

```bash
cd telephony
npm install
npm run dev
```

For production, use Docker:

```bash
docker build -t ultaura-telephony ./telephony
docker run -p 3001:3001 --env-file .env.local ultaura-telephony
```

### 6. Tunnel for Development

Use ngrok to expose the telephony server:

```bash
ngrok http 3001
```

Update `TELEPHONY_PUBLIC_URL` in `.env.local` with the ngrok URL.

## Usage Flow

### 1. User Signs Up

1. User creates account via MakerKit auth
2. Selects Ultaura plan and completes Stripe checkout
3. Webhook syncs subscription to `ultaura_subscriptions`

### 2. Add a Phone Line

1. User enters recipient name and phone number
2. User selects SMS or voice verification
3. Twilio sends verification code
4. User enters code to verify ownership

### 3. Schedule Calls

1. User selects days of week
2. User picks call time (respecting quiet hours)
3. Schedule saved to database
4. Scheduler picks up and initiates calls at configured times

### 4. Call Flow

1. Scheduler triggers outbound call via Twilio
2. Twilio connects, opens Media Stream WebSocket
3. Telephony server bridges audio to Grok Voice Agent
4. Grok converses naturally, using tools for reminders
5. Call ends, usage recorded in minute ledger
6. Memory summaries encrypted and stored

## API Reference

### Server Actions (`/src/lib/ultaura/actions.ts`)

```typescript
// Account & Lines
getOrCreateUltauraAccount()
getLines()
getLine(lineId: string)
createLine(data: CreateLineInput)
updateLine(lineId: string, data: UpdateLineInput)
deleteLine(lineId: string)

// Phone Verification
startPhoneVerification(lineId: string, channel: 'sms' | 'call')
checkPhoneVerification(lineId: string, code: string)

// Schedules
getSchedules(lineId: string)
createSchedule(data: CreateScheduleInput)
updateSchedule(scheduleId: string, data: UpdateScheduleInput)
deleteSchedule(scheduleId: string)

// Usage
getUsageSummary()

// Calls
initiateTestCall(lineId: string)
```

### Telephony API Endpoints

```
POST /twilio/inbound     - Twilio inbound call webhook
POST /twilio/outbound    - Initiate outbound call
POST /twilio/status      - Call status callback
WS   /media-stream       - Twilio Media Stream WebSocket
POST /calls/initiate     - Internal: Start a call
POST /tools/set_reminder - Grok tool: Set reminder
POST /tools/schedule_call - Grok tool: Schedule call
```

## Security Considerations

### Phone Verification
All lines must be verified before receiving calls to prevent abuse.

### Memory Encryption
Memory values are encrypted with AES-256-GCM using envelope encryption:
- KEK (Key Encryption Key) stored in environment
- DEK (Data Encryption Key) per account, wrapped with KEK
- AAD includes account and line IDs for binding

### RLS Policies
All Ultaura tables have Row Level Security:
- Users can only access their organization's data
- Service role required for telephony operations

### Rate Limiting
- Phone verification: 5 attempts per hour
- API calls: Standard MakerKit rate limiting applies

## Troubleshooting

### Call Not Connecting
1. Check Twilio console for errors
2. Verify webhook URL is accessible
3. Check telephony server logs
4. Ensure phone number is verified

### Grok Not Responding
1. Verify XAI_API_KEY is correct
2. Check WebSocket connection in logs
3. Ensure audio format is correct (mulaw, 8kHz)

### Usage Not Tracking
1. Check minute ledger entries in database
2. Verify call session is created
3. Check metering service logs

### Verification Code Not Received
1. Check Twilio Verify logs
2. Ensure phone number format is E.164
3. Verify TWILIO_VERIFY_SERVICE_SID

## File Structure

```
/
├── src/
│   ├── lib/ultaura/
│   │   ├── types.ts          # TypeScript types
│   │   ├── constants.ts      # Plans, settings
│   │   ├── prompts.ts        # Grok system prompts
│   │   ├── actions.ts        # Server actions
│   │   ├── billing.ts        # Stripe integration
│   │   └── index.ts          # Exports
│   ├── app/dashboard/[organization]/lines/
│   │   ├── page.tsx          # Lines list
│   │   ├── components/       # UI components
│   │   └── [lineId]/
│   │       ├── page.tsx      # Line detail
│   │       ├── verify/       # Phone verification
│   │       └── schedule/     # Schedule management
│   └── components/ultaura/
│       └── PricingTable.tsx  # Pricing UI
├── telephony/
│   ├── src/
│   │   ├── server.ts         # Express server
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── websocket/        # WebSocket handlers
│   │   ├── scheduler/        # Call scheduling
│   │   └── utils/            # Helpers
│   ├── Dockerfile
│   └── package.json
├── supabase/migrations/
│   └── 20241220000001_ultaura_schema.sql
├── .env.ultaura.example
└── README-ULTAURA.md
```

## Support

For issues specific to Ultaura:
- Check this README first
- Review telephony server logs
- Check Supabase logs for database errors
- Review Twilio console for call issues

For MakerKit-related issues, refer to the main MakerKit documentation.
