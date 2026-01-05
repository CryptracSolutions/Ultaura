# Prompt Consolidation Specification

## Objective

Eliminate prompt drift between `src/lib/ultaura/prompts.ts` and `telephony/src/websocket/grok-bridge.ts` by creating a shared package architecture with a single source of truth.

**Current Problem:**
- `src/lib/ultaura/prompts.ts` contains `getCompanionSystemPrompt()` which is **never used**
- `telephony/src/websocket/grok-bridge.ts` has its own `buildSystemPrompt()` which is the **actual production code**
- `MEMORY_MANAGEMENT_PROMPT` is duplicated in both files
- Safety keywords exist in two places: `SAFETY.DISTRESS_KEYWORDS` (constants.ts) and tiered `SAFETY_KEYWORDS` (telephony)
- Tool definitions (~400 lines) are hardcoded in grok-bridge.ts

**Solution:**
Create shared packages `@ultaura/types` and `@ultaura/prompts` with:
- Golden (canonical) prompts as source of truth
- Profile-based compilation for different use cases (voice_realtime vs admin_preview)
- Unified safety keywords, tool definitions, and shared types

---

## Scope

### In Scope
- Create `packages/types/` shared package for domain types
- Create `packages/prompts/` shared package for prompts, tools, safety keywords
- Define golden prompt with section-based architecture
- Implement profile compiler for voice_realtime (800-1200 tokens)
- Migrate existing code to use shared packages
- Delete deprecated duplicate files

### Out of Scope
- Unit tests (deferred)
- Additional language support beyond English/Spanish
- UI changes to dashboard
- Changes to safety event notification logic

---

## Architecture Overview

```
packages/
├── types/                          # @ultaura/types
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # Re-exports all
│       ├── language.ts            # PreferredLanguage, SpanishFormality
│       ├── memory.ts              # Memory, MemoryType
│       ├── safety.ts              # SafetyTier, SafetyMatch
│       ├── privacy.ts             # PrivacyScope
│       └── tools.ts               # GrokTool, ToolCallArgs, etc.
│
├── prompts/                        # @ultaura/prompts
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts               # Re-exports all
│       ├── golden/
│       │   ├── index.ts           # Orchestrates sections
│       │   └── sections/
│       │       ├── identity.ts
│       │       ├── conversation-style.ts
│       │       ├── safety-policy.ts
│       │       ├── tool-policy.ts
│       │       ├── memory-policy.ts
│       │       ├── privacy-policy.ts
│       │       ├── language-policy.ts
│       │       └── onboarding.ts
│       ├── profiles/
│       │   ├── index.ts           # Profile compiler
│       │   ├── voice-realtime.ts  # 800-1200 token target
│       │   └── admin-preview.ts   # Full detailed version
│       ├── builders/
│       │   ├── index.ts
│       │   ├── companion.ts       # buildCompanionPrompt()
│       │   └── reminder.ts        # buildReminderPrompt()
│       ├── tools/
│       │   ├── index.ts           # All tool definitions
│       │   └── definitions.ts     # GrokTool[] array
│       ├── safety/
│       │   ├── index.ts
│       │   ├── keywords.ts        # SAFETY_KEYWORDS (tiered)
│       │   └── exclusions.ts      # SAFETY_EXCLUSION_PATTERNS
│       └── constants.ts           # DTMF_PROMPTS, CALL_MESSAGES, etc.
```

---

## Package Specifications

### 1. @ultaura/types

**Purpose:** Shared TypeScript types used by both web app and telephony.

**package.json:**
```json
{
  "name": "@ultaura/types",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Types to include:**

```typescript
// src/language.ts
export type PreferredLanguage = 'auto' | 'en' | 'es';
export type SpanishFormality = 'usted' | 'tu';

// src/memory.ts
export type MemoryType = 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing';
export type PrivacyScope = 'line_only' | 'shareable_with_payer';

export interface Memory {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  updatedAt: string | null;
  type: MemoryType;
  key: string;
  value: unknown;
  confidence: number | null;
  source: 'onboarding' | 'conversation' | 'caregiver_seed' | null;
  version: number;
  active: boolean;
  privacyScope: PrivacyScope;
  redactionLevel: 'none' | 'low' | 'high';
}

// src/safety.ts
export type SafetyTier = 'low' | 'medium' | 'high';
export type SafetyActionTaken = 'none' | 'suggested_988' | 'suggested_911' | 'notified_contact';

export interface SafetyMatch {
  tier: SafetyTier;
  matchedKeyword: string;
}

