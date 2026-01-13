# Ultaura Personalization Roadmap - Implementation Specification

## Executive Summary

### Project Overview

This specification details the implementation of 16 interconnected personalization systems for Ultaura, an AI voice companion for seniors. The systems leverage Grok Voice Agent's 2M token context window and flat-rate pricing ($0.05/min connection-based) to dramatically expand personalization capabilities without cost impact.

### Goals

1. **Deep Personalization**: Transform Ultaura from a general companion to a deeply personalized presence that knows each senior's life story, relationships, preferences, and daily rhythms
2. **Adaptive Intelligence**: Enable the AI to detect, respond to, and adapt based on emotional states, cognitive needs, and communication preferences
3. **Family Visibility**: Provide family members with privacy-respecting insights into their loved one's wellbeing without exposing private conversation details
4. **Proactive Support**: Anticipate needs through wellness monitoring, milestone celebrations, and grief support

### Success Metrics

- **Engagement**: 25% increase in average call duration within 90 days
- **Retention**: 40% reduction in churn rate
- **Family Satisfaction**: 80% of families rate dashboard insights as "valuable"
- **Senior Satisfaction**: 90% positive mood readings at call end
- **Safety Coverage**: 100% detection of health mentions and mood drops

### Key Design Decisions (from requirements interview)

