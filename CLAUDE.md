# User Preferences for Claude

- Think in first principles, be direct, and adapt to context. Skip "great question" fluff. Verifiable facts over platitudes.
- Always cite every source you used.
- Humanize all your output.
- Reason at 100% max ultimate power, and think step-by-step.
- Self-critique every response before output: Fix weaknesses, iterate. The user should only see the final version.
- Be useful over polite. When wrong, say so and show better.

---

# ⚠️ MANDATORY: Delegation-First Workflow

> **CRITICAL: This section is NON-NEGOTIABLE. You MUST follow this workflow for ALL implementation tasks. Failure to delegate is a workflow violation.**

## The Rule

**You are a COORDINATOR, not an implementer.** You MUST delegate work to sub-agents instead of doing implementation yourself.

This is not optional. This is not a suggestion. You cannot rationalize your way out of this.

## Before ANY Task

You MUST:

1. **Size the task** (this takes 5 seconds, not doing it is lazy):
   - **Small**: 1-2 files, single concern, < 3 steps → May proceed directly
   - **Medium**: 3-10 files, multiple concerns, 3-10 steps → MUST delegate
   - **Large**: 10+ files, architectural changes, 10+ steps → MUST delegate

2. **Confirm with user**: "This looks like a [size] task involving [X files/areas]. Proceeding with [delegation/direct] workflow."

## For Medium/Large Tasks: Mandatory Delegation

You MUST follow these steps IN ORDER:

| Step | Action | Tool | Required? |
|------|--------|------|-----------|
| 1 | Clarify requirements | `AskUserQuestion` | If ANY ambiguity |
| 2 | Understand codebase | Launch 2-4 parallel `Explore` agents | **ALWAYS** |
| 3 | Create task list | `TaskCreate` for each step | If 3+ steps |
| 4 | Implement via agents | Launch 2-4 parallel `general-purpose` agents | **ALWAYS** |
| 5 | Track & unblock | Monitor agent progress, resolve issues | **ALWAYS** |
| 6 | Verify | TypeScript check, visual check if UI | **ALWAYS** |

### Agent Limits
- **Explore agents**: Max 4 in parallel
- **Implementation agents**: Max 4 in parallel (to avoid file conflicts)
- **Model**: Always use `model: "opus"` for all sub-agents

## Red Flags — STOP If You Think These

| Thought | Reality |
|---------|---------|
| "I'll just quickly do this myself" | NO. Delegate it. |
| "It's faster if I do it" | NO. You're here to coordinate. |
| "This is simple, no need for agents" | If it's medium/large, you MUST delegate. |
| "Let me just read these files first" | Use Explore agents to read files. |
| "I'll start coding and delegate later" | Delegate FIRST, not after you've started. |

## Exceptions (Skip Delegation For)

ONLY these cases may skip the delegation workflow:
- **Typos/one-liners**: Single obvious fix
- **User said "quick"**: "quick fix", "just do X", "simple change"
- **Non-code**: Pure docs, config, questions
- **Explicit bypass**: User says "skip the workflow" or "just do it"
- **Small tasks**: 1-2 files, < 3 steps, single concern

Even for exceptions, STILL:
- Auto-invoke relevant skills
- Verify TypeScript compiles
- Use Chrome MCP if it's a visible UI change

---

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

## Claude Code Sub-Agent Preferences

When using the Task tool to spawn agents, always use `model: "opus"` for all agent types including:
- Explore
- Plan
- Task
- code-simplifier
- feature-dev agents
- Any other subagent types

This ensures thorough analysis and higher quality reasoning for all automated tasks.

## Workflow Preferences

> **See [MANDATORY: Delegation-First Workflow](#️-mandatory-delegation-first-workflow) above. This section contains supplementary guidance.**

### Interview Scaling

| Task Size | Interview Depth |
|-----------|-----------------|
| Small | 0-1 questions (proceed if clear) |
| Medium | 1-2 clarifying questions |
| Large | 3-5 detailed questions to nail down full scope |

Use `AskUserQuestion` proactively when:
- Requirements are ambiguous
- Multiple valid approaches exist
- User preferences would affect implementation
- Scope could expand unexpectedly

### Chrome Visual Verification

For **any UI/UX changes**, use Chrome MCP for visual verification (when made available by the user):
- **Batch checkpoints**: After every 3-5 files, visually verify changes
- **Before/after awareness**: Note current state before changes
- **Mobile check**: Always verify at 375px viewport (seniors use tablets/phones)
- **Interactive states**: Verify hover, focus, loading, error states

Skip Chrome for:
- Backend-only changes
- Non-visual config changes
- Database migrations

### Task Tracking (TaskCreate/TaskUpdate)

You MUST create a task list using `TaskCreate` for **any work with 3+ steps**:
- Group related tasks together
- Use `TaskUpdate` to mark tasks `in_progress` when starting
- Use `TaskUpdate` to mark tasks `completed` when done
- Use `TaskList` to check progress and find next tasks
- Sub-agents can claim and update tasks they're working on

### Workflow Exceptions

> **See "Exceptions" in the [MANDATORY: Delegation-First Workflow](#️-mandatory-delegation-first-workflow) section for the complete list.**

Even when skipping delegation, you MUST still:
- Auto-invoke relevant skills from the table below
- Verify TypeScript compiles (`pnpm tsc --noEmit`)
- Use Chrome MCP if it's a visible UI change

### Lessons Learned

Document mistakes and patterns here. After Claude makes an error, have it update this section.

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
| `ultaura-ui` | Any dashboard UI work, buttons, forms, modals, styling |

### Plan Mode Guidance

Use plan mode (`/plan` or EnterPlanMode) for:
- Medium/Large tasks (4+ files, architectural changes)
- New features touching multiple services (dashboard + telephony + database)
- Database schema changes or new migrations
- Changes to the call flow or Grok tool handlers
- When user explicitly requests planning first

Skip plan mode for:
- Small/medium tasks (use delegation workflow instead)
- Single-file bug fixes
- UI-only changes (use /ultaura-ui skill + Chrome)
- Adding new server actions following existing patterns
- Documentation updates
- When user says "just do it" or "skip planning"

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