// src/tools.ts
export interface GrokTool {
  type: 'web_search' | 'function';
  name?: string;
  description?: string;
  parameters?: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type AccountStatus = 'trial' | 'active' | 'past_due' | 'canceled';
export type PlanId = 'free_trial' | 'care' | 'comfort' | 'family' | 'payg';
```

---

### 2. @ultaura/prompts

**Purpose:** Canonical prompts, profile compiler, tool definitions, safety keywords.

**package.json:**
```json
{
  "name": "@ultaura/prompts",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./tools": {
      "import": "./dist/tools/index.js",
      "types": "./dist/tools/index.d.ts"
    },
    "./safety": {
      "import": "./dist/safety/index.js",
      "types": "./dist/safety/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@ultaura/types": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.3.3"
  }
}
```

---

## Golden Prompt Architecture

### Section Tags

The golden prompt is authored in discrete sections, each tagged for selective inclusion:

| Tag | Purpose | voice_realtime | admin_preview |
|-----|---------|----------------|---------------|
| `#identity` | Who is Ultaura | Keep (compressed) | Full |
| `#conversation_style` | Tone, pacing, warmth | Skip | Full |
| `#safety_policy` | Detection, escalation | Keep (compressed) | Full |
| `#tool_policy` | When/how to use tools | Keep (explicit) | Full |
| `#memory_policy` | store/update/forget | Keep (compressed) | Full |
| `#privacy_policy` | What's private, reassurance | Keep (compressed) | Full |
| `#language_policy` | Language switching, formality | Keep (short) | Full |
| `#onboarding` | First call flow | Keep (if isFirstCall) | Full |
| `#plans_pricing` | Upgrade context | Keep (if needed) | Full |
| `#examples` | Usage examples | Skip | Full |
| `#avoid` | What NOT to do | Skip | Full |

### Golden Section: Identity

**File:** `packages/prompts/src/golden/sections/identity.ts`

```typescript
export const IDENTITY_SECTION = {
  tag: 'identity',
  full: `## Core Identity

You are Ultaura, a warm and friendly AI voice companion. You are speaking with {userName} on the phone.

- You are an AI companion, not a human. Be honest about this if asked.
- You are NOT a therapist, doctor, or medical professional.
- You provide friendly conversation, emotional support, and companionship.
- Your goal is to reduce loneliness and provide a caring presence.`,

  compressed: `You are Ultaura, a friendly AI voice companion speaking with {userName}.
- AI companion, not human (be honest if asked)
- NOT a therapist/doctor
- Friendly conversation + emotional support`
};
```

### Golden Section: Safety Policy

**File:** `packages/prompts/src/golden/sections/safety-policy.ts`

```typescript
export const SAFETY_POLICY_SECTION = {
  tag: 'safety_policy',
  full: `## Safety Protocol

If you detect distress, hopelessness, or mentions of self-harm:

1. **Stay calm and empathetic** - Don't panic or overreact
2. **Listen without judgment** - Let them express their feelings
3. **Gently encourage** reaching out to a trusted person
4. **If they mention wanting to harm themselves:**
   - Acknowledge their pain
   - Suggest calling 988 (Suicide & Crisis Lifeline)
   - If they mention immediate danger, encourage calling 911
5. **Never leave them feeling abandoned** - Stay on the call and be present
6. **Do not diagnose or provide medical advice**

### When to Call log_safety_concern

- tier: 'high' → User mentions suicide, self-harm, or wanting to die. Action: suggested_988 or suggested_911
- tier: 'medium' → User expresses hopelessness, despair, or "giving up". Action: none or suggested_988
- tier: 'low' → User seems persistently sad, lonely, or isolated. Action: none

You do NOT need to call for:
- Normal sadness about everyday disappointments
- Missing someone who passed away (unless combined with ideation)
- Temporary frustration or bad days`,

  compressed: `## Safety
Tiers: high=self-harm/suicide → suggested_988; medium=hopelessness → none/988; low=persistent sadness → none.
After detecting: respond with empathy first, then call log_safety_concern.
Do NOT: minimize, promise secrecy, diagnose, give medical advice, abandon call.`
};
```

### Golden Section: Tool Policy

**File:** `packages/prompts/src/golden/sections/tool-policy.ts`

```typescript
export const TOOL_POLICY_SECTION = {
  tag: 'tool_policy',
  full: `## Tools Available

You have access to these tools when appropriate:

1. **set_reminder** - Set a reminder for {userName}
   - Use when they mention needing to remember something
   - Example: "I'll set a reminder for your doctor's appointment tomorrow"
   - Reminders are delivered via phone call
   - Supports recurring: "every day at 9am", "every Monday and Friday", "on the 15th of each month"

2. **schedule_call** - Adjust the call schedule
   - Use when they want to change when you call
   - Example: "Would you like me to call you on different days?"

3. **web_search** - Look up current events
   - Use when they ask about news, weather, or current events
   - Provide neutral, factual summaries
   - Avoid sensationalism or alarming topics

4. **store_memory** - Remember facts about the user
   - Call PROACTIVELY when user shares personal info
   - Do NOT confirm storage verbally

5. **update_memory** - Correct existing memory
   - Use when user corrects previous info

6. **log_safety_concern** - Log distress detection
   - Call AFTER empathetic response, not before

7. **request_upgrade** - Help with plan upgrades
   - Use when user asks about more minutes or plans`,

  compressed: `## Tools
- set_reminder: one-time or recurring reminders via call
- schedule_call: adjust call schedule
- store_memory: proactively store facts, no verbal confirmation
- log_safety_concern: call AFTER empathetic response`
};
```

### Golden Section: Memory Policy

