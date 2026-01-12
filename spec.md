# Ultaura Memory System Improvements Specification

## Executive Summary

This specification outlines comprehensive improvements to Ultaura's memory system, an AI voice companion for seniors. The current implementation has six key limitations that this spec addresses:

1. **Primitive Text Matching**: Memory operations use basic substring matching
2. **Binary Consent Model**: Only pending/granted/denied for all memories
3. **Limited Memory Categories**: Only 6 types (fact, preference, follow_up, context, history, wellbeing)
4. **No Memory Decay**: All memories treated equally regardless of age/usage
5. **Single DEK Per Account**: One encryption key shared across all lines
6. **No Cross-Line Sharing**: Each line's memories completely isolated (keeping this by design)

---

## 1. Goals and Non-Goals

### Goals

- Replace primitive substring matching with semantic similarity search using embeddings
- Add topic exclusion categories controllable only by seniors via voice
- Introduce relationship, temporal, and routine memory types with detailed tracking
- Implement memory decay based on usage recency with AI-initiated pinning
- Migrate to per-line encryption keys for new lines
- Support memory review via voice command ("What do you remember about me?")
- Maintain full audit trail for all memory deactivations

### Non-Goals

- Cross-line memory sharing (explicitly decided against for privacy)
- Dashboard control of topic exclusions (senior voice-only control)
- Data export mechanism for memories (maximum privacy - data stays encrypted forever)
- Migrating existing account DEKs to line DEKs (new lines only - no existing users)
- Changing the 200 memory limit for Grok prompts

---

## 2. Technical Architecture

### 2.1 Semantic Search Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Memory Storage Flow                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  store_memory ──► Check Topic Exclusions ──► Excluded?          │
│                         │                         │             │
│                         ▼ No                      ▼ Yes         │
│                  Generate Embedding ──────► Skip Embedding      │
│                         │                         │             │
│                         ▼                         ▼             │
│                  Encrypt Value ──────────► Encrypt Value        │
│                         │                         │             │
│                         ▼                         ▼             │
│                  Store with Vector ──────► Store without        │
│                  (searchable)             (not searchable)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Memory Lookup Flow                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  forget_memory("my son John")                                   │
│         │                                                       │
│         ▼                                                       │
│  Generate Query Embedding                                       │
│         │                                                       │
│         ▼                                                       │
│  Vector Similarity Search (pgvector)                            │
│         │                                                       │
│         ▼                                                       │
│  Multiple Matches Found?                                        │
│      │              │                                           │
│      ▼ Yes          ▼ No (single match)                         │
│  AI Contextual      Direct Match                                │
│  Best Guess              │                                      │
│      │                   │                                      │
│      ▼                   ▼                                      │
│  "I think you        Proceed with                               │
│   mean X?"           operation                                  │
│      │                                                          │
│      ▼ Wrong guess                                              │
│  "Can you tell me                                               │
│   more about which                                              │
│   one you meant?"                                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Embedding Provider Strategy

**Primary Provider: xAI (Grok)**
- Check xAI API for embedding endpoint availability
- Use Grok embedding model if available
- Keeps all data with existing vendor

**Fallback Provider: OpenAI**
- Model: `text-embedding-3-small`
- Dimensions: 1536
- Cost: ~$0.02 per 1M tokens
- Environment variable: `OPENAI_API_KEY`

**Fallback on API Failure:**
- If embedding API fails during a call, fall back to current fuzzy keyword matching
- Log failure but continue call without interruption
- Graceful degradation ensures call quality is maintained

### 2.3 Per-Line Encryption Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Key Hierarchy                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  KEK (Key Encryption Key) - Environment Variable                │
│        │                                                        │
│        ├──► Account DEK (legacy, for existing lines)            │
│        │          │                                             │
│        │          └──► Memories for existing lines              │
│        │                                                        │
│        └──► Line DEK (new, per-line for new lines)              │
│                   │                                             │
│                   └──► Memories for new line                    │
│                                                                 │
│  Security: Compromising one line's DEK does NOT expose          │
│            other lines' memories                                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 New Memory Type Schemas

#### Relationship Type
Detailed tracking of social connections mentioned by the senior.

```typescript
interface RelationshipMemoryValue {
  name: string;                                        // "John"
  role: string;                                        // "son", "daughter", "friend", "caregiver", etc.
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely';
  topicsDiscussed?: string[];                          // ["grandchildren", "work", "health"]
  lastMentioned?: string;                              // ISO date
  sentiment?: 'positive' | 'neutral' | 'complicated';
  notes?: string;                                      // Additional context
}
```

#### Temporal Type
Time-bound memories with expected expiration.

```typescript
interface TemporalMemoryValue {
  description: string;                    // "recovering from hip surgery"
  expectedEndDate: string;                // ISO date, AI estimates based on context
  durationEstimateWeeks?: number;         // AI's initial estimate
  context?: string;                       // Additional context for the AI
  reviewBeforeArchive: boolean;           // Always true - AI asks before archiving
}
```

#### Routine Type
Daily patterns at three levels of detail.

```typescript
interface RoutineMemoryValue {
  description: string;                    // "morning walk"
  level: 'general' | 'time_specific' | 'day_specific';
  timeOfDay?: string;                     // "08:00" for time_specific
  daysOfWeek?: number[];                  // [0,6] = Sunday, Saturday for day_specific
  frequency?: 'daily' | 'weekly' | 'occasional';
  proactivePrompt?: string;               // "How was your walk this morning?"
}
```

---

