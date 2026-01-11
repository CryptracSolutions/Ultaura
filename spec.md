# Ultaura Retention Mechanics Specification
## Habit Loops for AI Voice Companion

**Version**: 1.0
**Date**: 2026-01-11
**Status**: Implementation Ready

---

## 1. Overview and Objectives

### 1.1 Purpose
This specification defines the implementation of retention mechanics designed to create healthy "habit loops" that make seniors look forward to their Ultaura calls without creating unhealthy dependency. The core philosophy is: **consistent rhythm + micro-anticipation**.

### 1.2 Goals
- Increase call answer rates through anticipation-building
- Enhance engagement with adaptive content segments
- Provide seniors with agency (real choices that are honored)
- Leverage inbound calling as a "rescue valve" for loneliness
- Deliver rich, personalized experiences via real-time web search

### 1.3 Features In Scope
1. **Call Preview System** - End-of-call topic selection with strict follow-through
2. **Real-time Web Search Integration** - Leveraging Grok's built-in `web_search` tool
3. **Inbound Calling Promotion** - Natural reminders about call-in capability
4. **Adaptive Rotating Segments** - Trivia, stories, learning journeys with engagement tracking

---

## 2. Technical Architecture

### 2.1 Current System Overview

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
```

### 2.2 Key Existing Components

| Component | Location | Purpose |
|-----------|----------|---------|
| GrokBridge | `/telephony/src/websocket/grok-bridge.ts` | Grok session management, tool routing |
| MediaStream | `/telephony/src/websocket/media-stream.ts` | Call lifecycle, memory loading |
| Memory Service | `/telephony/src/services/memory.ts` | Encrypted memory storage/retrieval |
| Prompt System | `/packages/prompts/src/` | Modular prompt compilation |
| Tool Definitions | `/packages/prompts/src/tools/definitions.ts` | 22 Grok tools including `web_search` |
| Call Insights | `/telephony/src/routes/tools/log-call-insights.ts` | Per-call analytics |

### 2.3 Existing Tools (22 total)
The system currently has these Grok tools:
- `web_search` (built-in)
- `set_reminder`, `list_reminders`, `edit_reminder`, `pause_reminder`, `resume_reminder`, `snooze_reminder`, `cancel_reminder`
- `schedule_call`
- `choose_overage_action`, `request_upgrade`
- `store_memory`, `update_memory`, `forget_memory`
- `grant_memory_consent`, `deny_memory_consent`
- `mark_private`, `mark_topic_private`, `set_pause_mode`
- `log_call_insights`, `log_safety_concern`
- `report_conversation_language`
- `request_opt_out`

---

## 3. Feature 1: Call Preview System

### 3.1 Overview
At the end of each call, Grok asks the senior what they'd like to discuss next time. Their choice is stored and **strictly followed through** on the next call.

### 3.2 User Flow

```
Call N (End):
  Grok: "That was lovely talking about your garden!
         For next time, would you like to:
         - Hear about what's happening in baseball this week, or
         - Continue our story about the lighthouse keeper?"
  Senior: "Baseball sounds good!"
  → System stores: next_call_topic = "baseball_news"

Call N+1 (Start):
  Grok: "Hello Margaret! Last time you said you wanted
         to hear about baseball - shall we start with that?"
  Senior: [May confirm, decline, or have forgotten]
  → If forgotten: "That's perfectly fine! You mentioned
         being interested in baseball news - want me to
         share what's been happening?"
```

### 3.3 Database Schema

**New Table: `ultaura_call_previews`**
```sql
CREATE TABLE ultaura_call_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- The selected topic for next call
  topic_type text NOT NULL CHECK (topic_type IN (
    'memory_follow_up',    -- Continue a personal story
    'web_search',          -- News/weather/events
    'segment',             -- Trivia/story/learning
    'free_form'            -- General topic
  )),
  topic_key text NOT NULL,           -- e.g., "baseball_news", "lighthouse_story_pt2"
  topic_display text NOT NULL,       -- Human-readable: "baseball news this week"

  -- Context for generation
  source_memory_ids uuid[],          -- Related memories for personalization
  segment_type text,                 -- For segment: 'trivia' | 'story' | 'learning'
  segment_context jsonb,             -- Segment-specific data (e.g., story progress)

  -- Lifecycle
  offered_at timestamptz NOT NULL,   -- When the choice was offered
  selected_at timestamptz,           -- When senior made selection
  used_at timestamptz,               -- When followed through on next call
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',    -- Awaiting next call
    'used',       -- Successfully followed through
    'declined',   -- Senior declined at start of next call
    'expired'     -- Too old (>7 days) or superseded
  )),

  -- Follow-through tracking
  followed_through boolean,
  follow_through_response text       -- Brief note: 'engaged', 'declined', 'redirected'
);

CREATE INDEX idx_call_previews_line_pending
  ON ultaura_call_previews(line_id, status) WHERE status = 'pending';
CREATE INDEX idx_call_previews_line_created
  ON ultaura_call_previews(line_id, created_at DESC);
