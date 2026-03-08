# User Preferences for Claude

- **The user is *NOT* a developer and has minimal experience**
- Humanize all your output.
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
| Orchestrator (main agent) | Opus 4.6 — set via `/model Opus 4.6` |
| Explore agents | Opus 4.6 |
| Plan agent | Opus 4.6 |
| Implementation teammates | Sonnet 4.6 (default) — upgrade to Opus 4.6 when the task is genuinely complex |
| Code simplifier | Sonnet 4.6 |

**Implementation model override rule:** The orchestrator should upgrade a specific implementation teammate to Opus 4.6 when the task involves ambiguous requirements, tricky state management, or needs to reason about multiple interacting systems simultaneously. Sonnet stays the default because it follows plan specs precisely without over-engineering — Opus is reserved for tasks where deeper reasoning outweighs that risk.

**Every time you deploy an agent, you MUST state the model being used in your visible output to the user.** This applies to ALL agent types — Explore, Plan, Implementation teammates, Code simplifier, and any one-shot Task agents.

**Silently deploying agents without stating the model OR deploying a Haiku 4.5 agent are workflow violations.**

**Format:** When launching agents, announce them like this:

> Launching **[agent role/name]** on **[model]** — [brief purpose]

**Example formats:**
- "Launching **Explore agent** on **Opus 4.6** — investigating database schema and RLS policies"
- "Launching **Implementation teammate `frontend-1`** on **Sonnet 4.6** — building the schedule form component"
- "Launching **Plan agent** on **Opus 4.6** — drafting implementation plan"
- "Launching **code-simplifier** on **Sonnet 4.6** — reviewing modified files for cleanup"

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
   - Small tasks: 0-9 questions (proceed if clear)
   - Medium tasks: 9-18 clarifying questions minimum
   - Large tasks: 18+ questions to nail down full scope
   - Keep asking follow-ups until you have concrete answers for every decision point
   - Ask proactively when: requirements are ambiguous, multiple valid approaches exist, user preferences would affect implementation, or scope could expand unexpectedly
   - **HARD RULE: Do NOT begin writing the plan until every interview question has a concrete answer.** If the user says "just figure it out" or "up to you," you MUST document the assumption you're making as an explicit `[ASSUMPTION]` tag in the Requirements section (e.g., `[ASSUMPTION] User deferred — choosing modal over inline edit because it matches existing patterns in schedule-form.tsx`). Every `[ASSUMPTION]` tag is a flag for the user to review during plan approval. Unresolved ambiguity that is neither answered nor tagged is a planning violation.
3. **Identify every decision point** — Before writing a single line of the plan, list every fork in the road: naming conventions, UI placement, data model choices, error handling strategy, migration approach, API shape, etc. Each one must be resolved (either by codebase convention or by asking the user). If resolved by convention, cite the file/line where the convention is established. If resolved by the user, reference which interview answer confirmed it.

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
| **Security & Privacy Impact** | For every change in the plan, analyze: does it touch encrypted data, add/modify API routes, change RLS/permissions, expose PII to the client, interact with the safety system, or introduce new input paths? If no impact, state "No security impact" with a 1-sentence justification. This section is validated and deepened during the Phase 3 security review pass. |
| **Edge Cases & Error Handling** | How errors, empty states, permission failures, race conditions, and unexpected input are handled. |
| **Testing & Verification** | How to verify the implementation is correct: TypeScript compilation, specific UI states to check, API calls to test, migration verification steps. |
| **Out of Scope** | Explicitly list what this plan does NOT cover, to prevent scope creep during implementation. |
| **Plan Review Checklist** | The filled-out checklist from Phase 3. Must be the final section. |

#### Phase 3: Plan Review — Mandatory 4-Pass Deep Review

**This is NOT a skim.** Before exiting plan mode, the plan MUST survive all 4 review passes below. Each pass uses a different lens. Skipping a pass or doing them superficially is a planning violation.

