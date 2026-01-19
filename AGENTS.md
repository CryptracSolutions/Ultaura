# Ultaura - AI Voice Companion for Seniors

AI-powered voice companion providing check-in calls for elderly individuals. Built on MakerKit SaaS template with Twilio telephony and xAI Grok Voice Agent.

## Overview

Ultaura makes automated phone calls to seniors at scheduled times for friendly conversation, reminders, activity suggestions, and companionship. Family members (payers) manage lines, schedules, and usage through a web dashboard. The system includes mood tracking, wellness alerts, cognitive observation, and family notification features.

### Key Features

- **Scheduled Check-in Calls**: Configure daily call times with quiet hours and vacation mode
- **Natural Voice Conversations**: Powered by xAI Grok Voice Agent (Ara, Eve, Leo, Rex, Sal voices)
- **Recurring Reminders**: RRULE-based with pause/snooze/skip functionality
- **Memory System**: Encrypted storage with semantic search, topic exclusions, and decay
- **Safety Monitoring**: Detects distress keywords, logs events with severity tiers
- **Trusted Contacts**: Emergency contacts notified during safety events
- **Multi-Line Support**: Up to 4 lines on Family plan
- **Usage-Based Billing**: Minutes pooled at account level with overage at $0.15/min
- **Answering Machine Detection**: Configurable voicemail behavior when calls reach machines
- **Insights Dashboard**: Mood tracking, emotional trends, conversation highlights
- **Wellness Alerts**: Automated alerts to family when concerns detected
- **Weekly Summaries**: Email digests for family members
- **Milestones**: Birthday, anniversary, and memorial tracking
- **Accessibility Settings**: Hearing and cognitive support adaptations
- **Privacy Center**: Consent management, data export, account deletion


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
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌──────────────────┐
│  Upstash Redis  │     │  OpenAI/xAI      │
│  Rate Limiting  │     │  Embeddings      │
└─────────────────┘     └──────────────────┘
```

### Components

1. **Next.js Dashboard** (`/src/app/dashboard/(app)/`)
   - Line management with phone verification
   - Schedule and reminder configuration
   - Trusted contacts management
   - Usage monitoring and billing
   - Insights dashboard with mood trends
   - Wellness alerts management
   - Privacy center with consent controls
   - Milestones tracking

2. **Telephony Backend** (`/telephony/`)
   - Express.js server on port 3001
   - WebSocket bridge: Twilio Media Streams ↔ Grok Realtime API
   - Call scheduler with distributed locking
   - Weekly summary scheduler
   - Recording deletion scheduler
   - Memory decay and embedding jobs
   - 45 Grok tool handlers
   - 33 service modules
   - Rate limiting with Upstash Redis

3. **Database** (`/supabase/migrations/`)
   - 68 migration files with RLS policies
   - Core, billing, safety, insights, privacy, and personalization tables
   - Distributed scheduler coordination
   - Vector embeddings for semantic memory search

4. **Shared Packages** (`/packages/`)
   - `@ultaura/types` - Shared TypeScript types
   - `@ultaura/prompts` - Grok system prompts and tool definitions
   - `@ultaura/schemas` - Zod validation schemas

## Plans & Pricing

| Plan | Monthly | Annual | Minutes | Lines |
|------|---------|--------|---------|-------|
| Free Trial | $0 | - | 20 | 1 |
| Care | $39 | $399 | 300 | 1 |
| Comfort | $99 | $999 | 900 | 2 |
| Family | $199 | $1,999 | 2,200 | 4 |
| Usage Based | $0 | - | 0 | 4 |

- All overages: $0.15/min (except Free Trial: hard stop)
- Trial duration: 3 days
- Annual discount: 15%

## Setup Instructions

### Prerequisites

- Node.js 18+
- pnpm (workspace enabled)
- Supabase project (or local Docker)
- Twilio: Programmable Voice + Verify Service + phone number
- xAI account with Grok Voice Agent API access
- Stripe account
- Upstash Redis (for rate limiting)
- OpenAI API key (for semantic search embeddings)

### 1. Environment Configuration

```bash
cp .env.ultaura.example .env.local
```

**Required Environment Variables:**

```bash
# Ultaura Core
ULTAURA_ENCRYPTION_KEY=        # 64 hex chars (openssl rand -hex 32)
ULTAURA_INTERNAL_API_SECRET=   # API auth secret
ULTAURA_BACKEND_URL=           # http://localhost:3001
ULTAURA_PUBLIC_URL=            # Public URL for Twilio webhooks
ULTAURA_WEBSOCKET_URL=         # WSS URL for Twilio Media Streams
ULTAURA_APP_URL=               # Web app URL (defaults to NEXT_PUBLIC_SITE_URL)

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=           # E.164 format
TWILIO_VERIFY_SERVICE_SID=
TWILIO_AMD_ENABLED=true        # Answering machine detection