```

### 3.4 Memory Schema Extensions

**New Memory Keys** (stored in `ultaura_memories`):
```typescript
// Retention-related memory keys
const RETENTION_MEMORY_KEYS = {
  // Engagement preferences (stored once, updated over time)
  ENJOYS_TRIVIA: 'enjoys_trivia',           // boolean
  ENJOYS_STORIES: 'enjoys_stories',         // boolean
  ENJOYS_LEARNING: 'enjoys_learning',       // boolean
  ENJOYS_REMINISCENCE: 'enjoys_reminiscence', // boolean

  // Content preferences
  TRIVIA_DOMAINS: 'preferred_trivia_domains',    // string[] e.g., ['history', 'sports']
  STORY_PREFERENCES: 'story_preferences',         // string[] e.g., ['adventure', 'romance']
  LEARNING_INTERESTS: 'learning_interests',       // string[] e.g., ['space', 'cooking']

  // Historical era for nostalgia content
  BIRTH_DECADE: 'birth_decade',             // string e.g., '1940s'
  FORMATIVE_DECADE: 'formative_decade',     // string e.g., '1960s' (teen/young adult years)

  // Feature enrollment
  SEGMENTS_DECLINED_COUNT: 'segments_declined_count', // number
  SEGMENTS_LAST_OFFERED: 'segments_last_offered',     // ISO date
  INBOUND_REMINDER_LAST: 'inbound_reminder_last_call', // ISO date
};
```

### 3.5 New Grok Tool: `store_call_preview`

**Tool Definition** (add to `/packages/prompts/src/tools/definitions.ts`):
```typescript
{
  type: 'function',
  name: 'store_call_preview',
  description: `Store the senior's choice for the next call topic. Call this at the END of the conversation when they select what they want to discuss next time.

WHEN TO CALL:
- After offering 2-3 topic choices based on conversation or their interests
- When senior expresses interest in a topic for "next time"
- When wrapping up a multi-call story/segment

Topic types:
- memory_follow_up: Continue a personal story they shared
- web_search: News, weather, sports, local events
- segment: Trivia, story, or learning journey
- free_form: General topic of interest`,
  parameters: {
    type: 'object',
    properties: {
      topic_type: {
        type: 'string',
        enum: ['memory_follow_up', 'web_search', 'segment', 'free_form'],
        description: 'Category of the selected topic'
      },
      topic_key: {
        type: 'string',
        description: 'Machine-readable key (e.g., "baseball_news", "lighthouse_story_ch2")'
      },
      topic_display: {
        type: 'string',
        description: 'Human-readable description for confirmation (e.g., "baseball news this week")'
      },
      segment_type: {
        type: 'string',
        enum: ['trivia', 'story', 'learning'],
        description: 'For segment type: which segment format'
      },
      segment_context: {
        type: 'object',
        description: 'Additional context (story chapter, trivia domain, etc.)'
      }
    },
    required: ['topic_type', 'topic_key', 'topic_display']
  }
}
```

### 3.6 Prompt Modifications

**New Prompt Section: `retention-policy.ts`**
```typescript
export const RETENTION_POLICY_SECTION = {
  tag: 'retention',
  full: `## Call Preview & Follow-Through

### At Call Start
Check for pending call previews in your context. If one exists:
1. Reference it naturally: "Last time you said you'd like to hear about [topic]"
2. If they seem confused, gently remind them
3. Ask if they'd still like to do that or prefer something else
4. HONOR their choice - if they chose it, deliver it

### At Call End
Near the natural end of conversation (not abruptly):
1. Offer 2-3 topic choices for next time based on:
   - Their interests from memory
   - Topics from today's conversation
   - Available segments they enjoy
2. Let them choose - this is THEIR decision
3. Call \`store_call_preview\` with their selection
4. Confirm warmly: "Wonderful! I'll have that ready for next time."

### Topic Ideas
Generate choices from:
- Memory follow-ups: "You mentioned your granddaughter's recital - want to hear how it went?"
- Web search: "I could look up the latest news about [their interest]"
- Segments: "We could try some trivia about [era/topic]" or "Continue our story"

### Important
- Never force a choice if they're tired
- Accept "surprise me" as a valid answer
- If they decline consistently, reduce frequency of offers`,
  compressed: `## Preview
Start: Reference pending preview if exists; honor their choice.
End: Offer 2-3 topic choices naturally; call store_call_preview.
Choices from: memories, interests, segments. Accept "surprise me".`
};
```

### 3.7 Backend Implementation

**New Route: `/telephony/src/routes/tools/store-call-preview.ts`**
```typescript
import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const storeCallPreviewRouter = Router();