## 3. Database Schema Changes

### 3.1 New Tables

#### `ultaura_memory_embeddings`
Vector embeddings for semantic search.

```sql
-- Ensure pgvector extension is enabled
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

CREATE TABLE ultaura_memory_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES ultaura_memories(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,

  -- Embedding data
  embedding vector(1536) NOT NULL,
  embedding_model TEXT NOT NULL DEFAULT 'text-embedding-3-small',
  embedding_created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Searchable text (plaintext summary for embedding, NOT the encrypted value)
  searchable_text TEXT NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(memory_id)
);

-- Index for fast similarity search
CREATE INDEX idx_memory_embeddings_vector
  ON ultaura_memory_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX idx_memory_embeddings_line ON ultaura_memory_embeddings(line_id);
CREATE INDEX idx_memory_embeddings_account ON ultaura_memory_embeddings(account_id);

ALTER TABLE ultaura_memory_embeddings ENABLE ROW LEVEL SECURITY;
-- No user policies - service role only access
```

#### `ultaura_line_crypto_keys`
Per-line encryption keys for new lines.

```sql
CREATE TABLE ultaura_line_crypto_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Wrapped DEK (encrypted with KEK)
  dek_wrapped BYTEA NOT NULL,
  dek_wrap_iv BYTEA NOT NULL,
  dek_wrap_tag BYTEA NOT NULL,
  dek_kid TEXT NOT NULL DEFAULT 'kek_v1',
  dek_alg TEXT NOT NULL DEFAULT 'AES-256-GCM',
  rotated_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_line_crypto_keys_line ON ultaura_line_crypto_keys(line_id);

ALTER TABLE ultaura_line_crypto_keys ENABLE ROW LEVEL SECURITY;
-- No user policies - service role only
```

#### `ultaura_topic_exclusions`
Senior-controlled topic exclusions.

```sql
CREATE TYPE ultaura_exclusion_category AS ENUM (
  'health_medical',       -- medications, symptoms, diagnoses, doctors
  'family_relationships', -- names, relationships, conflicts, personal stories
  'finances',             -- money, bills, banking, insurance
  'location_address'      -- where they live, addresses, daily location patterns
);

CREATE TABLE ultaura_topic_exclusions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Exclusion settings
  category ultaura_exclusion_category NOT NULL,
  excluded BOOLEAN NOT NULL DEFAULT false,  -- false = not excluded (default)
  excluded_at TIMESTAMPTZ,
  excluded_call_session_id UUID REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,

  -- Re-inclusion tracking
  reincluded_at TIMESTAMPTZ,
  reincluded_call_session_id UUID REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,

  UNIQUE(line_id, category)
);

CREATE INDEX idx_topic_exclusions_line ON ultaura_topic_exclusions(line_id);
CREATE INDEX idx_topic_exclusions_excluded ON ultaura_topic_exclusions(line_id, excluded) WHERE excluded = true;

ALTER TABLE ultaura_topic_exclusions ENABLE ROW LEVEL SECURITY;

-- Users can view exclusions for their accounts (read-only in dashboard)
CREATE POLICY "Users can view topic exclusions for their accounts"
  ON ultaura_topic_exclusions FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- Auto-create exclusion rows for new lines (all categories start as NOT excluded)
CREATE OR REPLACE FUNCTION create_topic_exclusions_for_line()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ultaura_topic_exclusions (line_id, account_id, category, excluded)
  VALUES
    (NEW.id, NEW.account_id, 'health_medical', false),
    (NEW.id, NEW.account_id, 'family_relationships', false),
    (NEW.id, NEW.account_id, 'finances', false),
    (NEW.id, NEW.account_id, 'location_address', false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_topic_exclusions
AFTER INSERT ON ultaura_lines
FOR EACH ROW EXECUTE FUNCTION create_topic_exclusions_for_line();
```

#### `ultaura_memory_deactivation_log`
Full audit trail for memory deactivations.

```sql
CREATE TYPE ultaura_deactivation_reason AS ENUM (
  'user_request',      -- Senior explicitly asked to forget
  'user_request_bulk', -- Senior asked to forget multiple (confirmed)
  'decay',             -- Confidence dropped below threshold (0.5)
  'topic_exclusion',   -- Topic was excluded after memory created
  'temporal_expiry',   -- Temporal memory expired (AI confirmed with senior)
  'payer_deletion'     -- Payer requested account data deletion
);

CREATE TABLE ultaura_memory_deactivation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL,  -- No FK - memory may be hard deleted
  memory_key TEXT NOT NULL, -- Preserve key for reference
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Deactivation details
  reason ultaura_deactivation_reason NOT NULL,
  confidence_at_deactivation NUMERIC,
  call_session_id UUID REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,

  -- Restoration tracking (for potential undo)
  restored_at TIMESTAMPTZ,
  restored_call_session_id UUID REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,
  restored_reason TEXT,

  -- Additional context
  metadata JSONB  -- Any extra context (e.g., bulk deletion count, decay details)
);

CREATE INDEX idx_deactivation_log_line ON ultaura_memory_deactivation_log(line_id, created_at DESC);
CREATE INDEX idx_deactivation_log_reason ON ultaura_memory_deactivation_log(reason);
CREATE INDEX idx_deactivation_log_memory ON ultaura_memory_deactivation_log(memory_id);

ALTER TABLE ultaura_memory_deactivation_log ENABLE ROW LEVEL SECURITY;
-- No user policies - service role only
```

### 3.2 Schema Modifications to Existing Tables

