# Ultaura Architecture Reference

Detailed reference documentation for the Ultaura codebase. For project overview and Claude Code instructions, see [CLAUDE.md](./CLAUDE.md).

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
- `ultaura_pending_recording_deletions` - Queued recording deletion jobs

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

**Grok Tool Endpoints** (48 tools in `/telephony/src/routes/tools/`):

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
- set-insights-enabled, set-voice-preference

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

The telephony backend includes 44 service modules in `/telephony/src/services/`:

| Service | Description |
|---------|-------------|
| `account-encryption.ts` | Account-level encryption key management |
| `active-calls.ts` | Active call session tracking |
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
| `routing-alerts.ts` | Call routing alert notifications |
| `safety-classifier.ts` | AI-powered safety classification |
| `safety-heuristics.ts` | Rule-based safety detection |
| `safety-keywords.ts` | Keyword-based safety triggers |
| `safety-metrics.ts` | Safety event metrics tracking |
| `safety-notifications.ts` | Safety alert notifications |
| `safety-rubric.ts` | Safety severity rubric |
| `safety-state.ts` | Safety monitoring state |
| `safety-verifier.ts` | Safety classification verification |
| `stream-token.ts` | WebSocket stream token management |
| `topic-exclusions.ts` | Topic filtering enforcement |
| `weekly-summary.ts` | Weekly summary generation |
| `wellness-alerts.ts` | Wellness alert triggering |
| `ws-security.ts` | WebSocket security validation |
| `ws-security-alerts.ts` | WebSocket security alerting |