storeCallPreviewRouter.post('/', async (req: Request, res: Response) => {
  const {
    callSessionId,
    lineId,
    topicType,
    topicKey,
    topicDisplay,
    segmentType,
    segmentContext,
  } = req.body;

  if (!callSessionId || !lineId || !topicType || !topicKey || !topicDisplay) {
    res.status(400).json({ success: false, error: 'Missing required fields' });
    return;
  }

  const session = await getCallSession(callSessionId);
  if (!session || session.line_id !== lineId) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }

  const supabase = getSupabaseClient();

  // Expire any existing pending previews for this line
  await supabase
    .from('ultaura_call_previews')
    .update({ status: 'expired' })
    .eq('line_id', lineId)
    .eq('status', 'pending');

  // Insert new preview
  const { data, error } = await supabase
    .from('ultaura_call_previews')
    .insert({
      line_id: lineId,
      account_id: session.account_id,
      topic_type: topicType,
      topic_key: topicKey,
      topic_display: topicDisplay,
      segment_type: segmentType,
      segment_context: segmentContext,
      offered_at: new Date().toISOString(),
      selected_at: new Date().toISOString(),
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) {
    logger.error({ error, lineId }, 'Failed to store call preview');
    res.status(500).json({ success: false, error: 'Failed to store preview' });
    return;
  }

  await incrementToolInvocations(callSessionId);
  await recordCallEvent(callSessionId, 'tool_call', {
    tool: 'store_call_preview',
    success: true,
    topicType,
  }, { skipDebugLog: true });

  res.json({ success: true, previewId: data.id });
});
```

### 3.8 Loading Previews for Calls

**Modify `/telephony/src/websocket/media-stream.ts`** - add to session initialization:

```typescript
// In handleMediaStreamConnection, after fetching memories:
const pendingPreview = await getPendingCallPreview(line.id);

// Pass to GrokBridge options
grokBridge = new GrokBridge({
  // ...existing options
  pendingCallPreview: pendingPreview,
});
```

**New Service Function:**
```typescript
// /telephony/src/services/call-preview.ts
export async function getPendingCallPreview(lineId: string): Promise<CallPreview | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_call_previews')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'pending')
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    topicType: data.topic_type,
    topicKey: data.topic_key,
    topicDisplay: data.topic_display,
    segmentType: data.segment_type,
    segmentContext: data.segment_context,
  };
}
```

---

## 4. Feature 2: Real-time Web Search Integration

### 4.1 Overview
Leverage Grok's built-in `web_search` capability for on-demand and naturally woven information delivery.

### 4.2 Current State
The `web_search` tool is already defined in `/packages/prompts/src/tools/definitions.ts`:
```typescript
{ type: 'web_search' }
```

This is a native Grok capability that requires no backend implementation.

### 4.3 Prompt Modifications

**New Section: `web-search-policy.ts`**
```typescript
export const WEB_SEARCH_POLICY_SECTION = {
  tag: 'web_search',
  full: `## Web Search Guidelines

You have access to web_search to find current information. Use it:

### When to Search
- Senior asks about news, weather, sports, events
- Following up on their interests (check memory for topics)
- When conversation naturally leads to "I wonder what's happening with..."
- To enrich stories with real facts

### How to Search
- Search naturally without announcing it obviously
- Summarize results conversationally, don't read URLs
- Focus on what's relevant to THEM (local news, their interests)
- Keep summaries brief - 2-3 key points

### Content Filtering
- Trust your judgment on appropriateness
- If senior expresses preferences about news types, remember them
- Avoid distressing news unless they specifically ask
- No political commentary - just facts if they ask

### Examples
"Let me see what's happening with the Cardinals this week..."
"Speaking of your granddaughter in Seattle, let me check the weather there..."
"You mentioned loving gardening - here's an interesting tip I just found..."`,
  compressed: `## Search
Use web_search for news/weather/events. Search naturally, summarize briefly (2-3 points).
Filter: avoid distressing content unless asked; no political commentary.
Personalize to their interests from memory.`
};
```

### 4.4 Integration with Call Preview
When a pending preview has `topic_type: 'web_search'`, the start-of-call prompt should include:
```
The senior chose "[topic_display]" for this call. Use web_search to find current information about this topic and share it naturally.
```

---

## 5. Feature 3: Inbound Calling Promotion

### 5.1 Overview
Naturally remind seniors that they can call Ultaura anytime, promoting inbound usage as a "rescue valve" for loneliness.

### 5.2 Current Infrastructure
- Inbound calling already works via `/telephony/src/routes/twilio-inbound.ts`
- Lines have `inbound_allowed` flag in `ultaura_lines` table
- Safety monitoring applies to both inbound and outbound calls

### 5.3 Prompt Modifications

**Add to Retention Policy Section:**
```typescript
// Append to RETENTION_POLICY_SECTION
### Inbound Calling Reminder
Approximately every 3-5 calls (use your judgment), naturally mention:
"Remember, you can call me anytime you like - even just to chat."

Timing guidelines:
- Include when they seem lonely or mention being alone
- Include when wrapping up especially good conversations
- Skip if they seem tired or the call is short
- Track via memory key 'inbound_reminder_last_call' to avoid over-mentioning