#### Update `ultaura_memories` table

```sql
-- Add new memory types to enum
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'relationship';
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'temporal';
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'routine';

-- Add columns for decay, pinning, and topic tracking
ALTER TABLE ultaura_memories
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_reason TEXT,
  ADD COLUMN IF NOT EXISTS excluded_category ultaura_exclusion_category,
  ADD COLUMN IF NOT EXISTS embedding_pending BOOLEAN NOT NULL DEFAULT false;

-- Index for decay calculations (confidence-based filtering)
CREATE INDEX IF NOT EXISTS idx_memories_decay
  ON ultaura_memories (line_id, active, confidence, last_accessed_at)
  WHERE active = true;

-- Index for pinned memories (never decay)
CREATE INDEX IF NOT EXISTS idx_memories_pinned
  ON ultaura_memories (line_id, pinned)
  WHERE pinned = true AND active = true;

-- Index for excluded memories (may need re-embedding later)
CREATE INDEX IF NOT EXISTS idx_memories_excluded
  ON ultaura_memories (line_id, excluded_category)
  WHERE excluded_category IS NOT NULL AND active = true;

-- Index for pending embeddings
CREATE INDEX IF NOT EXISTS idx_memories_embedding_pending
  ON ultaura_memories (embedding_pending)
  WHERE embedding_pending = true AND active = true;
```

### 3.3 Database Functions

#### Semantic Search Function

```sql
CREATE OR REPLACE FUNCTION match_memories_semantic(
  p_line_id UUID,
  p_query_embedding vector(1536),
  p_match_count INT DEFAULT 5,
  p_similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
  memory_id UUID,
  similarity FLOAT,
  memory_key TEXT,
  memory_type ultaura_memory_type,
  searchable_text TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id AS memory_id,
    1 - (e.embedding <=> p_query_embedding) AS similarity,
    m.key AS memory_key,
    m.type AS memory_type,
    e.searchable_text
  FROM ultaura_memory_embeddings e
  JOIN ultaura_memories m ON m.id = e.memory_id
  WHERE e.line_id = p_line_id
    AND m.active = true
    AND m.confidence >= 0.5  -- Only include memories above decay threshold
    AND (1 - (e.embedding <=> p_query_embedding)) >= p_similarity_threshold
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;
```

#### Decay Calculation Function

```sql
CREATE OR REPLACE FUNCTION calculate_memory_decay(
  p_line_id UUID
)
RETURNS TABLE (
  memory_id UUID,
  old_confidence NUMERIC,
  new_confidence NUMERIC,
  should_exclude BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_decay_rate NUMERIC := 0.20;  -- 20% per 30 days
  v_threshold NUMERIC := 0.5;    -- Exclude below this
BEGIN
  RETURN QUERY
  WITH decay_calc AS (
    SELECT
      m.id,
      m.confidence AS old_conf,
      GREATEST(
        0,
        COALESCE(m.confidence, 1.0) - (
          v_decay_rate *
          EXTRACT(EPOCH FROM (now() - COALESCE(m.last_accessed_at, m.created_at))) /
          (30 * 24 * 60 * 60)  -- 30 days in seconds
        )
      ) AS new_conf
    FROM ultaura_memories m
    WHERE m.line_id = p_line_id
      AND m.active = true
      AND m.pinned = false  -- Pinned memories never decay
      AND m.confidence IS NOT NULL
  )
  SELECT
    dc.id AS memory_id,
    dc.old_conf AS old_confidence,
    dc.new_conf::NUMERIC AS new_confidence,
    dc.new_conf < v_threshold AS should_exclude
  FROM decay_calc dc
  WHERE dc.new_conf < dc.old_conf;  -- Only return memories that decayed
END;
$$;
```

#### Apply Decay Function

```sql
CREATE OR REPLACE FUNCTION apply_memory_decay(
  p_line_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated_count INTEGER := 0;
BEGIN
  -- Update confidence scores
  WITH decay_results AS (
    SELECT memory_id, new_confidence, should_exclude
    FROM calculate_memory_decay(p_line_id)
  )
  UPDATE ultaura_memories m
  SET
    confidence = dr.new_confidence,
    updated_at = now()
  FROM decay_results dr
  WHERE m.id = dr.memory_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Log memories that fell below threshold
  INSERT INTO ultaura_memory_deactivation_log (
    memory_id, memory_key, line_id, account_id, reason, confidence_at_deactivation
  )
  SELECT
    m.id, m.key, m.line_id, m.account_id, 'decay', m.confidence
  FROM ultaura_memories m
  WHERE m.line_id = p_line_id
    AND m.active = true
    AND m.confidence < 0.5
    AND m.pinned = false
    AND NOT EXISTS (
      SELECT 1 FROM ultaura_memory_deactivation_log l
      WHERE l.memory_id = m.id AND l.reason = 'decay' AND l.restored_at IS NULL
    );

  RETURN v_updated_count;
END;
$$;
```

#### Topic Categorization Helper

