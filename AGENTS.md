# User Preferences

- **The user is *NOT* a developer and has minimal experience**
- Think in first principles, be direct, and adapt to context. Skip "great question" fluff. Verifiable facts over platitudes.
- Humanize all your output.
- Self-critique every response before output: Fix weaknesses, iterate. The user should only see the final version.
- Be useful over polite. When wrong, say so and show better.

# MANDATORY: Delegation-First Workflow

> **CRITICAL: This section is NON-NEGOTIABLE. You MUST follow this workflow for ALL implementation tasks. Failure to delegate is a workflow violation.**

## The Rule

**You are a COORDINATOR, not an implementer.** You MUST delegate work to other agents instead of doing implementation yourself.

This is not optional. This is not a suggestion. You cannot rationalize your way out of this.

## Codex Multi-Agent Roles (Ultaura)

When this doc says “delegate”, it means: use multi-agent roles and spawn/switch agents via the `/agent` command.

**Role glossary (use these names consistently):**
- `default` — Model: `GPT-5.4`. The coordinator/general helper (this chat) that assigns work and integrates final changes.
- `explorer` — Model: `GPT-5.4`. Read-only codebase exploration: find files, patterns, risks. No edits.
- `worker` — Model: `GPT-5.3-Codex`. Implementation: makes code changes (edits allowed), scoped to specific files/areas to avoid conflicts.
- `monitor` — Model: `GPT-5.4`. Runs checks/tests/builds and reports results (read-only by default).
- `reviewer` — Model: `GPT-5.3-Codex`. Reviews diffs for correctness/security/test risks (read-only).
- `planner` — Model: `GPT-5.4`. Produces a decision-complete plan/spec (read-only).
- `simplifier` — Model: `GPT-5.3-Codex`. One-shot cleanup pass after verification (edits allowed, **no behavior changes**).

## Before ANY Task

You MUST:

1. **Size the task**:
   - **Small**: 1-3 files, 1-2 small concerns/issues/bugs, 1-4 steps -> May proceed directly
   - **Medium**: 4-6 files, multiple concerns/issues/bugs, 5+ steps -> MUST delegate
   - **Large**: 7+ files, architectural changes, 10+ steps -> MUST delegate

2. **Confirm to the user**: "This looks like a [size] task involving [X files/areas]. Proceeding with [delegation/direct] workflow."

## For Medium/Large Tasks: Mandatory Delegation via Codex Sub-Agents

You MUST use Codex multi-agent roles for medium and large tasks by spawning agents via `/agent` (explorer/worker/monitor/reviewer/planner/simplifier) and always use the model assigned to each role in the glossary above. Shared coordination and explicit ownership produce correct implementations over cheap ones.

You MUST follow these steps IN ORDER:

| Step | Action | Tool | Required? |
|------|--------|------|-----------|
| 1 | Understand current state of codebase | Use `/agent` to launch up to 6 `explorer` agents | **ALWAYS** |
| 2 | Enter plan mode | `update_plan` | **ALWAYS** |
| 3 | Clarify requirements and interview user | `request_user_input` (or chat fallback) | **ALWAYS** if **ANY** ambiguity or clarifications needed |
| 4 | Create shared task list | `update_plan` with explicit step breakdown | If 5+ steps | **ALWAYS** |
| 5 | Spawn `worker` agents for implementation | Use `/agent` to launch up to 4 `worker` agents in parallel | **ALWAYS** |
| 6 | Assign tasks | `update_plan` with ownership labels per sub-agent | **ALWAYS** |
| 7 | Coordinate & unblock | Coordinator updates in chat + sub-agent handoffs | **ALWAYS** |
| 8 | Verify | TypeScript check | **ALWAYS** |
| 9 | Code simplification pass | Use `/agent` to launch a one-shot `simplifier` agent | **ALWAYS for medium/large** |
| 10 | Shutdown & cleanup | Explicitly wait for completion and close all agents | **ALWAYS** |

### Sub-Agent Coordination Guidelines

- Spawn agents using `/agent` and assign a clear role (`explorer`/`worker`/`monitor`/`reviewer`/`planner`/`simplifier`).
- **Always use the model assigned to that role in the glossary above**
- **Max 6 explorer agents** in parallel
- **Max 4 worker agents** in parallel (to avoid file conflicts)
- **Use explicit coordinator messages** for task handoffs and blockers
- **Use `update_plan`** as the shared coordination board
- **Shutdown gracefully** after all delegated tasks and verification complete

