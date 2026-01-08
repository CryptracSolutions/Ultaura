# Insights Without Transcripts - Spec Index

## Part 1: Core Data and Telephony
- Insights extraction pipeline (log_call_insights, fallback) and Grok prompt updates.
- Core schema for call insights, baselines, privacy, and line/call-session counters.
- Grok tools (pause mode, private topics) and telephony endpoints integration.
- Baseline recalculation job and backend logic for answered/missed detection.

## Part 2: Dashboard and Notifications
- Insights dashboard UI, settings integration, and call history mood indicator.
- Weekly summary generation, missed-call alerts, and email templates.
- Notification preferences, server actions, and Next.js email delivery endpoints.
- Scheduled jobs for weekly summaries and missed-call alert checks.

## Dependencies Between Parts
- Part 2 depends on Part 1 for schema, insights capture, baseline data, privacy state, and encryption helpers.
- Part 1 has no dependency on Part 2.

## Coverage Matrix
| Original Heading | Part | Notes |
|---|---|---|
| Insights Without Transcripts - Feature Specification | Part 1 | Title and overview captured in Shared Definitions appendix (in both parts) |
| Overview | Part 1 | Shared Definitions appendix |
| Design Principles | Part 1 | Shared Definitions appendix |
| Target Audience | Part 1 | Shared Definitions appendix |
| Core Metrics ("The Core 5") | Part 1 | Shared Definitions appendix |
| 1. Answered / Missed + Call Duration | Part 1 | Shared Definitions appendix |
| 2. Engagement Score (1-10) | Part 1 | Shared Definitions appendix |
| 3. Mood (3-state + intensity) | Part 1 | Shared Definitions appendix |
| 4. Social Need / Loneliness Indicator (0-3) | Part 1 | Shared Definitions appendix |
| 5. Needs Follow-up Flag | Part 1 | Shared Definitions appendix |
| Topic Tracking | Part 1 | Shared Definitions appendix |
| Topic Taxonomy (10 Categories - Engagement-Focused) | Part 1 | Shared Definitions appendix |
| Storage per call: | Part 1 | Shared Definitions appendix (Topic Tracking) |
| Display: | Part 1 | Shared Definitions appendix (Topic Tracking) |
| Privacy Controls: | Part 1 | Shared Definitions appendix (Topic Tracking) |
| Concern Tracking | Part 1 | Shared Definitions appendix |
| Concern Taxonomy (7 Categories - Wellbeing-Focused) | Part 1 | Shared Definitions appendix |
| Storage per call: | Part 1 | Shared Definitions appendix (Concern Tracking) |
| Novelty Tracking: | Part 1 | Shared Definitions appendix |
| Display: | Part 1 | Shared Definitions appendix (Concern Tracking) |
| Important: | Part 1 | Shared Definitions appendix |
| Safety System Integration | Part 1 | Shared Definitions appendix |
| Separate Systems | Part 1 | Shared Definitions appendix |
| No Overlap | Part 1 | Shared Definitions appendix |
| NOT Tracking (Explicitly Excluded) | Part 1 | Shared Definitions appendix |
| Conversation Clarity / Confusion | Part 1 | Shared Definitions appendix |
| Alerting Rules | Part 1 | Shared Definitions appendix |
| Tier 1: Weekly Summary Only (No Immediate Alert) | Part 1 | Shared Definitions appendix |
| Tier 2: Immediate Notification | Part 1 | Shared Definitions appendix |
| Pause Mode | Part 1 | Shared Definitions appendix |
| Purpose | Part 1 | Shared Definitions appendix (Pause Mode) |
| Implementation | Part 1 | Shared Definitions appendix (Pause Mode) |
| Baseline Calculation | Part 1 | Shared Definitions appendix |
| Baseline Window (14 days, excluding current week) | Part 1 | Shared Definitions appendix |
| Storage | Part 1 | Shared Definitions appendix (Baseline Calculation) |
| Update Frequency | Part 1 | Shared Definitions appendix (Baseline Calculation) |
| Weekly Summary | Part 2 | Part 2 requirements |
| Delivery | Part 2 | Weekly Summary |
| Email Template Structure | Part 2 | Weekly Summary |
| SMS Format (future, not implemented in MVP) | Part 2 | Weekly Summary |
| Insights Extraction | Part 1 | Part 1 requirements |
| Method: Real-Time Tool Call | Part 1 | Insights Extraction |
| Extraction Prompt Additions | Part 1 | Insights Extraction |
| Handling Abrupt Endings | Part 1 | Insights Extraction |
| Database Schema | Part 1 | Split across parts (weekly_summaries and notification_preferences in Part 2) |
| New Table: `ultaura_call_insights` | Part 1 | Database Schema |
| Decrypted Insights JSON Schema | Part 1 | Shared Definitions appendix |
| New Table: `ultaura_line_baselines` | Part 1 | Database Schema |
| New Table: `ultaura_weekly_summaries` | Part 2 | Database Schema (Part 2) |
| New Table: `ultaura_notification_preferences` | Part 2 | Database Schema (Part 2) |
| New Table: `ultaura_insight_privacy` | Part 1 | Database Schema |
| Extend `ultaura_lines` Table | Part 1 | Database Schema |
| Extend `ultaura_call_sessions` Table | Part 1 | Database Schema |
| New Grok Tools | Part 1 | Part 1 requirements |
| 1. `log_call_insights` | Part 1 | New Grok Tools |
| 2. `set_pause_mode` | Part 1 | New Grok Tools |
| 3. `mark_topic_private` | Part 1 | New Grok Tools |
| API Endpoints & Server Actions | Part 2 | Split; telephony endpoints in Part 1 |
| New Server Actions (`/src/lib/ultaura/insights.ts`) | Part 2 | Server actions |
| New Telephony Endpoints (Grok Tools) | Part 1 | API Endpoints |
| New Next.js API Endpoints (Email Delivery) | Part 2 | API Endpoints |
| Dashboard UI | Part 2 | Part 2 requirements |
| New Route: `/dashboard/(app)/insights/` | Part 2 | Dashboard UI |
| Insights Dashboard Layout | Part 2 | Dashboard UI |
| Settings Integration | Part 2 | Dashboard UI |
| Scheduled Jobs | Part 2 | Split; baseline recalculator in Part 1 |
| 1. Weekly Summary Generator | Part 2 | Scheduled Jobs |
| 2. Missed Call Alert Checker | Part 2 | Scheduled Jobs |
| 3. Baseline Recalculator | Part 1 | Scheduled Jobs |
| Encryption Implementation | Part 1 | Shared Definitions appendix |
| Reuse Existing Key Infrastructure | Part 1 | Shared Definitions appendix |
| Grok Prompt Additions | Part 1 | Part 1 requirements |
| Email Templates | Part 2 | Part 2 requirements |
| Weekly Summary Email | Part 2 | Email Templates |
| Missed Calls Alert Email | Part 2 | Email Templates |
| Implementation Order | Part 1 & 2 | Split by phase across parts |
| Phase 1: Core Infrastructure | Part 1 | Implementation Order |
| Phase 2: Dashboard UI | Part 2 | Implementation Order |
| Phase 3: Notifications | Part 2 | Implementation Order |
| Phase 4: Privacy & Pause | Part 1 | Split; UI tasks in Part 2 |
| Phase 5: Polish & Testing | Part 2 | Split; backend tests in Part 1 |
| File Changes Summary | Part 1 & 2 | Split across parts |
| New Files | Part 1 & 2 | Split across parts |
| Modified Files | Part 1 & 2 | Split across parts |
| Testing Considerations | Part 1 & 2 | Split across parts |
| Unit Tests | Part 1 | Testing |
| Integration Tests | Part 1 & 2 | Split across parts |
| E2E Tests | Part 1 & 2 | Split across parts |
| Manual Testing | Part 1 & 2 | Split across parts |
| Assumptions | Part 1 | Shared Context appendix |
| Open Questions (Resolved) | Part 1 | Shared Context appendix |
| Success Metrics | Part 1 | Shared Context appendix |
| Disclaimer Text | Part 1 | Shared Context appendix |
| Implementation Clarifications | Part 2 | Split across parts |
| Data Model | Part 1 | Implementation Clarifications |
| Insights Processing | Part 1 | Implementation Clarifications |
| Privacy | Part 1 | Implementation Clarifications |
| Safety System Integration | Part 1 | Implementation Clarifications |
| Alerts & Baselines | Part 1 | Implementation Clarifications |
| Weekly Summary & Notifications | Part 2 | Implementation Clarifications |
| Dashboard UI | Part 2 | Implementation Clarifications |
| Weekly Summary Structured Data Schema | Part 2 | Part 2 requirements |
| Answered Detection Logic | Part 1 | Shared Definitions appendix |
| Lazy Notification Preferences Pattern | Part 2 | Part 2 requirements |
| Encryption AAD Structure | Part 1 | Shared Definitions appendix |

## Open Questions
- None. The split introduces no new ambiguities beyond the resolved questions in Shared Context.