| Decision | Choice |
|----------|--------|
| Rollout | All-or-nothing (all 16 systems together) |
| Content Source | AI-generated on-the-fly |
| Family Visibility | Topic summaries only (no verbatim quotes) |
| Life Story Input | Voice-only (organic capture) |
| Accessibility | Family-configurable + AI fine-tuning |
| Alert Triggers | Health mentions + mood drops |
| Milestones | Dashboard calendar + voice-captured |
| Relationships | Extended schema (name, relation, frequency, sentiment, topics, location, activities) |
| Mood Storage | Per-call snapshot (start, mid, end) |
| Story Arcs | Up to 3 concurrent |
| Context Window | Last 10+ calls |
| Grief Tracking | Flag on relationship record (deceased + passed_at) |
| Call Timing | Smart scheduling (family initial + AI refinement) |
| Health Privacy | All health private by default |
| AI Persona | Auto-adaptive (mirrors senior's style) |
| Cognitive Support | Tiered response (3+ calls with confusion = flag) |

---

## Current Architecture Summary

### Memory System (from codebase exploration)
- **9 memory types**: fact, preference, follow_up, context, history, wellbeing, relationship, temporal, routine
- **Encryption**: AES-256-GCM envelope encryption (DEK wrapped by KEK)
- **Relevance scoring**: confidence (40%) + recency (30%) + access_count (20%) + pinned (10%)
- **Limits**: 50-200 memories fetched per call, filtered by decay/exclusions
- **Auto-pinning**: Medical/emergency keywords automatically pinned

### Prompt System
- **Architecture**: Modular "golden sections" in `/packages/prompts/src/golden/sections/` (14 files)
- **Compilation**: `compilePrompt()` with `voice_realtime` vs `admin_preview` profiles
- **Current size**: ~700-900 tokens (massive headroom to 2M)
- **Injection points**: memories, routines, story arcs, call previews, interests, avoid topics
- **Tools**: 26 Grok tools available

### Database Schema
- **Core tables**: ultaura_memories, ultaura_lines, ultaura_accounts, ultaura_call_sessions
- **Insights**: ultaura_call_insights (encrypted), ultaura_line_baselines (14-day averages)
- **Safety**: ultaura_safety_events (3 tiers, 9 categories)
- **Existing relationships**: Stored as `relationship` memory type with structured value

---

## Architecture Overview

### System Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PROMPT ASSEMBLY                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  Identity   │ │  Life Story │ │  Emotional  │ │  Content    │       │
│  │  Section    │ │  Context    │ │  Intelligence│ │  Engine     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Relationship│ │ Accessibility│ │  Adaptive   │ │  Celebration│       │
│  │  Context    │ │  Settings   │ │  Persona    │ │  & Grief    │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Daily Rhythm│ │   Health    │ │ Interruption│ │  Memories   │       │
│  │  Awareness  │ │  Wellness   │ │  Handling   │ │  Formatted  │       │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           GROK VOICE AGENT                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ System Prompt (expanded from ~900 → ~15,000-50,000 tokens)      │   │
│  │ • Golden sections (identity, safety, privacy, tools)            │   │
│  │ • Personalization sections (all 16 systems inject here)         │   │
│  │ • Dynamic context (memories, relationships, recent calls)       │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Tools (expanded from 26 → ~40 tools)                            │   │
│  │ • Memory tools (existing)                                        │   │
│  │ • Relationship tools (new)                                       │   │
│  │ • Mood/wellness tools (new)                                      │   │
│  │ • Content generation tools (new)                                 │   │
│  │ • Milestone/celebration tools (new)                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                     │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │ ultaura_memories  │  │ ultaura_          │  │ ultaura_          │   │
│  │ (extended schema) │  │ relationships     │  │ milestones        │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │ ultaura_mood_     │  │ ultaura_persona   │  │ ultaura_wellness  │   │
│  │ snapshots         │  │ _adaptations      │  │ _alerts           │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │ ultaura_          │  │ ultaura_          │  │ ultaura_          │   │
│  │ accessibility     │  │ cognitive_flags   │  │ life_chapters     │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       FAMILY DASHBOARD                                   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │ Emotional Trends  │  │ Wellness Alerts   │  │ Conversation      │   │
│  │ (mood charts)     │  │ (health/mood)     │  │ Highlights        │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │ Relationship      │  │ Milestone         │  │ Accessibility     │   │
│  │ Quality Metrics   │  │ Calendar          │  │ Settings          │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## System 1: Deep Life Story Engine

### Purpose
Captures and utilizes biographical information to create deeply personalized conversations that reference the senior's life history, formative experiences, and personal narratives.

### Database Schema

```sql
-- New table for structured life chapters
CREATE TABLE ultaura_life_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  chapter_type text NOT NULL CHECK (chapter_type IN (
    'childhood', 'education', 'career', 'marriage', 'parenting',
    'military', 'travel', 'retirement', 'accomplishment', 'loss', 'other'
  )),
  title text NOT NULL,
  era_start_year integer,
  era_end_year integer,
  location text,

  -- Encrypted narrative content
  narrative_ciphertext bytea NOT NULL,
  narrative_iv bytea NOT NULL,
  narrative_tag bytea NOT NULL,
  narrative_alg text NOT NULL DEFAULT 'aes-256-gcm',
  narrative_kid text NOT NULL DEFAULT 'kek_v1',

  key_people text[],
  emotional_tone text CHECK (emotional_tone IN ('joyful', 'proud', 'bittersweet', 'difficult', 'neutral')),
  times_referenced integer NOT NULL DEFAULT 0,
  last_referenced_at timestamptz,
  connects_to_chapter_ids uuid[],
  source text NOT NULL DEFAULT 'conversation' CHECK (source IN ('conversation', 'family_input', 'onboarding'))
);

CREATE INDEX idx_life_chapters_line ON ultaura_life_chapters(line_id);
CREATE INDEX idx_life_chapters_type ON ultaura_life_chapters(line_id, chapter_type);

-- Extend ultaura_lines with era context
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS birth_decade integer GENERATED ALWAYS AS ((birth_year / 10) * 10) STORED,
  ADD COLUMN IF NOT EXISTS formative_decade integer,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS current_location text;
```

### Memory Type Extension

Use existing `history` type with structured value:

```typescript
interface LifeStoryMemoryValue {
  chapterId?: string;
  era: string; // e.g., "1950s childhood"
  location?: string;
  keyPeople?: string[];
  emotionalSignificance: 'high' | 'medium' | 'low';
  narrativeThread?: string;
}
```

### Prompt Section

**File**: `/packages/prompts/src/golden/sections/life-story.ts`

```typescript
export const LIFE_STORY_SECTION = {
  tag: 'life_story',
  full: `## Life Story Context

{userName}'s life story provides context for meaningful conversation.

### Era Context
- Born: {birthDecade}s
- Formative years: {formativeDecade}s
- Hometown: {hometown}
- Current location: {currentLocation}

### Life Chapters
{lifeChaptersFormatted}

### Narrative Threading Guidelines
When {userName} shares a story:
1. Store it using store_memory with type='history'
2. Note connections to existing chapters
3. Reference related memories naturally: "That reminds me of when you mentioned..."
4. For ongoing stories, pick up where you left off

### Era-Aware Conversation
- Reference pop culture, events from their formative years
- Connect their experiences to broader historical context when natural`,
  compressed: `## Life Story
Era: {birthDecade}s born, {formativeDecade}s formative. Chapters: {lifeChaptersCompressed}
Reference their era naturally; thread narratives across calls.`
};
```

### New Grok Tool

```typescript
{
  type: 'function',
  name: 'store_life_chapter',
  description: 'Store a significant life chapter when senior shares an important story.',
  parameters: {
    type: 'object',
    properties: {
      chapter_type: {
        type: 'string',
        enum: ['childhood', 'education', 'career', 'marriage', 'parenting',
               'military', 'travel', 'retirement', 'accomplishment', 'loss', 'other']
      },
      title: { type: 'string' },
      era_start_year: { type: 'integer' },
      era_end_year: { type: 'integer' },
      narrative_summary: { type: 'string' },
      key_people: { type: 'array', items: { type: 'string' } },
      emotional_tone: { type: 'string', enum: ['joyful', 'proud', 'bittersweet', 'difficult', 'neutral'] }
    },
    required: ['chapter_type', 'title', 'narrative_summary']
  }
}
```

### API Endpoint

`POST /tools/store_life_chapter`

### Privacy

- All narrative content encrypted at rest
- Life chapters inherit `line_only` privacy scope
- Never surfaced to family dashboard directly

---

## System 2: Adaptive Emotional Intelligence

### Purpose
Detects emotional states in real-time and adapts conversation strategy. Provides therapeutic techniques and mood-appropriate responses.

### Database Schema

```sql
-- Mood snapshots per call
CREATE TABLE ultaura_mood_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Three-point mood tracking
  mood_start text CHECK (mood_start IN ('positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated')),
  mood_mid text CHECK (mood_mid IN ('positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated')),
  mood_end text CHECK (mood_end IN ('positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated')),

  mood_start_at timestamptz,
  mood_mid_at timestamptz,
  mood_end_at timestamptz,

  mood_trajectory text CHECK (mood_trajectory IN ('improved', 'declined', 'stable')),
  techniques_used text[] DEFAULT '{}',
  technique_effectiveness jsonb DEFAULT '{}',
  energy_level text CHECK (energy_level IN ('high', 'normal', 'low', 'very_low')),

  UNIQUE(call_session_id)
);

CREATE INDEX idx_mood_snapshots_line ON ultaura_mood_snapshots(line_id, created_at DESC);

-- Emotional patterns for trend detection
CREATE TABLE ultaura_emotional_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  dominant_mood text,
  mood_variability text CHECK (mood_variability IN ('stable', 'moderate', 'high')),
  best_time_of_day text CHECK (best_time_of_day IN ('morning', 'afternoon', 'evening')),
  worst_time_of_day text CHECK (worst_time_of_day IN ('morning', 'afternoon', 'evening')),
  positive_triggers text[],
  negative_triggers text[],
  effective_techniques text[],
  ineffective_techniques text[]
);
```

### Prompt Section

**File**: `/packages/prompts/src/golden/sections/emotional-intelligence.ts`

```typescript
export const EMOTIONAL_INTELLIGENCE_SECTION = {
  tag: 'emotional_intelligence',
  full: `## Emotional Intelligence

### Mood Detection
Assess {userName}'s emotional state through:
- Tone of voice (energy, pace, pitch)
- Word choice and language patterns
- Topic selection and engagement level

### Mood Categories
- positive: Upbeat, engaged, sharing happily
- neutral: Conversational, neither up nor down
- low: Subdued, less responsive, slower
- anxious: Worried, repetitive concerns
- sad: Grief, loss-focused, tearful
- frustrated: Irritated, complaining

### Adaptive Response Strategies

**LOW mood:** Validate feelings, offer gentle distraction, use reminiscence
**ANXIOUS mood:** Ground in present, break down concerns, reassure
**SAD mood:** Acknowledge, sit with silence, offer companionship
**FRUSTRATED mood:** Validate, don't defend, offer subject change

### Therapeutic Micro-Techniques
- Reflection: "It sounds like..."
- Normalization: "Many people feel that way"
- Positive reframing: "That shows how much you care"
- Gratitude prompt: "What's one small thing that went well?"

### Call log_mood_snapshot at END
Record: mood_start, mood_mid, mood_end, mood_trajectory, techniques_used, energy_level`,
  compressed: `## Emotional Intelligence
Detect mood: positive/neutral/low/anxious/sad/frustrated.
Adapt response. Use therapeutic techniques naturally. Match energy.
Call log_mood_snapshot at end with start/mid/end moods and trajectory.`
};
```

### New Grok Tool

```typescript
{
  type: 'function',
  name: 'log_mood_snapshot',
  description: 'Record mood observations at call end.',
  parameters: {
    type: 'object',
    properties: {
      mood_start: { type: 'string', enum: ['positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated'] },
      mood_mid: { type: 'string', enum: ['positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated'] },
      mood_end: { type: 'string', enum: ['positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated'] },
      mood_trajectory: { type: 'string', enum: ['improved', 'declined', 'stable'] },
      techniques_used: { type: 'array', items: { type: 'string' } },
      energy_level: { type: 'string', enum: ['high', 'normal', 'low', 'very_low'] }
    },
    required: ['mood_start', 'mood_end', 'mood_trajectory', 'energy_level']
  }
}
```

### Dashboard Component

`/src/app/dashboard/(app)/insights/MoodTrendChart.tsx`
- 14-day mood trend line chart
- Mood distribution pie chart
- Energy level indicators
- Mood trajectory per call

---

## System 3: Personalized Content Engine

### Purpose
Generates on-the-fly personalized content including serialized fiction, trivia, memory lane journeys, and brain games tailored to interests, era, and cognitive needs.

### Database Schema

```sql
-- Extend existing story_arcs
ALTER TABLE ultaura_story_arcs
  ADD COLUMN IF NOT EXISTS personalization_context jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS era_setting text,
  ADD COLUMN IF NOT EXISTS themes text[],
  ADD COLUMN IF NOT EXISTS engagement_score decimal(3,2);

-- Content preferences per line
CREATE TABLE ultaura_content_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  trivia_preference integer DEFAULT 3 CHECK (trivia_preference BETWEEN 1 AND 5),
  story_preference integer DEFAULT 3 CHECK (story_preference BETWEEN 1 AND 5),
  memory_lane_preference integer DEFAULT 3 CHECK (memory_lane_preference BETWEEN 1 AND 5),
  brain_games_preference integer DEFAULT 3 CHECK (brain_games_preference BETWEEN 1 AND 5),

  favorite_trivia_domains text[] DEFAULT '{}',
  avoided_trivia_domains text[] DEFAULT '{}',
  trivia_difficulty text DEFAULT 'medium' CHECK (trivia_difficulty IN ('easy', 'medium', 'hard')),

  favorite_story_genres text[] DEFAULT '{}',
  avoided_story_themes text[] DEFAULT '{}',
  preferred_story_length text DEFAULT 'medium' CHECK (preferred_story_length IN ('short', 'medium', 'long')),

  favorite_eras text[] DEFAULT '{}',
  favorite_memory_topics text[] DEFAULT '{}',

  best_segment_time_of_call text DEFAULT 'middle' CHECK (best_segment_time_of_call IN ('early', 'middle', 'late'))
);
```

### Prompt Section

```typescript
export const CONTENT_ENGINE_SECTION = {
  tag: 'content_engine',
  full: `## Personalized Content Engine

Generate personalized content on-the-fly based on {userName}'s interests and era.

### Content Types

**1. Trivia (2-3 minutes)**
From their interests: {favoriteTriviaDomains}
Difficulty: {triviaDifficulty}
Connect answers to their experiences

**2. Serialized Stories (3-5 minutes per chapter)**
Era settings: {eraSetting}
Themes: {favoriteStoryGenres}
End each chapter with cliffhanger
Maximum 3 active story arcs

**3. Memory Lane Journeys (2-4 minutes)**
Topics: {favoriteMemoryTopics}
Eras: {favoriteEras}
Use "What do you remember about..." prompts

**4. Brain Games (2-3 minutes)**
Word association, trivia with hints, pattern games
Adjust difficulty based on success

### Active Story Arcs
{activeStoryArcsFormatted}`,
  compressed: `## Content
Generate trivia, stories, memory lane, brain games dynamically.
Era: {birthDecade}s-{formativeDecade}s. Max 3 story arcs.
Offer content when conversation lulls. Never force.`
};
```

### New Grok Tool

```typescript
{
  type: 'function',
  name: 'update_content_preference',
  description: 'Update content preferences based on engagement.',
  parameters: {
    type: 'object',
    properties: {
      content_type: { type: 'string', enum: ['trivia', 'story', 'memory_lane', 'brain_games'] },
      preference_change: { type: 'string', enum: ['increase', 'decrease'] },
      specific_update: { type: 'object' }
    },
    required: ['content_type', 'preference_change']
  }
}
```

---

## System 4: Family Connection & Relationship Mapping

### Purpose
Maintains comprehensive relationship map with extended attributes for personalized conversation nurturing.

### Database Schema

```sql
-- Extended relationship tracking
CREATE TABLE ultaura_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  name text NOT NULL,
  nickname text,
  relation_type text NOT NULL, -- 'family', 'friend', 'professional', 'pet'
  relation_role text NOT NULL, -- 'daughter', 'grandson', 'neighbor', 'doctor'

  contact_frequency text CHECK (contact_frequency IN ('daily', 'weekly', 'monthly', 'rarely', 'unknown')),
  last_contact_mentioned timestamptz,
  typical_contact_method text,

  sentiment text DEFAULT 'positive' CHECK (sentiment IN ('positive', 'neutral', 'complicated', 'strained')),
  emotional_significance text DEFAULT 'medium' CHECK (emotional_significance IN ('high', 'medium', 'low')),

  location text,
  distance_category text CHECK (distance_category IN ('local', 'regional', 'distant', 'unknown')),

  shared_activities text[],
  conversation_topics text[],

  times_mentioned integer DEFAULT 1,
  last_mentioned_at timestamptz,
  recent_topics text[],

  -- Grief tracking (System 9)
  is_deceased boolean DEFAULT false,
  passed_at timestamptz,
  death_mentioned_at timestamptz,
  grief_sensitivity text CHECK (grief_sensitivity IN ('high', 'medium', 'low')),

  privacy_scope text DEFAULT 'line_only' CHECK (privacy_scope IN ('line_only', 'shareable_with_payer'))
);

CREATE INDEX idx_relationships_line ON ultaura_relationships(line_id);
CREATE INDEX idx_relationships_deceased ON ultaura_relationships(line_id, is_deceased) WHERE is_deceased = true;
```

### Extended Relationship Memory Value

```typescript
interface RelationshipMemoryValue {
  relationshipId?: string;
  name: string;
  role: string;
  nickname?: string;
  relationType?: 'family' | 'friend' | 'professional' | 'pet';
  contactFrequency?: 'daily' | 'weekly' | 'monthly' | 'rarely' | 'unknown';
  sentiment?: 'positive' | 'neutral' | 'complicated' | 'strained';
  location?: string;
  sharedActivities?: string[];
  emotionalSignificance?: 'high' | 'medium' | 'low';
  isDeceased?: boolean;
  passedAt?: string;
  griefSensitivity?: 'high' | 'medium' | 'low';
}
```

### Prompt Section

```typescript
export const RELATIONSHIP_MAPPING_SECTION = {
  tag: 'relationships',
  full: `## Relationship Network

{userName}'s important people:

### Family
{familyRelationshipsFormatted}

### Friends & Community
{friendRelationshipsFormatted}

### Deceased Loved Ones
{deceasedRelationshipsFormatted}

### Relationship Nurturing
1. Remember details: "How is {grandchildName} doing with {sharedActivity}?"
2. Track mentions: store new info via update_relationship
3. Prompt follow-ups for HIGH significance relationships
4. For complicated: acknowledge without probing
5. For deceased: allow memories, don't avoid`,
  compressed: `## Relationships
Family: {familyCompressed}. Friends: {friendsCompressed}. Deceased: {deceasedCompressed}.
Remember details, track mentions, prompt follow-ups for high-significance.`
};
```

### New Grok Tools

```typescript
{
  type: 'function',
  name: 'update_relationship',
  description: 'Update relationship information.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      updates: {
        type: 'object',
        properties: {
          nickname: { type: 'string' },
          contact_frequency: { type: 'string' },
          sentiment: { type: 'string' },
          recent_topic: { type: 'string' },
          location: { type: 'string' },
          shared_activity: { type: 'string' }
        }
      }
    },
    required: ['name', 'updates']
  }
},
{
  type: 'function',
  name: 'mark_relationship_deceased',
  description: 'Mark a relationship as deceased.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      passed_at: { type: 'string' },
      grief_sensitivity: { type: 'string', enum: ['high', 'medium', 'low'] }
    },
    required: ['name']
  }
}
```

### Dashboard Component

`/src/app/dashboard/(app)/lines/[lineId]/Relationships.tsx`
- Visual relationship map
- Mention frequency
- Sentiment indicators
- No private content

---

## System 5: Cognitive Accessibility & Context Continuity

### Purpose
Adapts communication for hearing/cognitive needs, provides context pickup between calls, implements tiered cognitive support.

### Database Schema

```sql
-- Accessibility settings per line
CREATE TABLE ultaura_accessibility_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  hearing_mode text DEFAULT 'normal' CHECK (hearing_mode IN ('normal', 'enhanced_clarity', 'slow_pace')),
  speech_rate decimal(3,2) DEFAULT 1.0 CHECK (speech_rate BETWEEN 0.7 AND 1.3),
  pause_between_sentences boolean DEFAULT false,
  repeat_key_info boolean DEFAULT true,

  cognitive_mode text DEFAULT 'normal' CHECK (cognitive_mode IN ('normal', 'supportive', 'high_support')),
  simplified_language boolean DEFAULT false,
  shorter_responses boolean DEFAULT false,

  provide_call_recap boolean DEFAULT true,
  remind_of_previous_topics boolean DEFAULT true,
  context_window_calls integer DEFAULT 10,

  hearing_mode_source text DEFAULT 'default' CHECK (hearing_mode_source IN ('default', 'family', 'ai_detected', 'senior_request')),
  cognitive_mode_source text DEFAULT 'default'
);