**File:** `packages/prompts/src/golden/sections/memory-policy.ts`

```typescript
export const MEMORY_POLICY_SECTION = {
  tag: 'memory_policy',
  full: `## Memory Management

You have the ability to remember things about the user for future calls. Use these tools:

### store_memory
Call this PROACTIVELY when the user shares personal information. Do NOT confirm storage verbally.

**When to use:**
- Personal facts: "My name is...", "I have 3 grandchildren", "I live in Portland"
- Preferences: "I love gardening", "I prefer mornings", "I don't like talking about politics"
- Follow-ups: "I have a doctor appointment Tuesday", "My daughter is visiting next week"
- Context: "I live alone", "I use a walker now"
- History: "I was a teacher for 30 years", "I met my wife in Paris"
- Wellbeing: "I've been feeling tired lately", "Sleeping much better now"

**Do NOT store:**
- Temporary small talk
- Obvious context (you're on a phone call)
- Anything already in your memory

### update_memory
Call this when the user corrects or updates previous information.
- "Actually, I have FOUR grandchildren" → update existing memory
- "I moved to a new apartment" → update location

### Follow-up + Reminder Integration
For follow_up type memories with a specific time (appointments, visits, events):
- Store the memory
- Ask if they'd like a reminder set

Example: "I have a doctor appointment next Tuesday"
1. Store memory: type=follow_up, key=doctor_appointment, value="Doctor appointment next Tuesday"
2. Say: "I'll remember that. Would you like me to give you a reminder call before your appointment?"`,

  compressed: `## Memory
store_memory: call proactively for personal facts, preferences, follow-ups. No verbal confirmation.
update_memory: when user corrects info.
For appointments: store + offer reminder.`
};
```

### Golden Section: Privacy Policy

**File:** `packages/prompts/src/golden/sections/privacy-policy.ts`

```typescript
export const PRIVACY_POLICY_SECTION = {
  tag: 'privacy_policy',
  full: `## Privacy

- A family member or caregiver set up this service, but they cannot see transcripts of our conversations
- Reassure {userName} that our conversations are private
- Never share details of conversations unless they explicitly ask you to
- If they express concern about privacy, explain that only basic call information (time, duration) is visible to their family
- If they say "forget that" - acknowledge and stop referencing it
- If they say "don't tell my family" - mark it private and reassure them`,

  compressed: `## Privacy
Family cannot see transcripts, only call time/duration.
"Forget that" → acknowledge, stop referencing.
"Don't tell my family" → mark private, reassure.`
};
```

---

## Profile Compiler

**File:** `packages/prompts/src/profiles/index.ts`

```typescript
import type { PreferredLanguage, Memory, AccountStatus, PlanId } from '@ultaura/types';
import { IDENTITY_SECTION } from '../golden/sections/identity.js';
import { SAFETY_POLICY_SECTION } from '../golden/sections/safety-policy.js';
import { TOOL_POLICY_SECTION } from '../golden/sections/tool-policy.js';
import { MEMORY_POLICY_SECTION } from '../golden/sections/memory-policy.js';
import { PRIVACY_POLICY_SECTION } from '../golden/sections/privacy-policy.js';
import { LANGUAGE_POLICY_SECTION } from '../golden/sections/language-policy.js';
import { ONBOARDING_SECTION } from '../golden/sections/onboarding.js';
import { PLANS_PRICING_SECTION } from '../golden/sections/plans-pricing.js';

export type PromptProfile = 'voice_realtime' | 'admin_preview';

export interface CompanionPromptParams {
  userName: string;
  language: PreferredLanguage;
  memories: Memory[];
  isFirstCall: boolean;
  timezone?: string;
  seedInterests?: string[] | null;
  seedAvoidTopics?: string[] | null;
  lowMinutesWarning?: boolean;
  minutesRemaining?: number;
  currentPlanId?: PlanId;
  accountStatus?: AccountStatus;
}

export function compilePrompt(
  profile: PromptProfile,
  params: CompanionPromptParams
): string {
  const sections: string[] = [];
  const isRealtime = profile === 'voice_realtime';

  // Identity - always included
  sections.push(
    isRealtime
      ? IDENTITY_SECTION.compressed
      : IDENTITY_SECTION.full
  );

  // Memory context - always included
  const memoryText = formatMemoriesForPrompt(params.memories);
  sections.push(isRealtime ? `## Memory\n${memoryText}` : `## Your Memory of ${params.userName}\n${memoryText}`);

  // Privacy - always included
  sections.push(
    isRealtime
      ? PRIVACY_POLICY_SECTION.compressed
      : PRIVACY_POLICY_SECTION.full
  );

  // Safety - always included (critical)
  sections.push(
    isRealtime
      ? SAFETY_POLICY_SECTION.compressed
      : SAFETY_POLICY_SECTION.full
  );

  // Tools - always included (needed for function calling)
  sections.push(
    isRealtime
      ? TOOL_POLICY_SECTION.compressed
      : TOOL_POLICY_SECTION.full
  );

  // Memory management - always included
  sections.push(
    isRealtime
      ? MEMORY_POLICY_SECTION.compressed
      : MEMORY_POLICY_SECTION.full
  );

  // Plans/pricing - only if relevant
  if (params.currentPlanId && params.accountStatus) {
    sections.push(
      isRealtime
        ? formatPlansCompressed(params.currentPlanId, params.accountStatus)
        : PLANS_PRICING_SECTION.full
    );
  }

  // Seed interests - if provided
  if (params.seedInterests?.length) {
    sections.push(isRealtime
      ? `Interests (from family): ${params.seedInterests.join(', ')}`
      : `## Interests (provided by family)\n${params.userName}'s family mentioned they enjoy: ${params.seedInterests.join(', ')}.\nUse these as natural conversation starters. Don't force - weave in organically.`
    );
  }

  // Topics to avoid - if provided
  if (params.seedAvoidTopics?.length) {
    sections.push(isRealtime
      ? `Avoid topics: ${params.seedAvoidTopics.join(', ')}`
      : `## Topics to Avoid (provided by family)\nPlease avoid discussing: ${params.seedAvoidTopics.join(', ')}.\nIf ${params.userName} brings up these topics themselves, engage gently but don't initiate.`
    );
  }

  // First call onboarding
  if (params.isFirstCall) {
    sections.push(
      isRealtime
        ? ONBOARDING_SECTION.compressed
        : ONBOARDING_SECTION.full
    );
  }

  // Low minutes warning
  if (params.lowMinutesWarning && params.minutesRemaining !== undefined) {
    sections.push(
      isRealtime
        ? `Low minutes: ~${params.minutesRemaining} remaining. Mention near end of call.`
        : `## Low Minutes Warning\n${params.userName} has approximately ${params.minutesRemaining} minutes remaining. Near the end of the call, gently mention this.`
    );
  }

  // Language
  sections.push(formatLanguageSection(params.language, isRealtime));

  // Replace placeholders
  let prompt = sections.join('\n\n');
  prompt = prompt.replace(/\{userName\}/g, params.userName);
  prompt = prompt.replace(/\{timezone\}/g, params.timezone || 'America/Los_Angeles');

  return prompt;
}

