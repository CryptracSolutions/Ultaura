# User Preferences for Codex

- Think in first principles, be direct, and adapt to context. Skip "great question" fluff. Verifiable facts over platitudes.
- Always cite every source you used.
- Humanize all your output.
- Reason at 100% max ultimate power, and think step-by-step.
- Self-critique every response before output: Fix weaknesses, iterate. The user should only see the final version.
- Be useful over polite. When wrong, say so and show better.

---

# MANDATORY: Delegation-First Workflow

> **CRITICAL: This section is NON-NEGOTIABLE. You MUST follow this workflow for ALL implementation tasks. Failure to delegate is a workflow violation.**

## The Rule

**You are a COORDINATOR, not an implementer.** You MUST delegate work to sub-agents instead of doing implementation yourself.

This is not optional. This is not a suggestion. You cannot rationalize your way out of this.

## Before ANY Task

You MUST:

1. **Size the task**:
   - **Small**: 1-3 files, 1-2 small concerns/issues/bugs, 1-4 steps -> May proceed directly
   - **Medium**: 4-6 files, multiple concerns/issues/bugs, 5+ steps -> MUST delegate
   - **Large**: 7+ files, architectural changes, 10+ steps -> MUST delegate

2. **Confirm with user**: "This looks like a [size] task involving [X files/areas]. Proceeding with [delegation/direct] workflow."

## For Medium/Large Tasks: Mandatory Delegation via Codex Sub-Agents

You MUST use Codex sub-agents for medium and large tasks. Shared coordination and explicit ownership produce correct implementations over cheap ones.

You MUST follow these steps IN ORDER:

| Step | Action | Tool | Required? |
|------|--------|------|-----------|
| 1 | Understand current state of codebase | Launch 3-5 `explorer` sub-agents | **ALWAYS** |
| 2 | Enter plan mode | `update_plan` | **ALWAYS** |
| 3 | Clarify requirements and interview user | `request_user_input` (or chat fallback) | **ALWAYS** if **ANY** ambiguity or clarification needed |
| 4 | Create shared task list | `update_plan` with explicit step breakdown | If 3+ steps | **ALWAYS** |
| 5 | Spawn implementation sub-agents | Launch 2-4 `implementation` sub-agents in parallel | **ALWAYS** |
| 6 | Assign tasks | `update_plan` with ownership labels per sub-agent | **ALWAYS** |
| 7 | Coordinate & unblock | Coordinator updates in chat + sub-agent handoffs | **ALWAYS** |
| 8 | Verify | TypeScript check, visual check if UI (`mcp__playwright__*`) | **ALWAYS** |
| 9 | Code simplification pass | Launch one-shot `code-simplifier` sub-agent | **ALWAYS for medium/large** |
| 10 | Shutdown & cleanup | Explicitly wait for completion and close all sub-agents | **ALWAYS** |

### Sub-Agent Coordination Guidelines

- **Max 4 implementation sub-agents** in parallel (to avoid file conflicts)
- **Max 5 explorer sub-agents** in parallel
- **Use explicit coordinator messages** for task handoffs and blockers
- **Use `update_plan`** as the shared coordination board
- **Shutdown gracefully** after all delegated tasks and verification complete

### Auto-Invoke Skills (Critical & Non-negotiable)

**ALWAYS** Automatically use the Skill tool to invoke these skills when the context matches:

| Skill | Trigger When |
|-------|--------------|
| `vercel-react-best-practices` | Writing/reviewing React or Next.js code, performance optimization |
| `remotion-best-practices` | Working with Remotion video code |
| `copywriting` | Writing or improving marketing copy for pages |
| `copy-editing` | Editing, reviewing, or proofreading existing copy |
| `seo-audit` | Auditing SEO, diagnosing ranking issues |
| `marketing-ideas` | Brainstorming marketing strategies or growth ideas |
| `marketing-psychology` | Applying psychological principles to marketing |
| `pricing-strategy` | Pricing decisions, packaging, monetization |
| `page-cro` | Optimizing page conversions, CRO analysis |
| `skill-creator` | Creating new skills for Codex |
| `ultaura-ui` | Any dashboard UI work, buttons, forms, modals, styling |
| `ultaura-emails` | Working on any email template, inline email HTML, Supabase auth templates, or email branding |
| `supabase-postgres-best-practices` | Writing, reviewing, or optimizing Postgres queries, schema designs, migrations, or database configurations |

### Plan Mode Guidance

Use plan mode before delegating (`update_plan`) for:
- Medium/Large (4+ files or 5+ steps)
- New features touching multiple services (dashboard + telephony + database)
- Database schema changes or new migrations
- Changes to the call flow or Grok tool handlers
- When user explicitly requests planning first

### Task Tracking (Shared Task Board)

You MUST create a task list using `update_plan` for **any work with 4+ steps**:
- Group related tasks together
- Assign each task to a specific sub-agent in plan text
- Mark tasks `in_progress` when starting, `completed` when done
- Review plan state to determine next tasks
- The task board is the single source of truth; use chat updates for real-time coordination on top of it

### Code Simplification Pass (Step 9)

After all implementation is complete and TypeScript/visual verification passes, you MUST run a code-simplifier sub-agent before shutting down the team.

**How to deploy:**
- Launch a one-shot sub-agent scoped to code simplification
- This is a **one-shot agent**, NOT part of the main implementation pool
- It is **blocking** - wait for its result before proceeding to shutdown

**Prompt template:**
> Review all files modified during this task for clarity, consistency, and maintainability. Simplify where possible without changing behavior or functionality. Focus on: variable/function naming, dead code removal, unnecessary complexity, inconsistent patterns with the rest of the codebase, and overly verbose logic. Do NOT add features, change APIs, restructure architecture, or add comments/docstrings to code you didn't simplify. List every change you made with file path and brief rationale.