```sql
CREATE OR REPLACE FUNCTION categorize_memory_topic(
  p_key TEXT,
  p_value TEXT,
  p_type ultaura_memory_type
)
RETURNS ultaura_exclusion_category
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_combined TEXT;
BEGIN
  v_combined := lower(COALESCE(p_key, '') || ' ' || COALESCE(p_value, ''));

  -- Health/Medical keywords
  IF v_combined ~ '(medication|medicine|doctor|hospital|surgery|diagnosis|symptom|pain|prescription|illness|disease|treatment|therapy|medical|nurse|clinic|pharmacy|pill|dose|appointment|checkup|blood pressure|diabetes|arthritis|heart|cancer)' THEN
    RETURN 'health_medical';
  END IF;

  -- Family/Relationships keywords
  IF v_combined ~ '(son|daughter|wife|husband|spouse|grandchild|grandson|granddaughter|family|brother|sister|mother|father|parent|friend|neighbor|caregiver|nephew|niece|aunt|uncle|cousin|in-law|ex-|divorce|marriage|relationship)' THEN
    RETURN 'family_relationships';
  END IF;

  -- Finances keywords
  IF v_combined ~ '(money|bank|account|bill|payment|insurance|pension|savings|debt|loan|mortgage|income|expense|retire|social security|medicare|medicaid|tax|budget|afford|cost|price|dollar|cent|\$)' THEN
    RETURN 'finances';
  END IF;

  -- Location/Address keywords
  IF v_combined ~ '(address|street|avenue|road|apartment|apt|house|home|live|living|location|neighborhood|city|town|state|zip|floor|building|complex|community|facility|residence|move|moved)' THEN
    RETURN 'location_address';
  END IF;

  -- No category match
  RETURN NULL;
END;
$$;
```

#### Mark Memory Accessed Function

```sql
CREATE OR REPLACE FUNCTION mark_memory_accessed(
  p_memory_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ultaura_memories
  SET
    last_accessed_at = now(),
    access_count = access_count + 1,
    -- Boost confidence when accessed (but cap at 1.0)
    confidence = LEAST(1.0, COALESCE(confidence, 1.0) + 0.1)
  WHERE id = p_memory_id AND active = true;
END;
$$;
```

#### Pin Memory Function

```sql
CREATE OR REPLACE FUNCTION pin_memory(
  p_memory_id UUID,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE ultaura_memories
  SET
    pinned = true,
    pinned_reason = p_reason,
    confidence = 1.0,  -- Restore full confidence
    updated_at = now()
  WHERE id = p_memory_id AND active = true;
END;
$$;
```

---

## 4. API Changes

### 4.1 New Tool Endpoints

#### `POST /tools/exclude_topic`
Exclude a topic category from memory storage (voice-only).

```typescript
// Request
interface ExcludeTopicRequest {
  callSessionId: string;
  lineId: string;
  category: 'health_medical' | 'family_relationships' | 'finances' | 'location_address';
}

// Response
interface ExcludeTopicResponse {
  success: boolean;
  message: string;
  category: string;
  affectedMemories: number;  // Count of existing memories that will be hidden
}
```

**Behavior:**
1. Update `ultaura_topic_exclusions` to set `excluded = true`
2. Mark existing memories of that category with `excluded_category`
3. Delete embeddings for excluded memories
4. Return confirmation message

#### `POST /tools/include_topic`
Re-include a previously excluded topic category (voice-only).

```typescript
// Request
interface IncludeTopicRequest {
  callSessionId: string;
  lineId: string;
  category: 'health_medical' | 'family_relationships' | 'finances' | 'location_address';
}

// Response
interface IncludeTopicResponse {
  success: boolean;
  message: string;
  category: string;
  restoredMemories: number;  // Count of memories being re-indexed
}
```

**Behavior:**
1. Update `ultaura_topic_exclusions` to set `excluded = false`
2. Clear `excluded_category` from memories
3. Mark memories for re-embedding (`embedding_pending = true`)
4. Queue background job to generate embeddings
5. Return confirmation message

#### `POST /tools/list_topic_exclusions`
List current topic exclusion settings (for AI reference).

```typescript
// Request
interface ListTopicExclusionsRequest {
  callSessionId: string;
  lineId: string;
}

// Response
interface ListTopicExclusionsResponse {
  success: boolean;
  exclusions: Array<{
    category: string;
    displayName: string;  // "Health & Medical", etc.
    excluded: boolean;
    excludedAt: string | null;
  }>;
}
```

#### `POST /tools/review_memories`
Summarize memories for senior review ("What do you remember about me?").

```typescript
// Request
interface ReviewMemoriesRequest {
  callSessionId: string;
  lineId: string;
  category?: string;  // Optional filter: "family", "hobbies", etc.
}

// Response
interface ReviewMemoriesResponse {
  success: boolean;
  summary: string;      // Conversational summary for AI to read aloud
  memoryCount: number;
  categories: string[]; // Categories with memories
}
```

**Summary Format:**
```
I remember that your name is [name]. You have [X] family members I know about, including [names/roles].
You enjoy [interests] and prefer [preferences].
You [routine summary].
Would you like me to go into more detail about any of these?
```

### 4.2 Enhanced Existing Tool Endpoints

#### `POST /tools/forget_memory` (Enhanced)

```typescript
// Request (unchanged)
interface ForgetMemoryRequest {
  callSessionId: string;
  lineId: string;
  whatToForget: string;
  permanent?: boolean;
}

// Response (enhanced)
interface ForgetMemoryResponse {
  success: boolean;
  message: string;

  // New fields for semantic matching
  matchType: 'exact' | 'semantic' | 'multiple' | 'not_found';

  // If single match found
  matchedMemory?: {
    id: string;
    key: string;
    preview: string;      // First 50 chars of value
    similarity?: number;  // Semantic similarity score
  };

  // If multiple matches found
  alternatives?: Array<{
    id: string;
    key: string;
    preview: string;
    similarity: number;
  }>;

  // Confirmation flow
  needsConfirmation?: boolean;
  confirmationPrompt?: string;  // "Are you sure you don't want to speak about X anymore?"
}
```