-- Cognitive observations
CREATE TABLE ultaura_cognitive_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  observation_type text NOT NULL CHECK (observation_type IN (
    'confusion', 'repetition', 'word_finding', 'orientation', 'memory_lapse'
  )),
  severity text CHECK (severity IN ('mild', 'moderate', 'significant')),
  context text,
  response_given text,
  is_novel boolean DEFAULT true,
  similar_observation_count integer DEFAULT 1
);

-- Cognitive concern flags (tiered response)
CREATE TABLE ultaura_cognitive_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  concern_level text DEFAULT 'none' CHECK (concern_level IN ('none', 'monitoring', 'flagged')),
  confusion_count_14d integer DEFAULT 0,
  repetition_count_14d integer DEFAULT 0,
  orientation_count_14d integer DEFAULT 0,
  consecutive_calls_with_concern integer DEFAULT 0,
  last_concern_at timestamptz,
  flagged_at timestamptz,
  family_notified_at timestamptz
);
```

### Prompt Section

```typescript
export const ACCESSIBILITY_SECTION = {
  tag: 'accessibility',
  full: `## Accessibility & Context Continuity

### Settings
- Hearing: {hearingMode}, Rate: {speechRate}x
- Cognitive: {cognitiveMode}
- Context window: {contextWindowCalls} calls

### Context Continuity
At call START: "Last time we talked about {lastCallTopicsSummary}."
Reference last {contextWindowCalls} calls naturally.

### Cognitive Support (Tiered)
**Occasional confusion:** Supportive response only, log observation
**Repeated patterns (3+ calls):** Auto-flag for family notification

### Important
- NEVER diagnose or suggest dementia
- NEVER express worry to senior
- Observations for pattern detection only`,
  compressed: `## Accessibility
Hearing: {hearingMode}. Cognitive: {cognitiveMode}. Rate: {speechRate}x.
Context recap at start. Confusion: supportive only, log. 3+ calls: auto-flag.
Never diagnose. Never express worry.`
};
```

### New Grok Tools

```typescript
{
  type: 'function',
  name: 'log_cognitive_observation',
  description: 'Log cognitive observation for pattern detection.',
  parameters: {
    type: 'object',
    properties: {
      observation_type: { type: 'string', enum: ['confusion', 'repetition', 'word_finding', 'orientation', 'memory_lapse'] },
      severity: { type: 'string', enum: ['mild', 'moderate', 'significant'] },
      context: { type: 'string' },
      response_given: { type: 'string' }
    },
    required: ['observation_type', 'severity']
  }
},
{
  type: 'function',
  name: 'adjust_accessibility',
  description: 'Adjust accessibility settings.',
  parameters: {
    type: 'object',
    properties: {
      setting: { type: 'string', enum: ['speech_rate', 'hearing_mode', 'cognitive_mode'] },
      value: { type: 'string' },
      source: { type: 'string', enum: ['senior_request', 'ai_detected'] }
    },
    required: ['setting', 'value']
  }
}
```

### Dashboard Component

`/src/app/dashboard/(app)/lines/[lineId]/settings/Accessibility.tsx`
- Hearing mode selector
- Speech rate slider
- Cognitive support toggle
- Cognitive flag indicator

---

## System 6: Adaptive Companion Personality

### Purpose
Learns and mirrors senior's communication style, energy, vocabulary, and patterns.

### Database Schema

```sql
CREATE TABLE ultaura_persona_adaptations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  formality_level text DEFAULT 'warm' CHECK (formality_level IN ('casual', 'warm', 'formal')),
  humor_level text DEFAULT 'light' CHECK (humor_level IN ('none', 'light', 'moderate', 'frequent')),
  directness_level text DEFAULT 'balanced' CHECK (directness_level IN ('very_direct', 'balanced', 'gentle')),

  vocabulary_complexity text DEFAULT 'standard' CHECK (vocabulary_complexity IN ('simple', 'standard', 'sophisticated')),
  regional_expressions text[] DEFAULT '{}',
  preferred_phrases text[] DEFAULT '{}',
  avoided_phrases text[] DEFAULT '{}',

  prefers_short_exchanges boolean DEFAULT false,
  prefers_stories boolean DEFAULT true,
  asks_many_questions boolean DEFAULT true,

  typical_energy text DEFAULT 'moderate' CHECK (typical_energy IN ('high', 'moderate', 'low', 'variable')),
  morning_energy text,
  afternoon_energy text,
  evening_energy text,

  calls_analyzed integer DEFAULT 0,
  confidence_score decimal(3,2) DEFAULT 0.5
);
```

### Prompt Section

```typescript
export const ADAPTIVE_PERSONA_SECTION = {
  tag: 'adaptive_persona',
  full: `## Adaptive Companion Personality

### Learned Style for {userName}
- Formality: {formalityLevel}
- Humor: {humorLevel}
- Directness: {directnessLevel}
- Vocabulary: {vocabularyComplexity}

### Vocabulary Adaptation
- Use their phrases: {preferredPhrases}
- Avoid: {avoidedPhrases}
- Regional expressions: {regionalExpressions}

### Energy Matching
Typical: {typicalEnergy}. Now: {timeSpecificEnergy}
Match their pace and energy level.`,
  compressed: `## Persona
Style: {formalityLevel}/{humorLevel}/{directnessLevel}. Vocab: {vocabularyComplexity}.
Energy: {typicalEnergy} typical, {timeSpecificEnergy} now. Mirror naturally.`
};
```

### Post-Call Analysis

New service: `/telephony/src/services/persona-analyzer.ts`
- Analyzes engagement patterns
- Updates persona adaptations automatically

---

## System 7: Seamless Companion Experience

### Purpose
Ensures natural conversation flow, authentic interest, appropriate AI transparency.

### Prompt Section (no database changes)

```typescript
export const SEAMLESS_EXPERIENCE_SECTION = {
  tag: 'seamless_experience',
  full: `## Seamless Companion Experience

### Natural Flow
- Smooth transitions: "That reminds me..." not "Now let's talk about..."
- Authentic interest: Ask follow-ups, remember details
- Allow comfortable silences

### AI Transparency
- Transparent if directly asked
- Don't proactively announce AI nature
- Focus on genuine connection

### Avoid Uncanny Valley
- Don't claim human experiences
- Don't use robotic phrases
- Use remembered info naturally: "How's Sarah?" not "My records show..."

### Error Recovery
- "Let me make sure I heard you right..."
- Never pretend to understand when you didn't`,
  compressed: `## Seamless
Natural transitions. Authentic interest. Allow pauses. Transparent if asked.
Don't claim human experiences. Use memories naturally. Recover gracefully.`
};
```

---

## System 8: Celebration & Validation System

### Purpose
Tracks milestones and provides timely celebration and validation.

### Database Schema

```sql
CREATE TABLE ultaura_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  milestone_type text NOT NULL CHECK (milestone_type IN (
    'birthday', 'anniversary', 'memorial', 'achievement', 'holiday', 'custom'
  )),
  title text NOT NULL,
  description text,

  date_month integer NOT NULL CHECK (date_month BETWEEN 1 AND 12),
  date_day integer NOT NULL CHECK (date_day BETWEEN 1 AND 31),
  date_year integer,
  is_recurring boolean NOT NULL DEFAULT true,

  related_relationship_id uuid REFERENCES ultaura_relationships(id) ON DELETE SET NULL,
  related_person_name text,

  notify_days_before integer DEFAULT 0,
  notify_on_day boolean DEFAULT true,

  last_celebrated_at timestamptz,
  times_celebrated integer DEFAULT 0,

  source text DEFAULT 'conversation' CHECK (source IN ('conversation', 'family_input', 'calendar_import')),
  privacy_scope text DEFAULT 'shareable_with_payer'
);

