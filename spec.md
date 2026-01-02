# Memory Writeback System - Implementation Specification

## Overview

This specification details the implementation of a complete memory writeback system for Ultaura's AI voice companion. Currently, the system can READ memories into Grok's prompt but cannot WRITE new memories from conversation. This feature enables persistent personalization - the core value proposition of "it knows me."

### Problem Statement

The memory system has:
- **Encryption infrastructure** - AES-256-GCM envelope encryption (working)
- **Read path** - `getMemoriesForLine()` → `formatMemoriesForPrompt()` → Grok prompt (working)
- **Privacy tools** - `forget_memory`, `mark_private` (working)

But is missing:
- **No `store_memory` tool** - Grok cannot persist memories during calls
- **No `update_memory` tool** - Cannot update existing memories
- **No end-of-call summarization** - No extraction from conversation
- **No ephemeral transcript buffer** - No in-memory conversation storage

### Privacy Posture

This implementation maintains strict privacy:
1. **Ephemeral transcript buffer** - Exists only in server memory during call
2. **Grok turn summaries** - Store distilled summaries, not raw transcription
3. **Encrypted storage** - Only extracted memories are encrypted and persisted
4. **Discard raw text** - All conversation data discarded after memory extraction

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DURING CALL                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  User speaks → Grok processes → Detects memorable info                     │
│                                    ↓                                        │
│                        Calls store_memory/update_memory tool                │
│                                    ↓                                        │
│                        Tool encrypts + stores in DB                         │
│                                    ↓                                        │
│                        Memory context refreshed in Grok                     │
│                                                                             │
│  Simultaneously: Each Grok turn summary added to ephemeral buffer          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Call ends (WebSocket close)
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        END-OF-CALL SUMMARIZATION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Spawn async Promise (non-blocking)                                      │
│  2. Send ephemeral buffer to Grok with extraction prompt                    │
│  3. Grok returns structured memory objects                                  │
│  4. Encrypt and store each memory (skip duplicates)                         │
│  5. Discard ephemeral buffer                                                │
│  6. Log completion                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TELEPHONY SERVER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  GrokBridge     │    │ EphemeralBuffer │    │  MemoryService  │         │
│  │                 │    │                 │    │                 │         │
│  │ - Tool defs     │───▶│ - Turn summaries│    │ - storeMemory() │         │
│  │ - handleToolCall│    │ - 30 min cap    │    │ - updateMemory()│         │
│  │ - refreshMemory │    │ - Per-call scope│    │ - getMemories() │         │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘         │
│           │                      │                      │                   │
│           │                      │                      │                   │
│           ▼                      ▼                      ▼                   │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    Tool Endpoints (/tools/*)                     │       │
│  │                                                                  │       │
│  │  store_memory.ts │ update_memory.ts │ forget_memory.ts │ ...    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                     │                                       │
└─────────────────────────────────────┼───────────────────────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │    Supabase     │
                            │                 │
                            │ ultaura_memories│
                            │ (encrypted)     │
                            └─────────────────┘
```

---

## Database Changes

### Migration: Add New Memory Types

**File:** `supabase/migrations/YYYYMMDDHHMMSS_add_memory_types.sql`

```sql
-- Add new memory types to the enum
-- PostgreSQL ALTER TYPE ... ADD VALUE is safe and non-blocking

ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'context';
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'history';
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'wellbeing';

-- Add index for faster memory lookups during refresh
CREATE INDEX IF NOT EXISTS idx_ultaura_memories_line_updated
  ON ultaura_memories (line_id, updated_at DESC)
  WHERE active = true;

COMMENT ON TYPE ultaura_memory_type IS 'Memory categories:
  fact - Personal information (name, family, pets, location)
  preference - Likes/dislikes, interests, habits
  follow_up - Things to ask about in future calls
  context - Living situation, environment, daily patterns
  history - Past experiences, stories shared
  wellbeing - Non-medical wellness observations';
```

### Memory Type Definitions

| Type | Description | Example Keys | Example Values |
|------|-------------|--------------|----------------|
| `fact` | Personal information | `preferred_name`, `family_members`, `pets`, `location` | "John", "daughter Sarah, son Mike", "dog Max" |
| `preference` | Likes/dislikes | `interests`, `topics_to_avoid`, `call_time_preference` | "gardening, jazz music", "politics", "mornings" |
| `follow_up` | Future conversation topics | `upcoming_events`, `health_appointment`, `family_visit` | "grandson's birthday next week", "doctor Tuesday" |
| `context` | Living situation/environment | `living_situation`, `mobility`, `assistance_level` | "lives alone", "uses walker", "daughter visits daily" |
| `history` | Past experiences shared | `career`, `life_story`, `memorable_events` | "retired teacher", "lived in Paris in 1960s" |
| `wellbeing` | Non-medical wellness notes | `energy_level`, `sleep_quality`, `mood_pattern` | "more tired lately", "sleeping better", "cheerful today" |

---

## Implementation Details

### 1. Ephemeral Transcript Buffer

**File:** `telephony/src/services/ephemeral-buffer.ts`

```typescript
interface TurnSummary {
  timestamp: number;
  speaker: 'user' | 'assistant';
  summary: string;        // Distilled content, not raw text
  intent?: string;        // Detected intent (question, statement, request)
  entities?: string[];    // Extracted entities (names, dates, topics)
}

interface EphemeralBuffer {
  callSessionId: string;
  lineId: string;
  accountId: string;
  startTime: number;
  turns: TurnSummary[];
}

// In-memory Map, keyed by callSessionId
const buffers = new Map<string, EphemeralBuffer>();

const MAX_BUFFER_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS = 200; // Safety limit

export function createBuffer(callSessionId: string, lineId: string, accountId: string): void;
export function addTurn(callSessionId: string, turn: TurnSummary): void;
export function getBuffer(callSessionId: string): EphemeralBuffer | null;
export function clearBuffer(callSessionId: string): EphemeralBuffer | null; // Returns buffer before clearing
export function pruneOldTurns(callSessionId: string): void; // Remove turns > 30 min old
```

**Key Implementation Notes:**
- Buffer exists only in process memory - never persisted
- Automatically pruned when turns exceed 30-minute window
- `clearBuffer()` returns the buffer for final extraction before deletion
- If server crashes, buffers are lost (acceptable per privacy requirements)

### 2. Store Memory Tool

**File:** `telephony/src/routes/tools/store-memory.ts`

**Tool Definition (add to grok-bridge.ts tools array):**

```typescript
{
  type: 'function',
  name: 'store_memory',
  description: `Store something important about the user to remember in future calls.
Call this PROACTIVELY when the user shares personal information. Examples:
- "My name is..." or "Call me..."
- "I have three grandchildren"
- "I love gardening" or "I enjoy..."
- "I used to be a teacher"
- "My daughter visits on Sundays"
- "I have a doctor appointment next week"

Do NOT confirm storage verbally - just store silently and continue conversation naturally.`,
  parameters: {
    type: 'object',
    properties: {
      memory_type: {
        type: 'string',
        enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
        description: `Type of memory:
- fact: Personal info (name, family, pets, location)
- preference: Likes/dislikes, interests
- follow_up: Things to ask about later
- context: Living situation, environment
- history: Past experiences, life stories
- wellbeing: Wellness observations (energy, mood)`
      },
      key: {
        type: 'string',
        description: 'Semantic key for the memory (e.g., "preferred_name", "favorite_hobby", "upcoming_surgery")'
      },
      value: {
        type: 'string',
        description: 'The memory content to store'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence level (0-1). Use lower values for inferred information.'
      },
      suggest_reminder: {
        type: 'boolean',
        description: 'For follow_up type: should we suggest creating a reminder for this?'
      }
    },
    required: ['memory_type', 'key', 'value']
  }
}
```

**Handler Implementation:**

```typescript
// POST /tools/store_memory
export const storeMemoryRouter = Router();

storeMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const {
      callSessionId,
      lineId,
      accountId,
      memoryType,
      key,
      value,
      confidence = 1.0,
      suggestReminder = false
    } = req.body;

    // Validation
    if (!callSessionId || !lineId || !accountId || !memoryType || !key || !value) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate call session exists
    const session = await getCallSession(callSessionId);
    if (!session) {
      return res.status(404).json({ error: 'Call session not found' });
    }

    // Store encrypted memory
    const memoryId = await storeMemory(accountId, lineId, memoryType, key, value, {
      confidence,
      source: 'conversation',
      privacyScope: 'line_only', // Default to private
    });

    if (!memoryId) {
      return res.status(500).json({ error: 'Failed to store memory' });
    }

    // Record tool invocation for analytics
    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'store_memory',
      memoryId,
      key,
      type: memoryType,
    });

    logger.info({ memoryId, key, type: memoryType, callSessionId }, 'Memory stored');

    // Build response
    const response: StoreMemoryResponse = {
      success: true,
      memoryId,
      refreshed: false, // Will be set by refresh logic
    };

    // For follow_up type with suggest_reminder, include suggestion
    if (memoryType === 'follow_up' && suggestReminder) {
      response.suggestReminder = true;
      response.reminderSuggestion = `Would you like me to set a reminder about this?`;
    }

    res.json(response);
  } catch (error) {
    logger.error({ error }, 'Error storing memory');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 3. Update Memory Tool

**File:** `telephony/src/routes/tools/update-memory.ts`

**Tool Definition:**

```typescript
{
  type: 'function',
  name: 'update_memory',
  description: `Update an existing memory when the user provides new or corrected information.
Use this when:
- User corrects previous info: "Actually, I have FOUR grandchildren, not three"
- Information has changed: "I moved to a new apartment"
- Adding to existing memory: "I also like jazz, not just classical"

Do NOT confirm the update verbally - just update silently and continue.`,
  parameters: {
    type: 'object',
    properties: {
      existing_key: {
        type: 'string',
        description: 'The key of the existing memory to update'
      },
      new_value: {
        type: 'string',
        description: 'The updated memory content'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
        description: 'Confidence in the update (0-1)'
      }
    },
    required: ['existing_key', 'new_value']
  }
}
```

**Handler Implementation:**

```typescript
// POST /tools/update_memory
export const updateMemoryRouter = Router();

updateMemoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, accountId, existingKey, newValue, confidence = 1.0 } = req.body;

    // Find existing memory by key
    const memories = await getMemoriesForLine(accountId, lineId, { limit: 100 });
    const existingMemory = memories.find(m => m.key === existingKey);

    if (!existingMemory) {
      // If no existing memory, store as new
      logger.info({ key: existingKey }, 'No existing memory found, creating new');
      const memoryId = await storeMemory(accountId, lineId, 'fact', existingKey, newValue, {
        confidence,
        source: 'conversation',
        privacyScope: 'line_only',
      });

      return res.json({
        success: true,
        memoryId,
        action: 'created',
      });
    }

    // Update existing memory (creates new version, deactivates old)
    const success = await updateMemory(accountId, lineId, existingMemory.id, newValue);

    if (!success) {
      return res.status(500).json({ error: 'Failed to update memory' });
    }

    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'update_memory',
      key: existingKey,
      previousValue: existingMemory.value,
      newValue,
    });

    logger.info({ key: existingKey, callSessionId }, 'Memory updated');

    res.json({
      success: true,
      memoryId: existingMemory.id,
      action: 'updated',
    });
  } catch (error) {
    logger.error({ error }, 'Error updating memory');
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 4. Same-Call Memory Refresh

**File:** `telephony/src/websocket/grok-bridge.ts` (modify existing)

After any successful memory store/update, refresh the memory context in Grok's session:

```typescript
// Add to GrokBridge class
private async refreshMemoryContext(): Promise<void> {
  try {
    // Fetch updated memories
    const memories = await getMemoriesForLine(
      this.options.accountId,
      this.options.lineId,
      { limit: 50 }
    );
    const memoryText = formatMemoriesForPrompt(memories);

    // Update session with new memory context
    // This sends a session.update message to Grok
    this.sendMessage({
      type: 'session.update',
      session: {
        instructions: this.buildSystemPrompt({
          ...this.options,
          memories: memoryText,
        }),
      },
    });

    logger.debug({ lineId: this.options.lineId }, 'Memory context refreshed');
  } catch (error) {
    // Silent continue on error - graceful degradation
    logger.warn({ error }, 'Failed to refresh memory context, continuing without refresh');
  }
}

// Modify handleToolCall to refresh after memory operations
private async handleToolCall(callId: string, name: string, argsJson: string): Promise<void> {
  // ... existing tool handling ...

  // After store_memory or update_memory, refresh context
  if (name === 'store_memory' || name === 'update_memory') {
    // Non-blocking refresh
    this.refreshMemoryContext().catch(err => {
      logger.warn({ error: err }, 'Memory refresh failed');
    });
  }

  // ... rest of method ...
}
```

### 5. End-of-Call Summarization

**File:** `telephony/src/services/call-summarization.ts`

```typescript
import { getBuffer, clearBuffer } from './ephemeral-buffer.js';
import { storeMemory, getMemoriesForLine } from './memory.js';
import { logger } from '../server.js';

interface ExtractedMemory {
  type: 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing';
  key: string;
  value: string;
  confidence: number;
}

const EXTRACTION_PROMPT = `You are analyzing a conversation summary to extract memorable information about the user.

Review the conversation turns below and extract any important information worth remembering for future calls.

For each memory, provide:
- type: fact | preference | follow_up | context | history | wellbeing
- key: semantic identifier (snake_case)
- value: the information to remember
- confidence: 0-1 how confident you are this is accurate

IMPORTANT:
- Only extract genuinely useful information, not small talk
- Skip anything that was already stored during the call (marked as [STORED])
- Focus on things that would help personalize future conversations
- For follow_ups, include time context if mentioned

Respond with JSON array only, no explanation:
[{"type": "...", "key": "...", "value": "...", "confidence": 0.9}, ...]

If nothing worth storing, respond with: []

CONVERSATION TURNS:
`;

export async function summarizeAndExtractMemories(callSessionId: string): Promise<void> {
  const buffer = clearBuffer(callSessionId);

  if (!buffer || buffer.turns.length === 0) {
    logger.debug({ callSessionId }, 'No conversation buffer to summarize');
    return;
  }

  try {
    // Format turns for extraction
    const turnText = buffer.turns
      .map(t => `[${t.speaker.toUpperCase()}] ${t.summary}`)
      .join('\n');

    // Get existing memories to avoid duplicates
    const existingMemories = await getMemoriesForLine(buffer.accountId, buffer.lineId, { limit: 100 });
    const existingKeys = new Set(existingMemories.map(m => m.key));

    // Call Grok for extraction (using separate API call, not in-call session)
    const extractedMemories = await extractMemoriesWithGrok(turnText);

    // Store each extracted memory, skipping duplicates
    let storedCount = 0;
    for (const memory of extractedMemories) {
      if (existingKeys.has(memory.key)) {
        logger.debug({ key: memory.key }, 'Skipping duplicate memory key');
        continue;
      }

      try {
        await storeMemory(
          buffer.accountId,
          buffer.lineId,
          memory.type,
          memory.key,
          memory.value,
          {
            confidence: memory.confidence,
            source: 'conversation',
            privacyScope: 'line_only',
          }
        );
        storedCount++;
      } catch (err) {
        logger.warn({ error: err, key: memory.key }, 'Failed to store extracted memory');
      }
    }

    logger.info({
      callSessionId,
      turnsProcessed: buffer.turns.length,
      memoriesExtracted: extractedMemories.length,
      memoriesStored: storedCount,
    }, 'End-of-call summarization complete');

  } catch (error) {
    logger.error({ error, callSessionId }, 'End-of-call summarization failed');
    // Buffer is already cleared - data is lost, which is acceptable
  }
}

async function extractMemoriesWithGrok(turnText: string): Promise<ExtractedMemory[]> {
  // Use xAI API directly (not realtime) for extraction
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.XAI_GROK_MODEL || 'grok-3-fast',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: turnText },
      ],
      temperature: 0.3, // Lower temperature for consistent extraction
    }),
  });

  if (!response.ok) {
    throw new Error(`Grok API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content || '[]';

  try {
    return JSON.parse(content);
  } catch {
    logger.warn({ content }, 'Failed to parse extraction response as JSON');
    return [];
  }
}
```

### 6. Integration with Call Lifecycle

**File:** `telephony/src/websocket/media-stream.ts` (modify existing)

```typescript
// At call start - create ephemeral buffer
ws.on('message', async (data) => {
  const message = JSON.parse(data.toString());

  if (message.event === 'start') {
    // ... existing start handling ...

    // Create ephemeral buffer for this call
    createBuffer(callSessionId, line.id, account.id);

    // ... rest of start handling ...
  }
});

// Track conversation turns
// Add this to GrokBridge when receiving Grok responses
private handleGrokResponse(message: GrokMessage): void {
  // ... existing handling ...

  if (message.type === 'response.done') {
    // Add turn summary to ephemeral buffer
    addTurn(this.options.callSessionId, {
      timestamp: Date.now(),
      speaker: 'assistant',
      summary: this.extractTurnSummary(message),
      intent: this.detectIntent(message),
      entities: this.extractEntities(message),
    });
  }
}

// On call end - trigger summarization
ws.on('close', async (code, reason) => {
  // ... existing cleanup ...

  // Spawn async summarization (non-blocking)
  summarizeAndExtractMemories(callSessionId).catch(err => {
    logger.error({ error: err, callSessionId }, 'Background summarization failed');
  });

  // ... rest of close handling ...
});
```

### 7. Route Registration

**File:** `telephony/src/routes/tools/index.ts` (modify existing)

```typescript
import { Router } from 'express';
import { setReminderRouter } from './set-reminder.js';
import { storeMemoryRouter } from './store-memory.js';
import { updateMemoryRouter } from './update-memory.js';
import { forgetMemoryRouter } from './forget-memory.js';
import { markPrivateRouter } from './mark-private.js';
// ... other imports ...

export const toolsRouter = Router();

// Memory tools
toolsRouter.use('/store_memory', storeMemoryRouter);
toolsRouter.use('/update_memory', updateMemoryRouter);
toolsRouter.use('/forget_memory', forgetMemoryRouter);
toolsRouter.use('/mark_private', markPrivateRouter);

// ... other routes ...
```

### 8. GrokBridge Tool Call Routing

**File:** `telephony/src/websocket/grok-bridge.ts` (modify handleToolCall switch)

```typescript
case 'store_memory':
  result = await this.callToolEndpoint(`${baseUrl}/tools/store_memory`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    accountId: this.options.accountId,
    memoryType: args.memory_type,
    key: args.key,
    value: args.value,
    confidence: args.confidence || 1.0,
    suggestReminder: args.suggest_reminder || false,
  });
  break;

case 'update_memory':
  result = await this.callToolEndpoint(`${baseUrl}/tools/update_memory`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    accountId: this.options.accountId,
    existingKey: args.existing_key,
    newValue: args.new_value,
    confidence: args.confidence || 1.0,
  });
  break;
```

---

## System Prompt Updates

**File:** `telephony/src/websocket/grok-bridge.ts` (modify buildSystemPrompt)

Add memory storage instructions to the system prompt:

```typescript
// Add to system prompt after existing memory section

## Memory Management

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
2. Say: "I'll remember that. Would you like me to give you a reminder call before your appointment?"
```

---

## File Structure Summary

### New Files

```
telephony/src/
├── services/
│   ├── ephemeral-buffer.ts      # In-memory conversation buffer
│   └── call-summarization.ts    # End-of-call memory extraction
├── routes/tools/
│   ├── store-memory.ts          # POST /tools/store_memory
│   └── update-memory.ts         # POST /tools/update_memory
```

### Modified Files

```
telephony/src/
├── websocket/
│   ├── grok-bridge.ts           # Add tool definitions, refresh logic, turn tracking
│   └── media-stream.ts          # Create/clear buffer, trigger summarization
├── routes/tools/
│   └── index.ts                 # Register new routes
├── services/
│   └── memory.ts                # Already has storeMemory/updateMemory (no changes needed)

supabase/migrations/
└── YYYYMMDDHHMMSS_add_memory_types.sql  # Add new enum values
```

---

## Implementation Order

### Phase 1: Foundation (Required First)
1. Create database migration for new memory types
2. Create `ephemeral-buffer.ts` service
3. Run migration

### Phase 2: Real-Time Tools
4. Create `store-memory.ts` route handler
5. Create `update-memory.ts` route handler
6. Register routes in `index.ts`
7. Add tool definitions to `grok-bridge.ts`
8. Add tool call routing in `handleToolCall()`
9. Implement memory context refresh in `GrokBridge`

### Phase 3: End-of-Call Summarization
10. Create `call-summarization.ts` service
11. Integrate buffer creation in `media-stream.ts` on call start
12. Add turn tracking to `GrokBridge`
13. Trigger summarization on WebSocket close

### Phase 4: System Prompt & Polish
14. Update system prompt with memory management instructions
15. Update memory formatting to include new types
16. Add logging and monitoring

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| store_memory fails | Return error to Grok, it continues without confirmation |
| update_memory can't find key | Create new memory instead |
| Memory refresh fails | Log warning, continue without refresh (graceful degradation) |
| End-of-call extraction fails | Log error, buffer already cleared (data loss acceptable) |
| Grok API error during extraction | Log error, skip extraction for this call |
| Server crash during call | Buffer lost, no memories stored (privacy-preserving) |

---

## Security Considerations

1. **Encryption**: All memories encrypted with AES-256-GCM before storage
2. **AAD Binding**: Additional Authenticated Data includes account_id, line_id, memory_id
3. **Privacy Scope**: Default to `line_only` for conversation-sourced memories
4. **No Raw Storage**: Ephemeral buffer never persisted to database
5. **Soft Deletes**: forget_memory deactivates rather than hard deletes
6. **Service Role**: Memory tables have no RLS policies - service role only access

---

## Monitoring & Observability

### Logging Points

```typescript
// Successful memory storage
logger.info({ memoryId, key, type, callSessionId }, 'Memory stored');

// Memory update
logger.info({ key, callSessionId }, 'Memory updated');

// Refresh success
logger.debug({ lineId }, 'Memory context refreshed');

// Refresh failure (warning, not error)
logger.warn({ error }, 'Failed to refresh memory context');

// End-of-call summarization
logger.info({
  callSessionId,
  turnsProcessed,
  memoriesExtracted,
  memoriesStored,
}, 'End-of-call summarization complete');
```

### Metrics to Track

- `ultaura.memories.stored` - Counter of memories stored per call
- `ultaura.memories.updated` - Counter of memory updates
- `ultaura.memories.refresh_failures` - Counter of refresh failures
- `ultaura.summarization.duration_ms` - Histogram of summarization time
- `ultaura.summarization.memories_extracted` - Histogram of memories per call

---

## Success Criteria

1. **Real-time storage works**: User says "My name is John" → memory stored within 2 seconds
2. **Updates work**: User says "Actually, it's Johnny" → previous memory updated
3. **Same-call refresh**: New memories available in conversation context immediately
4. **End-of-call extraction**: Additional memories extracted from conversation summary
5. **Privacy maintained**: No raw transcripts persisted, only encrypted memories
6. **Graceful degradation**: Failures logged but don't crash calls
7. **Silent operation**: No awkward "I'll remember that" confirmations

---

## Dependencies

### Existing (No Changes)
- `telephony/src/utils/encryption.ts` - Encryption utilities
- `telephony/src/services/memory.ts` - Memory CRUD (storeMemory, updateMemory already exist)
- Supabase client configuration
- xAI API key and endpoint

### Environment Variables (Existing)
- `XAI_API_KEY` - For Grok API calls
- `XAI_GROK_MODEL` - Model to use (default: grok-3-fast)
- `MEMORY_ENCRYPTION_KEY` - KEK for envelope encryption (64 hex characters)
- `TELEPHONY_BACKEND_URL` - For tool endpoint calls

---

## Implementation Clarifications

This section provides detailed answers to implementation questions.

### 1. Turn Summaries - Deriving TurnSummary Fields

**Track BOTH user and assistant turns.**

**User turns:**
- Source: Grok Realtime API sends `input_audio_buffer.speech_started` and `input_audio_buffer.committed` events
- For user speech, Grok provides transcription in `conversation.item.input_audio_transcription.completed` message
- Extract `summary` from the transcription text
- `intent`: Infer from content (question if ends with ?, request if contains "can you", "please", etc.)
- `entities`: Simple regex extraction for names, dates, numbers

**Assistant turns:**
- Source: `response.done` message from Grok contains the complete response
- `summary`: Extract from `response.output[].content[].transcript` (the text Grok spoke)
- `intent`: Usually 'response' or 'question' based on content
- `entities`: Extract any mentioned names, dates, topics

**Example extraction in GrokBridge:**

```typescript
private extractUserTurn(transcription: string): TurnSummary {
  return {
    timestamp: Date.now(),
    speaker: 'user',
    summary: transcription.slice(0, 500), // Truncate long utterances
    intent: this.inferIntent(transcription),
    entities: this.extractEntities(transcription),
  };
}

private extractAssistantTurn(response: GrokResponseDone): TurnSummary {
  const transcript = response.output
    ?.find(o => o.type === 'message')
    ?.content?.find(c => c.type === 'audio')
    ?.transcript || '';

  return {
    timestamp: Date.now(),
    speaker: 'assistant',
    summary: transcript.slice(0, 500),
    intent: 'response',
    entities: this.extractEntities(transcript),
  };
}

private inferIntent(text: string): string {
  if (text.includes('?')) return 'question';
  if (/\b(can you|please|could you|would you)\b/i.test(text)) return 'request';
  return 'statement';
}

private extractEntities(text: string): string[] {
  const entities: string[] = [];
  // Names (capitalized words)
  const names = text.match(/\b[A-Z][a-z]+\b/g);
  if (names) entities.push(...names.slice(0, 5));
  // Dates
  const dates = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)\b/gi);
  if (dates) entities.push(...dates);
  return [...new Set(entities)];
}
```

### 2. Stored Keys Tracking (Preventing Duplicate Extraction)

**Approach: Track stored keys in a Set per call session.**

Add to `EphemeralBuffer` interface:

```typescript
interface EphemeralBuffer {
  callSessionId: string;
  lineId: string;
  accountId: string;
  startTime: number;
  turns: TurnSummary[];
  storedKeys: Set<string>;  // Keys stored during this call
}
```

**When to add to storedKeys:**
- In `store-memory.ts` handler, after successful storage, call:
  ```typescript
  addStoredKey(callSessionId, key);
  ```

- In `update-memory.ts` handler, after successful update, call:
  ```typescript
  addStoredKey(callSessionId, existingKey);
  ```

**In call-summarization.ts, skip stored keys:**

```typescript
// Get keys stored during this call
const storedDuringCall = buffer.storedKeys;

// Skip both existing DB keys AND keys stored during call
for (const memory of extractedMemories) {
  const keyLower = memory.key.toLowerCase();
  if (existingKeys.has(keyLower) || storedDuringCall.has(keyLower)) {
    logger.debug({ key: memory.key }, 'Skipping already-stored memory key');
    continue;
  }
  // ... store memory ...
}
```

### 3. Buffer Pruning Strategy

**Strategy: Drop oldest turns when limits exceeded.**

Implement in `addTurn()`:

```typescript
export function addTurn(callSessionId: string, turn: TurnSummary): void {
  const buffer = buffers.get(callSessionId);
  if (!buffer) return;

  buffer.turns.push(turn);

  // Prune by count
  while (buffer.turns.length > MAX_TURNS) {
    buffer.turns.shift(); // Remove oldest
  }

  // Prune by time (30 min window)
  const cutoff = Date.now() - MAX_BUFFER_DURATION_MS;
  while (buffer.turns.length > 0 && buffer.turns[0].timestamp < cutoff) {
    buffer.turns.shift();
  }
}
```

Pruning is **automatic inside addTurn** - no separate prune call needed.

### 4. When to Run End-of-Call Summarization

**Conditions:**
1. Call was successfully connected (reached `in_progress` status)
2. Call lasted at least 30 seconds
3. NOT a reminder call (`isReminderCall === false`)

**In media-stream.ts close handler:**

```typescript
ws.on('close', async (code, reason) => {
  // ... existing cleanup ...

  // Only summarize if:
  // 1. Call was connected (isConnected flag)
  // 2. Duration >= 30 seconds
  // 3. Not a reminder call
  const duration = session?.connectedAt
    ? Date.now() - new Date(session.connectedAt).getTime()
    : 0;

  const shouldSummarize =
    isConnected &&
    duration >= 30000 &&
    !session?.isReminderCall;

  if (shouldSummarize) {
    summarizeAndExtractMemories(callSessionId).catch(err => {
      logger.error({ error: err, callSessionId }, 'Background summarization failed');
    });
  } else {
    // Just clear the buffer without extraction
    clearBuffer(callSessionId);
    logger.debug({ callSessionId, duration, isReminderCall: session?.isReminderCall },
      'Skipping summarization');
  }

  // ... rest of close handling ...
});
```

### 5. Duplication Rules for End-of-Call Extraction

**Skip by key against active memories only (case-insensitive).**

```typescript
// In call-summarization.ts
const existingMemories = await getMemoriesForLine(buffer.accountId, buffer.lineId, { limit: 100 });
// Create case-insensitive Set
const existingKeys = new Set(existingMemories.map(m => m.key.toLowerCase()));
const storedDuringCall = new Set([...buffer.storedKeys].map(k => k.toLowerCase()));

for (const memory of extractedMemories) {
  const keyLower = memory.key.toLowerCase();

  // Skip if key exists (active memories or stored during call)
  if (existingKeys.has(keyLower) || storedDuringCall.has(keyLower)) {
    continue;
  }

  // Store as new - never update existing during extraction
  await storeMemory(...);
}
```

**Never update existing memories during extraction** - only skip or create new. Updates should only happen via the real-time `update_memory` tool.

### 6. Tool Response Payloads

**store_memory response:**

```typescript
interface StoreMemoryResponse {
  success: boolean;
  memoryId?: string;           // UUID of stored memory
  error?: string;              // Error message if failed
  // Optional message for edge cases (suggest_reminder)
  message?: string;            // e.g., "Would you like me to set a reminder?"
  suggestReminder?: boolean;   // True if follow_up with suggest_reminder=true
}

// Example success (normal - silent storage):
{ success: true, memoryId: "uuid-here" }

// Example with reminder suggestion:
{
  success: true,
  memoryId: "uuid-here",
  suggestReminder: true,
  message: "Would you like me to set a reminder about this?"
}

// Example error:
{ success: false, error: "Missing required fields" }
```

**update_memory response:**

```typescript
interface UpdateMemoryResponse {
  success: boolean;
  memoryId?: string;           // UUID of memory (new or updated)
  action?: 'updated' | 'created';  // What happened
  error?: string;
}

// Example update:
{ success: true, memoryId: "uuid-here", action: "updated" }

// Example create (key not found):
{ success: true, memoryId: "uuid-here", action: "created" }
```

### 7. Update Tool Type Fallback

**Add optional `memory_type` parameter to update_memory tool.**

Updated tool definition:

```typescript
{
  type: 'function',
  name: 'update_memory',
  description: `Update an existing memory...`,
  parameters: {
    type: 'object',
    properties: {
      existing_key: {
        type: 'string',
        description: 'The key of the existing memory to update'
      },
      new_value: {
        type: 'string',
        description: 'The updated memory content'
      },
      memory_type: {
        type: 'string',
        enum: ['fact', 'preference', 'follow_up', 'context', 'history', 'wellbeing'],
        description: 'Type to use if creating new memory (when key not found). Defaults to fact.'
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1,
      }
    },
    required: ['existing_key', 'new_value']
  }
}
```

**Key matching is CASE-INSENSITIVE:**

```typescript
// In update-memory.ts handler
const existingMemory = memories.find(
  m => m.key.toLowerCase() === existingKey.toLowerCase()
);

if (!existingMemory) {
  // Use provided type or default to 'fact'
  const memoryType = req.body.memoryType || 'fact';
  const memoryId = await storeMemory(accountId, lineId, memoryType, existingKey, newValue, ...);
  return res.json({ success: true, memoryId, action: 'created' });
}
```

### 8. Memory Refresh Scope

**Refresh ONLY after real-time store/update tool calls, NOT after end-of-call extraction.**

End-of-call extraction happens after the WebSocket is closed - there's no live Grok session to refresh. The new memories will be available on the next call.

```typescript
// In GrokBridge.handleToolCall():
if (name === 'store_memory' || name === 'update_memory') {
  // Refresh context for current call
  this.refreshMemoryContext().catch(err => {
    logger.warn({ error: err }, 'Memory refresh failed');
  });
}

// In call-summarization.ts:
// NO refresh - call is already ended, memories available next call
```

### 9. Migration File Naming

**Use current date: `20260102000001_add_memory_types.sql`**

Following the existing pattern with today's date.

### 10. TypeScript Types Sync

**Recommended: Run Supabase type generation after migration.**

```bash
# After running the migration
npx supabase gen types typescript --local > src/lib/database.types.ts
```

Then manually update the union type in `src/lib/ultaura/types.ts`:

```typescript
// Before
type MemoryType = 'fact' | 'preference' | 'follow_up';

// After
type MemoryType = 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing';
```

### 11. System Prompt Location

**Both locations:**
- Constants in `src/lib/ultaura/prompts.ts` for consistency
- Assembled dynamically in `telephony/src/websocket/grok-bridge.ts`

Add to `prompts.ts`:

```typescript
export const MEMORY_MANAGEMENT_PROMPT = `## Memory Management

You have the ability to remember things about the user for future calls...
[full prompt content]`;
```

In `grok-bridge.ts`:

```typescript
import { MEMORY_MANAGEMENT_PROMPT } from '../../../src/lib/ultaura/prompts.js';

// In buildSystemPrompt:
${MEMORY_MANAGEMENT_PROMPT}
```

### 12. Encryption Environment Variable

**Use existing: `MEMORY_ENCRYPTION_KEY`** (64 hex characters)

This is what `encryption.ts` already expects. The `ULTAURA_KEK_BASE64` in `.env.ultaura.example` appears to be a documentation inconsistency - update the example file to match the code:

```bash
# .env.ultaura.example - update comment:
# Memory Encryption Key (64 hex characters = 256 bits)
MEMORY_ENCRYPTION_KEY=
```

### 13. Grok Extraction API Call

**30-second timeout, no retry. Skip silently if API key missing.**

```typescript
async function extractMemoriesWithGrok(turnText: string): Promise<ExtractedMemory[]> {
  // Skip silently if no API key
  if (!process.env.XAI_API_KEY) {
    return [];
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.XAI_GROK_MODEL || 'grok-3-fast',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: turnText },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Grok extraction API error');
      return [];
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || '[]';

    return JSON.parse(content);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.warn('Grok extraction timed out after 30s');
    } else {
      logger.warn({ error }, 'Grok extraction failed');
    }
    return [];
  }
}
```

### 14. Call Event Logging

**Use existing `recordCallEvent` with `tool_call` type - no new event types needed.**

The existing logging is sufficient:

```typescript
// Already in store-memory.ts:
await recordCallEvent(callSessionId, 'tool_call', {
  tool: 'store_memory',
  memoryId,
  key,
  type: memoryType,
});

// Already in update-memory.ts:
await recordCallEvent(callSessionId, 'tool_call', {
  tool: 'update_memory',
  key: existingKey,
  previousValue: existingMemory.value,
  newValue,
});
```

For end-of-call summarization, just use logger (not call events, since session is closed):

```typescript
logger.info({
  callSessionId,
  turnsProcessed: buffer.turns.length,
  memoriesExtracted: extractedMemories.length,
  memoriesStored: storedCount,
}, 'End-of-call summarization complete');
```

---

## Complete EphemeralBuffer Interface

Updated interface incorporating all clarifications:

```typescript
// telephony/src/services/ephemeral-buffer.ts

interface TurnSummary {
  timestamp: number;
  speaker: 'user' | 'assistant';
  summary: string;
  intent?: string;
  entities?: string[];
}

interface EphemeralBuffer {
  callSessionId: string;
  lineId: string;
  accountId: string;
  startTime: number;
  turns: TurnSummary[];
  storedKeys: Set<string>;  // Track keys stored during this call
}

const buffers = new Map<string, EphemeralBuffer>();

const MAX_BUFFER_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const MAX_TURNS = 200;

export function createBuffer(callSessionId: string, lineId: string, accountId: string): void {
  buffers.set(callSessionId, {
    callSessionId,
    lineId,
    accountId,
    startTime: Date.now(),
    turns: [],
    storedKeys: new Set(),
  });
}

export function addTurn(callSessionId: string, turn: TurnSummary): void {
  const buffer = buffers.get(callSessionId);
  if (!buffer) return;

  buffer.turns.push(turn);

  // Auto-prune by count
  while (buffer.turns.length > MAX_TURNS) {
    buffer.turns.shift();
  }

  // Auto-prune by time
  const cutoff = Date.now() - MAX_BUFFER_DURATION_MS;
  while (buffer.turns.length > 0 && buffer.turns[0].timestamp < cutoff) {
    buffer.turns.shift();
  }
}

export function addStoredKey(callSessionId: string, key: string): void {
  const buffer = buffers.get(callSessionId);
  if (buffer) {
    buffer.storedKeys.add(key.toLowerCase());
  }
}

export function getBuffer(callSessionId: string): EphemeralBuffer | null {
  return buffers.get(callSessionId) || null;
}

export function clearBuffer(callSessionId: string): EphemeralBuffer | null {
  const buffer = buffers.get(callSessionId);
  buffers.delete(callSessionId);
  return buffer || null;
}
```
