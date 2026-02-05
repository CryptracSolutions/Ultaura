# User Preferences for Codex

- Think in first principles, be direct, and adapt to context. Skip "great question" fluff. Verifiable facts over platitudes.
- Always cite every source you used.
- Humanize all your output.
- Reason at 100% max ultimate power, and think step-by-step.
- Self-critique every response before output: Fix weaknesses, iterate. The user should only see the final version.
- Be useful over polite. When wrong, say so and show better.

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

## Codex Workflow Preferences

### Task Sizing (Auto-Detect)

Before implementation, identify task size:
- **Small**: 1-2 files, single concern, < 3 steps
- **Medium**: 3-5 files, multiple concerns, 3-10 steps
- **Large**: 6+ files, architectural changes, 10+ steps

**First output should state**: "This is a [size] task involving [X files/areas]. Approach: [workflow level]."

### Delegation-First Approach

**Act as a coordinator, not an implementer.** For medium/large tasks:
1. Launch parallel subagents to explore/understand the codebase (max 3)
2. Identify existing patterns, utilities, and code to reuse
3. Break work into parallelizable chunks
4. Dispatch implementation subagents (max 4 at a time)
5. Verify changes compile and tests pass
6. Document any assumptions or questions in the PR description

### Subagent Rules

- **Exploration subagents**: Max 4 in parallel (for auditing/understanding)
- **Implementation subagents**: Max 4 in parallel (to avoid conflicts)
- **ALWAYS wait for all subagents to complete before yielding**

Spawn subagents automatically when:
- Exploration of the codebase is needed before planning
- Work can be parallelized (e.g., multiple independent files)
- Long-running tasks where workers can run independently
- Isolation is needed for risky changes or verification

### Handling Ambiguity (Use request_user_input)

Use the `request_user_input` tool proactively when:
- Requirements are ambiguous
- Multiple valid approaches exist
- User preferences would affect implementation
- Scope could expand unexpectedly

| Task Size | Question Depth |
|-----------|----------------|
| Small | 0-1 questions (proceed if clear) |
| Medium | 1-2 clarifying questions |
| Large | 3-5 detailed questions to nail down full scope |

**Always document assumptions** in the PR description or commit messages so the user can correct if needed.

### UI/UX Changes (No Visual Verification)

Without Chrome MCP, for any UI changes:
- **Follow existing patterns**: Match styling from similar components
- **Mobile-first**: Seniors use tablets/phones - ensure responsive design
- **Describe expected result**: In PR, describe what the UI should look like
- **Test compilation**: Ensure TypeScript passes
- **Reference designs**: If Figma/screenshots provided in task, follow them exactly

### Verification Checklist

Before completing any task, verify:
- [ ] TypeScript compiles (`npm run typecheck` or `tsc --noEmit`)
- [ ] Tests pass if they exist (`npm test`)
- [ ] No obvious regressions in related functionality
- [ ] Commit messages are clear and descriptive
- [ ] PR description documents approach and any assumptions

### Task Tracking (update_plan)

Use the `update_plan` tool for **any work with 3+ steps**:
- Create a task list before starting implementation
- Group related tasks together
- Mark tasks in_progress when starting
- Mark tasks completed when done
- Use for progress visibility and coordination

### Skip Elaborate Workflow For

Proceed directly without the full subagent workflow for:
- **Typos and one-liners**: Obvious fixes, single line changes
- **Simple bug fixes**: Clear cause, single file
- **Documentation updates**: README, comments, ARCHITECTURE.md
- **Config changes**: Environment, package.json, tsconfig

For skipped tasks, still:
- Verify TypeScript compiles
- Run relevant tests
- Write clear commit message

### Lessons Learned

Document mistakes and patterns here. After an agent makes an error, have it update this section.

#### Database & Supabase
- Always add RLS policies when creating new `ultaura_*` tables
- New tables must have `account_id` or `line_id` for RLS scoping
- Run `supabase db diff` to verify migration changes before committing

#### Telephony
- Grok tools must be registered in both `/telephony/src/routes/tools/` AND the prompt definitions in `@ultaura/prompts`
- WebSocket handlers must handle disconnect gracefully (30s drain on SIGTERM)
- Always use the service role client for telephony operations (RLS bypass)

#### React/Next.js
- Server actions go in `/src/lib/ultaura/`
- Use the existing patterns for error handling with `ActionResult<T>` types
- Dashboard pages should use the existing layout components

#### Common Mistakes
- [ ] Forgetting to add new tables to the ARCHITECTURE.md reference
- [ ] Not testing with both payer and line user_type accounts
- [ ] Missing encryption for PII fields (use line/account encryption services)

*Add new lessons as they're discovered.*

### Plan Mode Guidance

Use Plan mode for:
- **Large tasks** (6+ files, architectural changes)
- New features touching multiple services (dashboard + telephony + database)
- Database schema changes or new migrations
- Changes to the call flow or Grok tool handlers
- When user explicitly requests planning first

Skip Plan mode for:
- **Small/Medium tasks** (use delegation workflow instead)
- Single-file bug fixes
- UI-only changes following existing patterns
- Adding new server actions following existing patterns
- Documentation updates
- When user says "just do it" or "skip planning"

### Workflow Selection

| Task Size | Workflow |
|-----------|----------|
| **Large** (6+ files, architectural) | Plan mode → then delegation workflow |
| **Medium** (3-5 files, clear requirements) | Delegation workflow (parallel subagents) |
| **Small** (1-2 files, obvious fix) | Proceed directly |

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
   - 48 Grok tool handlers
   - 44 service modules
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
5. Grok converses using 48 available tools (reminders, safety, memory, insights, etc.)
6. Call ends, usage recorded in minute ledger
7. Call insights extracted and stored (encrypted)
8. Memory summaries encrypted and stored with embeddings
9. Wellness alerts triggered if concerns detected
10. Weekly summary scheduler aggregates data for family notifications
11. Overage reported to Stripe if applicable

## Reference Documentation

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md):
- Database tables and schemas (56 tables)
- Server actions by module (in `/src/lib/ultaura/`)
- Telephony API endpoints
- Grok tool endpoints (48 tools in `/telephony/src/routes/tools/`)
- Telephony service modules (44 services)
- Next.js API routes

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