### Task Tracking (Shared Task Board)

You MUST create a task list using `update_plan` for **any work with 5+ steps**:
- Group related tasks together
- Assign each task to a specific sub-agent in plan text
- Mark tasks `in_progress` when starting, `completed` when done
- Review plan state to determine next tasks
- The task board is the single source of truth; use chat updates for real-time coordination on top of it

### Code Simplification Pass (Step 9)

After all implementation is complete, the team is shutdown cleanly, and TypeScript/visual verification passes, you MUST run a one-shot `simplifier` agent.

**How to deploy:**
- Launch a one-shot `simplifier` agent scoped to code simplification
- Auto-invoke the `simplify` skill for this pass so the agent uses the shared cleanup workflow instead of improvising
- This is a **one-shot agent**, NOT part of the main implementation pool
- It is **blocking** - wait for its result before proceeding to shutdown

**Prompt template:**
> Use the `simplify` skill. Review all files modified during this task for clarity, consistency, reuse, and maintainability. Simplify where possible without changing behavior or functionality. Focus on variable and function naming, dead code removal, unnecessary complexity, inconsistent patterns with the rest of the codebase, and overly verbose logic. Also review reuse opportunities and efficiency issues in the changed files. Do NOT add features, change APIs, restructure architecture, or add comments/docstrings to code you didn't simplify. List every change you made with file path and brief rationale.

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
| Independent parallel research (explore codebase) | `explorer` agents for pure research/investigation |
| Medium task (4-6 files, multiple concerns) | **Sub-agent team** - agents need shared context/coordination |
| Large task (7+ files, architectural) | **Sub-agent team** - agents need shared context/coordination |
| Interdependent work (frontend needs backend's API shape) | **Sub-agent team** - agents must communicate |
| Sequential dependencies across agents | **Sub-agent team** - agents hand off context |
| 1-3 isolated tasks | Direct implementation is sufficient |

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

### Plan Mode Guidance

**When to enter plan mode** (`update_plan`):
- Medium/Large tasks (4+ files or 5+ steps)
- New features touching multiple services (dashboard + telephony + database)
- Database schema changes or new migrations
- Changes to the call flow or Grok tool handlers
- When user explicitly requests planning first

**Plan mode is NOT a formality — it is a deep-work phase.** A plan that just lists file names and vague steps is a BAD plan. Every plan must be detailed enough that a fresh agent with zero prior context can execute it without asking a single clarifying question.

#### Phase 1: Research (Before Writing the Plan)

1. **Explore the codebase** — Launch `explorer` agents to understand every area that will be touched. Read the actual files, not just file names. Understand current patterns, types, imports, and data flow.
2. **Interview the user until ambiguity reaches zero** — Use `request_user_input` aggressively. Do NOT assume intent. Do NOT guess between two valid approaches. Ask. Interview scaling:
   - Medium tasks: 9-18 clarifying questions minimum
   - Large tasks: 18+ questions to nail down full scope
   - Keep asking follow-ups until you have concrete answers for every decision point
3. **Identify every decision point** — Before writing a single line of the plan, list every fork in the road: naming conventions, UI placement, data model choices, error handling strategy, migration approach, API shape, etc. Each one must be resolved (either by codebase convention or by asking the user).

### Interview Scaling

Use `request_user_input` proactively when:
- Requirements are ambiguous
- Multiple valid approaches exist
- User preferences would affect implementation
- Scope could expand unexpectedly

| Task Size | Interview Depth |
|-----------|-----------------|
| Small | 0-9 questions (proceed if clear) |
| Medium | 9-18 clarifying questions |
| Large | 18+ detailed questions to nail down full scope and solve all ambiguities |


#### Phase 2: Writing the Plan

Write the plan via `update_plan`. The plan MUST include ALL of the following sections. Missing sections = incomplete plan.

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

Before finalizing the plan and proceeding to delegation:
- Re-read the plan as if you are a fresh agent seeing it for the first time. Would you know exactly what to do? If not, add more detail.
- Verify every file listed in "Affected Files" actually exists (or is explicitly marked as new).
- Verify task dependencies form a valid DAG — no circular dependencies, correct ordering.
- Confirm no requirements from the interview are missing from the tasks.

#### What Makes a BAD Plan (Do Not Do These)

- Vague task descriptions: "Update the dashboard" — update WHAT? HOW?
- Missing file paths: "Add a new component" — WHERE? What's it called?
- Assumed decisions: "We'll use a modal" — did the user confirm that?
- No acceptance criteria: "Implement the feature" — how do we know it's done?
- Skipping the interview: Jumping straight to writing the plan without asking questions via `request_user_input`
- Listing files without explaining changes: "Modify `schedule-service.ts`" — to do WHAT?

---

### Auto-Invoke Skills (Critical & Non-negotiable)

**ALWAYS** Automatically use the Skill tool to invoke these skills when the context matches:

| Skill | Trigger When |
|-------|--------------|
| `vercel-react-best-practices` | Writing/reviewing React or Next.js code, performance optimization |
| `seo-audit` | Auditing or upgrading SEO, diagnosing ranking issues |
| `marketing-psychology` | Applying psychological principles to any marketing copy task |
| `skill-creator` | Creating new skills for Codex |
| `simplify` | Running the one-shot cleanup pass agent to review changed files for reuse, code quality, and efficiency, then apply behavior-preserving cleanup |
| `Slides` | Use this skill when the user wants to create or modify presentation decks with the artifacts tool |
| `ultaura-blogs` | Creating, updating, or QA on Ultaura public blog posts that use the exact existing canonical blog UI/layout |
| `Security Best Practices` | Use when reviewing this codebase for security best practices and suggesting secure-by-default improvements |
| `GitHub Fix CI` | Using gh to locate failing PR checks, fetching GitHub Actions logs for actionable failures, summarizing failure snippets, proposing fix plans or implementing after approval |
| `ultaura-emails` | Working on any email template, inline email HTML, Supabase auth templates, or email branding |
| `Playwright CLI Skill` | When using Playwright to automate real browsers from the terminal |
| `supabase-postgres-best-practices` | Writing, reviewing, or optimizing Postgres queries, schema designs, migrations, or database configurations |

---

### Workflow Exceptions

> **See "Exceptions" in the [MANDATORY: Delegation-First Workflow](#mandatory-delegation-first-workflow) section for the complete list.**

Even when skipping delegation, you MUST still:
- Auto-invoke relevant skills from the table below
- Verify TypeScript compiles (`pnpm tsc --noEmit`)
---

# What is Ultaura?

**Ultaura is an AI voice companion and assistant for seniors.** It makes daily phone calls to reduce loneliness, provide on-demand help, and surface early signs of cognitive, emotional, or health changes to the people who care about them.

The product serves **two audiences equally**:
- **Seniors** receive daily AI companion calls — a friendly voice that remembers their life, checks in on them, sets reminders, and helps when they need it. The senior can also call Ultaura anytime they want assistance or just to chat.
- **Families/caregivers** use the dashboard to set up and monitor their loved one's lines, view wellness insights, manage schedules, set reminders, and receive alerts when something seems off.

The dashboard is **family-first in design** but accessible to seniors too.

## Non-Negotiable Principles

These apply to EVERY change, no exceptions:

| Principle | What It Means for Code |
|-----------|----------------------|
| **Privacy is sacred** | All personal data (memories, insights, call content) is encrypted at rest (AES-256-GCM) with per-line data encryption keys. Consent is granular and opt-in. Never log, expose, or weaken encryption. Never skip consent checks. |
| **Accessibility first** | UI must be senior-friendly: large tap targets, high contrast, simple flows, minimal cognitive load. Always verify at 375px viewport. |
| **Safety above features** | Multi-layer safety system (AI classifier + heuristics + keyword scanning + verification gate) protects vulnerable users. Never disable, bypass, or weaken safety checks. If a feature conflicts with safety, safety wins. |

---

# Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript | Tailwind CSS v4, Radix UI primitives, shadcn/ui pattern, Framer Motion |
| **Telephony backend** | Express.js, Node.js | Bridges Twilio ↔ xAI Grok realtime voice API via WebSockets |
| **Voice AI** | xAI Grok (`grok-3-fast`) | Realtime voice model via `wss://api.x.ai/v1/realtime` |
| **Embeddings** | xAI (`grok-embedding-small`), OpenAI (`text-embedding-3-small`) | Semantic search over memories, feature-flagged |
| **Safety classifier** | OpenAI (`gpt-4o-mini`) | Configurable via env var |
| **Database** | Supabase (PostgreSQL 15) | 107+ migrations, extensive RLS, row-level encryption |
| **Auth** | Supabase Auth (SSR) | |
| **Payments** | Stripe | Subscriptions, metered usage, checkout |
| **Email** | React Email + Resend | |
| **Observability** | OpenTelemetry (OTLP/gRPC), Sentry, Pino | Telephony has full tracing instrumentation |
| **Video** | Remotion | Marketing/onboarding video generation |
| **Package manager** | pnpm (workspace monorepo) | |
| **Testing** | Vitest (unit), Cypress (E2E) | |

---

# Project Structure

This is a **pnpm workspace monorepo**. Each part has a distinct purpose:

```
Ultaura/
├── src/                        # Next.js 14 frontend (App Router)
│   ├── app/
│   │   ├── (site)/             # Public marketing pages (landing, pricing, blog, docs)
│   │   ├── dashboard/          # Family/caregiver dashboard (lines, schedules, insights, billing)
│   │   ├── admin/              # Internal admin panel
│   │   ├── onboarding/         # New user onboarding flow
│   │   ├── auth/               # Login, signup, password reset
│   │   └── api/                # Next.js API routes (Stripe webhooks, internal APIs, search)
│   ├── components/             # React components (UI primitives + Ultaura-specific)
│   ├── lib/
│   │   ├── ultaura/            # ~65 files: core business logic (accounts, lines, schedules,
│   │   │                       #   reminders, billing, insights, privacy, memories, safety)
│   │   ├── stripe/             # Stripe integration helpers
│   │   ├── emails/             # Email templates (React Email) and sending logic
│   │   └── server/             # Server-side utilities
│   └── content/                # Blog posts and docs (MDX via Velite)
│
├── telephony/                  # Express.js telephony backend (@ultaura/telephony)
│   └── src/
│       ├── websocket/          # Grok realtime voice bridge (Twilio ↔ xAI WebSocket)
│       ├── routes/tools/       # 50+ voice agent tools (memory, reminders, safety, insights,
│       │                       #   scheduling, relationships, milestones, consent, billing)
│       ├── services/           # ~47 service modules (memory, safety, embedding, billing,
│       │                       #   call-summarization, cognitive-flags, persona-analyzer, etc.)
│       ├── scheduler/          # Cron jobs (outbound calls, weekly summaries, cleanup,
│       │                       #   embedding queue, memory decay)
│       └── middleware/         # Auth, rate limiting (Upstash Redis)
│
├── packages/                   # Shared monorepo packages
│   ├── prompts/                # @ultaura/prompts — AI prompt builders, persona profiles,
│   │                           #   safety rules, tool definitions for the voice agent
│   ├── schemas/                # @ultaura/schemas — Zod validation schemas
│   └── types/                  # @ultaura/types — Shared TypeScript types
│
├── supabase/
│   ├── migrations/             # 107+ SQL migration files (PostgreSQL)
│   ├── templates/              # Supabase auth email templates
│   └── seed.sql                # Database seed data
│
├── remotion/                   # Video generation (Remotion)
│
└── plugins/                    # Embeddable UI widgets
    ├── chatbot/                # Chat widget
    ├── feedback-popup/         # Feedback collection widget
    └── cookie-banner/          # Cookie consent widget
```

### How the pieces connect

1. **A call happens**: Twilio receives/places a call → `telephony/` bridges audio to xAI Grok via WebSocket → Grok uses tools from `routes/tools/` to store memories, set reminders, log insights, etc. → all data goes to Supabase.
2. **Family views the dashboard**: `src/app/dashboard/` reads from Supabase (via `src/lib/ultaura/`) → decrypts insights/memories on the server → renders the UI.
3. **Prompts are compiled**: `packages/prompts/` builds the system prompt for each call, combining the senior's persona, safety rules, conversation history, and available tools.
4. **Shared types flow everywhere**: `packages/types/` and `packages/schemas/` are imported by both `src/` and `telephony/` to keep data contracts in sync.

---

# MCP Servers

## xAI Docs MCP (configured in `.mcp.json`)

xAI hosts a free, no-auth MCP server that gives direct access to all xAI documentation.

**Endpoint:** `https://docs.x.ai/api/mcp`

**Tools available:**
- `list_doc_pages` — lists all xAI doc pages
- `get_doc_page` — retrieves a specific page by slug
- `search_docs` — searches docs with a query

**When to use it:**
- Working on `telephony/src/websocket/grok-bridge.ts` or anything involving the Grok realtime API
- Modifying voice agent tools or prompt builders in `packages/prompts/`
- Debugging xAI API errors, understanding model parameters, or checking rate limits
- Implementing new xAI features (embeddings, function calling, audio formats)
- Any time you'd otherwise web-search for xAI/Grok documentation