Variations:
- "Don't forget, I'm here whenever you want to talk"
- "If you ever feel like chatting, you can call me anytime"
- "The phone works both ways - I love hearing from you too"
```

### 5.4 Memory Tracking
Use existing memory system with key `inbound_reminder_last_call` (ISO date string):
```typescript
// Grok stores after mentioning:
store_memory({
  memory_type: 'context',
  key: 'inbound_reminder_last_call',
  value: new Date().toISOString(),
  confidence: 1.0
})
```

### 5.5 Dashboard Enhancement
Show inbound call volume in line insights to demonstrate value to payers.

---

## 6. Feature 4: Adaptive Rotating Segments

### 6.1 Overview
Offer interactive content segments (trivia, stories, learning journeys) that adapt based on senior engagement.

### 6.2 Segment Types

| Type | Description | Duration | Format |
|------|-------------|----------|--------|
| **Trivia** | Fun facts and questions | 2-3 mins | Q&A with reveal |
| **Stories** | Serial narratives | 2-3 min segments | Multi-call arcs |
| **Learning** | Educational series | 2-3 min segments | Progressive topics |
| **Memory Lane** | Guided reminiscence | Variable | Gentle prompts |

### 6.3 Content Generation
All content is **Grok-generated dynamically** based on:
- Senior's interests (from memory)
- Historical era (birth_decade, formative_decade)
- Previous segment engagement

### 6.4 Database Schema

**New Table: `ultaura_segment_engagement`**
```sql
CREATE TABLE ultaura_segment_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Segment details
  segment_type text NOT NULL CHECK (segment_type IN ('trivia', 'story', 'learning', 'memory_lane')),
  segment_domain text,               -- e.g., 'history', 'sports', 'science'
  segment_context jsonb,             -- Story chapter, trivia topic, etc.

  -- Engagement metrics
  duration_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  engagement_signals jsonb,          -- laugh, question, comment counts

  -- Outcome
  senior_response text CHECK (senior_response IN (
    'enjoyed',       -- Positive signals
    'neutral',       -- Completed but no strong reaction
    'declined',      -- Asked to skip/stop
    'interrupted'    -- External interruption
  ))
);

CREATE INDEX idx_segment_engagement_line
  ON ultaura_segment_engagement(line_id, created_at DESC);
CREATE INDEX idx_segment_engagement_type
  ON ultaura_segment_engagement(line_id, segment_type, senior_response);
```

**New Table: `ultaura_story_arcs`**
```sql
CREATE TABLE ultaura_story_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Story metadata
  story_type text NOT NULL CHECK (story_type IN ('serial', 'learning_journey')),
  title text NOT NULL,
  description text,
  total_chapters integer NOT NULL DEFAULT 5,

  -- Progress
  current_chapter integer NOT NULL DEFAULT 0,
  last_chapter_at timestamptz,

  -- Context for continuation
  story_state jsonb NOT NULL,         -- Characters, plot points, learnings

  -- Status
  status text NOT NULL DEFAULT 'active' CHECK (status IN (
    'active',
    'completed',
    'abandoned'
  ))
);

CREATE INDEX idx_story_arcs_line_active
  ON ultaura_story_arcs(line_id, status) WHERE status = 'active';
