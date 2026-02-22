# User Preferences for Claude

- **The user is not a developer and has minimal experience, so all responses from the agent should attempt to simplify and explain all things in a way that is easy for the user to understand**
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

You MUST use the **Agent Teams** feature (`Teammate` tool) for medium and large tasks. Teams give agents shared task boards, inter-agent messaging, and persistent context — producing correct implementations over cheap ones.

**Model assignments** (non-negotiable):
| Role | Model |
|------|-------|
| Orchestrator (you) | Opus 4.6 — set via `/model Opus 4.6` |
| Explore agents | Opus 4.6 |
| Plan agent | Opus 4.6 |
| Implementation teammates | Sonnet 4.6 |
| Code simplifier | Sonnet 4.6 |

**Every time you deploy an agent, you MUST state the model being used in your visible output to the user.** This applies to ALL agent types — Explore, Plan, Implementation teammates, Code simplifier, and any one-shot Task agents.

**Silently deploying agents without stating the model is a workflow violation.**

**Format:** When launching agents, announce them like this:

> Launching **[agent role/name]** on **[model]** — [brief purpose]

**Example formats:**
- "Launching **Explore agent** on **Opus 4.6** — investigating database schema and RLS policies"
- "Launching **Implementation teammate `frontend-1`** on **Sonnet 4.6** — building the schedule form component"
- "Launching **Plan agent** on **Opus 4.6** — drafting implementation plan"
- "Launching **code-simplifier** on **Sonnet 4.6** — reviewing modified files for cleanup"

**For batch launches**, list each agent individually.

You MUST follow these steps IN ORDER:

| Step | Action | Tool | Required? |
|------|--------|------|-----------|
| 1 | Explore codebase | Launch up to 6 `Explore` agents | **ALWAYS** |
| 2 | Plan & interview | `EnterPlanMode`, then `AskUserQuestion` to clarify (see Plan Mode Guidance) | **ALWAYS** |
| 3 | Create shared task list | `TaskCreate` for each step | **ALWAYS** if 3+ steps |
| 4 | Spawn implementation teammates | Launch up to 6 `Task` teammates. Use `isolation: "worktree"` for independent tasks (see Worktree Isolation) | **ALWAYS** |
| 5 | Assign tasks | `TaskUpdate` with `owner` | **ALWAYS** |
| 6 | Coordinate & unblock | `SendMessage` to guide teammates, resolve blockers | As needed |
| 7 | Merge worktree branches | `git merge <branch> --no-edit` per worktree agent (see Merge-back process) | If worktrees used |
| 8 | Verify | `pnpm tsc --noEmit`, visual check if UI via Chrome MCP | **ALWAYS** |
| 9 | Code simplification | `Task` with `subagent_type: "code-simplifier:code-simplifier"` | **ALWAYS for medium/large** |
| 10 | Shutdown & cleanup | `SendMessage` shutdown requests to each teammate | **ALWAYS** |

### Plan Mode Guidance (Step 2)

**Plan mode is NOT a formality — it is a deep-work phase.** A plan that just lists file names and vague steps is a BAD plan. Every plan must be detailed enough that a fresh agent with zero prior context can execute it without asking a single clarifying question.

#### Phase 1: Research (Before Writing the Plan)

1. **Explore the codebase** — Launch Explore agents to understand every area that will be touched. Read the actual files, not just file names. Understand current patterns, types, imports, and data flow.
2. **Interview the user until ambiguity reaches zero** — Use `AskUserQuestion` aggressively. Do NOT assume intent. Do NOT guess between two valid approaches. Ask. Interview scaling:
   - Small tasks: 0-6 questions (proceed if clear)
   - Medium tasks: 6-12 clarifying questions minimum
   - Large tasks: 12+ questions to nail down full scope
   - Keep asking follow-ups until you have concrete answers for every decision point
   - Ask proactively when: requirements are ambiguous, multiple valid approaches exist, user preferences would affect implementation, or scope could expand unexpectedly
