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

## Claude Code Agent Preferences

When using the Task tool to spawn agents, always use `model: "opus"` for all agent types including:
- Explore
- Plan
- code-simplifier
- feature-dev agents
- Any other subagent types

This ensures thorough analysis and higher quality reasoning for all automated tasks.

### Auto-Invoke Skills

Automatically use the Skill tool to invoke these skills when the context matches:

| Skill | Trigger When |
|-------|--------------|
| `vercel-react-best-practices` | Writing/reviewing React or Next.js code, performance optimization |
| `remotion-best-practices` | Working with Remotion video code |
| `better-auth-best-practices` | Implementing authentication with Better Auth |
| `copywriting` | Writing or improving marketing copy for pages |
| `copy-editing` | Editing, reviewing, or proofreading existing copy |
| `seo-audit` | Auditing SEO, diagnosing ranking issues |
| `programmatic-seo` | Building SEO pages at scale, template pages |
| `marketing-ideas` | Brainstorming marketing strategies or growth ideas |
| `marketing-psychology` | Applying psychological principles to marketing |
| `pricing-strategy` | Pricing decisions, packaging, monetization |
| `page-cro` | Optimizing page conversions, CRO analysis |
| `skill-creator` | Creating new skills for Claude Code or Codex |

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
   - Migration files with RLS policies
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

- See `telephony/OBSERVABILITY.md` for logging, metrics, and tracing details.
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