**Enhanced Behavior:**
1. Generate embedding for `whatToForget`
2. Search using `match_memories_semantic()` function
3. If single match above threshold: proceed with contextual confirmation
4. If multiple matches: AI makes best guess, confirms "I think you mean X - is that right?"
5. If wrong guess: AI asks "Can you tell me a bit more about which one you meant?"
6. Bulk deletion always requires confirmation: "Are you sure you don't want to speak about X anymore?"
7. On API failure: fall back to fuzzy keyword matching

#### `POST /tools/store_memory` (Enhanced)

```typescript
// Request (enhanced)
interface StoreMemoryRequest {
  callSessionId: string;
  lineId: string;
  memoryType: MemoryType;  // Now includes 'relationship' | 'temporal' | 'routine'
  key: string;
  value: string | RelationshipMemoryValue | TemporalMemoryValue | RoutineMemoryValue;
  confidence?: number;
  suggestReminder?: boolean;

  // New fields for enhanced types
  expectedEndDate?: string;   // ISO date for temporal type
  routineLevel?: 'general' | 'time_specific' | 'day_specific';
}

// Response (enhanced)
interface StoreMemoryResponse {
  success: boolean;
  memoryId: string;
  action: 'created' | 'updated' | 'skipped' | 'excluded';
  reason?: string;
  version: number;

  // New fields
  excludedCategory?: string;  // If excluded due to topic settings
  embeddingGenerated?: boolean;
  pinned?: boolean;           // If auto-pinned as critical memory
}
```

**Enhanced Behavior:**
1. Check topic exclusions before storing
2. If excluded: store memory but mark with `excluded_category`, skip embedding
3. If not excluded: generate embedding and store
4. Auto-pin critical memories (emergency contacts, medications) silently
5. For temporal type: AI estimates `expectedEndDate` based on context
6. For routine type: determine level from content

### 4.3 New Grok Tool Definitions

Add to `/packages/prompts/src/tools/definitions.ts`:

```typescript
// Topic exclusion tool
{
  type: 'function',
  name: 'exclude_memory_topic',
  description: `Exclude a category of memories from storage. Call when senior clearly indicates they don't want certain topics remembered:

  Examples:
  - "Don't remember anything about my medications" -> health_medical
  - "Keep my family out of this" -> family_relationships
  - "Don't store anything about my money" -> finances
  - "Forget where I live" -> location_address

  IMPORTANT: This is controlled ONLY by the senior via voice. Ask for confirmation before excluding.`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['health_medical', 'family_relationships', 'finances', 'location_address'],
        description: 'Category to exclude from memory storage'
      }
    },
    required: ['category']
  }
},

// Topic inclusion tool
{
  type: 'function',
  name: 'include_memory_topic',
  description: `Re-enable a previously excluded memory category. Call when senior explicitly asks to start remembering a topic again.

  Example: "You can remember my health stuff now"

  This will also restore any previously excluded memories of that type.`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['health_medical', 'family_relationships', 'finances', 'location_address'],
        description: 'Category to re-include in memory storage'
      }
    },
    required: ['category']
  }
},

// Memory review tool
{
  type: 'function',
  name: 'review_memories',
  description: `Summarize what you remember about the senior. Call when they ask:
  - "What do you remember about me?"
  - "What do you know about me?"
  - "Tell me what you've learned about me"

  Return a conversational summary they can listen to.`,
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Optional: focus on a specific area (family, hobbies, routines, etc.)'
      }
    },
    required: []
  }
}
```

---

## 5. Implementation Plan

### Phase 1: Database Foundation

**Files to create:**
- `supabase/migrations/YYYYMMDD000001_memory_embeddings.sql`
- `supabase/migrations/YYYYMMDD000002_line_crypto_keys.sql`
- `supabase/migrations/YYYYMMDD000003_topic_exclusions.sql`
- `supabase/migrations/YYYYMMDD000004_memory_deactivation_log.sql`
- `supabase/migrations/YYYYMMDD000005_memory_enhancements.sql`

**Tasks:**
1. Create `ultaura_memory_embeddings` table with pgvector
2. Create `ultaura_line_crypto_keys` table
3. Create `ultaura_topic_exclusions` table with trigger
4. Create `ultaura_memory_deactivation_log` table
5. Add new columns to `ultaura_memories`
6. Add new enum values to `ultaura_memory_type`
7. Create all database functions
8. Run migrations and verify

### Phase 2: Per-Line Encryption

**Files to modify:**
- `telephony/src/utils/encryption.ts`
- `telephony/src/services/memory.ts`

**Files to create:**
- `telephony/src/services/line-encryption.ts`

**Tasks:**
1. Create `getOrCreateLineDEK()` function
2. Update encryption service to check for line DEK first
3. Update AAD building to include line_id for line-level encryption
4. Add trigger for auto-creating line DEK on new line creation
5. Update memory service to use appropriate DEK based on line age

### Phase 3: Topic Exclusions

**Files to create:**
- `telephony/src/services/topic-exclusions.ts`
- `telephony/src/routes/tools/exclude-topic.ts`
- `telephony/src/routes/tools/include-topic.ts`
- `telephony/src/routes/tools/list-exclusions.ts`

**Files to modify:**
- `telephony/src/routes/tools/store-memory.ts`
- `packages/prompts/src/tools/definitions.ts`
- `packages/prompts/src/golden/sections/memory-policy.ts`