**Pass 1: Completeness Traceability**
- Build a traceability matrix: for every requirement (R1, R2, ...), confirm at least one implementation task covers it. For every task, confirm it maps to at least one requirement.
- Flag any orphaned requirements (R# with no task) or orphaned tasks (task with no R#). Both are plan defects — fix them before proceeding.
- Verify every file listed in "Affected Files" actually exists in the codebase (or is explicitly marked as `[NEW]`).
- Verify task dependencies form a valid DAG — no circular dependencies, correct ordering.

**Pass 2: Security & Privacy Impact**
- For every change in the plan, answer these questions. If the answer to all is "no impact," the plan must still state that explicitly in the Security section.
  - Does this touch encrypted data (memories, insights, call content)? If yes, does the plan preserve AES-256-GCM encryption and per-line data keys?
  - Does this add or modify any API route? What auth/RLS protects it? Could an unauthenticated or wrong-tenant user reach it?
  - Does this change any RLS policies, DB permissions, or row-level access patterns?
  - Could this expose PII to the client (browser) that wasn't exposed before? Check every `select` query and API response shape.
  - Does this interact with the safety system (AI classifier, heuristics, keyword scanning, verification gate)? Could it weaken or bypass any layer?
  - Does this introduce any new user input paths? If yes, what validation/sanitization is planned?

**Pass 3: Accessibility Audit (UI changes only — skip if backend-only)**
- Does every new/modified UI element meet senior-friendly standards? Large tap targets (min 44px), high contrast, simple flows, minimal cognitive load.
- Has the plan accounted for 375px viewport behavior?
- Are loading, empty, and error states defined for every new UI surface?

**Pass 4: Adversarial "Break My Plan" Pass**
- **Assume the plan has at least 3 flaws. Find them.** This is mandatory — you cannot declare "no flaws found" without documenting what you checked.
- Attack vectors to check:
  - What happens if a database migration fails halfway? Is there a rollback path?
  - What happens if an API call times out or returns unexpected data?
  - Are there race conditions (e.g., two concurrent requests modifying the same row)?
  - What if the user has no data yet (empty state)? What if they have a massive amount (performance)?
  - Could a malicious user exploit any new input path?
  - What assumption am I making that could be wrong?
- **Document every flaw found and how the plan addresses it.** Add fixes to the relevant task's acceptance criteria or to the Edge Cases section.

#### Pre-Exit Checklist (MUST appear in the plan document before calling `ExitPlanMode`)

The plan document must include this checklist, filled out, as its final section. The agent cannot call `ExitPlanMode` until every item is checked. Copy this template and fill it in:

```
## Plan Review Checklist
- [ ] Every requirement (R#) maps to at least one task
- [ ] Every task maps to at least one requirement (R#)
- [ ] Every task has concrete acceptance criteria (not "it works")
- [ ] Security & Privacy pass completed — impact section filled out
- [ ] Accessibility pass completed (or marked N/A for backend-only)
- [ ] Adversarial pass completed — found and addressed [N] flaws: [list them]
- [ ] All interview questions answered — no unresolved ambiguity
- [ ] All [ASSUMPTION] tags documented for user-deferred decisions
- [ ] File paths verified as real or marked [NEW]
- [ ] Task dependency graph has no cycles
- [ ] No requirement from the interview is missing from the tasks
- [ ] Plan is detailed enough for a fresh agent with zero context to execute without questions
```

If any item cannot be checked, the plan is not ready. Fix the gap before exiting.

#### What Makes a BAD Plan (Do Not Do These)

- Vague task descriptions: "Update the dashboard" — update WHAT? HOW?
- Missing file paths: "Add a new component" — WHERE? What's it called?
- Assumed decisions: "We'll use a modal" — did the user confirm that?
- No acceptance criteria: "Implement the feature" — how do we know it's done?
- Skipping the interview: Jumping straight to writing the plan without asking questions
- Listing files without explaining changes: "Modify `schedule-service.ts`" — to do WHAT?
- Rubber-stamping the review passes: Saying "Pass 4 complete, no issues" without documenting what you checked — the adversarial pass REQUIRES finding at least 3 flaws or documenting the specific attack vectors you tested
- Missing the checklist: Calling `ExitPlanMode` without a filled-out Plan Review Checklist at the bottom of the plan document
- Untagged assumptions: Making decisions the user didn't explicitly confirm without an `[ASSUMPTION]` tag

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
- The subagent MUST invoke the `/simplify` skill — this is the single source of truth for simplification logic
- This is a **one-shot agent**, NOT a teammate — it runs independently after the team finishes
- It is **blocking** — wait for its result before proceeding to shutdown

**Prompt:** Tell the subagent to invoke `/simplify` and pass it the list of modified files (gathered from `git diff --name-only` or tracked during implementation).

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
| `seo-audit` | Auditing SEO, diagnosing ranking issues |
| `marketing-psychology` | Applying psychological principles to marketing |
| `skill-creator` | Creating new skills for Claude Code or Codex |
| `ultaura-emails` | Working on any email template, inline email HTML, Supabase auth templates, or email branding |
| `supabase-postgres-best-practices` | Writing, reviewing, or optimizing Postgres queries, schema designs, migrations, or database configurations |

---

### Chrome Visual Verification

For **any UI/UX changes**, use Chrome MCP for visual verification (when made available by the user):
- **Before/after awareness**: Note current state before changes
- **Interactive states**: Verify hover, focus, loading, error states

Skip Chrome for:
- Backend-only changes
- Non-visual config changes
- Database migrations

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

**When NOT to use it:**
- Frontend-only work unrelated to xAI
- Supabase/Stripe/Twilio questions (use their own docs)
