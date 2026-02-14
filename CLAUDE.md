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
   - **Small**: 1-3 files, 1-2 small concerns/issues/bugs, 1-4 steps → May proceed directly
   - **Medium**: 4-6 files, multiple concerns/issues/bugs, 5+ steps → MUST delegate
   - **Large**: 7+ files, architectural changes, 10+ steps → MUST delegate

2. **Confirm with user**: "This looks like a [size] task involving [X files/areas]. Proceeding with [delegation/direct] workflow."

## For Medium/Large Tasks: Mandatory Delegation via Agent Teams

You MUST use the **Agent Teams** feature with all agents as **model: "opus"** (`Teammate` tool) for medium and large tasks. Teams give agents shared task boards, inter-agent messaging, and persistent context — producing correct implementations over cheap ones.

You MUST follow these steps IN ORDER:

| Step | Action | Tool | Required? |
|------|--------|------|-----------|
| 1 | Understand current state of codebase | Launch 1-6 `Explore` agents | **ALWAYS** |
| 2 | Enter plan mode | `EnterPlanMode` | **ALWAYS**
| 2 | Clarify requirements and interview user | `AskUserQuestion` | **ALWAYS** if **ANY** ambiguity or clarifications needed |
| 3 | Create shared task list | `TaskCreate` for each step | If 3+ steps | **ALWAYS** |
| 4 | Spawn a team of implementation teammates | Launch 1-4 `Task` teammates using `Teammate` with `spawnTeam` | **ALWAYS** |
| 5 | Assign tasks | `TaskUpdate` with `owner` to assign work | **ALWAYS** |
| 6 | Coordinate & unblock | `SendMessage` to guide teammates, resolve blockers | **ALWAYS** |
| 7 | Verify | TypeScript check, visual check if UI | **ALWAYS** |
| 8 | Code simplification pass | `Task` with `subagent_type: "code-simplifier:code-simplifier"` | **ALWAYS for medium/large** |
| 9 | Shutdown & cleanup | `SendMessage` shutdown requests, then `Teammate` cleanup | **ALWAYS** |

### Agent Teams Guidelines

- **Always use `model: "opus"`** for ALL agent types
- **Max 4 implementation/task teammates** in parallel (to avoid file conflicts)
- **Max 6 explore agents** in parallel
- **Use `SendMessage`** to coordinate — teammates can't hear your plain text
- **Teammates persist** — reassign them to new tasks instead of spawning new agents
- **Teammates go idle after each turn** — this is normal, send a message to wake them
- **Use `TaskList`/`TaskUpdate`** as the shared coordination board
- **Shutdown gracefully** — send `shutdown_request` to each teammate when done, then call `Teammate` cleanup

### Task Tracking (Shared Task Board)

You MUST create a task list using `TaskCreate` for **any work with 4+ steps**:
- Group related tasks together
- Use `TaskUpdate` with `owner` to assign tasks to specific teammates
- Use `TaskUpdate` to mark tasks `in_progress` when starting, `completed` when done
- Use `TaskList` to check progress and find next tasks
- Teammates can claim and update their own tasks
- The task board is the single source of truth — use `SendMessage` for real-time coordination on top of it

### Code Simplification Pass (Step 8)

After all implementation is complete and TypeScript/visual verification passes, you MUST run a code-simplifier agent before shutting down the team.

**How to deploy:**
- Use the `Task` tool with `subagent_type: "code-simplifier:code-simplifier"` and `model: "opus"`
- This is a **one-shot agent**, NOT a teammate — it runs independently after the team finishes
- It is **blocking** — wait for its result before proceeding to shutdown

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

### When to Use Teams vs. One-Shot Task Agents