3. **Identify every decision point** — Before writing a single line of the plan, list every fork in the road: naming conventions, UI placement, data model choices, error handling strategy, migration approach, API shape, etc. Each one must be resolved (either by codebase convention or by asking the user).

#### Phase 2: Writing the Plan — **MUST use `Plan` agent with `model: "Opus 4.6"`**

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

### Agent Teams Guidelines

- **Max 6 implementation teammates** in parallel (resource limit — worktrees remove file-conflict risk but 6 remains the cap)
- **Max 6 explore agents** in parallel
- **Use `SendMessage`** to coordinate — teammates can't hear your plain text
- **Teammates persist** — reassign them to new tasks instead of spawning new agents
- **Teammates go idle after each turn** — this is normal, send a message to wake them
- **Use `TaskList`/`TaskUpdate`** as the shared coordination board

### Worktree Isolation for Teammates

Use git worktrees to give implementation teammates their own isolated copy of the repo. This **eliminates file conflicts** when agents work in parallel — each agent edits its own copy, then changes are merged back.

**How it works:**
- The `Task` tool has a built-in `isolation: "worktree"` parameter
- When set, the agent gets a temporary git worktree (a full copy of the repo on a new branch)
- Everything stays **local** — nothing is pushed to GitHub unless you explicitly run `git push`
- If the agent makes no changes, the worktree is automatically cleaned up
- If the agent makes changes, the worktree path and branch name are returned so you can merge them

**When to use worktree isolation:**

| Scenario | Use `isolation: "worktree"`? |
|----------|------------------------------|
| Agents working on **separate files/features** (e.g., one builds a component, another writes an API route) | **Yes** — clean isolation, no conflicts |
| Agent doing a **standalone task** (new component, new migration, new service) | **Yes** — safe sandbox |
| Agents that **depend on each other's real-time output** (e.g., frontend needs backend's types as they're written) | **No** — they can't see each other's changes until merge |
| Multiple agents editing the **same files** | **No** — merge conflicts likely; coordinate via shared directory instead |

**Merge-back process (Step 7):**

When a worktree agent finishes, the `Task` tool returns the **branch name** and **worktree path**. If the agent made no changes, the worktree is auto-cleaned — skip it.

For each agent that made changes:

1. **Merge foundational branches first** (types, schemas, shared packages) before branches that depend on them.
2. **Run the merge:**
   ```bash
   git merge <agent-branch-name> --no-edit
   ```