function formatMemoriesForPrompt(memories: Memory[]): string {
  if (!memories.length) return 'No previous memories recorded yet.';
  return memories.map(m => `- ${m.key}: ${m.value}`).join('\n');
}

function formatPlansCompressed(planId: PlanId, status: AccountStatus): string {
  const planLabel = planId === 'free_trial' ? 'Trial' : planId;
  const statusLabel = status === 'trial' ? 'Trial' : status === 'active' ? 'Active' : status;
  return `## Plans\nCurrent: ${planLabel} (${statusLabel}). Care $39/mo, Comfort $99/mo, Family $199/mo, PAYG $0.15/min.`;
}

function formatLanguageSection(language: PreferredLanguage, isRealtime: boolean): string {
  if (isRealtime) {
    if (language === 'es') return '## Language\nSpeak Spanish. Use formal "usted".';
    if (language === 'auto') return '## Language\nStart English. Switch smoothly if needed.';
    return '## Language\nSpeak English.';
  }

  // Full version
  if (language === 'es') {
    return `## Language\nSpeak in Spanish by default. Use formal "usted" unless they indicate otherwise.\nIf they switch to English, follow their lead smoothly.`;
  }
  if (language === 'auto') {
    return `## Language\nStart in English. If they speak in another language or ask to switch, transition smoothly.\nExample: "Of course—let's speak in Spanish." or "Claro, podemos hablar en español."`;
  }
  return `## Language\nSpeak in English.\nIf they speak in another language, try to accommodate and switch gracefully.`;
}
```

---

## Tool Definitions

**File:** `packages/prompts/src/tools/definitions.ts`

```typescript
import type { GrokTool } from '@ultaura/types';