**Tasks:**
1. Create topic exclusions service with all CRUD operations
2. Create tool handlers for exclude/include/list
3. Update store_memory to check exclusions before storing
4. Update Grok tool definitions
5. Update system prompts to document exclusion behavior

### Phase 4: Embedding Service

**Files to create:**
- `telephony/src/services/embedding.ts`
- `telephony/src/services/embedding-providers/xai.ts`
- `telephony/src/services/embedding-providers/openai.ts`

**Files to modify:**
- `telephony/src/routes/tools/store-memory.ts`
- `.env.ultaura.example`

**Tasks:**
1. Create embedding service with provider abstraction
2. Implement xAI provider (if API available)
3. Implement OpenAI fallback provider
4. Implement graceful fallback to fuzzy matching on failure
5. Integrate embedding generation into store_memory
6. Add environment variables for API keys and model config
7. Create background job for pending embeddings

### Phase 5: Semantic Memory Operations

**Files to modify:**
- `telephony/src/routes/tools/forget-memory.ts`
- `telephony/src/routes/tools/mark-private.ts`
- `telephony/src/routes/tools/update-memory.ts`
- `telephony/src/services/memory.ts`

**Tasks:**
1. Update forget_memory to use semantic search
2. Implement multi-match confirmation flow
3. Implement contextual guess with wrong-guess recovery
4. Update mark_private to use semantic search
5. Update update_memory to use semantic search for finding existing memory
6. Add bulk deletion confirmation with soft wording

### Phase 6: New Memory Types

**Files to modify:**
- `packages/types/src/memory.ts`
- `telephony/src/routes/tools/store-memory.ts`
- `telephony/src/services/memory.ts`
- `packages/prompts/src/golden/sections/memory-policy.ts`

**Tasks:**
1. Add TypeScript interfaces for new memory value types
2. Update MemoryType union to include new types
3. Update store_memory handler for relationship, temporal, routine types
4. Implement temporal memory expiry checking
5. Add AI estimation logic for temporal expectedEndDate
6. Update system prompts with guidance for new types

### Phase 7: Memory Decay System

**Files to create:**
- `telephony/src/services/memory-decay.ts`
- `telephony/src/jobs/decay-job.ts`

**Files to modify:**
- `telephony/src/services/memory.ts`
- `telephony/src/websocket/grok-bridge.ts`

**Tasks:**
1. Create memory decay service
2. Implement decay calculation with configurable rate
3. Implement access tracking (mark_memory_accessed)
4. Implement auto-pinning for critical memories
5. Create scheduled job for daily decay calculation
6. Update memory fetching to filter by confidence threshold
7. Update Grok prompt assembly to use relevance-sorted memories

### Phase 8: Memory Review

**Files to create:**
- `telephony/src/routes/tools/review-memories.ts`

**Files to modify:**
- `packages/prompts/src/tools/definitions.ts`
- `packages/prompts/src/golden/sections/memory-policy.ts`

**Tasks:**
1. Create review_memories tool handler
2. Implement conversational summary generation
3. Add Grok tool definition
4. Update system prompts with review capability

### Phase 9: Testing and Validation

**Files to create:**
- `telephony/tests/services/embedding.test.ts`
- `telephony/tests/services/topic-exclusions.test.ts`
- `telephony/tests/services/memory-decay.test.ts`
- `telephony/tests/services/line-encryption.test.ts`
- `telephony/tests/integration/semantic-search.test.ts`

**Tasks:**
1. Unit tests for embedding service with fallback scenarios
2. Unit tests for topic exclusion logic
3. Unit tests for memory decay calculations
4. Unit tests for per-line encryption
5. Integration tests for semantic search accuracy
6. Integration tests for voice-controlled exclusions
7. End-to-end tests for complete flows

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Embedding Service:**
```typescript
describe('EmbeddingService', () => {
  it('should generate embedding using xAI provider')
  it('should fall back to OpenAI when xAI fails')
  it('should fall back to fuzzy matching when both fail')
  it('should validate embedding dimensions (1536)')
  it('should handle rate limiting gracefully')
});
```

**Topic Exclusions:**
```typescript
describe('TopicExclusionService', () => {
  it('should detect health_medical category from keywords')
  it('should detect family_relationships from names')
  it('should detect finances from money keywords')
  it('should detect location_address from address keywords')
  it('should return null for uncategorized memories')
  it('should exclude topic and mark existing memories')
  it('should re-include topic and queue re-embedding')
});
```

**Memory Decay:**
```typescript
describe('MemoryDecayService', () => {
  it('should calculate 20% decay per 30 days')
  it('should not decay pinned memories')
  it('should exclude memories below 0.5 confidence')
  it('should boost confidence when memory accessed')
  it('should log decay deactivations')
});
```

**Per-Line Encryption:**
```typescript
describe('LineEncryptionService', () => {
  it('should create DEK for new lines')
  it('should use existing DEK for existing lines')
  it('should include line_id in AAD')
  it('should fail decryption with wrong line_id')
});
```

### 6.2 Integration Tests

**Semantic Search:**
```typescript
describe('Semantic Search Integration', () => {
  it('should find "medication" when searching "medicine"')
  it('should find "pet dog Max" when searching "my dog"')
  it('should return multiple matches for ambiguous queries')
  it('should rank by similarity score')
  it('should fall back to fuzzy on embedding failure')
});
```

**Voice Controls:**
```typescript
describe('Voice Control Integration', () => {
  it('should exclude health topic via exclude_memory_topic')
  it('should prevent storing health memories when excluded')
  it('should re-include topic and restore memories')
  it('should summarize memories on review_memories')
});
```