# xAI Grok
XAI_API_KEY=
XAI_GROK_MODEL=grok-3-fast

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Embeddings (for semantic memory search)
OPENAI_API_KEY=

# Stripe (8 price IDs + keys)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID=
STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID=
STRIPE_ULTAURA_PAYG_PRICE_ID=
STRIPE_ULTAURA_OVERAGE_PRICE_ID=
```

**Optional Configuration:**

```bash
# Rate Limiting Thresholds
RATE_LIMIT_VERIFY_SEND_PER_PHONE=5
RATE_LIMIT_VERIFY_CHECK_PER_PHONE=10
RATE_LIMIT_PER_IP=20
RATE_LIMIT_PER_ACCOUNT=10

# Memory System
ULTAURA_SEMANTIC_SEARCH_ENABLED=true
ULTAURA_MEMORY_DECAY_ENABLED=true
ULTAURA_TOPIC_EXCLUSIONS_ENABLED=true
ULTAURA_PER_LINE_DEK_ENABLED=true

# Observability
SENTRY_DSN=
LOG_LEVEL=info

# Development
SKIP_PHONE_VERIFICATION=false
ULTAURA_DEBUG=false
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
Messaging Webhook: https://your-server.com/twilio/sms/inbound (POST)
```

### 4. Start Telephony Server

```bash
cd telephony && pnpm install && pnpm dev
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
Update `ULTAURA_PUBLIC_URL` with ngrok URL.

## Call Flow

1. Scheduler triggers outbound call via Twilio (with AMD enabled)
2. Twilio performs Answering Machine Detection:
   - **Human/Unknown**: Proceeds to conversation
   - **Machine**: Applies line's `voicemail_behavior` setting (none/brief/detailed)
   - **Fax**: Hangs up immediately
3. If human, Twilio opens Media Stream WebSocket at `/twilio/media`
4. Telephony bridges audio to Grok Realtime API
5. Grok converses using 45 available tools (reminders, safety, memory, insights, etc.)
6. Call ends, usage recorded in minute ledger
7. Call insights extracted and stored (encrypted)
8. Memory summaries encrypted and stored with embeddings
9. Wellness alerts triggered if concerns detected
10. Weekly summary scheduler aggregates data for family notifications
11. Overage reported to Stripe if applicable

## Database Tables

### Core
- `ultaura_accounts` - Account records tied to organizations (includes user_type, sharing settings)
- `ultaura_lines` - Phone number profiles with preferences, accessibility, vacation settings
- `ultaura_subscriptions` - Stripe subscription records
- `ultaura_plans` - Plan reference data
- `ultaura_phone_verifications` - Verification tracking
- `ultaura_system_settings` - Global system toggles

### Calling
- `ultaura_schedules` - Recurring call schedules
- `ultaura_schedule_exceptions` - Skip/snooze/reschedule specific dates
- `ultaura_schedule_events` - Schedule audit trail
- `ultaura_call_sessions` - Individual call records (includes `answered_by` for AMD)
- `ultaura_call_events` - Call event log (DTMF, tools, errors)
- `ultaura_scheduler_leases` - Distributed scheduler coordination

### Reminders
- `ultaura_reminders` - Reminders with recurrence, pause, snooze
- `ultaura_reminder_events` - Reminder action audit trail

### Billing
- `ultaura_minute_ledger` - Call minute tracking for billing

### Insights & Analytics
- `ultaura_call_insights` - Per-call AI insights (encrypted)
- `ultaura_line_baselines` - 14-day rolling average baselines
- `ultaura_insight_privacy` - Per-line insight sharing controls
- `ultaura_weekly_summaries` - Weekly summary reports (encrypted)
- `ultaura_notification_preferences` - Summary and alert preferences
- `ultaura_notification_recipients` - Family sharing recipients

