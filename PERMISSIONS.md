# Ultaura Permission Matrix

This document defines who can read or write each resource, and where those rules are enforced.

Legend:
- R = read
- W = write
- N = no access
- R* = read with consent/tier/privacy gating
- W* = write via controlled flow (voice tool or server action only)

Actors:
- Self user: account owner on `user_type='self'`
- Family payer: account owner on `user_type='family_managed'`
- Other org member: any other user with org membership via `memberships`/`can_access_ultaura_account`
- Added recipient: `ultaura_notification_recipients` (email-only)
- Line voice: Grok voice agent on the call
- Internal/admin: support/admin interfaces using admin credentials
- Service role: telephony/internal services using service-role keys

## Permission Matrix

| Resource | Self user | Family payer | Other org member | Added recipient | Line voice | Internal/admin | Service role |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Accounts (`ultaura_accounts`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Lines (`ultaura_lines`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Schedules (`ultaura_schedules`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Reminders (`ultaura_reminders`) | R/W (own) | R/W (own) | R/W (org) | N | W* (voice tools) | R/W | R/W |
| Trusted contacts (`ultaura_trusted_contacts`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Call sessions (`ultaura_call_sessions`) | R/W (own) | R/W (own) | R/W (org) | N | W* (telephony) | R/W | R/W |
| Call events (`ultaura_call_events`) | R (own) | R (own) | R (org) | N | W* (telephony) | R/W | R/W |
| Safety events (`ultaura_safety_events`) | R (own) | R (own) | R (org) | N | W* (tools/classifier) | R/W | R/W |
| Wellness alerts (`ultaura_wellness_alerts`) | R* | R* | R* | R* (email only) | W* (tools) | R/W | R/W |
| Weekly summaries (`ultaura_weekly_summaries`) | R* | R* | R* | R* (email only) | W* (telephony) | R/W | R/W |
| Insights dashboard data (`ultaura_call_insights`, `ultaura_mood_snapshots`, `ultaura_line_baselines`) | R* | R* | R* | N | W* (tools) | R/W | R/W |
| Memory system (`ultaura_memories`, `ultaura_memory_embeddings`) | R/W (own) | N | N | N | W* (tools) | R/W | R/W |
| Life chapters (`ultaura_life_chapters`) | R/W (own) | N | N | N | W* (tools) | R/W | R/W |
| Milestones (`ultaura_milestones`) | R/W (own) | R (own, app UI) | R (org, app UI) | N | W* (tools) | R/W | R/W |
| Privacy settings (account) (`ultaura_account_privacy_settings`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Voice consent (`ultaura_line_voice_consent`) | R (own) | R (own) | R (org) | N | W* (tools) | R/W | R/W |
| Insight privacy (`ultaura_insight_privacy`) | R (own, no private_topic_codes) | R (own, no private_topic_codes) | R (org, no private_topic_codes) | N | W* (tools) | R/W | R/W |
| Consent audit log (`ultaura_consent_audit_log`) | R (own) | R (own) | R (org) | N | W* (tools/services) | R/W | R/W |
| Notification recipients (`ultaura_notification_recipients`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Data exports (`ultaura_data_export_requests`) | R/W (own) | R/W (own) | R/W (org) | N | N | R/W | R/W |
| Recordings (`ultaura_pending_recording_deletions`) | R/W (own) | R/W (own) | R/W (org) | N | W* (telephony) | R/W | R/W |
| Topic exclusions (`ultaura_topic_exclusions`) | R (own) | R (own) | R (org) | N | W* (tools) | R/W | R/W |
| Opt-outs (`ultaura_opt_outs`) | R (own) | R (own) | R (org) | N | W* (tools/telephony) | R/W | R/W |
| SMS opt-outs (`ultaura_sms_opt_outs`) | N | N | N | N | N | R/W | R/W |

Notes:
- R* for insights: requires `sharing_consent='granted'`, `sharing_tier`, `insights_enabled=true`, and not paused for family-managed. Self users also require `insights_enabled=true`.
- Added recipients only receive redacted emails (weekly summary, wellness alerts, missed calls) and never access dashboards.
- Memory content is never shared to family or recipients; `privacy_scope='line_only'` is excluded from any family-facing context.
- Org membership is enforced by `can_access_ultaura_account` (via `memberships`). UI/role gating may further restrict access.

## Enforcement Points (Exact)

### Database/RLS + Column Privileges
- All tables enforce org scoping via RLS.
- `ultaura_insight_privacy.private_topic_codes`:
  - `REVOKE SELECT (private_topic_codes)` for `anon` + `authenticated`.
  - Only service-role/admin can read (telephony jobs + admin server actions).
- `ultaura_insight_privacy.insights_enabled` and `private_topic_codes`:
  - `REVOKE UPDATE (insights_enabled, private_topic_codes)` for `anon` + `authenticated`.
- `ultaura_insight_privacy` mutation hardening:
  - `REVOKE INSERT, DELETE` for `anon` + `authenticated` (service role only).

### Server Actions (Dashboard)
- `src/lib/ultaura/sharing-gate.ts` centralizes consent/tier/pause/insights_enabled gating.
- `src/lib/ultaura/insights.ts` guards all insights surfaces with `getSharingGate`, filters private topics via `getPrivateTopicCodes`, and blocks family memory artifacts.
- `src/lib/ultaura/alerts.ts` enforces tier redaction for family and blocks tier_1.
- `src/lib/ultaura/privacy.ts` only allows payer-initiated re-prompts; senior-controlled fields cannot be updated directly.

### Telephony Tools (Voice)
- `telephony/src/routes/tools/*` enforce line ownership, record audits, and update consent via service role:
  - `set_sharing_tier`, `set_pause_mode`, `set_insights_enabled`, recording consent tools.
  - Recording re-enable requests are blocked after a decline and cooled down.

### Email Routes (Next.js)
- `src/app/api/telephony/weekly-summary/route.ts`: consent/tier/pause/insights_enabled gating + recipient redaction.
- `src/app/api/telephony/wellness-alerts/route.ts`: consent/tier/pause/insights_enabled gating + tier redaction.
- `src/app/api/telephony/missed-calls/route.ts`: consent/pause/insights_enabled gating.
- `src/app/api/telephony/safety-alert/route.ts`: safety emails always allowed (internal secret only).

### Telephony Services
- `telephony/src/services/weekly-summary.ts`, `telephony/src/services/wellness-alerts.ts`: pause + insights_enabled gating.
- `telephony/src/websocket/media-stream.ts`: filters `privacy_scope='line_only'` memories for family-managed contexts.
- `telephony/src/services/safety-notifications.ts`: safety emails always sent, rate-limited, and checked for delivery success.