### 6.3 End-to-End Tests

**Full Exclusion Flow:**
1. Senior says "Don't remember anything about my medications"
2. AI confirms, calls exclude_memory_topic
3. Subsequent health info is NOT stored (verify in DB)
4. Senior says "You can remember health stuff again"
5. AI calls include_memory_topic
6. Previously excluded health memories are re-indexed (verify embeddings)

**Semantic Forget Flow:**
1. Memory stored: "My son John visits every Sunday"
2. Senior says "Forget about my son"
3. AI uses semantic search, finds John relationship
4. AI confirms: "I think you mean John who visits on Sundays - is that right?"
5. If wrong: AI asks "Can you tell me a bit more about which one you meant?"
6. Senior confirms, memory deactivated, log entry created

**Decay Flow:**
1. Create memory with confidence 1.0
2. Run decay job (simulate 60 days passed)
3. Verify confidence dropped to ~0.6
4. Run decay job again (simulate 90 days total)
5. Verify confidence dropped below 0.5, excluded from prompts
6. Reference memory in conversation
7. Verify confidence restored to 1.0

---

## 7. Edge Cases and Error Handling

### 7.1 Embedding API Failures

**Scenario:** Both xAI and OpenAI embedding APIs unavailable

**Handling:**
1. Log error with severity level
2. Continue with keyword-based fallback matching
3. Store memory WITHOUT embedding
4. Set `embedding_pending = true` on memory
5. Background job retries embedding when service recovers
6. Call continues without interruption

### 7.2 Multiple Semantic Matches

**Scenario:** "Forget about my doctor" matches multiple doctor-related memories

**Handling:**
1. AI makes contextual best guess based on recent conversation
2. Confirms: "I think you mean Dr. Smith, your cardiologist - is that right?"
3. If senior says no: "Can you tell me a bit more about which one you meant?"
4. Never bulk delete without explicit confirmation
5. Bulk confirmation uses soft wording: "Are you sure you don't want to speak about X anymore?"

### 7.3 Topic Re-inclusion with Many Memories

**Scenario:** Senior re-includes health topic with 50+ excluded memories

**Handling:**
1. Update exclusion status immediately
2. Mark all affected memories with `embedding_pending = true`
3. Process embeddings in batches (10 at a time) via background job
4. Log progress and any failures
5. Inform AI when re-indexing complete

### 7.4 Temporal Memory Expiry

**Scenario:** "Surgery recovery" temporal memory reaches expectedEndDate

**Handling:**
1. Before auto-archiving, AI asks: "You mentioned you were recovering from surgery. Is that still going on, or are you feeling better now?"
2. If senior says "still recovering": Extend expectedEndDate (AI estimates new duration)
3. If senior says "feeling better": Deactivate with reason `temporal_expiry`
4. Log in deactivation_log with metadata

### 7.5 Confidence Below Threshold

**Scenario:** Memory decays below 0.5 confidence

**Handling:**
1. Memory excluded from Grok prompts (not shown to AI)
2. Memory NOT deleted from database
3. Log in deactivation_log with reason `decay`
4. If senior mentions related topic again:
   - Find memory via semantic search
   - Restore confidence to 1.0
   - Mark restoration in deactivation_log
   - Include in next prompt refresh

### 7.6 Auto-Pinning Critical Memories

**Scenario:** Senior mentions emergency contact or medication