CREATE INDEX idx_milestones_upcoming ON ultaura_milestones(date_month, date_day);
```

### Prompt Section

```typescript
export const CELEBRATION_SECTION = {
  tag: 'celebration',
  full: `## Celebration & Validation

### Today's Celebrations
{todayMilestonesFormatted}

### Upcoming Milestones
{upcomingMilestonesFormatted}

### Guidelines
**Birthdays:** Lead with celebration, ask about plans
**Anniversaries:** Congratulate, prompt memory sharing
**Memorial Dates:** Gentle acknowledgment, allow them to share
**Achievements:** Enthusiastic validation

### Storing Milestones
Call store_milestone when they mention dates
Call mark_milestone_celebrated after acknowledging`,
  compressed: `## Celebrate
Today: {todayMilestonesFormatted}. Upcoming: {upcomingMilestonesFormatted}.
Lead with celebration. Allow memorial reflection. Store new dates.`
};
```

### New Grok Tools

```typescript
{
  type: 'function',
  name: 'store_milestone',
  description: 'Store a milestone.',
  parameters: {
    type: 'object',
    properties: {
      milestone_type: { type: 'string', enum: ['birthday', 'anniversary', 'memorial', 'achievement', 'holiday', 'custom'] },
      title: { type: 'string' },
      date_month: { type: 'integer', minimum: 1, maximum: 12 },
      date_day: { type: 'integer', minimum: 1, maximum: 31 },
      date_year: { type: 'integer' },
      related_person_name: { type: 'string' },
      is_recurring: { type: 'boolean' }
    },
    required: ['milestone_type', 'title', 'date_month', 'date_day']
  }
},
{
  type: 'function',
  name: 'mark_milestone_celebrated',
  description: 'Mark milestone as acknowledged.',
  parameters: {
    type: 'object',
    properties: {
      milestone_id: { type: 'string' },
      milestone_title: { type: 'string' }
    }
  }
}
```

### Dashboard Component

`/src/app/dashboard/(app)/lines/[lineId]/milestones/MilestoneCalendar.tsx`
- Calendar view with milestones
- Add/edit form
- Celebration history

---

## System 9: Grief & Loss Support

### Purpose
Sensitively handles conversations about deceased loved ones and supports during grief.

### Database Schema

Uses `ultaura_relationships` with `is_deceased`, `passed_at`, `grief_sensitivity` (from System 4).

Additional:

```sql
CREATE TABLE ultaura_grief_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  relationship_id uuid REFERENCES ultaura_relationships(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  interaction_type text NOT NULL CHECK (interaction_type IN (
    'mention', 'memory_sharing', 'grief_expression', 'anniversary_acknowledgment'
  )),
  emotional_tone text CHECK (emotional_tone IN ('sad', 'nostalgic', 'grateful', 'peaceful', 'complicated')),
  support_techniques_used text[],
  days_since_passing integer
);
```

### Prompt Section

```typescript
export const GRIEF_SUPPORT_SECTION = {
  tag: 'grief_support',
  full: `## Grief & Loss Support

### Deceased Loved Ones
{deceasedRelationshipsWithContext}

### Guidelines
- Follow their lead
- "Tell me about {name}" not past tense
- Allow memory sharing without redirecting
- Validate: "It sounds like you really miss them"

### New Death Disclosure
1. Express sympathy
2. Ask if they want to talk
3. Call mark_relationship_deceased
4. Store memories they share

### What NOT to do
- Don't say "They're in a better place"
- Don't rush through grief
- Don't compare losses`,
  compressed: `## Grief
Deceased: {deceasedCompressed}. Follow their lead. Allow memories.
New death: express sympathy, call mark_relationship_deceased.
Don't rush or compare.`
};
```

---

## System 10: Daily Rhythm Awareness

### Purpose
Maps daily patterns, enables time-aware conversations, optimizes call scheduling.

### Database Schema

```sql
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS optimal_call_time time,
  ADD COLUMN IF NOT EXISTS optimal_call_time_source text CHECK (optimal_call_time_source IN ('family_set', 'ai_learned', 'senior_request')),
  ADD COLUMN IF NOT EXISTS optimal_call_days integer[];