### Personalization
- `ultaura_memories` - Encrypted memory storage with embeddings
- `ultaura_memory_embeddings` - Vector embeddings for semantic search
- `ultaura_life_chapters` - Life story chapters (encrypted)
- `ultaura_mood_snapshots` - Per-call mood tracking
- `ultaura_emotional_patterns` - Mood patterns and triggers
- `ultaura_content_preferences` - Trivia/story/game preferences
- `ultaura_relationships` - Tracked people and relationships
- `ultaura_milestones` - Birthdays, anniversaries, memorials
- `ultaura_daily_rhythms` - Daily energy/routine patterns
- `ultaura_persona_adaptations` - AI persona adjustments
- `ultaura_accessibility_settings` - Hearing/cognitive support

### Retention & Engagement
- `ultaura_call_previews` - Topic previews for next call
- `ultaura_segment_engagement` - Trivia/story/learning tracking
- `ultaura_story_arcs` - Serial stories and learning journeys

### Safety & Health
- `ultaura_trusted_contacts` - Emergency contacts
- `ultaura_safety_events` - Safety incidents (low/medium/high tiers)
- `ultaura_wellness_alerts` - Wellness alert records
- `ultaura_health_mentions` - Health-related mentions (encrypted)
- `ultaura_cognitive_observations` - Per-call cognitive observations
- `ultaura_cognitive_flags` - 14-day cognitive concern flags
- `ultaura_grief_interactions` - Grief support tracking

### Privacy & Consent
- `ultaura_consents` - Consent records (calls, SMS, data)
- `ultaura_opt_outs` - Do-not-call tracking
- `ultaura_sms_opt_outs` - SMS opt-out tracking
- `ultaura_account_privacy_settings` - Account-level privacy (recording, retention)
- `ultaura_consent_audit_log` - Immutable consent change trail
- `ultaura_line_voice_consent` - Per-line voice consent status
- `ultaura_data_export_requests` - GDPR-style data export requests
- `ultaura_topic_exclusions` - Senior-controlled memory topic exclusions
- `ultaura_memory_deactivation_log` - Memory deactivation audit trail

### Encryption
- `ultaura_account_crypto_keys` - Account-level DEKs wrapped with KEK
- `ultaura_line_crypto_keys` - Per-line DEKs for enhanced privacy

### Admin & Debug
- `ultaura_debug_logs` - Admin-only debug logging
- `ultaura_rate_limit_events` - Rate limit audit logging

## API Reference

### Server Actions (by module)

**Accounts** (`accounts.ts`):
- getOrCreateUltauraAccount, getUltauraAccount, updateAccountSharing
- upgradeSelfToFamilyMode, isTrialExpired, getTrialInfo

**Lines** (`lines.ts`):
- getLines, getLine, createLine, updateLine, deleteLine

**Phone Verification** (`verification.ts`):
- startPhoneVerification, checkPhoneVerification

**Schedules** (`schedules.ts`):
- getSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule
- getUpcomingScheduledCalls, getAllSchedules

**Schedule Exceptions** (`schedule-exceptions.ts`):
- getScheduleExceptions, getScheduleException, getUpcomingExceptions
- createScheduleException, deleteScheduleException

**Schedule Events** (`schedule-events.ts`):
- logScheduleEvent, getScheduleEvents

**Reminders** (`reminders.ts`):
- getReminders, getReminder, createReminder, editReminder
- pauseReminder, resumeReminder, snoozeReminder, cancelReminder
- skipNextOccurrence, getUpcomingReminders, getAllReminders
- getPendingReminderCount, getNextReminder

**Reminder Events** (`reminder-events.ts`):
- logReminderEvent, getReminderEvents, getLineReminderEvents

**Trusted Contacts** (`contacts.ts`):
- getTrustedContacts, addTrustedContact, removeTrustedContact

**Usage & Billing** (`usage.ts`):
- getUsageSummary, getCallSessions, getLineActivity
- updateOverageCap, initiateTestCall

**Checkout** (`checkout.ts`):
- createUltauraCheckout, getUltauraPriceId

**Vacation** (`vacation.ts`):
- getVacationRanges, isLineOnVacation, addVacationRange, removeVacationRange

**Privacy** (`privacy.ts`):
- getAccountPrivacySettings, updatePrivacySettings, acknowledgeVendorDisclosure
- getLineVoiceConsent, getLineVoiceConsents
- requestRecordingReenable, requestSharingRePrompt
- logConsentAudit, getConsentAuditLog
- requestDataExport, getDataExportRequests, requestAccountDataDeletion