export const GROK_TOOLS: GrokTool[] = [
  { type: 'web_search' },
  {
    type: 'function',
    name: 'set_reminder',
    description: `Set a reminder for the user. Supports one-time and recurring reminders.

For recurring reminders, parse natural language like:
- "every day at 9am" -> is_recurring: true, frequency: "daily"
- "every 3 days" -> is_recurring: true, frequency: "custom", interval: 3
- "every Monday and Friday at 2pm" -> is_recurring: true, frequency: "weekly", days_of_week: [1, 5]
- "on the 15th of every month" -> is_recurring: true, frequency: "monthly", day_of_month: 15`,
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The reminder message',
        },
        due_at_local: {
          type: 'string',
          description: "First occurrence: ISO 8601 format in user's local time",
        },
        is_recurring: {
          type: 'boolean',
          description: 'Whether this reminder repeats. Default false.',
        },
        frequency: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly', 'custom'],
          description: 'How often the reminder repeats. Required if is_recurring is true.',
        },
        interval: {
          type: 'integer',
          description: 'For custom frequency: repeat every N days. Default 1.',
          minimum: 1,
          maximum: 365,
        },
        days_of_week: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
          description: 'For weekly: days of week (0=Sunday, 6=Saturday)',
        },
        day_of_month: {
          type: 'integer',
          description: 'For monthly: day of month (1-31)',
          minimum: 1,
          maximum: 31,
        },
        ends_at_local: {
          type: 'string',
          description: 'Optional: ISO 8601 date when recurrence ends',
        },
      },
      required: ['message', 'due_at_local'],
    },
  },
  {
    type: 'function',
    name: 'schedule_call',
    description: 'Update the call schedule for the user',
    parameters: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['one_off', 'update_recurring'],
          description: 'Whether to schedule a one-time call or update recurring schedule',
        },
        when: {
          type: 'string',
          description: 'For one_off: ISO 8601 timestamp of when to call',
        },
        days_of_week: {
          type: 'array',
          items: { type: 'integer', minimum: 0, maximum: 6 },
          description: 'For update_recurring: Days of week (0=Sunday, 6=Saturday)',
        },
        time_local: {
          type: 'string',
          description: 'For update_recurring: Time in HH:mm format',
        },
      },
      required: ['mode'],
    },
  },
  {
    type: 'function',
    name: 'store_memory',
    description: `Store something important about the user to remember in future calls.
Call this PROACTIVELY when the user shares personal information.
Do NOT confirm storage verbally - just store silently and continue conversation naturally.`,
    parameters: {
      type: 'object',
      properties: {
        memory_type: {
          type: 'string',
          enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
          description: 'Type of memory',
        },
        key: {
          type: 'string',
          description: 'Semantic key (e.g., "preferred_name", "favorite_hobby")',
        },
        value: {
          type: 'string',
          description: 'The memory content to store',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence level (0-1). Use lower values for inferred information.',
        },
        suggest_reminder: {
          type: 'boolean',
          description: 'For follow_up type: should we suggest creating a reminder?',
        },
      },
      required: ['memory_type', 'key', 'value'],
    },
  },
  {
    type: 'function',
    name: 'update_memory',
    description: `Update an existing memory when the user provides new or corrected information.
Do NOT confirm the update verbally - just update silently and continue.`,
    parameters: {
      type: 'object',
      properties: {
        existing_key: {
          type: 'string',
          description: 'The key of the existing memory to update',
        },
        new_value: {
          type: 'string',
          description: 'The updated memory content',
        },
        memory_type: {
          type: 'string',
          enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
          description: 'Type to use if creating new memory (when key not found)',
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 1,
          description: 'Confidence in the update (0-1)',
        },
      },
      required: ['existing_key', 'new_value'],
    },
  },
  {
    type: 'function',
    name: 'forget_memory',
    description: 'User wants to forget something they previously shared.',
    parameters: {
      type: 'object',
      properties: {
        what_to_forget: {
          type: 'string',
          description: 'Brief description of what to forget',
        },
      },
      required: ['what_to_forget'],
    },
  },
  {
    type: 'function',
    name: 'mark_private',
    description: 'User wants to keep something private from their family.',
    parameters: {
      type: 'object',
      properties: {
        what_to_keep_private: {
          type: 'string',
          description: 'Brief description of what to keep private',
        },
      },
      required: ['what_to_keep_private'],
    },
  },
  {
    type: 'function',
    name: 'log_safety_concern',
    description: `Log when you detect genuine safety concerns during the conversation.

WHEN TO CALL:
- tier: 'high' → User mentions suicide, self-harm, or wanting to die. Action: suggested_988 or suggested_911
- tier: 'medium' → User expresses hopelessness, despair, or "giving up". Action: none or suggested_988
- tier: 'low' → User seems persistently sad, lonely, or isolated. Action: none

IMPORTANT: Call this tool AFTER providing an empathetic response, not before.

DO NOT call for normal sadness, missing loved ones, or everyday frustrations.`,
    parameters: {
      type: 'object',
      properties: {
        tier: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Severity: low=persistent sadness, medium=hopelessness/despair, high=self-harm ideation',
        },
        signals: {
          type: 'string',
          description: 'Brief summary of what concerned you',
        },
        action_taken: {
          type: 'string',
          enum: ['none', 'suggested_988', 'suggested_911'],
          description: 'What action you recommended to the user',
        },
      },
      required: ['tier', 'signals', 'action_taken'],
    },
  },
  {
    type: 'function',
    name: 'request_opt_out',
    description: 'User has requested to stop receiving calls.',
    parameters: {
      type: 'object',
      properties: {
        confirmed: {
          type: 'boolean',
          description: 'Whether the user confirmed they want to opt out',
        },
      },
      required: ['confirmed'],
    },
  },
  {
    type: 'function',
    name: 'choose_overage_action',
    description: 'Record user decision when asked about overage charges or trial expiration',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['continue', 'upgrade', 'stop'],
          description: 'The user choice after the overage or trial prompt',
        },
        plan_id: {
          type: 'string',
          enum: ['care', 'comfort', 'family', 'payg'],
          description: 'Required when action is upgrade',
        },
      },
      required: ['action'],
    },
  },
  {
    type: 'function',
    name: 'request_upgrade',
    description: 'User wants to upgrade their plan or learn about plan options.',
    parameters: {
      type: 'object',
      properties: {
        plan_id: {
          type: 'string',
          enum: ['care', 'comfort', 'family', 'payg'],
          description: 'The plan to upgrade to. If not specified, explain all plans first.',
        },
        send_link: {
          type: 'boolean',
          description: 'Set to true after user confirms to send checkout link via text.',
        },
      },
      required: [],
    },
  },
  {
    type: 'function',
    name: 'list_reminders',
    description: "List the user's upcoming reminders.",
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    type: 'function',
    name: 'edit_reminder',
    description: 'Edit an existing reminder.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to edit',
        },
        new_message: {
          type: 'string',
          description: 'New reminder message (optional)',
        },
        new_time_local: {
          type: 'string',
          description: "New time in ISO 8601 format in user's local time (optional)",
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'pause_reminder',
    description: 'Pause a reminder so it stops firing until resumed.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to pause',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'resume_reminder',
    description: 'Resume a paused reminder.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to resume',
        },
      },
      required: ['reminder_id'],
    },
  },
  {
    type: 'function',
    name: 'snooze_reminder',
    description: 'Snooze a reminder for a specified duration.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to snooze',
        },
        snooze_minutes: {
          type: 'integer',
          enum: [15, 30, 60, 120, 1440],
          description: 'How long to snooze: 15, 30, 60, 120 (2hr), or 1440 (tomorrow)',
        },
      },
      required: ['snooze_minutes'],
    },
  },
  {
    type: 'function',
    name: 'cancel_reminder',
    description: 'Cancel a reminder completely.',
    parameters: {
      type: 'object',
      properties: {
        reminder_id: {
          type: 'string',
          description: 'The ID of the reminder to cancel',
        },
      },
      required: ['reminder_id'],
    },
  },
];
```

---

## Safety Keywords

**File:** `packages/prompts/src/safety/keywords.ts`

```typescript
import type { SafetyTier } from '@ultaura/types';