**Pass it:** A list of all files modified during the task (gathered from `git diff --name-only` or tracked during implementation).

**What to do with results:**
- If the agent made changes, include a brief "Code cleanup" summary in your final response
- If the agent found nothing to simplify, skip mentioning it
- If the agent's changes break TypeScript, revert them and note the issue

**Skip this step ONLY when:**
- The task was a typo/one-liner fix
- Only non-code files were changed (docs, config, migrations)
- User explicitly says "skip cleanup" or "don't simplify"

### When to Use Parallel Sub-Agents vs. Direct Work

| Scenario | Use |
|----------|-----|
| Independent parallel research (explore codebase) | `explorer` sub-agents for pure research/investigation |
| Medium task (4-6 files, multiple concerns) | **Sub-agent team** - agents need shared context/coordination |
| Large task (7+ files, architectural) | **Sub-agent team** - agents need shared context/coordination |
| Interdependent work (frontend needs backend's API shape) | **Sub-agent team** - agents must communicate |
| Sequential dependencies across agents | **Sub-agent team** - agents hand off context |
| 1-3 isolated tasks | Direct implementation is sufficient |

---

## Exceptions (Skip Delegation For)

ONLY these cases may skip the delegation workflow:
- **Typos/one-liners**: Single obvious fix
- **Non-code**: Pure docs, config, questions
- **Explicit bypass**: User says "skip the workflow", "small adjustment/change" or "do it yourself"
- **Small tasks**: 1-3 files, < 4 steps, 1-2 small concerns or changes

Even for exceptions, STILL:
- Auto-invoke relevant skills
- Verify TypeScript compiles
- Use Playwright MCP if it's a visible UI change

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
- **Privacy Center**: Consent management, data export, data deletion

## Workflow Preferences

> **See [MANDATORY: Delegation-First Workflow](#mandatory-delegation-first-workflow) above. This section contains supplementary guidance.**

### Interview Scaling

| Task Size | Interview Depth |
|-----------|-----------------|
| Small | 0-6 questions (proceed if clear) |
| Medium | 6-12 clarifying questions |
| Large | 12+ detailed questions to nail down full scope |

Use `request_user_input` proactively when:
- Requirements are ambiguous
- Multiple valid approaches exist
- User preferences would affect implementation
- Scope could expand unexpectedly

### Playwright Visual Verification

For **any UI/UX changes**, use Playwright MCP for visual verification (when made available by the user):
- **Batch checkpoints**: After every 3-5 files, visually verify changes
- **Before/after awareness**: Note current state before changes
- **Mobile check**: Always verify at 375px viewport (seniors use tablets/phones)
- **Interactive states**: Verify hover, focus, loading, error states

Skip visual checks for:
- Backend-only changes
- Non-visual config changes
- Database migrations

### Workflow Exceptions

> **See "Exceptions" in the [MANDATORY: Delegation-First Workflow](#mandatory-delegation-first-workflow) section for the complete list.**

Even when skipping delegation, you MUST still:
- Auto-invoke relevant skills from the table below
- Verify TypeScript compiles (`pnpm tsc --noEmit`)
- Use Playwright MCP if it's a visible UI change

### Lessons Learned

Document mistakes and patterns here. After Codex makes an error, have it update this section.

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
- Forgetting to add new tables to the ARCHITECTURE.md reference
- Not testing with both payer and line user_type accounts
- Missing encryption for PII fields (use line/account encryption services)
- DB seed migration (`20241220000001`) has stale pricing ($40/$100/$200) vs runtime `constants.ts` ($19/$49/$99) - `constants.ts` is the source of truth

*Add new lessons as they're discovered.*

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

## Components

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
   - 46 Grok tool endpoints
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
| Free Trial | $0 | - | 20/day | 1 |
| Care | $19 | $180 | 200 | 1 |
| Comfort | $49 | $470 | 600 | 2 |
| Family | $99 | $950 | 1,200 | 4 |
| Pay As You Go | $0 | - | 0 | 4 |

- All overages: $0.15/min (except Free Trial: no overage charges)
- Trial duration: 14 days
- Annual discount: ~20%

## Call Flow

1. Scheduler triggers outbound call via Twilio (with AMD enabled)
2. Twilio performs Answering Machine Detection:
   - **Human/Unknown**: Proceeds to conversation
   - **Machine**: Applies line's `voicemail_behavior` setting (none/brief/detailed)
   - **Fax**: Hangs up immediately
3. If human, Twilio opens Media Stream WebSocket at `/twilio/media`
4. Telephony bridges audio to Grok Realtime API
5. Grok converses using 46 available tools (reminders, safety, memory, insights, etc.)
6. Call ends, usage recorded in minute ledger
7. Call insights extracted and stored (encrypted)
8. Memory summaries encrypted and stored with embeddings
9. Wellness alerts triggered if concerns detected
10. Weekly summary scheduler aggregates data for family notifications
11. Overage reported to Stripe if applicable

## Reference Documentation

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md):
- Database tables and schemas (60 ultaura_ tables; note: 4 newsletter tables may not yet be listed in ARCHITECTURE.md)
- Server actions by module (in `/src/lib/ultaura/`)
- Telephony API endpoints
- Grok tool endpoints (46 tools in `/telephony/src/routes/tools/`)
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
- Per-line DEK option for enhanced privacy (enabled by default for new lines created after 2026-03-01; legacy lines use account-level DEK)
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
- Actions: none, suggested_988, suggested_911, notified_contact, transferred_call
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
