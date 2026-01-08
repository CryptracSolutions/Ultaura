# Implement Insights Feature — Part 1 (Codex-Orchestrated)

Use the **autonomous-skill** to manage task tracking across sessions, with **Codex** handling all implementation and **Explore agents** reviewing each phase.

---

## How to Start

Invoke the autonomous-skill to begin:

```
/autonomous-skill insights-feature
```

This will:
- Create `.autonomous/insights-feature/` directory
- Set up `task_list.md` and `progress.md` for multi-session tracking
- Follow the Initializer/Executor workflow patterns

---

## Source of Truth

Read these files before creating the task list:
- `/spec.md` — Index and coverage map
- `/spec.part1.md` — **Part 1 is the ONLY implementation scope**

Part 1 includes:
- Database schema for call insights, baselines, privacy, and line/call-session fields
- Grok tools (log_call_insights, mark_topic_private, set_pause_mode)
- Telephony integration, baseline recalculation, answered/missed logic
- Encryption helpers and prompt updates
- Part 1 acceptance criteria and tests

---

## Orchestrator Role

You are the **Orchestrator**. You MUST NOT write any code or make any file changes directly.

Your responsibilities:
1. Manage task tracking via autonomous-skill (`task_list.md`, `progress.md`)
2. Delegate **entire phases** to Codex via `/codex-skill`
3. Deploy Explore agents to review each phase
4. Block progression until the phase review passes
5. Reprompt Codex for fixes if issues are found
6. Update progress tracking after each phase

---

## Session Workflows

### First Session (Initializer)

Follow the autonomous-skill Initializer workflow:

1. **Read specs completely**:
   - Read `spec.md` and `spec.part1.md` completely and thoroughly
   - Use Explore agents to understand existing codebase patterns

2. **Create `task_list.md`** in `.autonomous/insights-feature/` with phases:
   - Phase 1: Core Infrastructure
   - Phase 2: Grok Tools & Prompt Updates
   - Phase 3: Baseline & Detection
   - Phase 4: Privacy & Pause Tools
   - Phase 5: Final Verification

3. **Create `progress.md`** in `.autonomous/insights-feature/`

4. **Begin Phase 1** using the Phase Execution Cycle below

### Continuation Sessions (Executor)

Follow the autonomous-skill Executor workflow:

1. **Get bearings**: Read `task_list.md` and `progress.md`
2. **Verify previous work**: Check for any issues from last session
3. **Continue from where left off**: Pick up the current phase
4. **Follow the Phase Execution Cycle** for remaining phases

---

## Phase Execution Cycle

**For each phase, follow this exact cycle. DO NOT proceed to the next phase until the current phase review passes.**

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE N                                                    │
├─────────────────────────────────────────────────────────────┤
│  1. Prepare Context (gather patterns, files, requirements)  │
│  2. Delegate to Codex (entire phase via /codex-skill)       │
│  3. Review with Explore Agent (thoroughness: very thorough) │
│  4. Evaluate Results                                        │
│     ├── PASS → Mark phase complete, update progress.md      │
│     └── FAIL → Reprompt Codex with fixes, return to Step 3  │
└─────────────────────────────────────────────────────────────┘
```

---

### Step 1: Prepare Phase Context

Before delegating a phase to Codex, gather ALL context:

1. **Read relevant existing files** the phase will modify/reference
2. **Extract code patterns** Codex should follow (include actual snippets)
3. **List every file** that needs to be created or modified
4. **Define acceptance criteria** for the entire phase
5. **Check dependencies** from previous phases

Use Explore agents to gather patterns from:
- Migration patterns: `/supabase/migrations/`
- Encryption patterns: `/telephony/src/utils/encryption.ts`
- Grok tool patterns: `/telephony/src/routes/tools/`
- Prompt structure: `/src/lib/ultaura/prompts.ts`
- Call session service: `/telephony/src/services/call-session.ts`

---

### Step 2: Delegate Entire Phase to Codex

Invoke `/codex-skill` with a comprehensive prompt containing ALL tasks for the phase:

```
/codex-skill

## Phase [N]: [Phase Name]

Implement all of the following tasks for this phase.

### Tasks
1. [Task description with specific file path]
2. [Task description with specific file path]
3. [Task description with specific file path]

### Files to Create/Modify
| File | Action | Description |
|------|--------|-------------|
| `/path/to/file1.ts` | Create | [what it should contain] |
| `/path/to/file2.sql` | Create | [what it should contain] |

### Existing Patterns to Follow