**Insights** (`insights.ts`):
- getNotificationPreferences, updateNotificationPreferences
- getInsightPrivacy, updateInsightPrivacy
- getLineInsights, getLineBaseline, getWeeklySummary
- getInsightsDashboard, getEmotionalTrends, getMoodCalendar
- getSafetyEvents, getConversationHighlights, getMemoryActivity
- getRelationshipIndicators, setPauseMode

**Retention** (`retention.ts`):
- getCallPreviewHistory, getStoryArcProgress
- getSegmentEngagementStats, getRetentionMetrics

**Notification Recipients** (`notification-recipients.ts`):
- getNotificationRecipients, inviteNotificationRecipient
- removeNotificationRecipient, confirmNotificationRecipient
- unsubscribeNotificationRecipient

**Alerts** (`alerts.ts`):
- getWellnessAlerts, acknowledgeWellnessAlert

**Milestones** (`milestones.ts`):
- getMilestones, createMilestone, updateMilestone, deleteMilestone

**Accessibility** (`accessibility.ts`):
- getAccessibilitySettings, updateAccessibilitySettings

**Relationships** (`relationships.ts`):
- getRelationships

### Telephony API Endpoints

**Core Routes:**
```
POST /twilio/voice/inbound   - Inbound call webhook
POST /twilio/voice/outbound  - Outbound call TwiML
POST /twilio/status          - Call status callback
POST /twilio/sms/inbound     - SMS inbound handling
WS   /twilio/media           - Twilio Media Stream WebSocket
POST /calls/outbound         - Initiate outbound call
POST /calls/test             - Test call endpoint
POST /verify/*               - Phone verification
GET  /health                 - Health check with service status
```

**Internal Routes:**
```
POST /internal/sms           - Internal SMS sending
POST /internal/recordings    - Recording management
POST /internal/exports       - Data export generation
GET  /internal/scheduler-status - Scheduler lease status
GET  /internal/active-calls  - Active call sessions on this pod
GET  /internal/metrics       - Prometheus metrics (protected)
```

**Grok Tool Endpoints** (45 tools in `/tools/*`):

*Reminders:*
- set-reminder, list-reminders, edit-reminder
- pause-reminder, resume-reminder, snooze-reminder, cancel-reminder

*Scheduling:*
- schedule-call, skip-schedule, snooze-schedule, reschedule-schedule

*Memory:*
- store-memory, update-memory, review-memories, forget-memory
- mark-private, mark-topic-private, memory-guard

*Insights & Personalization:*
- log-call-insights, log-mood-snapshot, log-segment-engagement
- log-cognitive-observation, log-health-mention
- store-life-chapter, store-milestone, mark-milestone-celebrated
- update-relationship, mark-relationship-deceased
- update-content-preference, manage-story-arc
- store-call-preview, mark-preview-outcome
- adjust-accessibility, report-conversation-language

*Privacy & Consent:*
- opt-out, voice-consent, recording-consent, sharing-consent
- exclude-topic, include-topic, list-exclusions, set-pause-mode

*Safety:*
- safety-event

*Billing:*
- overage-action, request-upgrade

### Next.js API Routes

```
POST /api/voice-demo              - Voice demo TTS
POST /api/telephony/alerts        - Security anomaly alerts
POST /api/telephony/upgrade       - Voice-initiated upgrade
POST /api/telephony/missed-calls  - Missed call email alerts
POST /api/telephony/wellness-alerts - Wellness alert notifications
POST /api/telephony/weekly-summary  - Weekly summary emails
POST /api/ultaura/invite          - Family notification invites
GET  /api/ultaura/confirm/[token] - Email confirmation
POST /api/ultaura/unsubscribe/[token] - Email unsubscribe
```

## Telephony Services

The telephony backend includes 33 service modules:

| Service | Description |
|---------|-------------|
| `account-encryption.ts` | Account-level encryption key management |
| `anomaly-alerts.ts` | Security anomaly detection and alerting |
| `baseline.ts` | 14-day rolling baseline calculations |
| `call-preview.ts` | Next-call topic preview generation |
| `call-session.ts` | Call lifecycle management |
| `call-summarization.ts` | AI-powered call summarization |
| `cognitive-flags.ts` | Cognitive concern flagging |
| `embedding.ts` | Vector embedding generation |
| `embedding-queue.ts` | Async embedding job queue |
| `ephemeral-buffer.ts` | Temporary call data buffer |
| `exports.ts` | Data export generation |
| `insight-state.ts` | Real-time insight tracking |
| `insights.ts` | Call insights extraction |
| `insights-fallback.ts` | Fallback insight generation |
| `language.ts` | Language detection and handling |
| `line-encryption.ts` | Per-line encryption key management |
| `line-lookup.ts` | Line data retrieval |
| `memory.ts` | Memory storage and retrieval |
| `memory-decay.ts` | Memory importance decay |
| `metering.ts` | Minute usage tracking |
| `persona-analyzer.ts` | Persona adaptation analysis |
| `privacy.ts` | Privacy enforcement |
| `prompt-context.ts` | Dynamic prompt context building |
| `rate-limit-config.ts` | Rate limit configuration |
| `rate-limit-events.ts` | Rate limit event logging |
| `rate-limiter.ts` | Request rate limiting |
| `redis.ts` | Upstash Redis client |
| `retention-context.ts` | Retention mechanics context |
| `safety-state.ts` | Safety monitoring state |
| `topic-exclusions.ts` | Topic filtering enforcement |
| `weekly-summary.ts` | Weekly summary generation |
| `wellness-alerts.ts` | Wellness alert triggering |

## Operations Notes

- WebSocket media streams require sticky sessions; ingress should hash on the `callSessionId` query param.
- Scheduler leases include: `schedules`, `reminders`, `weekly-summaries`, `recording-deletions`, `embeddings`, `decay-job`.
- Telephony pods drain active WebSocket calls on SIGTERM/SIGINT (30s max) before exit.
- Internal ops endpoints (require `X-Webhook-Secret`): `/internal/scheduler-status`, `/internal/active-calls`, `/internal/metrics`.
- Prometheus scraping should hit `/internal/metrics` with `X-Webhook-Secret` via ServiceMonitor `httpHeaders` + Secret.

## Security

### Phone Verification
All lines must be verified via Twilio Verify before receiving calls.

### Memory Encryption
AES-256-GCM envelope encryption:
- KEK (Key Encryption Key) in environment
- DEK (Data Encryption Key) per account, wrapped with KEK
- Per-line DEK option for enhanced privacy (enabled by default for new lines)
- AAD binding includes account and line IDs

### Rate Limiting
Distributed rate limiting via Upstash Redis:
- Per-phone verification limits
- Per-IP request limits
- Per-account action limits
- Anomaly detection with cost thresholds

### Safety Monitoring
- Detects distress keywords (suicide, self-harm, hopeless, etc.)
- Logs events with tiers: low, medium, high
- Actions: none, suggested_988, suggested_911, notified_contact
- Wellness alerts sent to family members