CREATE TABLE ultaura_daily_rhythms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  morning_energy text DEFAULT 'moderate' CHECK (morning_energy IN ('high', 'moderate', 'low')),
  afternoon_energy text DEFAULT 'moderate',
  evening_energy text DEFAULT 'moderate',

  morning_routine_summary text,
  afternoon_routine_summary text,
  evening_routine_summary text,

  best_engagement_time time,
  worst_engagement_time time,
  avg_duration_by_time jsonb,

  best_days_of_week integer[],
  avoid_days_of_week integer[]
);
```

### Prompt Section

```typescript
export const DAILY_RHYTHM_SECTION = {
  tag: 'daily_rhythm',
  full: `## Daily Rhythm Awareness

### Current Context
Time: {currentTimeOfDay}. Day: {currentDayOfWeek}. Expected energy: {expectedEnergyNow}

### Typical Day
- Morning: {morningRoutineSummary}
- Afternoon: {afternoonRoutineSummary}
- Evening: {eveningRoutineSummary}

### Time-Aware Conversation
Reference routines naturally. Match energy to time.
If engagement consistently low: offer to reschedule.`,
  compressed: `## Rhythm
Time: {currentTimeOfDay}. Energy: {expectedEnergyNow}.
Morning: {morningRoutineSummary}. Afternoon: {afternoonRoutineSummary}. Evening: {eveningRoutineSummary}.
Match energy. Offer reschedule if engagement low.`
};
```

---

## System 11: Health & Wellness Context

### Purpose
Tracks health mentions (private by default), provides wellness check-ins, never gives medical advice.

### Database Schema

```sql
CREATE TABLE ultaura_health_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Encrypted content
  mention_ciphertext bytea NOT NULL,
  mention_iv bytea NOT NULL,
  mention_tag bytea NOT NULL,
  mention_alg text NOT NULL DEFAULT 'aes-256-gcm',
  mention_kid text NOT NULL DEFAULT 'kek_v1',

  category text NOT NULL CHECK (category IN (
    'pain', 'medication', 'appointment', 'symptom', 'sleep',
    'appetite', 'mobility', 'energy', 'general'
  )),
  severity text CHECK (severity IN ('mild', 'moderate', 'concerning')),

  triggers_alert boolean DEFAULT false,
  alert_sent_at timestamptz
);

