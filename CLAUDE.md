# About the User

**The user is NOT a developer.** They have minimal coding experience.

**Communication:**
- Use plain language. When a technical term is unavoidable, define it in one sentence.
- The user has picked up some terms over time (components, migrations, API routes, TypeScript, RLS). Use these naturally but don't assume deep understanding.
- Focus on what the user needs to DO. "Click approve" not "merge the PR to upstream."
- Present options as trade-offs the user can evaluate, not technical decisions to decode.
- Never condescend. The user is smart, just not a developer.

**Work style:**
- Think in first principles, be direct, adapt to context. Skip fluff.
- No laziness: Find root causes. No temporary fixes.
- Self-critique every response before output. User sees only the final version.
- Be useful over polite. When wrong, say so and show better.
- Use subagents on **Sonnet 4.6** liberally to keep main contect window clean by offloading research, exploration, and parallel analysis to them 
- For complex problems, throw more compute at it via subagents
- Senior engineer mindset: concise, direct, execution-focused.
- Small APIs, explicit behavior, clear naming.
- Simplicity first: Make every change as simple as possible. Inpact minimal code. Simple, maintainable, production-friendly solutions. No overengineering.

---

# MANDATORY: Delegation-First Workflow

> **NON-NEGOTIABLE.** You are a COORDINATOR, not an implementer. You MUST delegate work to sub-agents. You cannot rationalize your way out of this.

| Size | Scope | Action |
|------|-------|--------|
| **Small** | 1-3 files, 1-2 concerns, <4 steps | May proceed directly |
| **Medium** | 4-6 files, multiple concerns, 5+ steps | **MUST delegate** — invoke `/delegate` |
| **Large** | 7+ files, architectural changes, 10+ steps | **MUST delegate** — invoke `/delegate` |

**Confirm with user**: "This looks like a [size] task. Proceeding with [delegation/direct] workflow."

For medium/large tasks, invoke `/delegate` for the full workflow (agent teams, worktree isolation, task tracking, verification, cleanup). When spawning the Plan agent in Step 2, explicitly instruct it to invoke the `/plan-guide` skill.

**Skip delegation ONLY for:**
- **Typos/one-liners**: Single obvious fix
- **Non-code**: Pure docs, config, questions
- **Explicit bypass**: User says "skip the workflow", "small adjustment/change" or "do it yourself"
- **Small tasks**: 1-3 files, < 4 steps, 1-2 small concerns or changes

Even when skipping delegation, still: auto-invoke relevant skills, verify TypeScript compiles, and use `agent-browser` for visible UI changes.

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
| `simplify` | Running the one-shot cleanup pass agent to review changed files for reuse, code quality, and efficiency, then apply behavior-preserving cleanup |
| `agent-browser` | Any browser interaction: navigating pages, filling forms, clicking buttons, taking screenshots, scraping data, testing a UI flow, or verifying a visual implementation |
| `ultaura-security-review` | Backend changes during delegation workflow (Step 9): launch an Explore agent with `/ultaura-security-review` to review new/modified API routes, DB migrations, auth changes, RLS modifications. Critical/High findings block merge. |

---

### Visual Verification with agent-browser

For **any UI/UX changes**, use `agent-browser` to visually verify the result when the user asks to test or check an implementation:

```bash
agent-browser open http://localhost:3000
agent-browser snapshot -i
agent-browser screenshot --annotate
```

**Standard verification checklist:**
- Navigate to the affected page
- Log in with test credentials if needed:
| Email | Password |
| payer@ultaura-seed.test | testingpassword |
- Take an annotated screenshot to confirm layout/content
- Test interactive states (click buttons, fill forms, open modals)
- Check mobile viewport: `agent-browser set viewport 375 812`
- Re-snapshot after any navigation or DOM change

**When the user says "test it", "check it", "does it work", or "show me"** — use `agent-browser` automatically. Don't ask, just do it.

Skip `agent-browser` for:
- Backend-only changes
- Non-visual config or database changes
- TypeScript-only refactors with no UI impact

# What is Ultaura?