### Consent & Opt-out
- Tracks payer/line consent for calls, SMS, data retention
- Voice consent capture during calls
- Respects opt-out requests by channel (calls, SMS, all)
- Topic exclusions for sensitive subjects
- GDPR-compliant data export and deletion

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
├── packages/
│   ├── types/                    # @ultaura/types - Shared TypeScript types
│   ├── prompts/                  # @ultaura/prompts - Grok prompts & tools
│   └── schemas/                  # @ultaura/schemas - Zod validation schemas
├── src/
│   ├── lib/ultaura/
│   │   ├── accounts.ts           # Account management
│   │   ├── lines.ts              # Line CRUD
│   │   ├── verification.ts       # Phone verification
│   │   ├── schedules.ts          # Schedule management
│   │   ├── schedule-exceptions.ts # Schedule exceptions
│   │   ├── schedule-events.ts    # Schedule audit events
│   │   ├── reminders.ts          # Reminder lifecycle
│   │   ├── reminder-events.ts    # Reminder audit events
│   │   ├── contacts.ts           # Trusted contacts
│   │   ├── usage.ts              # Usage & billing queries
│   │   ├── checkout.ts           # Stripe checkout
│   │   ├── billing.ts            # Stripe integration
│   │   ├── vacation.ts           # Vacation management
│   │   ├── privacy.ts            # Privacy & consent
│   │   ├── insights.ts           # Insights dashboard (52KB)
│   │   ├── retention.ts          # Retention metrics
│   │   ├── alerts.ts             # Wellness alerts
│   │   ├── milestones.ts         # Milestone tracking
│   │   ├── accessibility.ts      # Accessibility settings
│   │   ├── relationships.ts      # Relationship data
│   │   ├── notification-recipients.ts # Family notifications
│   │   ├── notification-tokens.ts # Token generation
│   │   ├── constants.ts          # Plans, settings, config
│   │   ├── types.ts              # TypeScript types
│   │   ├── helpers.ts            # Shared helpers
│   │   └── index.ts              # Exports
│   ├── app/
│   │   ├── dashboard/(app)/
│   │   │   ├── lines/
│   │   │   │   ├── page.tsx              # Lines list
│   │   │   │   ├── components/           # LineCard, AddLineModal
│   │   │   │   └── [lineId]/
│   │   │   │       ├── page.tsx          # Line detail
│   │   │   │       ├── settings/         # Line settings, vacation
│   │   │   │       ├── verify/           # Phone verification
│   │   │   │       ├── schedule/         # Schedule management
│   │   │   │       ├── contacts/         # Trusted contacts
│   │   │   │       ├── reminders/        # Line reminders
│   │   │   │       ├── insights/         # Line insights, mood calendar
│   │   │   │       └── milestones/       # Milestone tracking
│   │   │   ├── reminders/                # All reminders view
│   │   │   ├── calls/                    # Call history
│   │   │   ├── usage/                    # Usage dashboard
│   │   │   ├── alerts/                   # Wellness alerts
│   │   │   ├── insights/                 # Global insights dashboard
│   │   │   └── privacy/                  # Privacy center
│   │   ├── onboarding/                   # User onboarding flow
│   │   ├── ultaura-admin/                # Admin interface
│   │   └── api/
│   │       ├── telephony/                # Telephony webhooks
│   │       ├── ultaura/                  # Notification endpoints
│   │       └── voice-demo/               # Voice demo API
│   ├── components/ultaura/
│   │   ├── PricingTable.tsx
│   │   ├── ErrorBoundary.tsx
│   │   ├── InProgressCallBanner.tsx
│   │   ├── TrialExpiredBanner.tsx
│   │   └── TrialStatusBadge.tsx
│   └── lib/emails/
│       ├── missed-calls-alert.tsx
│       ├── notification-invite.tsx
│       ├── weekly-summary.tsx
│       └── wellness-alert.tsx
├── telephony/
│   ├── src/
│   │   ├── server.ts                 # Express server (port 3001)
│   │   ├── middleware/
│   │   │   ├── auth.ts               # API authentication
│   │   │   └── rate-limiter.ts       # Rate limiting middleware
│   │   ├── routes/
│   │   │   ├── twilio-inbound.ts
│   │   │   ├── twilio-outbound.ts
│   │   │   ├── twilio-status.ts
│   │   │   ├── twilio-sms-inbound.ts
│   │   │   ├── calls.ts
│   │   │   ├── verify.ts
│   │   │   ├── test.ts
│   │   │   ├── internal/             # Internal APIs
│   │   │   └── tools/                # 45 Grok tool handlers
│   │   ├── services/                 # 33 service modules
│   │   ├── websocket/
│   │   │   ├── media-stream.ts       # Twilio WS handler
│   │   │   ├── grok-bridge.ts        # xAI Realtime bridge
│   │   │   └── grok-bridge-registry.ts
│   │   ├── scheduler/
│   │   │   ├── call-scheduler.ts     # Call scheduling
│   │   │   ├── weekly-summary-scheduler.ts
│   │   │   └── recording-deletion.ts
│   │   ├── jobs/
│   │   │   ├── decay-job.ts          # Memory decay
│   │   │   └── embedding-job.ts      # Embedding generation
│   │   └── utils/                    # Utility functions
│   ├── Dockerfile
│   └── package.json
├── supabase/migrations/              # 68 migration files
├── .github/workflows/
│   └── build.yml                     # CI/CD pipeline
├── .env.ultaura.example
└── pnpm-workspace.yaml
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

### Rate Limiting Issues
1. Check Upstash Redis connection
2. Review `ultaura_rate_limit_events` table
3. Check rate limit thresholds in environment

### Memory/Embeddings Not Working
1. Verify `OPENAI_API_KEY` is set
2. Check `ULTAURA_SEMANTIC_SEARCH_ENABLED`
3. Review embedding job logs
4. Check `ultaura_memory_embeddings` table

## Support

- Check this file and telephony server logs
- Supabase logs for database errors
- Twilio console for call issues
- MakerKit docs: https://makerkit.dev/docs/next-supabase-turbo