CREATE INDEX idx_health_mentions_alert ON ultaura_health_mentions(triggers_alert) WHERE triggers_alert = true;
-- Service role only - no user RLS policies
```

### Prompt Section

```typescript
export const HEALTH_WELLNESS_SECTION = {
  tag: 'health_wellness',
  full: `## Health & Wellness Context

### Privacy First
ALL health mentions are PRIVATE. Never share with family.

### Track via log_health_mention
- Pain, medication, symptoms, sleep, appetite, mobility, energy

### Alert Triggers (auto-notify family)
- Severe pain, medication confusion, concerning symptoms, falls

### Guidelines
- Acknowledge: "That sounds uncomfortable"
- Never diagnose or advise
- Suggest doctor for concerning symptoms
- Log silently

### What NOT to do
- Don't give medical advice
- Don't scare them
- Don't promise everything will be okay`,
  compressed: `## Health
ALL health PRIVATE. Track: pain, medication, symptoms, sleep, appetite.
Alert family only for severe/concerning. Never diagnose. Suggest doctor. Log silently.`
};
```

### New Grok Tool

```typescript
{
  type: 'function',
  name: 'log_health_mention',
  description: 'Log health mention. Always private.',
  parameters: {
    type: 'object',
    properties: {
      category: { type: 'string', enum: ['pain', 'medication', 'appointment', 'symptom', 'sleep', 'appetite', 'mobility', 'energy', 'general'] },
      summary: { type: 'string' },
      severity: { type: 'string', enum: ['mild', 'moderate', 'concerning'] }
    },
    required: ['category', 'summary']
  }
}
```

---

## System 12: Emotional Trend Insights (Dashboard)

### Purpose
Visualizes mood patterns for family dashboard.

### Dashboard Components

1. `/src/app/dashboard/(app)/insights/EmotionalTrends.tsx`
   - Mood distribution pie chart
   - Mood trend line over time
   - Energy level indicators
   - "Concerning patterns" alert

2. `/src/app/dashboard/(app)/insights/MoodCalendar.tsx`
   - Heatmap calendar by mood

### Server Actions

```typescript
export async function getEmotionalTrends(lineId: string, days: number = 14): Promise<EmotionalTrendsData>;
export async function getMoodCalendar(lineId: string, month: string): Promise<MoodCalendarData>;
```

---

## System 13: Proactive Wellness Alerts

### Purpose
Notifies family of health mentions and mood drops.

### Database Schema

```sql
CREATE TABLE ultaura_wellness_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  alert_type text NOT NULL CHECK (alert_type IN (
    'health_mention', 'mood_drop', 'cognitive_concern', 'missed_calls', 'custom'
  )),
  severity text NOT NULL CHECK (severity IN ('info', 'warning', 'urgent')),

  title text NOT NULL,
  summary text NOT NULL,

  source_call_session_id uuid REFERENCES ultaura_call_sessions(id),

  delivery_method text NOT NULL CHECK (delivery_method IN ('email', 'sms', 'push', 'dashboard_only')),
  delivered_at timestamptz,

  acknowledged_at timestamptz,
  acknowledged_by_user_id uuid
);

ALTER TABLE ultaura_notification_preferences
  ADD COLUMN IF NOT EXISTS health_mention_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mood_drop_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cognitive_concern_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_delivery_method text DEFAULT 'email';