**Ultaura is an AI voice companion and assistant for seniors.** It makes daily phone calls to reduce loneliness, provide on-demand help, and surface early signs of cognitive, emotional, or health changes to the people who care about them.

The product serves **two audiences equally**:
- **Seniors** receive daily AI companion calls — a friendly voice that remembers their life, checks in on them, sets reminders, and helps when they need it. The senior can also call Ultaura anytime they want assistance or just to chat.
- **Families/caregivers** use the dashboard to set up and monitor their loved one's lines, view wellness insights, manage schedules, set reminders, manage health, and receive alerts when something seems off.

The dashboard is **family-first in design** but accessible to seniors too.

## Non-Negotiable Principles

These apply to EVERY change, no exceptions:

| Principle | What It Means for Code |
|-----------|----------------------|
| **Privacy is sacred** | All personal data (memories, insights, call content) is encrypted at rest (AES-256-GCM) with per-line data encryption keys. Consent is granular and opt-in. Never log, expose, or weaken encryption. Never skip consent checks. Encryption utility: `src/lib/ultaura/encryption.ts` — use this for all data at rest, never implement encryption inline. |
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

> **Monorepo build order**: Always run `pnpm build:packages` before `pnpm typecheck` or starting dev. Workspace packages (`@ultaura/types`, `@ultaura/schemas`, `@ultaura/prompts`) must be compiled first — importing them without building produces cryptic TypeScript errors.

---

# Project Structure

This is a **pnpm workspace monorepo**. Each part has a distinct purpose:

```
Ultaura/
├── src/                        # Next.js 14 frontend (App Router)
│   ├── app/
│   │   ├── (site)/             # Public marketing pages (landing, pricing, blog, docs)
│   │   ├── dashboard/          # Family/caregiver dashboard (lines, calls, reminders, insights, billing, health)
│   │   ├── admin/              # Internal admin panel
│   │   ├── onboarding/         # New user onboarding flow
│   │   ├── auth/               # Login, signup, password reset
│   │   └── api/                # Next.js API routes (Stripe webhooks, internal APIs, search)
│   ├── components/             # React components (UI primitives + Ultaura-specific)
│   ├── lib/
│   │   ├── ultaura/            # Core business logic (accounts, lines, schedules,
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

# Database Conventions

## Migration naming
All migration files must follow: `YYYYMMDDHHMMSS_snake_case_description.sql`
Example: `20240315143022_add_health_profile_table.sql`

Every new table requires:
1. `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`
2. At least one RLS policy scoped to `auth.uid()`
3. If storing sensitive data: `encrypted_data text` and `encrypted_data_key text` columns — use `src/lib/ultaura/encryption.ts`

## Supabase local dev workflow
> **Do NOT run these commands unless the user explicitly asks.** They affect local database state and can be slow or destructive.

```bash
pnpm supabase:start        # start local Supabase (run before any DB work)
pnpm supabase:db:reset     # apply all migrations + seed data (after schema changes)
pnpm typegen               # regenerate src/database.types.ts (after schema changes)
pnpm supabase:stop         # stop local Supabase
```

---

# Testing

| Type | Command | When to use |
|------|---------|-------------|
| Unit | `pnpm test:unit` | Business logic, utility functions, service modules |
| E2E | `pnpm test:e2e` | User flows, dashboard interactions (requires local Supabase running) |
| DB | `pnpm test:db` | Migration correctness, RLS policy verification |

Unit test files live next to the source file: `foo.ts` → `foo.test.ts`.
Cypress E2E tests live in `cypress/`.

---

# Code Conventions

- **Business logic lives in `src/lib/ultaura/`** — never put logic in components or API route handlers
- **API routes use the Supabase SSR client** (from `src/lib/server/`) — never use the browser client on the server
- **Components follow the shadcn/ui pattern** — Radix primitive + `cva` variants, no raw HTML elements for interactive UI
- **`server-only` import** at the top of any file that must stay server-side (prevents accidental client bundle inclusion)
- **Imports from workspace packages**: use `@ultaura/types`, `@ultaura/schemas`, `@ultaura/prompts` — run `pnpm build:packages` first if types are missing

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