3. **If merge conflict** (rare when worktrees are used correctly):
   - Read conflicting files to understand both sides
   - Combine changes intelligently (keep both agents' work)
   - `git add <resolved-file>` then `git commit --no-edit`
4. **After ALL branches merged**, delete them:
   ```bash
   git branch -d <agent-branch-name>
   ```
5. **Proceed to Step 8 (Verify)** — TypeScript check happens there, not here.

**Default behavior:**
- **Independent tasks** (no file overlap) → launch with `isolation: "worktree"`
- **Interdependent tasks** (shared files or real-time dependencies) → shared working directory with `SendMessage` coordination
- **When unsure** → prefer worktree isolation — merging is safer than untangling file conflicts

### Task Tracking (Shared Task Board)

You MUST create a task list using `TaskCreate` for **any work with 3+ steps**:
- Group related tasks together
- Use `TaskUpdate` with `owner` to assign tasks to specific teammates
- Use `TaskUpdate` to mark tasks `in_progress` when starting, `completed` when done
- Use `TaskList` to check progress and find next tasks
- Teammates can claim and update their own tasks
- The task board is the single source of truth — use `SendMessage` for real-time coordination on top of it

### Code Simplification Pass (Step 9)

After all implementation is complete and TypeScript/visual verification passes, you MUST run a code-simplifier agent before shutting down the team.

**How to deploy:**
- Use the `Task` tool with `subagent_type: "code-simplifier:code-simplifier"` and `model: "sonnet"`
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

### When to Use Teams vs. One-Shot Agents vs. Worktree Isolation

| Scenario | Approach |
|----------|----------|
| Pure research / codebase exploration | `Explore` agent (one-shot, no team needed) |
| 1-3 isolated, independent tasks | `Task` agent (one-shot) with `isolation: "worktree"` |
| Medium/Large tasks (4+ files) | **Teams** — shared task board + coordination |
| Team tasks on **separate files** | **Teams + worktree** — `isolation: "worktree"` per teammate |
| Team tasks on **shared files** or real-time dependencies | **Teams, shared directory** — no worktree, coordinate via `SendMessage` |
| Sequential dependencies (A must finish before B starts) | **Teams, shared directory** — agents hand off context |

## Exceptions (Skip Delegation For)

ONLY these cases may skip the delegation workflow:
- **Typos/one-liners**: Single obvious fix
- **Non-code**: Pure docs, config, questions
- **Explicit bypass**: User says "skip the workflow", "small adjustment/change" or "do it yourself"
- **Small tasks**: 1-3 files, < 4 steps, 1-2 small concerns or changes

Even for exceptions, STILL:
- Auto-invoke relevant skills
- Verify TypeScript compiles
- Use Chrome MCP (when available) if it's a visible UI change

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

#### Telephony Grok Voice Agent Test Guardrails
- Scope: This suite validates in-call telephony behavior for the Grok Voice Agent using simulated calls (no live Grok API and no real phone/audio calls).
- Run before push for telephony work:
  - `pnpm --filter @ultaura/telephony typecheck`
  - `pnpm --filter @ultaura/telephony test:tool-coverage`
  - `pnpm --filter @ultaura/telephony test`
- Also run websocket simulators when changing call flow, timers, overage prompts, teardown, or bridge routing:
  - `pnpm --filter @ultaura/telephony test -- src/websocket/__tests__/media-stream-simulator.test.ts src/websocket/__tests__/call-scenario-simulator.test.ts`
- `test:tool-coverage` enforces:
  - canonical-tool matrix parity with `GROK_TOOLS` in `/packages/prompts/src/tools/definitions.ts`
  - success-path and failure-path evidence per canonical tool
  - exact `getPostHandler(router, '/path')` extraction for multi-route routers
- Out of scope for this suite:
  - dashboard/UI behavior
  - live provider integration behavior
  - Twilio audio-quality/media fidelity checks

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
- Internal maintenance scheduler also checks Next.js internal endpoints hourly, including `/api/internal/crypto-health` (task key: `crypto_health`).
- Alerting reference for crypto health checks:
  - Metric: `ultaura_onboarding_maintenance_runs_total{task="crypto_health",result="failure"}`
  - Repeated-failure log event: `crypto_health_consecutive_failures`

### KEK Rotation Runbook (ULTAURA_ENCRYPTION_KEY)

1. Generate a new 64-hex key and set it as `ULTAURA_ENCRYPTION_KEY` in both Next.js and telephony.
2. Move the prior key to `ULTAURA_ENCRYPTION_KEY_PREVIOUS` in both services.
3. Restart/deploy services so both env vars are active everywhere.
4. Verify decrypt health with:
   - `GET /api/internal/crypto-health` (authorized with `x-webhook-secret`)
   - Expect `200` `{ ok: true }` for the configured account check.
5. Monitor for at least one maintenance window:
   - `ultaura_onboarding_maintenance_runs_total{task="crypto_health",result="failure"}`
   - Log event `crypto_health_consecutive_failures` should remain absent.
6. If healthy, remove `ULTAURA_ENCRYPTION_KEY_PREVIOUS` in both services and redeploy.

Rollback:
1. Restore the prior key as `ULTAURA_ENCRYPTION_KEY`.
2. Put the attempted new key in `ULTAURA_ENCRYPTION_KEY_PREVIOUS`.
3. Redeploy and verify `/api/internal/crypto-health` returns `200`.

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