```

### Alert Generation Service

`/telephony/src/services/wellness-alerts.ts`
- Triggered after call completion
- Checks mood drops, health mentions, cognitive flags
- Generates and delivers alerts

### Dashboard Components

1. `/src/app/dashboard/(app)/alerts/WellnessAlertsList.tsx`
2. `/src/app/dashboard/(app)/lines/[lineId]/settings/AlertSettings.tsx`

---

## System 14: Conversation Highlights (Dashboard)

### Purpose
Shows topic summaries without verbatim quotes.

### Dashboard Components

1. `/src/app/dashboard/(app)/lines/[lineId]/insights/ConversationHighlights.tsx`
   - Topics discussed per call
   - New memories added (keys only)
   - Milestones mentioned
   - Mood indicator

2. `/src/app/dashboard/(app)/lines/[lineId]/insights/MemoryActivity.tsx`
   - Recent memory keys (no values)
   - Category distribution
   - Private indicator

### Privacy

```typescript
interface MemoryActivityItem {
  memoryId: string;
  type: MemoryType;
  key: string;
  createdAt: string;
  isPrivate: boolean;
  // value NEVER included
}
```

---

## System 15: Relationship Quality Indicators (Dashboard)

### Purpose
Shows mention frequency and sentiment for relationships.

### Dashboard Component

`/src/app/dashboard/(app)/lines/[lineId]/insights/RelationshipIndicators.tsx`
- People mentioned most frequently
- Sentiment indicators
- Recent mention dates
- Relationship map visualization

### Data Structure

```typescript
interface RelationshipIndicator {
  name: string;
  relationType: string;
  relationRole: string;
  sentiment: 'positive' | 'neutral' | 'complicated';
  mentionCount30d: number;
  lastMentionedAt: string | null;
  // No private details
}
```

---

## System 16: Natural Interruption Handling

### Purpose
Configures patience parameters for natural voice interaction.

### Database Schema

```sql
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS interruption_tolerance text DEFAULT 'normal' CHECK (interruption_tolerance IN ('high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS filler_word_patience text DEFAULT 'normal' CHECK (filler_word_patience IN ('high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS silence_tolerance_ms integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS crosstalk_recovery_mode text DEFAULT 'patient' CHECK (crosstalk_recovery_mode IN ('immediate', 'patient', 'very_patient'));
```

### Prompt Section

```typescript
export const INTERRUPTION_HANDLING_SECTION = {
  tag: 'interruption_handling',
  full: `## Natural Interruption Handling

### Settings
- Interruption tolerance: {interruptionTolerance}
- Filler patience: {fillerWordPatience}
- Silence tolerance: {silenceToleranceMs}ms
- Cross-talk recovery: {crosstalkRecoveryMode}

### Recovery Phrases
- "Oh, please go ahead"
- "Sorry, you first"
- "Take your time, I'm listening"

### Word-Finding Support
Wait patiently. Don't guess too quickly.
If they ask: offer gentle suggestions.`,
  compressed: `## Interruptions
Tolerance: {interruptionTolerance}. Filler: {fillerWordPatience}. Silence: {silenceToleranceMs}ms.
"Please go ahead" for crosstalk. Help word-finding gently.`
};
```

### Grok Session Config

Update VAD settings in `/telephony/src/websocket/grok-bridge.ts`:

```typescript
turn_detection: {
  type: 'server_vad',
  threshold: this.getVadThreshold(), // varies by interruption_tolerance
  prefix_padding_ms: this.getPrefixPadding(), // varies by filler_word_patience
  silence_duration_ms: this.options.silenceToleranceMs || VAD_SILENCE_DURATION_MS,
}
```

---

## Prompt Engineering Strategy

### Assembly Order in `compilePrompt()`

```typescript
// 1. Core Identity (existing)
// 2. Adaptive Persona (System 6) ~200 tokens
// 3. Life Story (System 1) ~500-2000 tokens
// 4. Relationships (System 4) ~500-1500 tokens
// 5. Emotional Intelligence (System 2) ~400 tokens
// 6. Accessibility (System 5) ~300 tokens
// 7. Daily Rhythm (System 10) ~200 tokens
// 8. Memories (existing, enhanced) ~1000-5000 tokens
// 9. Health/Wellness (System 11) ~300 tokens
// 10. Celebration (System 8) ~200 tokens
// 11. Grief Support (System 9) ~300 tokens
// 12. Content Engine (System 3) ~400 tokens
// 13. Seamless Experience (System 7) ~300 tokens
// 14. Interruption Handling (System 16) ~150 tokens
// 15. Existing sections (safety, privacy, tools, etc.)
// 16. Dynamic context (recent calls, preview)
```

### Token Estimation

| Component | Compressed | Full |
|-----------|------------|------|
| Core Identity | 50 | 100 |
| Adaptive Persona | 80 | 200 |
| Life Story | 200-500 | 500-2000 |
| Relationships | 200-400 | 500-1500 |
| Emotional Intelligence | 150 | 400 |
| Accessibility | 100 | 300 |
| Daily Rhythm | 80 | 200 |
| Memories | 500-2000 | 1000-5000 |
| Health/Wellness | 100 | 300 |
| Celebration | 80 | 200 |
| Grief Support | 100 | 300 |
| Content Engine | 150 | 400 |
| Seamless Experience | 100 | 300 |
| Interruption Handling | 60 | 150 |
| Existing Sections | 800 | 1500 |
| Dynamic Context | 300-600 | 500-1000 |
| **Total** | **3,000-6,000** | **7,000-15,000** |

Well within 2M token limit.

---

## Implementation Sequence

### Phase 1: Foundation
1. Database migrations (all new tables/columns)
2. Type extensions in `@ultaura/types`

### Phase 2: Core Systems
3. All 16 prompt sections
4. Tool definitions and handlers

### Phase 3: Data Layer
5. Memory service extensions
6. New services (persona analyzer, wellness alerts, mood patterns)

### Phase 4: Dashboard
7. Family dashboard components
8. API routes and server actions

---

## Testing Strategy

### Unit Tests
- Prompt assembly for each section
- Tool handler validation
- Memory service extensions

### Integration Tests
- Call flow with mock Grok
- Dashboard data aggregation
- Privacy filtering

### End-to-End Tests
- Full call simulation
- Dashboard verification after calls

### Manual Testing
- Voice quality with various accents
- Interruption handling
- Family dashboard usability

---

## Critical Files for Implementation

| File | Changes Required |
|------|------------------|
| `/packages/prompts/src/profiles/index.ts` | Inject 16 new sections with proper ordering |
| `/telephony/src/websocket/grok-bridge.ts` | Add ~10 new tool handlers, update VAD settings |
| `/packages/types/src/memory.ts` | Extend interfaces for all system types |
| `/telephony/src/services/memory.ts` | Handle extended relationships, life chapters, health mentions |
| `/supabase/migrations/[new]_personalization_systems.sql` | Create 8+ new tables with RLS |
| `/src/lib/ultaura/actions.ts` | New server actions for dashboard data |

---

## Verification Plan

### Post-Implementation Verification

1. **Call Flow Test**
   - Make test call with new prompt
   - Verify all tools invocable
   - Verify memory storage

2. **Dashboard Test**
   - Create test data
   - Verify all components render
   - Verify privacy (no verbatim quotes)

3. **Alert Test**
   - Trigger health mention
   - Verify alert generated
   - Verify delivery

4. **End-to-End**
   - Full call → dashboard update cycle
   - Verify all 16 systems functioning

---

## Migration Path

### Existing Users
1. Non-breaking migrations (nullable columns with defaults)
2. Feature flags per account
3. Data backfill from existing memories
4. A/B test prompt updates

### New Users
- All systems enabled by default
- First 3-5 calls build baseline

---

*This specification provides complete implementation guidance for transforming Ultaura from a functional check-in service into a deeply personalized companion that seniors look forward to speaking with.*


### Responses You Gave To The Questions The Agent Had 
1. Data + Encryption

  DEK Scope for new tables:
  - ultaura_life_chapters → Use Line DEK (like memories). Life chapters are deeply personal per-senior data with long retention, warranting per-line encryption isolation.
  - ultaura_health_mentions → Use Account DEK (like insights). Health mentions are call-associated, transient, and trigger account-level alerts, making account-scope appropriate.

  Should store_life_chapter auto-create a history memory?
  → No, keep them separate. Life chapters are structured narrative records with chapter_type, era_years, key_people, etc. The model should call store_memory separately for atomic facts extracted from stories. This preserves:
  - Clean separation of concerns (chapters = narratives, memories = facts)
  - Existing memory decay/scoring logic untouched
  - Simpler tool semantics

  Call-memory association for conversation highlights:
  → Add created_in_call_session_id column to ultaura_memories (nullable). This is cleaner than deriving from call_events because:
  - Direct query for "memories created in call X"
  - Deactivation log only tracks deletions, not creations
  - Simple join for dashboard highlights
  - Minimal schema change (one nullable FK)

  ---
  2. Relationships + Milestones

  Canonical source:
  → ultaura_relationships is canonical; relationship memories become a sync cache. Rationale:
  - The table supports extended attributes (contact_frequency, sentiment, deceased tracking, recent_topics[], etc.) that don't fit cleanly in memory JSON
  - Memories work well for atomic facts; relationships are inherently multi-attribute entities
  - Dashboard CRUD operates on the table directly
  - Prompt compilation reads from table and formats for prompt
  - When Grok calls update_relationship, update the table. Optionally sync a simplified memory for backward compatibility, but table is source of truth.

  Milestone dashboard CRUD:
  → Full CRUD (add/edit/delete/view). Following existing patterns (reminders have full CRUD), milestones should too:
  - Family should be able to add birthdays they know
  - Family should correct mistakes ("wrong date")
  - Family should delete obsolete milestones
  - This matches user expectations from reminders/contacts UI

  ---
  3. Alerts + Privacy

  Alert content for health mentions:
  → Generic category + severity, no details. Example:
  - ✅ "Health concern detected (pain, concerning severity)"
  - ❌ "Margaret mentioned her hip is hurting badly and she can't walk"

  This balances:
  - Privacy: Senior's specific words stay private
  - Actionability: Family knows to check in, category helps contextualize
  - Legal safety: Not medical advice, just awareness

  Delivery methods to implement now:
  → Email only for MVP, with architecture supporting future expansion:
  - Email is universal, low-friction, and async-friendly
  - SMS/push require additional infrastructure (Twilio SMS already exists but adds cost)
  - Store delivery_method in alerts table and alert_delivery_method preference
  - Future: Add SMS via Twilio, push via web-push/FCM

  Should alerts respect ultaura_notification_preferences?
  → Yes, absolutely. The spec adds health_mention_alerts, mood_drop_alerts, cognitive_concern_alerts columns to preferences. Honor them:
  -- Only generate alert if preference enabled
  WHERE (
    (alert_type = 'health_mention' AND prefs.health_mention_alerts = true) OR
    (alert_type = 'mood_drop' AND prefs.mood_drop_alerts = true) OR
    ...
  )

  ---
  4. Behavioral Algorithms

  Mood drop definition:
  → start→end decline within single call, or 3+ consecutive calls with mood_end = 'low':
  - Single call: mood_start IN ('positive', 'neutral') AND mood_end IN ('low', 'sad', 'anxious') = immediate alert
  - Pattern: 3+ consecutive calls where mood_end IN ('low', 'sad', 'anxious') = pattern alert
  - Keep it simple; complex mid-point analysis adds noise

  Cognitive flags threshold:
  → 3+ observations in rolling 14 days (matches existing baseline window):
  - Count distinct calls with cognitive observations
  - consecutive_calls_with_concern tracks streak
  - When count ≥ 3 AND concern_level = 'none', upgrade to 'monitoring'
  - When count ≥ 5 OR severity = 'significant', upgrade to 'flagged' and notify family
  - Reset streak when call has no observations

  Emotional patterns, daily rhythms, persona adaptation:
  → Simple rollups via scheduled job, NOT Grok post-call analysis:
  - Run nightly/weekly background job (like existing baseline calculation)
  - Aggregate from ultaura_mood_snapshots and ultaura_call_sessions
  - Persona adaptation: Compute from tool call patterns, engagement scores
  - Avoids token cost and latency of extra Grok call
  - Example rollup:
  -- Daily rhythm: avg engagement by time of day
  SELECT
    CASE WHEN EXTRACT(hour FROM started_at AT TIME ZONE line.timezone) < 12 THEN 'morning'
         WHEN EXTRACT(hour FROM ...) < 17 THEN 'afternoon'
         ELSE 'evening' END as time_of_day,
    AVG(engagement_score)
  FROM ultaura_call_sessions s
  JOIN ultaura_call_insights i ON ...
  GROUP BY time_of_day

  ---
  5. Prompt Inputs

  Pull in per-call summaries beyond memories?
  → Yes, add last N call topic summaries. The existing baseline system already stores recent_concern_codes. Extend with:
  - Last 5-10 calls: topics discussed (from ultaura_call_insights.topics)
  - Build a "Recent Conversations" prompt section:
  ## Recent Calls (last 10)
  - Jan 10: Talked about family (high engagement), mentioned grandson's soccer
  - Jan 9: Low mood, discussed missing husband, concerns about sleep
  - This enables context pickup ("Last time you mentioned...") with specificity

  Raise memory fetch limit?
  → Yes, raise to 150 for prompts, 300 for fetch. With 2M context window and flat-rate pricing:
  - Current: Fetch 200, use 50
  - Recommended: Fetch 300, use 150
  - Token impact: ~50 tokens/memory × 150 = 7,500 tokens (still tiny vs 2M)
  - Benefit: Richer personalization, more relationship/history context

  Update in:
  - /telephony/src/websocket/media-stream.ts line 196: limit: 150
  - /telephony/src/websocket/grok-bridge.ts line 431: limit: 150

  ---
  6. UI Placement + Routes

  Page placement:
  → Fold into existing pages where natural, create new pages for distinct features:
  Feature: Accessibility settings
  Recommendation: Add section to existing Settings page
  Rationale: Natural fit, follows timezone/quiet hours pattern
  ────────────────────────────────────────
  Feature: Milestone calendar
  Recommendation: New page: /lines/[lineId]/milestones/
  Rationale: Distinct CRUD like reminders/contacts
  ────────────────────────────────────────
  Feature: Relationships view
  Recommendation: New section in Insights
  Rationale: Part of relationship quality indicators
  ────────────────────────────────────────
  Feature: Emotional trends
  Recommendation: Extend existing Insights components
  Rationale: Add MoodTrendChart, MoodCalendar to grid
  ────────────────────────────────────────
  Feature: Wellness alerts
  Recommendation: New page: /alerts/
  Rationale: Account-level (not per-line), needs dedicated list view
  ────────────────────────────────────────
  Feature: Alert settings
  Recommendation: Add section to new /alerts/ page
  Rationale: Simple toggles, fits notification pattern
  ────────────────────────────────────────
  Feature: Conversation highlights
  Recommendation: Extend existing Insights
  Rationale: Add MemoryActivity component to grid
  New nav links:
  → Add one top-level nav item: "Alerts". Everything else nests:
  - Alerts → New sidebar item (account-level)
  - Milestones → Accessible from line detail page (like Reminders, Contacts)
  - Relationships → Section within Insights (not separate nav)

  Sidebar structure:
  Dashboard
  Lines
    └ [Line Name]
        ├ Overview
        ├ Settings (includes accessibility, alert prefs)
        ├ Schedule
        ├ Reminders
        ├ Milestones ← NEW
        └ Contacts
  Insights (includes emotional trends, relationships, highlights)
  Alerts ← NEW (account-level)
  Usage
  Privacy
  
  ---