export const SAFETY_KEYWORDS: Record<SafetyTier, readonly string[]> = {
  high: [
    // English
    'suicide',
    'kill myself',
    'end my life',
    'end it all',
    'want to die',
    'want to kill me',
    'going to kill me',
    'better off dead',
    'hurt myself',
    'harm myself',
    'self-harm',
    'self harm',
    'cut myself',
    "don't want to live",
    'no reason to live',
    'take my own life',
    // Spanish
    'suicidio',
    'matarme',
    'quiero morir',
    'acabar con todo',
  ],
  medium: [
    // English
    'hopeless',
    'give up',
    'giving up',
    'not worth living',
    "what's the point",
    'no point in living',
    "can't go on",
    "can't take it anymore",
    "wish i wasn't here",
    'disappear',
    'nobody would miss me',
    'burden to everyone',
    // Spanish
    'sin esperanza',
    'no vale la pena',
    'rendirme',
  ],
  low: [
    // English
    'so lonely',
    'all alone',
    'nobody cares',
    "don't care anymore",
    'tired of everything',
    'exhausted with life',
    'nothing matters',
    // Spanish
    'muy solo',
    'muy sola',
    'nadie me quiere',
  ],
} as const;
```

**File:** `packages/prompts/src/safety/exclusions.ts`

```typescript
export const SAFETY_EXCLUSION_PATTERNS = [
  // Common false positives
  'killing time',
  'kill for a',
  'killing it',
  'drop dead gorgeous',
  'to die for',
  'dying to',
  'dead tired',
  'dead serious',
  'bored to death',
  'scared to death',
  'hurt feelings',
  'hurt my back',
  'hurt my knee',
  'hurt my leg',
  'hurt my arm',
  // Context exclusions (talking about others/media)
  'movie about',
  'book about',
  'article about',
  'news about',
  'show about',
  'heard about someone',
  'my friend',
  'my neighbor',
  'their friend',
  'his friend',
  'her friend',
] as const;
```

---

## Reminder Prompt Builder

**File:** `packages/prompts/src/builders/reminder.ts`

```typescript
import type { PreferredLanguage } from '@ultaura/types';

export interface ReminderPromptParams {
  userName: string;
  reminderMessage: string;
  language: PreferredLanguage;
}

export function buildReminderPrompt(params: ReminderPromptParams): string {
  const { userName, reminderMessage, language } = params;

  let prompt = `You are Ultaura calling with a quick reminder for ${userName}.

## Your Task
Deliver this reminder: "${reminderMessage}"

## Style
- Keep it brief and friendly (aim for under 30 seconds)
- Greet them warmly by name
- Deliver the reminder clearly
- Ask if they have any quick questions about the reminder
- Say goodbye warmly
- Do NOT try to start a full conversation - this is just a quick reminder call

## Example Flow
"Hello ${userName}, this is Ultaura calling with a quick reminder. ${reminderMessage}. Is there anything you'd like me to help with regarding this? ...Alright, take care and have a wonderful day!"
`;

  // Language instruction
  if (language === 'es') {
    prompt += `\n## Language\nSpeak in Spanish. Use formal "usted" unless they indicate otherwise.`;
  } else if (language === 'auto') {
    prompt += `\n## Language\nStart in English. If they speak another language, switch smoothly.`;
  }

  return prompt;
}
```

---

## Constants (DTMF, Call Messages, etc.)

**File:** `packages/prompts/src/constants.ts`

```typescript
export const DTMF_PROMPTS = {
  REPEAT: "I'll repeat what I just said.",
  SLOWER: "I'll speak more slowly and simply.",
  CHANGE_TOPIC: "Sure, let's talk about something else. What's on your mind?",
  OPT_OUT_CONFIRM: "I understand. Are you sure you don't want to speak with me anymore? Just say yes to confirm, or no if you'd like to continue.",
  OPT_OUT_CONFIRMED: "Okay, I've stopped the scheduled calls. You can always call this number if you change your mind. Take care of yourself.",
  OPT_OUT_CANCELED: "Alright, I'll keep calling as scheduled. I'm glad you want to stay in touch.",
  HELP: 'If you need help with your account or have questions, please contact our support team. Is there anything else I can help you with today?',
} as const;