#### Pattern 1: [Name]
```[language]
[Actual code snippet from existing codebase]
```

### Requirements from Spec
[Paste relevant sections from spec.part1.md]

### Phase Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] All files compile without TypeScript errors
```

---

### Step 3: Review Phase with Explore Agent

After Codex completes, deploy an Explore agent for comprehensive review:

```
Deploy Explore agent (thoroughness: very thorough) to review Phase [N]:

## Review Checklist

### Files Created/Modified
- [ ] /path/to/file1.ts — exists and correct
- [ ] /path/to/file2.sql — exists and correct

### Code Quality
1. All files follow existing codebase patterns
2. TypeScript types are correct
3. No missing imports or exports
4. Integration points connect correctly

### Spec Requirements
- [ ] [Requirement from spec.part1.md]

Provide detailed report with file:line references for any issues.
```

---

### Step 4: Evaluate and Iterate

**CRITICAL: Do not proceed to the next phase until review passes.**

#### If Review PASSES:
1. Mark all phase tasks complete in `task_list.md`: `[ ]` → `[x]`
2. Add session entry to `progress.md` with:
   - What was accomplished
   - Current status (X/Y tasks complete)
   - Next phase to work on
3. **Proceed to next phase**

#### If Review FAILS:
1. Document issues in `progress.md`
2. Reprompt Codex with specific fixes:

```
/codex-skill

## Fix Issues in Phase [N]: [Phase Name]

### Issue 1: [File path]
**Problem:** [Description]
**Location:** [file:line]
**Required Fix:** [What needs to change]

### Issue 2: [File path]
...
```

3. **Re-run Explore agent review**
4. **Repeat until review passes**

---

## Task List Structure

Create `task_list.md` with these phases from spec.part1.md:

```markdown
# Task List: Insights Feature Part 1

## Meta
- Created: [YYYY-MM-DD HH:MM]
- Task Directory: .autonomous/insights-feature
- Total Tasks: 23
- Completed: 0/23 (0%)

## Progress Notes
<!-- Updated after each phase -->

## Tasks

### Phase 1: Core Infrastructure
- [ ] 1.1: Create migration for `ultaura_call_insights` table
- [ ] 1.2: Create migration for `ultaura_insight_baselines` table
- [ ] 1.3: Create migration for `ultaura_private_topics` table
- [ ] 1.4: Add columns to `ultaura_lines` (pause_mode, pause_until, etc.)
- [ ] 1.5: Add columns to `ultaura_call_sessions` (answered_by, insights_logged, etc.)
- [ ] 1.6: Create TypeScript types for insights in types.ts
- [ ] 1.7: Create encryption helpers (reuse memory crypto pattern)

### Phase 2: Grok Tools & Prompt Updates
- [ ] 2.1: Create `log_call_insights` tool handler
- [ ] 2.2: Register `log_call_insights` in Grok bridge
- [ ] 2.3: Update voice-realtime prompt with insights instructions

### Phase 3: Baseline & Detection
- [ ] 3.1: Create baseline calculation service
- [ ] 3.2: Implement nightly baseline recalculator job
- [ ] 3.3: Integrate answered/missed detection logic
- [ ] 3.4: Add call session counter updates
- [ ] 3.5: Connect baseline alerts to insights logging

### Phase 4: Privacy & Pause Tools
- [ ] 4.1: Create `set_pause_mode` tool handler
- [ ] 4.2: Register `set_pause_mode` in Grok bridge
- [ ] 4.3: Create `mark_topic_private` tool handler
- [ ] 4.4: Register `mark_topic_private` in Grok bridge
- [ ] 4.5: Integrate privacy state into call session flow