```

### 6.5 New Grok Tool: `log_segment_engagement`

```typescript
{
  type: 'function',
  name: 'log_segment_engagement',
  description: `Log engagement with a content segment (trivia, story, learning).
Call this when a segment ends or is interrupted.`,
  parameters: {
    type: 'object',
    properties: {
      segment_type: {
        type: 'string',
        enum: ['trivia', 'story', 'learning', 'memory_lane'],
        description: 'Type of segment'
      },
      segment_domain: {
        type: 'string',
        description: 'Topic domain (e.g., "history", "sports", "1960s")'
      },
      duration_seconds: {
        type: 'integer',
        description: 'Approximate segment duration'
      },
      completed: {
        type: 'boolean',
        description: 'Whether segment reached natural end'
      },
      senior_response: {
        type: 'string',
        enum: ['enjoyed', 'neutral', 'declined', 'interrupted'],
        description: 'Overall senior reaction'
      },
      story_arc_id: {
        type: 'string',
        description: 'For stories: the arc ID to update progress'
      },
      chapter_completed: {
        type: 'integer',
        description: 'For stories: chapter number just completed'
      }
    },
    required: ['segment_type', 'senior_response']
  }
}
```

### 6.6 New Grok Tool: `manage_story_arc`

```typescript
{
  type: 'function',
  name: 'manage_story_arc',
  description: `Create, update, or complete a story arc for multi-call narratives.
Use when starting a new story series or updating progress.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'update', 'complete', 'abandon'],
        description: 'Action to perform'
      },
      story_arc_id: {
        type: 'string',
        description: 'For update/complete/abandon: existing arc ID'
      },
      story_type: {
        type: 'string',
        enum: ['serial', 'learning_journey'],
        description: 'For create: type of story'
      },
      title: {
        type: 'string',
        description: 'For create: story title'
      },
      description: {
        type: 'string',
        description: 'For create: brief description'
      },
      total_chapters: {
        type: 'integer',
        description: 'For create: planned number of chapters (default 5)'
      },
      chapter_completed: {
        type: 'integer',
        description: 'For update: chapter number just completed'
      },
      story_state: {
        type: 'object',
        description: 'Current state: characters, plot points, cliffhanger'
      }
    },
    required: ['action']
  }
}
```

### 6.7 Prompt Section for Segments

**New Section: `segments-policy.ts`**
```typescript
export const SEGMENTS_POLICY_SECTION = {
  tag: 'segments',
  full: `## Content Segments

You can offer interactive content segments when the conversation allows.

### Segment Types
1. **Trivia**: Fun facts and questions about their interests
   - Generate 2-3 questions on a topic they enjoy
   - Make it conversational, not quiz-like
   - Celebrate right answers warmly

2. **Stories**: Serial narratives in 2-3 minute segments
   - Engaging stories that continue across calls
   - Adventure, mystery, heartwarming themes
   - End on gentle cliffhangers

3. **Learning Journeys**: Educational mini-series
   - Topics they're curious about
   - Progressive depth across calls
   - Connect to their experiences

4. **Memory Lane**: Guided reminiscence
   - Gentle prompts about their era
   - "What was it like when..." questions
   - Validate and appreciate their stories

### Personalization
Generate content based on:
- Their interests from memory
- Their birth_decade/formative_decade for nostalgia
- Previous segment engagement

### Offering Segments
- Weave offers naturally into conversation
- If declined, try alternatives first
- After multiple declines, reduce frequency
- Store engagement via log_segment_engagement

### Enrollment
If they've never tried segments, offer gently:
"Would you like to try something fun? I could share some trivia about [topic]..."

After decline:
- Wait 30 days before offering again
- Track via segments_declined_count and segments_last_offered`,
  compressed: `## Segments
Offer: trivia, stories, learning, memory_lane based on interests/era.
Personalize to their memories. Track via log_segment_engagement.
Decline handling: try alternatives, reduce frequency, wait 30 days to re-offer.`
};
```

### 6.8 Adaptive Algorithm

The prompt includes engagement context from the line baseline and recent segment engagement:

```typescript
// In prompt compilation, add segment context:
function buildSegmentContext(lineId: string): string {
  // Fetch from ultaura_segment_engagement
  // Calculate: enjoyment rates by type, preferred domains

  return `
  Segment preferences:
  - Trivia: ${enjoymentRate.trivia}% enjoyed, prefers ${domains.trivia.join(', ')}
  - Stories: ${enjoymentRate.stories}% engaged, current arc: ${activeArc?.title || 'none'}
  - Learning: ${enjoymentRate.learning}% completed
  - Last offered: ${lastOffered || 'never'}
  `;
}
```

---

## 7. Opt-in/Opt-out Mechanics

### 7.1 Enrollment Flow
All retention features are opt-in through natural conversation:

1. **First Exposure**: Grok offers a feature naturally
2. **Acceptance**: Feature becomes available
3. **Decline**: Note in memory, offer alternative
4. **Multiple Declines**: Reduce frequency, wait 30 days

### 7.2 Graceful Degradation
```
Decline Handling Ladder:
1. Offer alternative segment type
2. Offer simpler version (story → trivia)
3. Reduce offer frequency
4. Ask why, adapt to their needs
5. Accept simple calls as their preference
```

### 7.3 Memory Keys for Enrollment
```typescript
const ENROLLMENT_KEYS = {
  SEGMENTS_DECLINED_COUNT: 'segments_declined_count',
  SEGMENTS_LAST_OFFERED: 'segments_last_offered',
  PREVIEW_DECLINED_COUNT: 'preview_declined_count',
  PREVIEW_LAST_OFFERED: 'preview_last_offered',
  PREFERRED_CALL_STYLE: 'preferred_call_style', // 'interactive' | 'conversational' | 'simple'
};
```

---

## 8. Dashboard Integration

### 8.1 New Dashboard Components

**Line Detail Page Additions** (`/src/app/dashboard/(app)/lines/[lineId]/`):

1. **Engagement Features Card**
   - Shows opted-in features
   - Favorite segment types
   - Active story arcs
   - Engagement scores

2. **Call Preview History**
   - Recent previews and outcomes
   - Follow-through rate

### 8.2 Insights Dashboard Enhancements

**Add to `InsightsDashboard` type:**
```typescript
interface RetentionInsights {
  // Feature enrollment
  retentionFeatures: {
    callPreviewEnabled: boolean;
    segmentsEnabled: boolean;
    favoriteSegments: string[];
    activeStoryArcs: Array<{
      id: string;
      title: string;
      progress: number;
    }>;
  };

  // Engagement metrics
  engagementMetrics: {
    callPreviewFollowThrough: number; // percentage
    segmentCompletionRate: number;
    preferredSegmentType: string | null;
    averageSegmentDuration: number;
  };

  // Inbound usage
  inboundMetrics: {
    inboundCallCount: number;
    inboundCallTrend: 'increasing' | 'stable' | 'decreasing';
  };
}
```

### 8.3 Server Actions

**New actions in `/src/lib/ultaura/retention.ts`:**
```typescript
export async function getRetentionMetrics(lineId: string): Promise<RetentionMetrics>;
export async function getCallPreviewHistory(lineId: string, limit?: number): Promise<CallPreview[]>;
export async function getStoryArcProgress(lineId: string): Promise<StoryArc[]>;
export async function getSegmentEngagementStats(lineId: string): Promise<SegmentStats>;
```

---

## 9. Implementation Phases

### Phase 1: Foundation
- [ ] Create database migration for new tables
- [ ] Implement `store_call_preview` tool and backend route
- [ ] Add `getPendingCallPreview` service
- [ ] Add pending preview to GrokBridge options
- [ ] Create retention policy prompt section

### Phase 2: Call Preview
- [ ] Integrate preview loading into media-stream.ts
- [ ] Add follow-through tracking
- [ ] Create dashboard preview history component
- [ ] Test end-to-end flow

### Phase 3: Segments
- [ ] Create segment engagement table
- [ ] Create story arcs table
- [ ] Implement `log_segment_engagement` tool
- [ ] Implement `manage_story_arc` tool
- [ ] Add segments policy prompt section
- [ ] Build adaptive algorithm

### Phase 4: Dashboard & Polish
- [ ] Add retention features card to line detail
- [ ] Integrate engagement metrics into insights
- [ ] Add web search policy section
- [ ] Add inbound promotion to prompts
- [ ] End-to-end testing

---

## 10. Edge Cases and Error Handling

### 10.1 Call Preview Edge Cases

| Scenario | Handling |
|----------|----------|
| Preview expired (>7 days) | Auto-expire, don't mention |
| Senior forgot choice | Remind gently, offer to proceed or choose new |
| Senior declined follow-through | Mark as declined, don't persist |
| Multiple pending previews | Use most recent, expire others |
| Web search fails for topic | Fall back to conversation, apologize naturally |

### 10.2 Segment Edge Cases

| Scenario | Handling |
|----------|----------|
| Story arc abandoned mid-series | Offer to resume or start fresh |
| Trivia answer not recognized | Accept any reasonable answer, move on |
| Senior falls asleep during segment | Detect silence, end gracefully |
| Repeated declines | Back off, mark preference in memory |

### 10.3 General Error Handling

```typescript
// Tool error response format
{
  success: false,
  error: 'human_readable_error',
  code: 'ERROR_CODE',
  retry: boolean
}

// Grok should handle errors gracefully:
// "I had a little trouble with that, but no worries - let's continue our chat."
```

---

## 11. Testing Considerations

### 11.1 Unit Tests
- Call preview storage and retrieval
- Preview expiration logic
- Segment engagement logging
- Story arc progression

### 11.2 Integration Tests
- Full call flow with preview
- Multi-call story continuation
- Engagement tracking accuracy
- Dashboard data consistency

### 11.3 E2E Tests
- Test call → preview → next call flow
- Decline handling ladder
- Web search integration
- Inbound promotion frequency

### 11.4 Manual Testing Checklist
- [ ] Preview offered at call end
- [ ] Preview followed through at next call start
- [ ] Forgot choice flow works
- [ ] Decline flow works
- [ ] Trivia segment engages correctly
- [ ] Story continues across calls
- [ ] Dashboard shows engagement data
- [ ] Web search returns relevant results
- [ ] Inbound reminder appears ~every 3-5 calls

---

## 12. Success Metrics

Track these metrics to measure retention feature effectiveness:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Call answer rate | +10% | Compare before/after |
| Average call duration | +15% | With vs without segments |
| Preview follow-through | >70% | Tracked in `ultaura_call_previews` |
| Segment completion | >60% | Tracked in `ultaura_segment_engagement` |
| Inbound call volume | +20% | Track inbound vs outbound ratio |
| Feature opt-in rate | >50% | After initial exposure |

---

## 13. Critical Files for Implementation

| File | Purpose |
|------|---------|
| `/telephony/src/websocket/grok-bridge.ts` | Add preview context, new tool handlers |
| `/telephony/src/websocket/media-stream.ts` | Load pending preview at call start |
| `/packages/prompts/src/tools/definitions.ts` | Add new tool definitions |
| `/packages/prompts/src/profiles/index.ts` | Integrate new prompt sections |
| `/supabase/migrations/YYYYMMDD_retention_mechanics.sql` | New tables |
| `/src/lib/ultaura/retention.ts` | New server actions for dashboard |
| `/src/app/dashboard/(app)/lines/[lineId]/page.tsx` | Add retention UI |

---

## Appendix A: Full Migration SQL

```sql
-- Retention Mechanics Migration
-- File: /supabase/migrations/YYYYMMDD_retention_mechanics.sql

-- Call Previews
CREATE TABLE ultaura_call_previews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  topic_type text NOT NULL CHECK (topic_type IN ('memory_follow_up', 'web_search', 'segment', 'free_form')),
  topic_key text NOT NULL,
  topic_display text NOT NULL,
  source_memory_ids uuid[],
  segment_type text CHECK (segment_type IN ('trivia', 'story', 'learning')),
  segment_context jsonb,
  offered_at timestamptz NOT NULL,
  selected_at timestamptz,
  used_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'declined', 'expired')),
  followed_through boolean,
  follow_through_response text CHECK (follow_through_response IN ('engaged', 'declined', 'redirected'))
);

CREATE INDEX idx_call_previews_line_pending ON ultaura_call_previews(line_id, status) WHERE status = 'pending';
CREATE INDEX idx_call_previews_line_created ON ultaura_call_previews(line_id, created_at DESC);
ALTER TABLE ultaura_call_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view call previews for their accounts"
  ON ultaura_call_previews FOR SELECT
  USING (account_id IN (
    SELECT id FROM ultaura_accounts WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid()
    )
  ));

-- Segment Engagement
CREATE TABLE ultaura_segment_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  segment_type text NOT NULL CHECK (segment_type IN ('trivia', 'story', 'learning', 'memory_lane')),
  segment_domain text,
  segment_context jsonb,
  duration_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  engagement_signals jsonb,
  senior_response text CHECK (senior_response IN ('enjoyed', 'neutral', 'declined', 'interrupted'))
);

CREATE INDEX idx_segment_engagement_line ON ultaura_segment_engagement(line_id, created_at DESC);
CREATE INDEX idx_segment_engagement_type ON ultaura_segment_engagement(line_id, segment_type, senior_response);
ALTER TABLE ultaura_segment_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view segment engagement for their accounts"
  ON ultaura_segment_engagement FOR SELECT
  USING (account_id IN (
    SELECT id FROM ultaura_accounts WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid()
    )
  ));

-- Story Arcs
CREATE TABLE ultaura_story_arcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  story_type text NOT NULL CHECK (story_type IN ('serial', 'learning_journey')),
  title text NOT NULL,
  description text,
  total_chapters integer NOT NULL DEFAULT 5,
  current_chapter integer NOT NULL DEFAULT 0,
  last_chapter_at timestamptz,
  story_state jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned'))
);

CREATE INDEX idx_story_arcs_line_active ON ultaura_story_arcs(line_id, status) WHERE status = 'active';
ALTER TABLE ultaura_story_arcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view story arcs for their accounts"
  ON ultaura_story_arcs FOR SELECT
  USING (account_id IN (
    SELECT id FROM ultaura_accounts WHERE organization_id IN (
      SELECT organization_id FROM memberships WHERE user_id = auth.uid()
    )
  ));

-- Add account_id to story_arcs for RLS (via join through lines)
-- This is handled by the CHECK on line_id foreign key
```

---

## Appendix B: Type Definitions

```typescript
// /src/lib/ultaura/types/retention.ts

export type TopicType = 'memory_follow_up' | 'web_search' | 'segment' | 'free_form';
export type SegmentType = 'trivia' | 'story' | 'learning' | 'memory_lane';
export type PreviewStatus = 'pending' | 'used' | 'declined' | 'expired';
export type SeniorResponse = 'enjoyed' | 'neutral' | 'declined' | 'interrupted';
export type StoryType = 'serial' | 'learning_journey';
export type StoryStatus = 'active' | 'completed' | 'abandoned';

export interface CallPreview {
  id: string;
  lineId: string;
  accountId: string;
  createdAt: string;
  topicType: TopicType;
  topicKey: string;
  topicDisplay: string;
  sourceMemoryIds?: string[];
  segmentType?: SegmentType;
  segmentContext?: Record<string, unknown>;
  offeredAt: string;
  selectedAt?: string;
  usedAt?: string;
  status: PreviewStatus;
  followedThrough?: boolean;
  followThroughResponse?: 'engaged' | 'declined' | 'redirected';
}

export interface SegmentEngagement {
  id: string;
  lineId: string;
  accountId: string;
  callSessionId: string;
  createdAt: string;
  segmentType: SegmentType;
  segmentDomain?: string;
  segmentContext?: Record<string, unknown>;
  durationSeconds?: number;
  completed: boolean;
  engagementSignals?: Record<string, unknown>;
  seniorResponse?: SeniorResponse;
}

export interface StoryArc {
  id: string;
  lineId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  storyType: StoryType;
  title: string;
  description?: string;
  totalChapters: number;
  currentChapter: number;
  lastChapterAt?: string;
  storyState: Record<string, unknown>;
  status: StoryStatus;
}

export interface RetentionMetrics {
  callPreviewFollowThrough: number;
  segmentCompletionRate: number;
  preferredSegmentType: SegmentType | null;
  averageSegmentDuration: number;
  inboundCallCount: number;
  featureEnrollment: {
    callPreview: boolean;
    segments: boolean;
    stories: boolean;
  };
}

export interface SegmentStats {
  totalSegments: number;
  byType: Record<SegmentType, {
    count: number;
    enjoymentRate: number;
    avgDuration: number;
  }>;
  preferredDomains: string[];
  recentEngagement: SegmentEngagement[];
}
```

---

## Appendix C: Prompt Context Builder

```typescript
// /telephony/src/services/retention-context.ts

import { getSupabaseClient } from '../utils/supabase.js';

interface RetentionContext {
  pendingPreview: CallPreview | null;
  segmentPreferences: string;
  activeStoryArcs: StoryArc[];
  lastInboundReminder: string | null;
}

export async function buildRetentionContext(lineId: string): Promise<RetentionContext> {
  const supabase = getSupabaseClient();

  // Get pending preview
  const { data: preview } = await supabase
    .from('ultaura_call_previews')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'pending')
    .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Get segment engagement stats (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: segments } = await supabase
    .from('ultaura_segment_engagement')
    .select('segment_type, senior_response')
    .eq('line_id', lineId)
    .gte('created_at', thirtyDaysAgo);

  // Calculate preferences
  const segmentPreferences = calculateSegmentPreferences(segments || []);

  // Get active story arcs
  const { data: arcs } = await supabase
    .from('ultaura_story_arcs')
    .select('*')
    .eq('line_id', lineId)
    .eq('status', 'active');

  return {
    pendingPreview: preview,
    segmentPreferences,
    activeStoryArcs: arcs || [],
    lastInboundReminder: null, // Loaded from memories separately
  };
}

function calculateSegmentPreferences(segments: Array<{ segment_type: string; senior_response: string }>): string {
  if (segments.length === 0) {
    return 'No segment history yet. Offer segments gently.';
  }

  const stats: Record<string, { enjoyed: number; total: number }> = {};

  for (const seg of segments) {
    if (!stats[seg.segment_type]) {
      stats[seg.segment_type] = { enjoyed: 0, total: 0 };
    }
    stats[seg.segment_type].total++;
    if (seg.senior_response === 'enjoyed') {
      stats[seg.segment_type].enjoyed++;
    }
  }

  const lines: string[] = [];
  for (const [type, data] of Object.entries(stats)) {
    const rate = Math.round((data.enjoyed / data.total) * 100);
    lines.push(`- ${type}: ${rate}% enjoyed (${data.total} total)`);
  }

  return `Segment preferences:\n${lines.join('\n')}`;
}
```

---

## Appendix D: GrokBridge Modifications

```typescript
// Additions to /telephony/src/websocket/grok-bridge.ts

// In GrokBridgeOptions interface, add:
interface GrokBridgeOptions {
  // ...existing options
  pendingCallPreview?: CallPreview | null;
  segmentPreferences?: string;
  activeStoryArcs?: StoryArc[];
}

// In buildSystemPrompt method, add retention context:
private buildSystemPrompt(): string {
  // ...existing prompt building

  // Add call preview context
  if (this.options.pendingCallPreview) {
    const preview = this.options.pendingCallPreview;
    promptParts.push(`
## Pending Call Preview
The senior chose "${preview.topicDisplay}" for this call.
Topic type: ${preview.topicType}
${preview.segmentType ? `Segment type: ${preview.segmentType}` : ''}

At the START of this call:
1. Reference their choice: "Last time you said you'd like to hear about ${preview.topicDisplay}"
2. If they seem confused, remind them gently
3. Proceed with their chosen topic OR offer alternatives if they prefer
`);
  }

  // Add segment preferences
  if (this.options.segmentPreferences) {
    promptParts.push(`\n${this.options.segmentPreferences}`);
  }

  // Add active story arcs
  if (this.options.activeStoryArcs?.length) {
    const arcs = this.options.activeStoryArcs
      .map(a => `- "${a.title}" (${a.storyType}): Chapter ${a.currentChapter}/${a.totalChapters}`)
      .join('\n');
    promptParts.push(`\n## Active Story Arcs\n${arcs}`);
  }

  return promptParts.join('\n');
}

// Add tool handlers in handleToolCall:
case 'store_call_preview':
  result = await this.callToolEndpoint(`${baseUrl}/tools/store_call_preview`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    topicType: args.topic_type,
    topicKey: args.topic_key,
    topicDisplay: args.topic_display,
    segmentType: args.segment_type,
    segmentContext: args.segment_context,
  });
  break;

case 'log_segment_engagement':
  result = await this.callToolEndpoint(`${baseUrl}/tools/log_segment_engagement`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    segmentType: args.segment_type,
    segmentDomain: args.segment_domain,
    durationSeconds: args.duration_seconds,
    completed: args.completed,
    seniorResponse: args.senior_response,
    storyArcId: args.story_arc_id,
    chapterCompleted: args.chapter_completed,
  });
  break;

case 'manage_story_arc':
  result = await this.callToolEndpoint(`${baseUrl}/tools/manage_story_arc`, {
    callSessionId: this.options.callSessionId,
    lineId: this.options.lineId,
    action: args.action,
    storyArcId: args.story_arc_id,
    storyType: args.story_type,
    title: args.title,
    description: args.description,
    totalChapters: args.total_chapters,
    chapterCompleted: args.chapter_completed,
    storyState: args.story_state,
  });
  break;
```