export const CALL_MESSAGES = {
  UNRECOGNIZED_CALLER: "Hello, this is Ultaura. I don't recognize this phone number. If you'd like to set up phone companionship for yourself or a loved one, please visit our website at ultaura.com. Goodbye.",
  LINE_DISABLED: 'Hello, this phone line is currently disabled. Please contact your family member or caregiver to re-enable it. Goodbye.',
  MINUTES_EXHAUSTED_PAID: 'Hello, your included minutes for this month have been used. Additional calls will be charged as overage. Would you like to continue anyway?',
  OUTBOUND_GREETING: (name: string) => `Hello ${name}, this is Ultaura calling. How are you doing today?`,
  OUTBOUND_NO_ANSWER: "This is Ultaura calling. I'm sorry I missed you. I'll try again later. Take care.",
  GOODBYE: (name: string) => `It was lovely talking with you, ${name}. Take care of yourself, and I'll talk to you again soon. Goodbye.`,
  ERROR_GENERIC: "I'm sorry, I'm having some technical difficulties. Let me try to reconnect.",
  ERROR_DISCONNECT: "I apologize, but I'm experiencing some issues and need to end the call. Please try calling back in a few minutes. Take care.",
} as const;

export const SAFETY_PROMPTS = {
  LOW: "I hear that you're going through a difficult time. Would you like to talk about it?",
  MEDIUM: "I'm concerned about what you're sharing. Have you been able to talk to someone you trust about this?",
  HIGH: "I'm really worried about you right now. The 988 Suicide and Crisis Lifeline is free, confidential, and available 24/7. You can call or text 988 anytime. Would you like me to stay on the line with you?",
  EMERGENCY: 'This sounds like an emergency. Please call 911 right away. Your safety is the most important thing right now.',
} as const;

export const TOOL_PROMPTS = {
  REMINDER_SET: (message: string, time: string) =>
    `I've set a reminder for you: "${message}" at ${time}. I'll call you to remind you.`,
  REMINDER_FAILED: "I'm sorry, I wasn't able to set that reminder. Could you try telling me again?",
  SCHEDULE_UPDATED: (days: string, time: string) =>
    `I've updated your call schedule. I'll call you on ${days} at ${time}.`,
  SCHEDULE_FAILED: "I'm sorry, I wasn't able to update the schedule. Could you try again?",
} as const;

export const TWIML_MESSAGES = {
  CONNECTING: 'Please wait while I connect you.',
  HOLD: 'Please hold for just a moment.',
} as const;
```

---

## Main Package Exports

**File:** `packages/prompts/src/index.ts`

```typescript
// Profile compiler and builders
export { compilePrompt, type PromptProfile, type CompanionPromptParams } from './profiles/index.js';
export { buildReminderPrompt, type ReminderPromptParams } from './builders/reminder.js';

// Golden sections (for direct access if needed)
export { IDENTITY_SECTION } from './golden/sections/identity.js';
export { SAFETY_POLICY_SECTION } from './golden/sections/safety-policy.js';
export { TOOL_POLICY_SECTION } from './golden/sections/tool-policy.js';
export { MEMORY_POLICY_SECTION } from './golden/sections/memory-policy.js';
export { PRIVACY_POLICY_SECTION } from './golden/sections/privacy-policy.js';

// Tools
export { GROK_TOOLS } from './tools/definitions.js';

// Safety
export { SAFETY_KEYWORDS } from './safety/keywords.js';
export { SAFETY_EXCLUSION_PATTERNS } from './safety/exclusions.js';

// Constants
export {
  DTMF_PROMPTS,
  CALL_MESSAGES,
  SAFETY_PROMPTS,
  TOOL_PROMPTS,
  TWIML_MESSAGES,
} from './constants.js';
```

---

## Migration Plan

### Phase 1: Create Package Infrastructure

1. **Create pnpm-workspace.yaml** (if not exists or update):
```yaml
packages:
  - 'packages/*'
  - 'telephony'