### Phase 5: Final Verification
- [ ] 5.1: Run `pnpm typecheck` and fix any errors
- [ ] 5.2: Verify all acceptance criteria from spec.part1.md
- [ ] 5.3: Create summary of completed work
```

---

## Phase Details

### Phase 1: Core Infrastructure
**Scope:** Database migrations, TypeScript types, encryption helpers

| Task | File | Description |
|------|------|-------------|
| 1.1 | `/supabase/migrations/[ts]_call_insights.sql` | Create `ultaura_call_insights` table |
| 1.2 | `/supabase/migrations/[ts]_insight_baselines.sql` | Create `ultaura_insight_baselines` table |
| 1.3 | `/supabase/migrations/[ts]_private_topics.sql` | Create `ultaura_private_topics` table |
| 1.4 | `/supabase/migrations/[ts]_lines_insights_cols.sql` | Add pause_mode, pause_until to `ultaura_lines` |
| 1.5 | `/supabase/migrations/[ts]_sessions_insights_cols.sql` | Add answered_by, insights_logged to `ultaura_call_sessions` |
| 1.6 | `/src/lib/ultaura/types.ts` | Add TypeScript types for insights |
| 1.7 | `/telephony/src/utils/insights-crypto.ts` | Encryption helpers |

**Acceptance Criteria:**
- [ ] All 5 migrations created with correct schemas
- [ ] RLS policies on all new tables
- [ ] TypeScript types match database schema
- [ ] Encryption helpers use same pattern as memory encryption

---

### Phase 2: Grok Tools & Prompt Updates
**Scope:** log_call_insights tool, Grok bridge registration, prompt updates

| Task | File | Description |
|------|------|-------------|
| 2.1 | `/telephony/src/routes/tools/log-call-insights.ts` | Create tool handler |
| 2.2 | `/telephony/src/websocket/grok-bridge.ts` | Register tool |
| 2.3 | `/src/lib/ultaura/prompts.ts` | Update prompt with insights instructions |

**Acceptance Criteria:**
- [ ] Tool handler follows existing tool patterns
- [ ] Tool registered in Grok bridge tool list
- [ ] Prompt includes when/how to log insights
- [ ] Tool encrypts insight data before storage

---

### Phase 3: Baseline & Detection
**Scope:** Baseline calculation, nightly job, answered/missed detection

| Task | File | Description |
|------|------|-------------|
| 3.1 | `/telephony/src/services/baseline-calculator.ts` | Baseline calculation service |
| 3.2 | `/telephony/src/jobs/nightly-baseline.ts` | Nightly recalculator job |
| 3.3 | `/telephony/src/services/call-session.ts` | Answered/missed detection |
| 3.4 | `/telephony/src/services/call-session.ts` | Session counter updates |
| 3.5 | `/telephony/src/services/baseline-calculator.ts` | Alert integration |

**Acceptance Criteria:**
- [ ] Baseline calculation uses correct algorithm from spec
- [ ] Nightly job scheduled correctly
- [ ] Answered/missed detection integrated with AMD results
- [ ] Session counters update on call completion

---

### Phase 4: Privacy & Pause Tools
**Scope:** set_pause_mode tool, mark_topic_private tool

| Task | File | Description |
|------|------|-------------|
| 4.1 | `/telephony/src/routes/tools/set-pause-mode.ts` | Tool handler |
| 4.2 | `/telephony/src/websocket/grok-bridge.ts` | Register tool |
| 4.3 | `/telephony/src/routes/tools/mark-topic-private.ts` | Tool handler |
| 4.4 | `/telephony/src/websocket/grok-bridge.ts` | Register tool |
| 4.5 | `/telephony/src/services/call-session.ts` | Privacy state integration |

**Acceptance Criteria:**
- [ ] Both tools follow existing tool patterns
- [ ] Tools registered in Grok bridge
- [ ] Privacy state checked before logging insights
- [ ] Pause mode prevents insight logging when active

---

### Phase 5: Final Verification
**Scope:** Typecheck, acceptance criteria verification

| Task | Action |
|------|--------|
| 5.1 | Run `pnpm typecheck` — delegate to Codex to fix any errors |
| 5.2 | Use Explore agent to verify all spec.part1.md criteria |
| 5.3 | Update `progress.md` with final summary |

**Acceptance Criteria:**
- [ ] `pnpm typecheck` passes
- [ ] All spec.part1.md acceptance criteria verified
- [ ] Summary documented

---

## Critical Rules for Orchestrator

1. **NEVER write code directly** — All implementation goes through `/codex-skill`
2. **NEVER proceed to next phase without passing review** — Block until satisfied
3. **Delegate entire phases, not individual tasks** — One Codex invocation per phase
4. **Provide exhaustive context to Codex** — File paths, patterns, full requirements
5. **Use thorough Explore reviews** — Set thoroughness to "very thorough"
6. **Iterate until fixed** — Keep reprompting Codex until review passes
7. **Update autonomous-skill files** — Always update `task_list.md` and `progress.md`
8. **Follow autonomous-skill patterns** — Only modify checkboxes in task_list.md

---

## Start

```
/autonomous-skill insights-feature
```

Then follow the workflow:
1. If new task → Initializer workflow (read specs, create task list, begin Phase 1)
2. If continuation → Executor workflow (get bearings, continue from current phase)
3. For each phase: **Prepare → Delegate to Codex → Review → Iterate → Proceed**