**Handling:**
1. AI stores memory normally
2. System detects critical category (emergency_contact, medication, medical_condition)
3. Auto-pin memory silently (don't mention to senior)
4. Set `pinned_reason` to category
5. Pinned memories never decay

**Critical Categories for Auto-Pinning:**
- Emergency contacts (family phone numbers)
- Medications (names, dosages, schedules)
- Severe medical conditions (heart condition, diabetes, etc.)
- Allergies
- Primary care doctor/hospital

---

## 8. Security Considerations

### 8.1 Embedding Privacy

- **Searchable text is NOT the full memory value** - only key and summary
- Embeddings stored in separate table from encrypted values
- Excluded topics NEVER sent to embedding API
- Embedding table has no user policies (service role only)
- Vector similarity cannot reverse-engineer actual content

### 8.2 Per-Line Key Isolation

- Each new line gets independent DEK
- Compromising one line's DEK does NOT expose other lines
- Account KEK still required to unwrap any line DEK
- No mechanism to export or retrieve keys
- Data stays encrypted forever (no export feature)

### 8.3 Topic Exclusion Enforcement

- Exclusions checked BEFORE embedding generation
- Exclusions checked BEFORE memory storage
- Payer dashboard can VIEW exclusions but NOT modify
- All exclusion changes logged in audit trail
- Only senior voice commands can modify exclusions

### 8.4 Audit Trail

- All memory deactivations logged with reason
- All topic exclusion changes logged with call session
- All restoration events logged
- Immutable log (no DELETE policy)

---

## 9. Environment Variables

### New Required Variables

```bash
# Embedding providers
OPENAI_API_KEY=sk-...                    # For text-embedding-3-small fallback
XAI_EMBEDDING_MODEL=                     # xAI embedding model name (if available)

# Feature flags (all default to true in production)
ULTAURA_SEMANTIC_SEARCH_ENABLED=true
ULTAURA_TOPIC_EXCLUSIONS_ENABLED=true
ULTAURA_MEMORY_DECAY_ENABLED=true
ULTAURA_PER_LINE_DEK_ENABLED=true

# Decay configuration
ULTAURA_DECAY_RATE=0.20                  # 20% per 30 days
ULTAURA_DECAY_THRESHOLD=0.5              # Exclude below this confidence
ULTAURA_DECAY_CRON="0 3 * * *"           # Run at 3 AM daily

# Embedding configuration
ULTAURA_EMBEDDING_BATCH_SIZE=10          # Batch size for re-indexing
ULTAURA_EMBEDDING_SIMILARITY_THRESHOLD=0.7  # Minimum similarity for match
```

---

## 10. Rollback Strategy

### 10.1 Feature Flags

Each major feature has an independent feature flag:

```typescript
// Environment variable checks
const SEMANTIC_SEARCH_ENABLED = process.env.ULTAURA_SEMANTIC_SEARCH_ENABLED !== 'false';
const TOPIC_EXCLUSIONS_ENABLED = process.env.ULTAURA_TOPIC_EXCLUSIONS_ENABLED !== 'false';
const MEMORY_DECAY_ENABLED = process.env.ULTAURA_MEMORY_DECAY_ENABLED !== 'false';
const PER_LINE_DEK_ENABLED = process.env.ULTAURA_PER_LINE_DEK_ENABLED !== 'false';
```

### 10.2 Rollback Procedures

**Semantic Search Rollback:**
1. Set `ULTAURA_SEMANTIC_SEARCH_ENABLED=false`
2. System immediately reverts to keyword matching
3. Embeddings table remains but is not queried
4. No data loss, can re-enable anytime

**Topic Exclusions Rollback:**
1. Set `ULTAURA_TOPIC_EXCLUSIONS_ENABLED=false`
2. All memories stored regardless of exclusion settings
3. Exclusion settings preserved in database for re-enablement
4. No data loss

**Memory Decay Rollback:**
1. Set `ULTAURA_MEMORY_DECAY_ENABLED=false`
2. All active memories included in prompts regardless of confidence
3. Decay job stops running
4. Confidence scores preserved, can resume decay later

**Per-Line DEK Rollback:**
1. Set `ULTAURA_PER_LINE_DEK_ENABLED=false`
2. New lines use account DEK instead
3. Existing line DEKs remain functional for existing memories
4. No migration needed, existing data accessible

---

## 11. Key Files Reference

### Files to Create

| File | Purpose |
|------|---------|
| `telephony/src/services/embedding.ts` | Embedding generation with provider fallback |
| `telephony/src/services/embedding-providers/xai.ts` | xAI embedding provider |
| `telephony/src/services/embedding-providers/openai.ts` | OpenAI embedding provider |
| `telephony/src/services/topic-exclusions.ts` | Topic exclusion CRUD operations |
| `telephony/src/services/memory-decay.ts` | Decay calculation and application |
| `telephony/src/services/line-encryption.ts` | Per-line DEK management |
| `telephony/src/routes/tools/exclude-topic.ts` | Exclude topic tool handler |
| `telephony/src/routes/tools/include-topic.ts` | Include topic tool handler |
| `telephony/src/routes/tools/list-exclusions.ts` | List exclusions tool handler |
| `telephony/src/routes/tools/review-memories.ts` | Memory review tool handler |
| `telephony/src/jobs/decay-job.ts` | Scheduled decay job |

### Files to Modify

| File | Changes |
|------|---------|
| `telephony/src/utils/encryption.ts` | Add per-line DEK support |
| `telephony/src/services/memory.ts` | Integrate embeddings, exclusions, decay |
| `telephony/src/routes/tools/forget-memory.ts` | Add semantic search, confirmation flow |
| `telephony/src/routes/tools/store-memory.ts` | Add exclusion check, embedding generation |
| `telephony/src/routes/tools/mark-private.ts` | Add semantic search |
| `telephony/src/routes/tools/update-memory.ts` | Add semantic search for finding memory |
| `telephony/src/websocket/grok-bridge.ts` | Filter by confidence, sort by relevance |
| `packages/types/src/memory.ts` | Add new types and value schemas |
| `packages/prompts/src/tools/definitions.ts` | Add new Grok tools |
| `packages/prompts/src/golden/sections/memory-policy.ts` | Document new features |

### Database Migrations to Create

1. `YYYYMMDD000001_memory_embeddings.sql` - Embeddings table and pgvector
2. `YYYYMMDD000002_line_crypto_keys.sql` - Per-line encryption keys
3. `YYYYMMDD000003_topic_exclusions.sql` - Topic exclusions with trigger
4. `YYYYMMDD000004_memory_deactivation_log.sql` - Audit trail
5. `YYYYMMDD000005_memory_enhancements.sql` - New columns and types

---

## 12. Assumptions

1. **xAI Embedding API**: Assuming xAI may or may not have an embedding endpoint. Implementation should check availability and fall back to OpenAI.

2. **No Existing Real Users**: Since the system is still in development with no real users, per-line DEK migration only affects new lines.

3. **Supabase pgvector**: Assuming pgvector extension is available and enabled in the Supabase instance.

4. **Call Duration**: Memory operations (embedding generation, semantic search) should complete within acceptable latency for real-time voice calls (~500ms target).

5. **Storage Costs**: Vector storage in pgvector with 200 memories per line at 1536 dimensions is acceptable storage cost.

6. **Senior Cognitive Load**: Topic exclusions kept to 4 broad categories to minimize cognitive burden during voice interaction.

7. **Audit Retention**: Deactivation logs retained indefinitely for compliance and potential restoration.