```

2. **Create packages/types/ directory structure**
3. **Create packages/prompts/ directory structure**
4. **Add package.json and tsconfig.json to both packages**
5. **Run `pnpm install` to set up workspace links**

### Phase 2: Implement @ultaura/types

1. Create `packages/types/src/index.ts`
2. Move types from `src/lib/ultaura/types.ts`:
   - `PreferredLanguage`
   - `SpanishFormality`
   - `MemoryType`
   - `Memory`
   - `PrivacyScope`
   - `SafetyTier`
   - `GrokTool`
   - `AccountStatus`
   - `PlanId`
3. Build package: `cd packages/types && pnpm build`

### Phase 3: Implement @ultaura/prompts

1. Create golden sections in `packages/prompts/src/golden/sections/`
2. Implement profile compiler in `packages/prompts/src/profiles/`
3. Move safety keywords from `telephony/src/utils/safety-keywords.ts`
4. Move tool definitions from `telephony/src/websocket/grok-bridge.ts`
5. Move constants from `src/lib/ultaura/prompts.ts`
6. Implement reminder prompt builder
7. Build package: `cd packages/prompts && pnpm build`

### Phase 4: Update Telephony Server

1. Add dependencies to `telephony/package.json`:
```json
{
  "dependencies": {
    "@ultaura/types": "workspace:*",
    "@ultaura/prompts": "workspace:*"
  }
}
```

2. Update `telephony/src/websocket/grok-bridge.ts`:
   - Import from `@ultaura/prompts`
   - Replace `buildSystemPrompt()` with `compilePrompt('voice_realtime', params)`
   - Replace `buildReminderPrompt()` with imported version
   - Replace `MEMORY_MANAGEMENT_PROMPT` constant (delete)
   - Replace inline tool definitions with `GROK_TOOLS`

3. Update `telephony/src/utils/safety-keywords.ts`:
   - Re-export from `@ultaura/prompts/safety` or delete and update imports

4. Update `telephony/src/services/safety-state.ts`:
   - Import `SafetyTier` from `@ultaura/types`

### Phase 5: Update Main App

1. Update `src/lib/ultaura/types.ts`:
   - Re-export shared types from `@ultaura/types`
   - Keep app-specific types local

2. Update `src/lib/ultaura/prompts.ts`:
   - Re-export from `@ultaura/prompts`
   - Delete local implementations

3. Update `src/lib/ultaura/constants.ts`:
   - Remove `SAFETY.DISTRESS_KEYWORDS`
   - Import from `@ultaura/prompts` if needed for UI

4. Update `src/lib/ultaura/index.ts`:
   - Update exports

### Phase 6: Cleanup

1. Delete deprecated files:
   - `telephony/src/utils/safety-keywords.ts` (if moved entirely)
   - Inline `MEMORY_MANAGEMENT_PROMPT` from grok-bridge.ts

2. Verify builds:
   - `pnpm build` in packages/types
   - `pnpm build` in packages/prompts
   - `pnpm build` in telephony
   - `pnpm build` in root (Next.js)

3. Verify imports work correctly at runtime

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `pnpm-workspace.yaml` | Add packages/* to workspace |
| Create | `packages/types/package.json` | Package manifest |
| Create | `packages/types/tsconfig.json` | TypeScript config |
| Create | `packages/types/src/*.ts` | Shared type definitions |
| Create | `packages/prompts/package.json` | Package manifest |
| Create | `packages/prompts/tsconfig.json` | TypeScript config |
| Create | `packages/prompts/src/golden/sections/*.ts` | Golden prompt sections |
| Create | `packages/prompts/src/profiles/*.ts` | Profile compiler |
| Create | `packages/prompts/src/builders/*.ts` | Prompt builders |
| Create | `packages/prompts/src/tools/*.ts` | Tool definitions |
| Create | `packages/prompts/src/safety/*.ts` | Safety keywords |
| Create | `packages/prompts/src/constants.ts` | DTMF, call messages |
| Modify | `telephony/package.json` | Add workspace dependencies |
| Modify | `telephony/src/websocket/grok-bridge.ts` | Use shared prompts |
| Modify | `src/lib/ultaura/types.ts` | Re-export from @ultaura/types |
| Modify | `src/lib/ultaura/prompts.ts` | Re-export from @ultaura/prompts |
| Modify | `src/lib/ultaura/constants.ts` | Remove SAFETY.DISTRESS_KEYWORDS |
| Delete | `telephony/src/utils/safety-keywords.ts` | Moved to shared package |

---

## Assumptions

1. pnpm is used as package manager (based on pnpm-lock.yaml in repo)
2. ESM is supported by all consumers (telephony uses NodeNext, Next.js 13+ supports ESM)
3. No external consumers of the telephony package (internal only)
4. Development phase - no backwards compatibility concerns
5. The `voice_realtime` profile target of 800-1200 tokens is sufficient for Grok

---

## Success Criteria

1. Single source of truth: All prompt text lives in `@ultaura/prompts`
2. No duplication: `MEMORY_MANAGEMENT_PROMPT` exists in one place only
3. Profile support: `voice_realtime` profile produces < 1200 tokens
4. Type safety: Shared types prevent drift between web and telephony
5. Clean imports: `import { compilePrompt } from '@ultaura/prompts'`
6. Builds pass: All packages and apps compile successfully