| Scenario | Use |
|----------|-----|
| Independent parallel research (explore codebase) | `Explore` for pure research/investigation |
| Medium task (4-6 files, multiple concerns) | **Teams** — agents need shared context/coordination |
| Large task (7+ files, architectural) | **Teams** — agents need shared context/coordination |
| Interdependent work (frontend needs backend's API shape) | **Teams** — agents must communicate |
| Sequential dependencies across agents | **Teams** — agents hand off context |
| 1-3 isolated tasks | `Task` agent (one-shot) is sufficient |

## Exceptions (Skip Delegation For)

ONLY these cases may skip the delegation workflow:
- **Typos/one-liners**: Single obvious fix"
- **Non-code**: Pure docs, config, questions
- **Explicit bypass**: User says "skip the workflow", "small adjustment/change" or "do it yourself"
- **Small tasks**: 1-3 files, < 4 steps, 1-2 small concerns or changes

Even for exceptions, STILL:
- Auto-invoke relevant skills
- Verify TypeScript compiles
- Use Chrome MCP if it's a visible UI change

---

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
| `skill-creator` | Creating new skills for Claude Code or Codex |
| `ultaura-ui` | Any dashboard UI work, buttons, forms, modals, styling |
| `ultaura-emails` | Working on any email template, inline email HTML, Supabase auth templates, or email branding |
| `supabase-postgres-best-practices` | Writing, reviewing, or optimizing Postgres queries, schema designs, migrations, or database configurations |

---

### Plan Mode Guidance

**When to enter plan mode** (`/plan` or `EnterPlanMode`):
- Medium/Large tasks (4+ files or 5+ steps)
- New features touching multiple services (dashboard + telephony + database)
- Database schema changes or new migrations
- Changes to the call flow or Grok tool handlers
- When user explicitly requests planning first

**Plan mode is NOT a formality — it is a deep-work phase.** A plan that just lists file names and vague steps is a BAD plan. Every plan must be detailed enough that a fresh agent with zero prior context can execute it without asking a single clarifying question.

#### Phase 1: Research (Before Writing the Plan)

1. **Explore the codebase** — Launch Explore agents to understand every area that will be touched. Read the actual files, not just file names. Understand current patterns, types, imports, and data flow.
2. **Interview the user until ambiguity reaches zero** — Use `AskUserQuestion` aggressively. Do NOT assume intent. Do NOT guess between two valid approaches. Ask. Interview scaling:
   - Medium tasks: 6-12 clarifying questions minimum
   - Large tasks: 12+ questions to nail down full scope
   - Keep asking follow-ups until you have concrete answers for every decision point
3. **Identify every decision point** — Before writing a single line of the plan, list every fork in the road: naming conventions, UI placement, data model choices, error handling strategy, migration approach, API shape, etc. Each one must be resolved (either by codebase convention or by asking the user).

#### Phase 2: Writing the Plan — **MUST use `model: "opus"`**

The plan document MUST include ALL of the following sections. Missing sections = incomplete plan.

| Section | What It Must Contain |
|---------|---------------------|
| **Goal** | 1-2 sentence summary of what we're building/changing and WHY |
| **Current State** | How the system works today in the areas we're touching. Reference specific files, functions, types, and line numbers discovered during research. |
| **Requirements** | Bullet list of every requirement — functional, non-functional, edge cases, and user-confirmed decisions from the interview. Number them (R1, R2, ...) so tasks can reference them. |
| **Affected Files** | Every file that will be created, modified, or deleted, with a 1-line description of what changes. Group by area (dashboard, telephony, database, packages). |
| **Database Changes** | If applicable: exact table/column names, types, defaults, constraints, RLS policies, and migration file name. Include the SQL or describe it precisely enough to write it. |
| **Implementation Tasks** | Ordered, numbered task list. Each task must specify: (1) what to do, (2) which files to touch, (3) which requirements it satisfies (R1, R2...), (4) dependencies on other tasks, (5) acceptance criteria — how to verify it worked. |
| **Type & API Contracts** | Any new or modified TypeScript types, Zod schemas, API request/response shapes, or function signatures. Write them out explicitly — don't say "add a type for X", show the type. |
| **Edge Cases & Error Handling** | How errors, empty states, permission failures, race conditions, and unexpected input are handled. |
| **Testing & Verification** | How to verify the implementation is correct: TypeScript compilation, specific UI states to check, API calls to test, migration verification steps. |
| **Out of Scope** | Explicitly list what this plan does NOT cover, to prevent scope creep during implementation. |

#### Phase 3: Plan Review

Before exiting plan mode:
- Re-read the plan as if you are a fresh agent seeing it for the first time. Would you know exactly what to do? If not, add more detail.
- Verify every file listed in "Affected Files" actually exists (or is explicitly marked as new).
- Verify task dependencies form a valid DAG — no circular dependencies, correct ordering.
- Confirm no requirements from the interview are missing from the tasks.

#### What Makes a BAD Plan (Do Not Do These)

- Vague task descriptions: "Update the dashboard" — update WHAT? HOW?
- Missing file paths: "Add a new component" — WHERE? What's it called?
- Assumed decisions: "We'll use a modal" — did the user confirm that?
- No acceptance criteria: "Implement the feature" — how do we know it's done?
- Skipping the interview: Jumping straight to writing the plan without asking questions
- Listing files without explaining changes: "Modify `schedule-service.ts`" — to do WHAT?

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

> **See [MANDATORY: Delegation-First Workflow](#️-mandatory-delegation-first-workflow) above. This section contains supplementary guidance.**

### Interview Scaling

| Task Size | Interview Depth |
|-----------|-----------------|
| Small | 0-6 questions (proceed if clear) |
| Medium | 6-12 clarifying questions |
| Large | 12+ detailed questions to nail down full scope |

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

### Workflow Exceptions

> **See "Exceptions" in the [MANDATORY: Delegation-First Workflow]**

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
- Forgetting to add new tables to the ARCHITECTURE.md reference
- Not testing with both payer and line user_type accounts
- Missing encryption for PII fields (use line/account encryption services)
- Legacy migration `20241220000001` contains stale plan data (including Family `2200` minutes). Never copy pricing/allowance values from old migrations; use `src/lib/ultaura/constants.ts` and alignment migration `20260327000011` as source of truth.

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
