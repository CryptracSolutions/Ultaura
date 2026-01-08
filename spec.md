# Insights Without Transcripts - Feature Specification

## Overview

**Problem**: Dashboard shows call activity (duration, status) but no meaningful "signals". Families don't see value week-to-week. We're missing our differentiation vs competitors like Meela.

**Solution**: Build an insights system that extracts and stores only **canonical tags, scores, trends, and metadata** - no quotes, no paraphrased sentences, no raw transcripts. Everything is **baseline-aware** so families see *what changed*, not noisy "AI vibes."

**Impact**: Medium/High
**Likelihood of Success**: High
**Launch Approach**: Full feature build before launch

---

## Design Principles

1. **Actionable > Interesting**: Every signal must answer "Should I check in?" and "About what?"
2. **Trend + Change Detection**: Show *deviation from baseline* rather than absolute values
3. **No Content Storage**: Store only scores, tag IDs, severity, overall confidence, and call metadata. No verbatim text, no "summary paragraph."
4. **Consent Controls**: Privacy controls via settings AND voice commands during calls
5. **Language Agnostic**: Works for all languages Grok supports

---

## Target Audience

- **Primary viewers**: Both family members (payers) AND seniors see the same insights view
- **Access point**: New dedicated "Insights" tab in dashboard
- **History depth**: Last 30 days with weekly comparison

---

## Core Metrics ("The Core 5")

### 1. Answered / Missed + Call Duration

**Purpose**: Fastest proxy for isolation, routine disruption, availability.

**Stored fields**:
- `answered` (boolean)
- `duration_seconds` (integer)
- `direction` (enum: inbound/outbound)
- `end_reason` (enum: hangup, no_answer, busy, trial_cap, minutes_cap, error)

**Display**: Show trends vs baseline (e.g., "Calls answered: 5/6 (+1 from last week)")

**Minimum call threshold**: Insights are NOT generated for calls under 3 minutes

---

### 2. Engagement Score (1-10)

**Definition**: Model-provided 1-10 score only (no objective blending for MVP).

**Stored fields**:
- `engagement_score` (decimal 1-10)

**Formatting**: Store as decimal; round for display

**Display**: Change-focused only
- Only surface when score deviates significantly downward from baseline
- Example: "Engagement: down 2.6 points from typical"
- Never show "higher than typical"

**Alert threshold**: 2.5 points below baseline triggers concern (downward only)

---

### 3. Mood (3-state + intensity)

**Output**:
- `mood_overall`: enum (`positive` | `neutral` | `low`)
- `mood_intensity`: integer 0-3 (how strongly expressed)

**UI Label**: "Mood" (not clinical, but clear)
- Display as: "Mood: positive", "Mood: neutral", "Mood: low"
- Weekly summary label can be "Mixed week" if the week includes both positive and low calls

**Display**: Change-focused - only highlight when pattern shifts (3+ low calls in week with baseline ≤1)

---

### 4. Social Need / Loneliness Indicator (0-3)

**Output**:
- `social_need_level`: integer 0-3

**Trigger signals** (detected but not stored as quotes):
- Asked for more calls
- Expressed feeling alone
- Seeking reassurance
- Limited social mentions

**Display**: Trend-only (derived from `follow_up_reasons` contains `wants_more_contact`)
- Only surface if `wants_more_contact` appears in 3 consecutive weeks and baseline had 0 occurrences
- Baseline window for this trend is the 14 days immediately BEFORE the 3-week streak (total lookback = 5 weeks)
- Example: "Social connection: may benefit from extra contact"
- Do NOT show if level is normal/stable

---

### 5. Needs Follow-up Flag

**Output**:
- `needs_follow_up`: boolean
- `follow_up_reasons`: array of reason codes (strict enum - see below)

**Allowed reason codes**:
- All concern codes: `loneliness`, `sadness`, `anxiety`, `sleep`, `pain`, `fatigue`, `appetite`
- Additional codes: `wants_more_contact`, `missed_routine`

**Purpose**: Single caregiver-friendly output answering "Should I follow up?"

**Display**: Prominent when true, hidden when false

---

## Topic Tracking

### Topic Taxonomy (10 Categories - Engagement-Focused)

| Code | Label | Description |
|------|-------|-------------|
| `family` | Family | Discussions about family members, relationships |
| `friends` | Friends | Social connections, friendships |
| `activities` | Activities | Things they're doing, physical activities |
| `interests` | Interests | Hobbies, passions, ongoing interests |
| `memories` | Stories & Memories | Past events, life stories, reminiscing |
| `plans` | Plans & Future | Upcoming events, things to look forward to |
| `daily_life` | Daily Life | Routine, meals, household, schedules |
| `entertainment` | Entertainment | TV, movies, books, music, games |
| `feelings` | Feelings | Emotional expression, how they're feeling |
| `requests` | Requests | Things they need help with, asks |

### Storage per call:
```json
{
  "topics": [
    {"code": "family", "weight": 0.6},
    {"code": "memories", "weight": 0.3},
    {"code": "daily_life", "weight": 0.1}
  ]
}
```

### Display:
- **Per call**: Top 3 topics
- **Weekly summary**: Top 5 topics for the week
- Shown as simple tags/chips in UI

### Privacy Controls:
- Topics can be marked private during calls via `mark_topic_private` (persists to line settings)
- `log_call_insights.private_topics` hides topics for the current call only (does not persist)
- Topics can be configured as private in line settings
- Private topics are stored but NOT shown to any viewer in insights

---

## Concern Tracking

### Concern Taxonomy (7 Categories - Wellbeing-Focused)

| Code | Label | Severity Range | Description |
|------|-------|----------------|-------------|
| `loneliness` | Loneliness | 1-3 | Expressed isolation, wanting more contact |
| `sadness` | Sadness | 1-3 | Grief, low mood, tearfulness |
| `anxiety` | Anxiety | 1-3 | Worry, stress, nervousness |
| `sleep` | Sleep Trouble | 1-3 | Sleep quality, insomnia, fatigue from sleep |
| `pain` | Pain/Discomfort | 1-3 | Physical discomfort (self-reported, non-diagnostic) |
| `fatigue` | Fatigue | 1-3 | Low energy, tiredness |
| `appetite` | Appetite | 1-3 | Eating concerns, appetite changes |

### Storage per call:
```json
{
  "concerns": [
    {
      "code": "loneliness",
      "severity": 2,
      "confidence": 0.8,
      "is_novel": false
    }
  ]
}
```

### Novelty Tracking:
- Per-call: store `is_novel` boolean (true = new, false = recurring)
- Weekly summary: mark "resolved" when a concern appears in the baseline window but not in the current week

### Display:
- Show ALL detected concerns by default (no opt-in required)
- Format: Category + Severity + Trend
- Examples:
  - "New this week: sleep trouble (moderate)"
  - "Recurring: loneliness (mild)"
  - "Resolved: anxiety (was moderate last week → not present)"

### Important:
- No quotes or paraphrased sentences
- Label as self-reported observations, NOT clinical assessments

---

## Safety System Integration

### Separate Systems

The **existing safety system** (low/medium/high tiers) handles **emergencies**:
- Suicide ideation, self-harm, abuse, immediate danger
- Triggers trusted contact notifications
- Remains unchanged

The **new concerns system** handles **non-urgent wellbeing patterns**:
- Loneliness, sadness, anxiety, sleep, etc.
- Surfaces in weekly insights
- Does NOT trigger emergency alerts

### No Overlap
- Safety events continue to work as they do today
- Concerns are separate and lower-priority
- If something is urgent, safety system handles it; insights system does not escalate

---

## NOT Tracking (Explicitly Excluded)

### Conversation Clarity / Confusion

**Decision**: Do NOT implement clarity/confusion/disorientation tracking.

**Reason**: Too risky - potential for:
- Misuse by families
- Liability issues
- False positives causing alarm
- Not appropriate for non-clinical AI system

---

## Alerting Rules

### Tier 1: Weekly Summary Only (No Immediate Alert)

- Engagement down ≥2.5 from baseline for 2+ calls (downward only)
- Mood pattern shift: 3+ calls in the week with mood=low and baseline window had ≤1
- New concern at severity 2 or higher
- Missed calls increased from typical pattern (answer_rate drop ≥20 percentage points vs baseline AND at least 2 missed scheduled calls)

### Tier 2: Immediate Notification

**Triggers**:
1. **Safety events** (existing system - unchanged)
2. **3+ consecutive scheduled calls missed** (send once per streak; reset on answered scheduled outbound)

**Notification format**: Email only for MVP (SMS not implemented)

**Smart gap detection**:
- Only alert if schedule was expected but calls didn't happen
- Respect "pause" mode when family marks senior as away

---

## Pause Mode

### Purpose
Allow families to suppress alerts/insights when senior is traveling, hospitalized, visiting family, etc.

### Implementation

**Dashboard toggle**: Simple on/off in line settings
- No end date required (simple implementation)
- Manual toggle off when senior returns

**Voice activation**:
- Senior can say "I'll be away next week" or similar
- System auto-enables pause mode
- Grok tool: `set_pause_mode`

**Effects when paused**:
- Scheduled calls still happen (unless schedule is paused separately)
- Insights still generated and stored
- Alerts are suppressed
- Weekly summary notes "paused" status

---

## Baseline Calculation

### Baseline Window (14 days, excluding current week)

For trend comparisons, the baseline uses the 14 days immediately preceding the current 7-day summary window (no overlap).

```
|-------- baseline (days -21 to -8) --------|------- current week (days -7 to 0) -------|
```

For each metric (engagement, mood distribution, typical duration, typical call count):

```sql
-- Example: engagement baseline
SELECT AVG(engagement_score)
FROM ultaura_call_insights
WHERE line_id = $1
  AND created_at >= $baseline_start
  AND created_at < $baseline_end
  AND engagement_score IS NOT NULL
```

Baseline window definitions (line-local dates):

```
week_end = start of today
week_start = week_end - 7 days
baseline_end = week_start
baseline_start = baseline_end - 14 days
```

**Note**: Social-need trend uses a separate 5-week lookback: 14-day baseline immediately before the 3-week streak window.

### Storage

**Table**: `ultaura_line_baselines`

| Column | Type | Description |
|--------|------|-------------|
| `line_id` | UUID | FK to ultaura_lines |
| `updated_at` | timestamptz | Last calculation time |
| `avg_engagement` | decimal | Rolling average engagement |
| `avg_duration_seconds` | integer | Rolling average call duration |
| `calls_per_week` | decimal | Rolling average calls/week |
| `mood_distribution` | jsonb | % positive/neutral/low |
| `answer_rate` | decimal | % of scheduled calls answered |

### Update Frequency
- Nightly batch job (MVP): run once daily at 10:00 UTC
- Include ALL answered call types (scheduled + reminder + inbound) for engagement and mood baselines; social-need trend uses the same call set on demand
- Answer rate remains scheduled-only (see calculation below)

---

## Weekly Summary

### Delivery

**Default format**: Email only (SMS not implemented in MVP)
**Default timing**: Sunday evening (user's timezone)
**Content**: Self-contained (no login required for basic info)

**Note**: While the database schema supports `weekly_summary_format` values of `'email'`, `'sms'`, or `'both'`, the MVP implementation ignores SMS (even if selected) and only sends email. Add a TODO comment in notification sending logic for future SMS support.

### Email Template Structure

```
Subject: Weekly Check-in Summary for [Senior Name]

---
ULTAURA WEEKLY INSIGHTS
Week of [Date Range]
---

CALL ACTIVITY
• Calls answered: X/Y scheduled (trend vs last week)
• Average duration: Xm (trend)
• Missed calls: X (only if answer_rate drop ≥20pp vs baseline and missed ≥2)

ENGAGEMENT
• [Only if changed] "Engagement has been lower than typical"

MOOD PATTERN
• [Summary of week's mood trend]
• Example: "Mostly neutral with some low moments mid-week" or "Mixed week"

Mood summary logic:
- "Mixed week" if the week includes both positive and low calls

TOPICS DISCUSSED
• [Top 5 topic tags as chips/list]

[If any concerns detected:]
WELLBEING NOTES
• [New/Recurring/Resolved concerns with severity]

[If needs_follow_up true:]
FOLLOW-UP SUGGESTED
• Based on this week's patterns, consider checking in about: [reason codes]

---
[Footer disclaimer]
These insights are generated by AI and are not medical or clinical advice.
For emergencies, contact local emergency services.

Manage notification preferences: [link to dashboard settings]
---
```

### SMS Format (future, not implemented in MVP)

```
Ultaura Weekly: [Name]
Calls: 5/6 answered
Mood: mostly positive
New concern: sleep (mild)
View details: [dashboard link]
```

---

## Insights Extraction

### Method: Real-Time Tool Call

During the call, Grok has access to a new tool: `log_call_insights`

**Timing**: Called once at end of call (as conversation wraps up)

**Tool Schema**:
```typescript
{
  name: "log_call_insights",
  description: "Record conversation insights for this call. Call this as the conversation naturally concludes.",
  parameters: {
    mood_overall: "positive" | "neutral" | "low",
    mood_intensity: 0-3,
    engagement_score: 1-10,
    social_need_level: 0-3,
    topics: [{ code: string, weight: 0-1 }],
    concerns: [{
      code: string,
      severity: 1-3,
      confidence: 0-1
    }],
    needs_follow_up: boolean,
    follow_up_reasons: string[],
    confidence_overall: 0-1,
    private_topics: string[] // topic codes to hide for this call only
  }
}
```

### Extraction Prompt Additions

Add to Grok system prompt:

```
## Insights Extraction

At the end of each conversation, you must call `log_call_insights` to record your observations.

Rules:
- Only use codes from the allowed topic list: family, friends, activities, interests, memories, plans, daily_life, entertainment, feelings, requests
- Only use codes from the allowed concern list: loneliness, sadness, anxiety, sleep, pain, fatigue, appetite
- DO NOT include any quotes or paraphrased sentences
- DO NOT include specific names, places, or identifying details
- Only output scores, codes, per-concern confidence, and confidence_overall
- Engagement score should be your direct 1-10 rating (no blending)
- If unsure, lower your confidence_overall score
- Set confidence_overall to reflect your certainty across all extracted signals (0.0=uncertain, 1.0=very confident)

Topic weights should sum to approximately 1.0.
Concern severity: 1=mild, 2=moderate, 3=significant

If the resident says "keep this between us" or similar about a topic, add that topic code to private_topics array. Use `mark_topic_private` for permanent privacy (see below).
```

### Handling Abrupt Endings

If call ends unexpectedly before tool is called:
- Post-call analysis runs as fallback
- Uses ephemeral buffer content (before it's cleared)
- Generates best-effort partial insights
- Marks as `extraction_method: "post_call_fallback"`

---

## Database Schema

### New Table: `ultaura_call_insights`

```sql
CREATE TABLE ultaura_call_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Encrypted insights JSON (field-level encryption like memories)
  insights_ciphertext BYTEA NOT NULL,
  insights_iv BYTEA NOT NULL,
  insights_tag BYTEA NOT NULL,
  insights_alg TEXT NOT NULL DEFAULT 'aes-256-gcm',
  insights_kid TEXT NOT NULL DEFAULT 'kek_v1',  -- KEK version string (matches memories pattern)

  -- Non-encrypted metadata for queries
  extraction_method TEXT NOT NULL CHECK (extraction_method IN ('tool_call', 'post_call_fallback')),
  duration_seconds INTEGER,
  has_concerns BOOLEAN NOT NULL DEFAULT false,
  needs_follow_up BOOLEAN NOT NULL DEFAULT false,
  has_baseline BOOLEAN NOT NULL DEFAULT false,  -- false if baseline unavailable OR confidence_overall < 0.5

  UNIQUE(call_session_id)
);

CREATE INDEX idx_insights_line_created ON ultaura_call_insights(line_id, created_at DESC);
CREATE INDEX idx_insights_account_created ON ultaura_call_insights(account_id, created_at DESC);
CREATE INDEX idx_insights_concerns ON ultaura_call_insights(line_id, has_concerns) WHERE has_concerns = true;
CREATE INDEX idx_insights_followup ON ultaura_call_insights(line_id, needs_follow_up) WHERE needs_follow_up = true;
```

### Decrypted Insights JSON Schema

```typescript
// Strict type definitions matching Zod schema
type TopicCode = 'family' | 'friends' | 'activities' | 'interests' | 'memories' | 'plans' | 'daily_life' | 'entertainment' | 'feelings' | 'requests';
type ConcernCode = 'loneliness' | 'sadness' | 'anxiety' | 'sleep' | 'pain' | 'fatigue' | 'appetite';
type FollowUpReasonCode = ConcernCode | 'wants_more_contact' | 'missed_routine';

interface CallInsights {
  // Core metrics
  mood_overall: 'positive' | 'neutral' | 'low';
  mood_intensity: number; // 0-3
  engagement_score: number; // 1-10 (model-provided, no blending for MVP)
  social_need_level: number; // 0-3

  // Topics (strict enum codes)
  topics: Array<{
    code: TopicCode;
    weight: number; // 0-1
  }>;

  // Private topics (stored but not shown to ANY viewer)
  private_topics: TopicCode[];

  // Concerns (strict enum codes)
  concerns: Array<{
    code: ConcernCode;
    severity: number; // 1-3 (1=mild, 2=moderate, 3=significant)
    confidence: number; // 0-1
    is_novel: boolean; // true=new, false=recurring
  }>;

  // Follow-up (strict enum codes)
  needs_follow_up: boolean;
  follow_up_reasons: FollowUpReasonCode[];

  // Meta
  confidence_overall: number; // 0-1 (if <0.5, treat insights as provisional)
}
```

### New Table: `ultaura_line_baselines`

```sql
CREATE TABLE ultaura_line_baselines (
  line_id UUID PRIMARY KEY REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Rolling 14-day averages
  avg_engagement DECIMAL(4,2),
  avg_duration_seconds INTEGER,
  calls_per_week DECIMAL(4,2),
  answer_rate DECIMAL(4,3),

  -- Mood distribution (% over 14 days)
  mood_distribution JSONB NOT NULL DEFAULT '{"positive": 0, "neutral": 0, "low": 0}',

  -- For novelty detection
  recent_concern_codes TEXT[] NOT NULL DEFAULT '{}',

  -- Call count for baseline validity
  baseline_call_count INTEGER NOT NULL DEFAULT 0
);
```

### New Table: `ultaura_weekly_summaries`

```sql
CREATE TABLE ultaura_weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Aggregated data (encrypted)
  summary_ciphertext BYTEA NOT NULL,
  summary_iv BYTEA NOT NULL,
  summary_tag BYTEA NOT NULL,
  summary_alg TEXT NOT NULL DEFAULT 'aes-256-gcm',
  summary_kid TEXT NOT NULL DEFAULT 'kek_v1',  -- KEK version string (matches memories pattern)

  -- Delivery tracking
  email_sent_at TIMESTAMPTZ,
  sms_sent_at TIMESTAMPTZ,

  UNIQUE(line_id, week_start_date)
);

CREATE INDEX idx_summaries_line_week ON ultaura_weekly_summaries(line_id, week_start_date DESC);
```

### New Table: `ultaura_notification_preferences`

```sql
CREATE TABLE ultaura_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Weekly summary preferences
  weekly_summary_enabled BOOLEAN NOT NULL DEFAULT true,
  weekly_summary_format TEXT NOT NULL DEFAULT 'email' CHECK (weekly_summary_format IN ('email', 'sms', 'both')),
  weekly_summary_day TEXT NOT NULL DEFAULT 'sunday' CHECK (weekly_summary_day IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  weekly_summary_time TIME NOT NULL DEFAULT '18:00',

  -- Immediate alert preferences
  alert_missed_calls_enabled BOOLEAN NOT NULL DEFAULT true,
  alert_missed_calls_threshold INTEGER NOT NULL DEFAULT 3,

  UNIQUE(account_id, line_id)
);

-- RLS: Account-based policies
ALTER TABLE ultaura_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notification preferences for their accounts"
  ON ultaura_notification_preferences FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can insert notification preferences for their accounts"
  ON ultaura_notification_preferences FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));

CREATE POLICY "Users can update notification preferences for their accounts"
  ON ultaura_notification_preferences FOR UPDATE
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can delete notification preferences for their accounts"
  ON ultaura_notification_preferences FOR DELETE
  USING (can_access_ultaura_account(account_id));
```

### New Table: `ultaura_insight_privacy`

```sql
CREATE TABLE ultaura_insight_privacy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Master toggle for insights
  insights_enabled BOOLEAN NOT NULL DEFAULT true,

  -- Topics marked as private in settings
  private_topic_codes TEXT[] NOT NULL DEFAULT '{}',

  -- Pause mode
  is_paused BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMPTZ,
  paused_reason TEXT
);

CREATE UNIQUE INDEX idx_insight_privacy_line ON ultaura_insight_privacy(line_id);

-- RLS: Standard account-based policies (like ultaura_lines)
ALTER TABLE ultaura_insight_privacy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view insight privacy for their lines"
  ON ultaura_insight_privacy FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE POLICY "Users can update insight privacy for their lines"
  ON ultaura_insight_privacy FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE POLICY "Users can insert insight privacy for their lines"
  ON ultaura_insight_privacy FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE POLICY "Users can delete insight privacy for their lines"
  ON ultaura_insight_privacy FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- Auto-create row for new lines (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION create_insight_privacy_for_line()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ultaura_insight_privacy (line_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_insight_privacy
AFTER INSERT ON ultaura_lines
FOR EACH ROW EXECUTE FUNCTION create_insight_privacy_for_line();

-- Backfill existing lines
INSERT INTO ultaura_insight_privacy (line_id)
SELECT id FROM ultaura_lines
ON CONFLICT (line_id) DO NOTHING;
```

### Extend `ultaura_lines` Table

```sql
ALTER TABLE ultaura_lines ADD COLUMN consecutive_missed_calls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ultaura_lines ADD COLUMN last_answered_call_at TIMESTAMPTZ;
ALTER TABLE ultaura_lines ADD COLUMN missed_alert_sent_at TIMESTAMPTZ;
ALTER TABLE ultaura_lines ADD COLUMN last_weekly_summary_at TIMESTAMPTZ;
```

### Extend `ultaura_call_sessions` Table

```sql
-- Add test call flag for reliable detection in insights pipeline
ALTER TABLE ultaura_call_sessions ADD COLUMN is_test_call BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_call_sessions_test ON ultaura_call_sessions(is_test_call) WHERE is_test_call = true;
```

---

## New Grok Tools

### 1. `log_call_insights`

**Purpose**: Record conversation insights at end of call

**Location**: `/telephony/src/routes/tools/log-call-insights.ts`

**Input Schema**:
```typescript
const LogCallInsightsSchema = z.object({
  mood_overall: z.enum(['positive', 'neutral', 'low']),
  mood_intensity: z.number().int().min(0).max(3),
  engagement_score: z.number().min(1).max(10),
  social_need_level: z.number().int().min(0).max(3),
  topics: z.array(z.object({
    code: z.enum(['family', 'friends', 'activities', 'interests', 'memories', 'plans', 'daily_life', 'entertainment', 'feelings', 'requests']),
    weight: z.number().min(0).max(1)
  })),
  private_topics: z.array(z.string()).optional().default([]),
  concerns: z.array(z.object({
    code: z.enum(['loneliness', 'sadness', 'anxiety', 'sleep', 'pain', 'fatigue', 'appetite']),
    severity: z.number().int().min(1).max(3),
    confidence: z.number().min(0).max(1)
  })).optional().default([]),
  needs_follow_up: z.boolean(),
  follow_up_reasons: z.array(z.enum([
    // Concern codes
    'loneliness', 'sadness', 'anxiety', 'sleep', 'pain', 'fatigue', 'appetite',
    // Additional reason codes
    'wants_more_contact', 'missed_routine'
  ])).optional().default([]),
  confidence_overall: z.number().min(0).max(1)
});
```

**Implementation** (follows existing tool patterns):

```typescript
// Standard tool handler structure
router.post('/', async (req: Request, res: Response) => {
  const { callSessionId, lineId, ...insightData } = req.body;

  // 1. Get call session (standard pattern)
  const session = await getCallSession(callSessionId);
  if (!session) {
    res.status(404).json({ error: 'Call session not found' });
    return;
  }
  const accountId = session.account_id;

  // 2. Define failure logger (standard pattern)
  const recordFailure = async (errorCode?: string) => {
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'log_call_insights',
      success: false,
      errorCode,
    }, { skipDebugLog: true });
  };

  // 3. Validate input with Zod
  const parsed = LogCallInsightsInputSchema.safeParse(insightData);
  if (!parsed.success) {
    await recordFailure('validation_error');
    res.status(400).json({ error: 'Invalid insight data' });
    return;
  }

  // 4. Check insights_enabled
  const { data: privacy } = await supabase
    .from('ultaura_insight_privacy')
    .select('insights_enabled')
    .eq('line_id', lineId)
    .single();
  if (!privacy?.insights_enabled) {
    res.json({ success: true, skipped: true, reason: 'insights_disabled' });
    return;
  }

  // 5. Check call duration ≥ 3 minutes
  if (session.seconds_connected < 180) {
    res.json({ success: true, skipped: true, reason: 'call_too_short' });
    return;
  }

  // 6. Check is_test_call
  if (session.is_test_call) {
    res.json({ success: true, skipped: true, reason: 'test_call' });
    return;
  }

  // 7. Check for duplicate (first-write-wins)
  const { data: existing } = await supabase
    .from('ultaura_call_insights')
    .select('id')
    .eq('call_session_id', callSessionId)
    .single();
  if (existing) {
    res.json({ success: true, skipped: true, reason: 'already_recorded' });
    return;
  }

  // 8-15. Core logic (see service function below)
  const result = await storeCallInsights(accountId, lineId, callSessionId, parsed.data);

  // 16. Increment tool invocations (standard pattern)
  await incrementToolInvocations(callSessionId);

  // 17. Record success event (standard pattern)
  await recordCallEvent(callSessionId, 'tool_call', {
    tool: 'log_call_insights',
    success: true,
    has_concerns: result.hasConcerns,
    confidence: parsed.data.confidence_overall,
  }, { skipDebugLog: true }); // IMPORTANT: skip debug log for sensitive data

  res.json({ success: true, insightId: result.id });
});
```

**Service function** (`/telephony/src/services/insights.ts`):
```typescript
async function storeCallInsights(
  accountId: string,
  lineId: string,
  callSessionId: string,
  data: LogCallInsightsInput
): Promise<{ id: string; hasConcerns: boolean }> {
  // 1. Merge per-call private_topics with any mark_topic_private calls from session
  // 2. Persist ONLY mark_topic_private calls to ultaura_insight_privacy.private_topic_codes
  // 3. Use engagement_score as provided (no blending for MVP)
  // 4. Check if baseline exists (baseline_call_count >= 3)
  // 5. Set has_baseline = baselineAvailable && data.confidence_overall >= 0.5
  // 6. Compute concern is_novel flags from baseline recent_concern_codes
  // 7. Build AAD and encrypt insights JSON
  // 8. Insert into ultaura_call_insights
  // Returns { id, hasConcerns }
}
```

### 2. `set_pause_mode`

**Purpose**: Allow senior to pause insights/alerts via voice

**Location**: `/telephony/src/routes/tools/set-pause-mode.ts`

**Input Schema**:
```typescript
const SetPauseModeSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().optional()
});
```

**Trigger phrases** (add to Grok prompt):
- "I'll be away"
- "I'm traveling"
- "I'm going to visit [family member]"
- "I'm going to the hospital"

### 3. `mark_topic_private`

**Purpose**: Mark conversation topic as permanently private (persists to line settings)

**Location**: `/telephony/src/routes/tools/mark-topic-private.ts`

**Input Schema**:
```typescript
const MarkTopicPrivateSchema = z.object({
  topic_code: z.enum(['family', 'friends', 'activities', 'interests', 'memories', 'plans', 'daily_life', 'entertainment', 'feelings', 'requests'])
});
```

**Trigger phrases**:
- "Keep this between us"
- "Don't tell my [family member] about this"
- "This is private"

**Implementation**:
1. Add `topic_code` to `ultaura_insight_privacy.private_topic_codes` array (persists permanently)
2. Track in session state for merging with `log_call_insights.private_topics`
3. Return confirmation to Grok: "I'll keep that private"

**Note**: When senior requests privacy, Grok should:
1. Always call `mark_topic_private` for insights
2. Optionally also call existing `mark_private` tool if a specific memory was just discussed

---

## API Endpoints & Server Actions

### New Server Actions (`/src/lib/ultaura/insights.ts`)

```typescript
// Get insights for a specific line
export async function getLineInsights(lineId: string, options?: {
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<CallInsight[]>

// Get current baseline for a line
export async function getLineBaseline(lineId: string): Promise<LineBaseline | null>

// Get weekly summary for a specific week
export async function getWeeklySummary(lineId: string, weekStartDate: Date): Promise<WeeklySummary | null>

// Get aggregated insights for dashboard display
export async function getInsightsDashboard(lineId: string): Promise<InsightsDashboard>

// Update notification preferences
export async function updateNotificationPreferences(
  accountId: string,
  lineId: string,
  preferences: Partial<NotificationPreferences>
): Promise<void>

// Update insight privacy settings
export async function updateInsightPrivacy(
  lineId: string,
  settings: Partial<InsightPrivacy>
): Promise<void>

// Toggle pause mode
export async function setPauseMode(lineId: string, enabled: boolean, reason?: string): Promise<void>
```

### New Telephony Endpoints (Grok Tools)

```
POST /tools/log_call_insights     - Grok tool handler (mounts as /tools/log_call_insights)
POST /tools/set_pause_mode        - Grok tool handler
POST /tools/mark_topic_private    - Grok tool handler
```

### New Next.js API Endpoints (Email Delivery)

Following the existing pattern where telephony calls Next.js for email delivery:

```
POST /api/telephony/weekly-summary  - Receives WeeklySummaryData, renders template, sends email
POST /api/telephony/missed-calls    - Receives alert data, sends missed-call alert email
```

**Authentication**: `X-Webhook-Secret` header (timing-safe comparison against `ULTAURA_INTERNAL_API_SECRET`)

**Pattern**: Telephony generates data → POST to Next.js → Next.js renders email template → sendEmail()

**Missed Calls Alert Payload**:
```typescript
interface MissedCallsAlertPayload {
  lineId: string;
  accountId: string;
  lineName: string;
  consecutiveMissedCount: number;
  lastAttemptAt: string; // ISO timestamp
}
```

---

## Dashboard UI

### New Route: `/dashboard/(app)/insights/`

**Files to create**:
- `/src/app/dashboard/(app)/insights/page.tsx` - Main insights page
- `/src/app/dashboard/(app)/insights/InsightsPageClient.tsx` - Client component
- `/src/app/dashboard/(app)/insights/components/InsightsSummary.tsx` - Weekly summary card
- `/src/app/dashboard/(app)/insights/components/MoodTrend.tsx` - Mood visualization
- `/src/app/dashboard/(app)/insights/components/TopicsChart.tsx` - Topic distribution
- `/src/app/dashboard/(app)/insights/components/ConcernsList.tsx` - Active concerns
- `/src/app/dashboard/(app)/insights/components/CallMetrics.tsx` - Call statistics

### Insights Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [Line Selector Dropdown]                     [Date Range]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   THIS WEEK SUMMARY  │  │        CALL ACTIVITY         │ │
│  │                      │  │                              │ │
│  │  Calls: 5/6 (+1)     │  │  [Simple bar chart showing   │ │
│  │  Duration: 12m avg   │  │   calls per day last 30d]    │ │
│  │  Mood: mostly neutral│  │                              │ │
│  │                      │  │                              │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────┐  ┌──────────────────────────────┐ │
│  │   ENGAGEMENT TREND   │  │         MOOD TREND           │ │
│  │                      │  │                              │ │
│  │  [Only if notable]   │  │  [Color-coded dots showing   │ │
│  │  "Down 2.6 from      │  │   mood per call over time]   │ │
│  │   typical"           │  │                              │ │
│  │                      │  │  ● positive ● neutral ● low  │ │
│  └──────────────────────┘  └──────────────────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    TOPICS THIS WEEK                      ││
│  │                                                          ││
│  │  [Family] [Memories] [Daily Life] [Entertainment] [Plans]││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                   WELLBEING NOTES                        ││
│  │                                                          ││
│  │  ⚠️ New: sleep trouble (moderate)                        ││
│  │  🔄 Recurring: loneliness (mild)                         ││
│  │  ✅ Resolved: anxiety (was moderate)                     ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌──────────────────────────────────────────────────────────┐│
│  │                    CALL HISTORY                          ││
│  │                                                          ││
│  │  [Enhanced CallActivityList with mood indicators]        ││
│  │                                                          ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Call activity chart scope**: Include all call types (scheduled + reminder + inbound), with visual distinction by type/direction.

**Insights disabled banner**: Show a read-only banner when insights are disabled for the line; include a link to Line Settings to re-enable; keep historical data visible.

**Call history mood indicator**: 8x8 dot to the right of the status badge; show only for calls with insights where `mood_overall` is positive (`bg-success`) or low (`bg-destructive`); no dot for neutral or missing insights (including <3 min). Add tooltip text "Mood: Positive" / "Mood: Low".

### Settings Integration

Add to line settings page (`/src/app/dashboard/(app)/lines/[lineId]/settings/`):

**New section: "Insights & Privacy"**
- Toggle: Enable/disable insights for this line
- Topic privacy: Multi-select for private topics
- Pause mode: Toggle with optional reason field

**New section: "Weekly Summary"**
- Toggle: Enable/disable weekly summary
- Format: Email only (SMS hidden in MVP)
- Day: Dropdown (Sunday default)
- Time: Time picker (6pm default)

**Scope**: Line-specific controls only; no account-level defaults or inherited indicators

**Add Line Modal (Step 2 info callout)**:
```
ℹ️ About Call Insights

After each call, we'll capture a brief summary of topics discussed
and overall mood — but never transcripts or quotes. You can disable
insights anytime in Line Settings.
```

---

## Scheduled Jobs

### 1. Weekly Summary Generator

**Frequency**: Hourly at :00 (checks which lines are due within the hour)

**Location**: `/telephony/src/scheduler/weekly-summary-scheduler.ts` (SEPARATE from call-scheduler)

**Why separate**:
- Call scheduler runs every 30 seconds; weekly summary runs hourly
- Different concerns: call initiation vs. aggregation + email
- If call scheduler hangs, weekly summaries shouldn't be blocked

**Logic**:
```typescript
async function generateWeeklySummaries() {
  // Run hourly, check each line's preferred day/time in their timezone
  const lines = await getLinesForWeeklySummary();

  for (const line of lines) {
    const lineTime = DateTime.now().setZone(line.timezone);
    const preferredHour = parseInt(line.weekly_summary_time.split(':')[0]);
    const preferredWeekday = mapWeekday(line.weekly_summary_day); // sunday=7 ... saturday=6

    if (lineTime.weekday !== preferredWeekday) continue;
    if (!isWithinWindow(lineTime.hour, preferredHour, 1)) continue;
    if (!line.notificationPrefs.weekly_summary_enabled) continue;
    if (!line.insightsEnabled) continue;

    // Dedup: only send once per week per line
    const weekStart = getWeekStart(lineTime, line.weekly_summary_day); // aligns with summary window
    if (line.last_weekly_summary_at && line.last_weekly_summary_at >= weekStart) {
      continue;
    }

    // Generate summary
    const summary = await aggregateWeeklyInsights(line.id);
    await storeWeeklySummary(line.id, summary);
    await markWeeklySummarySent(line.id, lineTime.toISO());

    // POST to Next.js for email delivery
    await fetch(`${NEXT_PUBLIC_SITE_URL}/api/telephony/weekly-summary`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': ULTAURA_INTERNAL_API_SECRET,
      },
      body: JSON.stringify(summary),
    });
  }
}
```

**Idempotency**: Use `ultaura_lines.last_weekly_summary_at` to prevent double-sends per week; `UNIQUE(line_id, week_start_date)` is a secondary backstop

### 2. Missed Call Alert Checker

**Frequency**: After each scheduled call attempt

**Location**: Extend existing call-scheduler

**Logic**:
```typescript
async function checkMissedCallAlert(lineId: string, wasAnswered: boolean) {
  if (wasAnswered) {
    await resetConsecutiveMissedCalls(lineId);
    return;
  }

  const newCount = await incrementConsecutiveMissedCalls(lineId);
  const threshold = await getMissedCallThreshold(lineId); // default: 3

  const { insightsEnabled, missedAlertSentAt } = await getInsightsAlertState(lineId);

  if (newCount >= threshold && !missedAlertSentAt) {
    const isPaused = await isInsightsPaused(lineId);
    if (!isPaused && insightsEnabled) {
      await sendMissedCallAlert(lineId, newCount);
      await markMissedAlertSent(lineId);
    }
  }
}
```

### 3. Baseline Recalculator

**Frequency**: Nightly batch at 10:00 UTC (MVP)

**Location**: Run during daily scheduler cycle or as part of weekly summary generator

**Logic**:
```typescript
async function recalculateBaseline(lineId: string) {
  const { insightsEnabled } = await getInsightPrivacy(lineId);
  if (!insightsEnabled) return;

  const insights = await getInsightsBaselineWindow(lineId); // 14-day window excluding current week, all answered call types

  if (insights.length < 3) {
    // Not enough data for reliable baseline - mark as unavailable
    await upsertBaseline(lineId, { baseline_call_count: insights.length });
    return;
  }

  // Calculate answer_rate from SCHEDULED calls only (exclude reminders)
  const answerRate = await calculateAnswerRate(lineId);

  const baseline = {
    avg_engagement: average(insights.map(i => i.engagement_score)),
    avg_duration_seconds: average(insights.map(i => i.duration_seconds)),
    calls_per_week: insights.length / 2, // 14 days = 2 weeks
    answer_rate: answerRate,
    mood_distribution: calculateMoodDistribution(insights),
    recent_concern_codes: getUniqueConcernCodes(insights),
    baseline_call_count: insights.length
  };

  await upsertBaseline(lineId, baseline);
}

// Answer rate calculation (ONLY scheduled check-ins, not reminders)
async function calculateAnswerRate(lineId: string): Promise<number> {
  const { data } = await supabase
    .from('ultaura_call_sessions')
    .select('answered_by, seconds_connected')
    .eq('line_id', lineId)
    .like('scheduler_idempotency_key', 'schedule:%')  // Exclude reminder:*
    .gte('created_at', baselineStart.toISO())
    .lt('created_at', baselineEnd.toISO());

  if (!data || data.length === 0) return 0;

  const answered = data.filter(s =>
    s.answered_by === 'human' ||
    s.answered_by === 'unknown' ||
    (s.answered_by === null && s.seconds_connected > 0)
  ).length;

  return answered / data.length;
}
```

**Baseline availability**: `baseline_call_count >= 3` determines if baseline is available; per-call trend comparisons also require `confidence_overall >= 0.5`

---

## Encryption Implementation

### Reuse Existing Key Infrastructure

Use the same DEK/KEK pattern as `ultaura_memories`:

```typescript
// From existing memory encryption
import { getAccountDEK, encryptField, decryptField } from '../services/memory-crypto';

async function encryptInsights(
  accountId: string,
  insights: CallInsights
): Promise<EncryptedInsights> {
  const dek = await getAccountDEK(accountId);
  const plaintext = JSON.stringify(insights);

  return encryptField(dek, plaintext, {
    aad: `insights:${accountId}`
  });
}

async function decryptInsights(
  accountId: string,
  encrypted: EncryptedInsights
): Promise<CallInsights> {
  const dek = await getAccountDEK(accountId);

  const plaintext = await decryptField(dek, encrypted, {
    aad: `insights:${accountId}`
  });

  return JSON.parse(plaintext);
}
```

---

## Grok Prompt Additions

Add to the voice-realtime system prompt:

```markdown
## Conversation Insights

At the natural end of the conversation, you must call `log_call_insights` to record your observations about the call.

### Topic Codes (use ONLY these)
- family: Family members, relationships
- friends: Social connections
- activities: Physical activities, things they do
- interests: Hobbies, passions
- memories: Past events, life stories
- plans: Future events, things to look forward to
- daily_life: Routine, meals, household
- entertainment: TV, movies, books, music
- feelings: Emotional expression
- requests: Things they need help with

### Concern Codes (use ONLY these, only if clearly expressed)
- loneliness: Expressed isolation, wanting more contact
- sadness: Grief, low mood
- anxiety: Worry, stress
- sleep: Sleep quality issues
- pain: Physical discomfort
- fatigue: Low energy
- appetite: Eating concerns

### Follow-up Reason Codes (use ONLY these for follow_up_reasons)
- Any concern code above (loneliness, sadness, anxiety, sleep, pain, fatigue, appetite)
- wants_more_contact: Explicitly asked for more calls or visits
- missed_routine: Confused about schedule or routine disruption

### Rules
1. Call `log_call_insights` ONCE as the conversation naturally ends
2. DO NOT include quotes or specific phrases
3. Severity levels: 1=mild, 2=moderate, 3=significant
4. Topic weights should sum to approximately 1.0
5. Use `mood_overall` as positive, neutral, or low (3-state only)
6. Engagement score should be your direct 1-10 rating (no blending)
7. Set confidence_overall to reflect your certainty across all signals (0.0=uncertain, 1.0=very confident)
8. If they say "keep this between us", add that topic to private_topics for this call

### Privacy Commands
When the resident says phrases like:
- "Keep this between us"
- "Don't tell my family about this"
- "This is private"

1. ALWAYS call `mark_topic_private` with the relevant topic code (this hides the topic from insights)
2. If you just stored a specific memory about this topic, ALSO call `mark_private` to hide that memory

Note: `private_topics` in `log_call_insights` applies to the current call only; `mark_topic_private` persists to settings.

Example: If they shared something private about family drama:
- Call `mark_topic_private({ topic_code: 'family' })` - hides family topics from insights
- If you stored a memory about the specific situation, also call `mark_private({ what_to_keep_private: 'family drama' })`

### Pause Mode
When the resident indicates they'll be away:
- "I'll be traveling next week"
- "I'm going to the hospital"
- "I'm visiting my daughter"

Call `set_pause_mode` with enabled: true.
```

---

## Email Templates

### Weekly Summary Email

**Location**: `/src/lib/emails/weekly-summary.tsx` (React Email)

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Email-safe CSS */
    .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
    .header { background: #4A90A4; color: white; padding: 20px; text-align: center; }
    .section { padding: 20px; border-bottom: 1px solid #eee; }
    .metric { display: inline-block; margin-right: 20px; }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { font-size: 12px; color: #666; }
    .topic-tag { display: inline-block; background: #e3f2fd; padding: 4px 12px; border-radius: 16px; margin: 4px; }
    .concern { padding: 8px 0; }
    .concern-new { color: #f57c00; }
    .concern-recurring { color: #1976d2; }
    .concern-resolved { color: #388e3c; }
    .footer { padding: 20px; font-size: 12px; color: #999; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Weekly Check-in Summary</h1>
      <p>{{seniorName}} • Week of {{weekRange}}</p>
    </div>

    <div class="section">
      <h2>Call Activity</h2>
      <div class="metric">
        <div class="metric-value">{{answeredCalls}}/{{scheduledCalls}}</div>
        <div class="metric-label">Calls Answered {{answerTrend}}</div>
      </div>
      <div class="metric">
        <div class="metric-value">{{avgDuration}}m</div>
        <div class="metric-label">Avg Duration {{durationTrend}}</div>
      </div>
    </div>

    {{#if engagementNote}}
    <div class="section">
      <h2>Engagement</h2>
      <p>{{engagementNote}}</p>
    </div>
    {{/if}}

    <div class="section">
      <h2>Mood This Week</h2>
      <p>{{moodSummary}}</p>
    </div>

    <div class="section">
      <h2>Topics Discussed</h2>
      {{#each topTopics}}
      <span class="topic-tag">{{this}}</span>
      {{/each}}
    </div>

    {{#if hasConcerns}}
    <div class="section">
      <h2>Wellbeing Notes</h2>
      {{#each concerns}}
      <div class="concern concern-{{this.type}}">
        {{this.icon}} {{this.label}}: {{this.name}} ({{this.severity}})
      </div>
      {{/each}}
    </div>
    {{/if}}

    {{#if needsFollowUp}}
    <div class="section" style="background: #fff3e0;">
      <h2>Follow-up Suggested</h2>
      <p>Based on this week's patterns, consider checking in about: {{followUpReasons}}</p>
    </div>
    {{/if}}

    <div class="footer">
      <p>These insights are generated by AI and are not medical or clinical advice.</p>
      <p>For emergencies, contact local emergency services.</p>
      <p><a href="{{settingsLink}}">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>
```

### Missed Calls Alert Email

**Location**: `/src/lib/emails/missed-calls-alert.tsx` (React Email)

Subject: `Missed check-ins for [DisplayName]`

Body content (HTML):
```
Hi,

[DisplayName] has missed [X] consecutive scheduled calls from Ultaura.

This could mean:
• Phone is off or out of reach
• They're busy or away
• Line settings may need adjustment

What you can do:
• Give them a call to check in
• Review call schedule in your dashboard

[View Dashboard Button]

If you'd like to pause calls temporarily, you can do so in Line Settings.

— Ultaura
```

---

## Implementation Order

### Phase 1: Core Infrastructure
1. Create database migrations for new tables
2. Implement encryption helpers for insights
3. Add `log_call_insights` Grok tool
4. Integrate tool into voice-realtime prompt
5. Implement baseline calculation service

### Phase 2: Dashboard UI
1. Create `/insights/` route structure
2. Build InsightsDashboard component
3. Add insights data fetching actions
4. Implement topic and concern displays
5. Add insights to line settings page

### Phase 3: Notifications
1. Create notification preferences table and UI
2. Implement weekly summary generation
3. Build weekly summary email template (React Email)
4. Build missed-calls alert email template (React Email)
5. Implement missed-call alert logic
6. Add Next.js API routes for weekly summaries + missed-call alerts

### Phase 4: Privacy & Pause
1. Add `set_pause_mode` tool
2. Add `mark_topic_private` tool
3. Implement privacy filtering in UI
4. Add pause mode to settings

### Phase 5: Polish & Testing
1. Add loading states and error handling
2. Test with multi-language calls
3. Verify encryption/decryption
4. Test alerting thresholds
5. QA weekly summary emails

---

## File Changes Summary

### New Files

**Migrations**:
- `/supabase/migrations/YYYYMMDD_insights_schema.sql`

**Telephony**:
- `/telephony/src/routes/tools/log-call-insights.ts`
- `/telephony/src/routes/tools/set-pause-mode.ts`
- `/telephony/src/routes/tools/mark-topic-private.ts`
- `/telephony/src/services/insights.ts`
- `/telephony/src/services/baseline.ts`
- `/telephony/src/services/weekly-summary.ts`

**Next.js (Email + API)**:
- `/src/lib/emails/weekly-summary.tsx`
- `/src/lib/emails/missed-calls-alert.tsx`
- `/src/app/api/telephony/weekly-summary/route.ts`
- `/src/app/api/telephony/missed-calls/route.ts`

**Dashboard**:
- `/src/lib/ultaura/insights.ts`
- `/src/app/dashboard/(app)/insights/page.tsx`
- `/src/app/dashboard/(app)/insights/InsightsPageClient.tsx`
- `/src/app/dashboard/(app)/insights/components/*.tsx` (5-6 components)

**Types**:
- `/packages/types/src/insights.ts`

### Modified Files

- `/packages/prompts/src/profiles/voice-realtime.ts` - Add insights extraction instructions
- `/telephony/src/websocket/grok-bridge.ts` - Register new tools
- `/telephony/src/services/call-session.ts` - Track consecutive missed calls
- `/src/app/dashboard/(app)/lines/[lineId]/settings/SettingsClient.tsx` - Add privacy settings
- `/src/app/dashboard/(app)/lines/components/AddLineModal.tsx` - Add insights privacy callout
- `/src/app/dashboard/(app)/lines/[lineId]/components/CallActivityList.tsx` - Add mood dot indicator
- `/src/navigation.config.tsx` - Add Insights tab
- `/src/lib/ultaura/types.ts` - Add insight types
- `/src/lib/ultaura/constants.ts` - Add topic/concern taxonomies

---

## Testing Considerations

### Unit Tests
- Insight JSON schema validation
- Baseline calculation with edge cases (no data, single call, many calls)
- Encryption/decryption round-trip
- Concern novelty detection (new vs recurring vs resolved)
- Privacy filtering logic

### Integration Tests
- Grok tool calls record insights correctly
- Weekly summary aggregation across multiple calls
- Email delivery with correct template rendering
- Missed call alert triggering at correct threshold

### E2E Tests
- Complete call flow with insights extraction
- Dashboard displays correct aggregated data
- Privacy settings hide appropriate topics
- Pause mode suppresses alerts

### Manual Testing
- Multi-language insight extraction quality
- Edge cases: very short calls, abrupt hangups
- Email rendering across email clients
- Mobile dashboard responsiveness

---

## Assumptions

1. Grok reliably calls the `log_call_insights` tool at end of conversations
2. Existing encryption key infrastructure is working correctly
3. Email delivery infrastructure (Nodemailer) is operational
4. Users have valid email addresses in their accounts
5. Recharts library (already installed) is sufficient for visualizations
6. 14-day baseline is sufficient for meaningful deviation detection
7. Supabase handles the additional query load from insights tables

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| Who sees insights? | Both family and seniors, same view |
| When generated? | Real-time, after each call |
| Store transcripts? | No - scores/codes only |
| Clarity tracking? | NO - removed for liability |
| Export data? | No exports - in-app only |
| Language support? | All languages Grok supports |
| Pause mode? | Simple toggle + voice activation |
| Alert threshold? | 2.5 points for engagement, 3 missed calls |

---

## Success Metrics

1. **Adoption**: % of accounts viewing insights tab weekly
2. **Engagement**: Average time spent on insights page
3. **Value perception**: Reduction in churn for accounts using insights
4. **Alert accuracy**: False positive rate for missed call alerts
5. **Email engagement**: Open rate for weekly summaries
6. **Concern detection**: Rate of concern detection vs baseline
7. **Differentiation**: Competitor comparison in user research

---

## Disclaimer Text

For weekly emails and any in-app displays:

> These insights are generated by AI based on conversation patterns and are not medical, clinical, or professional advice. Ultaura is not an emergency service. If you believe there is immediate danger, contact local emergency services (911 in the US).

---

## Implementation Clarifications

This section documents detailed implementation decisions made during spec review.

### Data Model

| Decision | Details |
|----------|---------|
| **Insights enable/disable toggle** | Lives in `ultaura_insight_privacy.insights_enabled` column |
| **RLS approach** | Service-role only for encrypted tables (`ultaura_call_insights`, `ultaura_weekly_summaries`); server actions decrypt for dashboard. `ultaura_insight_privacy` gets standard account-based RLS |
| **Server actions location** | Create new `/src/lib/ultaura/insights.ts` file (per-domain pattern, not monolithic actions.ts) |
| **Encryption key ID (`insights_kid`)** | TEXT type storing version string like `'kek_v1'` (matches existing `ultaura_memories.value_kid` pattern), NOT UUID FK |
| **AAD format** | JSON with `account_id`, `line_id`, `call_session_id`, `type` for stronger binding |
| **Debug logging** | Log tool invocation metadata only (has_concerns, confidence_overall), NOT insight values |
| **`ultaura_insight_privacy` row creation** | Backfill existing lines in migration + trigger auto-creates for new lines |
| **`ultaura_notification_preferences` scope** | Line-specific only (`line_id` required); no account-level defaults |
| **Notification prefs UI** | Line-specific controls only; no account-level defaults screen or inherited indicator |
| **Test call detection** | New `is_test_call BOOLEAN` column on `ultaura_call_sessions`, set true when `reason='test'` |
| **`last_answered_call_at` updates** | Any answered call (inbound, reminder, scheduled) updates this field |
| **`last_weekly_summary_at` updates** | Set after a weekly summary is generated and sent (dedup per week) |
| **`answered_by = 'unknown'` handling** | Treat as answered (updates last_answered_call_at; resets missed counter only for scheduled outbound) |
| **`answered_by = NULL` with `seconds_connected > 0`** | Count as answered (AMD disabled but call connected) |
| **`insights_enabled = false` behavior** | Skip insights storage/baselines/summaries; suppress insights alerts only; still update missed-call counters; show disabled banner in Insights tab |
| **`has_baseline` column** | Non-encrypted metadata column on `ultaura_call_insights`; set false when baseline unavailable or confidence_overall < 0.5 |
| **Notification prefs creation** | Lazy creation - create line-specific defaults on first read if missing |
| **Language storage** | Use `ultaura_call_sessions.language_detected`; do not duplicate in insights JSON |

### Insights Processing

| Decision | Details |
|----------|---------|
| **Engagement storage** | Store model-provided engagement score directly (no blending for MVP) |
| **No baseline available / low confidence** | Mark insight as provisional (`has_baseline = false`) when baseline unavailable or `confidence_overall < 0.5`; display without trend comparison |
| **Engagement deviation** | Flag only when current engagement is ≥2.5 points below baseline; never surface positive deltas |
| **`follow_up_reasons` validation** | Strict zod enum - reject unknown codes at validation time |
| **Allowed `follow_up_reasons` codes** | Concern codes (`loneliness`, `sadness`, `anxiety`, `sleep`, `pain`, `fatigue`, `appetite`) + `wants_more_contact`, `missed_routine` |
| **Fallback extraction scope** | Same as tool calls - if call ≥3min and `insights_enabled`, extract regardless of call type (except test) |
| **Concern novelty** | Stored per concern as `is_novel` at call time (true=new, false=recurring); weekly summary computes "resolved" by comparing baseline window to current week |
| **Mood trend** | Pattern shift when week has 3+ low-mood calls and baseline window had ≤1 |
| **Social need trend** | Derived from `follow_up_reasons` containing `wants_more_contact`; computed on-demand from call insights (no stored baseline); surface only after 3 consecutive weeks and baseline had 0 occurrences; baseline = 14 days immediately before the 3-week streak (5-week lookback) |
| **Duplicate `log_call_insights` handling** | First-write wins - check for existing row before inserting, ignore duplicates |
| **Insights for call types** | Scheduled: Yes, Reminder: Yes (if conversation), Inbound: Yes, Test: No |
| **Sub-3-minute calls** | Update last_answered_call_at; reset missed counter only if answered scheduled outbound; skip insights storage |
| **Fallback integration** | Run BEFORE buffer clearing in call completion pipeline, same location as memory extraction |

### Privacy

| Decision | Details |
|----------|---------|
| **`mark_topic_private` persistence** | Persists to line settings (`ultaura_insight_privacy.private_topic_codes`) - affects future calls |
| **Private topics merge behavior** | `mark_topic_private` persists to settings; `log_call_insights.private_topics` applies to the current call only |
| **Who sees private topics** | Hide from ALL viewers (no role distinction) - simpler implementation |
| **Private topics in calculations** | Include in baseline/trend math, only hide from UI display |
| **Privacy copy updates** | Update Grok prompt, line settings UI, and AddLineModal Step 2 info callout |
| **When Grok should call privacy tools** | Call `mark_topic_private` when senior requests privacy; optionally also call existing `mark_private` if specific memory was just discussed |

### Safety System Integration

| Decision | Details |
|----------|---------|
| **Safety vs Concerns separation** | Keep both systems independent - safety handles emergencies (keyword backstop), concerns handle wellbeing patterns (model assessment) |
| **Low-tier safety events** | Do NOT remove from safety system; they ensure Grok responds empathetically. Do NOT surface low-tier safety_events in insights dashboard (families see concerns via insights instead) |

### Alerts & Baselines

| Decision | Details |
|----------|---------|
| **What counts as "missed" for counter** | `end_reason` in (`no_answer`, `busy`, `error`) OR `answered_by` in (`machine_start`, `machine_end_beep`, `machine_end_silence`, `machine_end_other`, `fax`) |
| **What does NOT count as missed** | `end_reason` in (`trial_cap`, `minutes_cap`) - system limitations, not senior behavior |
| **What resets missed counter** | Human-answered scheduled outbound call (`answered_by` = `human` or `unknown`, `scheduler_idempotency_key` starts with `schedule:`) |
| **Reset behavior** | Resetting consecutive missed calls also clears `missed_alert_sent_at` |
| **Missed counter increment trigger** | Call session end only (not Twilio initiation failures) |
| **Missed-call alerts** | Send once per streak when counter hits threshold; track `missed_alert_sent_at` to suppress repeats until reset |
| **Baseline window for trends** | Use the 14-day window immediately preceding the current week (no overlap) for engagement/mood; social-need uses a 5-week lookback (2-week baseline + 3-week streak) |
| **Baseline `answer_rate` denominator** | Only `scheduler_idempotency_key` values starting with `schedule:` (exclude `reminder:`) |
| **Baseline `answer_rate` calculation** | Actual sessions only: `answered / total` sessions with `schedule:*` key |
| **Missed calls increased (weekly summary)** | Flag when current week answer_rate (scheduled calls only) is ≥20 percentage points below baseline AND missed scheduled calls ≥2 |

### Weekly Summary & Notifications

| Decision | Details |
|----------|---------|
| **Pause mode behavior** | Weekly summaries still sent with "paused" note; missed-call alerts are suppressed |
| **Notification recipients** | Billing email only (account's `billing_email` field) |
| **SMS in notification prefs UI** | Hide SMS option for MVP - only show email toggle; ignore sms/both at send time |
| **Summary generation flow** | Telephony generates + encrypts + stores summary; calls Next.js API just to send email |
| **Weekly summary dedup** | Track `ultaura_lines.last_weekly_summary_at` and send at most once per line per week |
| **Delivery timing** | 60-minute window is "on time"; if missed, catch up later same day |
| **Alert recipient** | Billing email only (same as summaries) |
| **Summary API format** | Structured JSON data; Next.js renders email template |
| **Weekly summary call counts** | Use actual call sessions (schedule:*) for answered/total counts, not expected schedule occurrences |
| **`week_start_date` format** | Line's local date (user's timezone), not UTC |
| **Week range when not Sunday** | 7 days ending day before send (e.g., Wednesday send = previous Wed → this Tue) |

### Dashboard UI

| Decision | Details |
|----------|---------|
| **Date range UI** | Static "Last 30 days" label only - no picker, no interactivity |
| **Default line selection** | Prioritize active status first; only fall back to paused/disabled if no active lines exist |
| **Insights disabled UI** | Show historical data with a disabled banner; include a link to Line Settings to re-enable (do not hide) |
| **Call history mood indicator** | 8x8 dot to the right of status badge; show only for positive (`bg-success`) and low (`bg-destructive`) moods; no dot for neutral or missing insights (including <3 min); tooltip "Mood: Positive" / "Mood: Low" |

---

## Weekly Summary Structured Data Schema

When telephony calls Next.js to send a summary, it provides this JSON structure:

```typescript
interface WeeklySummaryData {
  // Identifiers
  lineId: string;
  lineName: string;
  accountId: string;
  billingEmail: string;
  weekStartDate: string; // YYYY-MM-DD in line's timezone
  weekEndDate: string;
  timezone: string;

  // Call activity
  scheduledCalls: number; // total scheduled session attempts (schedule:*)
  answeredCalls: number; // answered scheduled sessions only
  avgDurationMinutes: number;
  durationTrend: 'up' | 'down' | 'stable' | null;
  durationTrendValue: number | null; // minutes difference

  // Engagement (null if no insights this week)
  engagementNote: string | null; // e.g., "down 2.6 points from typical"

  // Mood
  moodSummary: string | null; // e.g., "mostly positive", "mixed week"
  moodDistribution: {
    positive: number; // count
    neutral: number;
    low: number;
  } | null;

  // Topics & concerns
  topTopics: Array<{
    code: string;
    label: string;
    weight: number;
  }>; // up to 5, with private topics filtered out

  concerns: Array<{
    code: string;
    label: string;
    severity: 'mild' | 'moderate' | 'significant';
    novelty: 'new' | 'recurring' | 'resolved';
  }>;

  // Flags
  needsFollowUp: boolean;
  followUpReasons: string[]; // deduped union across the week (human-readable labels)
  isPaused: boolean;
  pausedNote: string | null;

  // Links
  dashboardUrl: string;
  settingsUrl: string;
}
```

---

## Answered Detection Logic

```typescript
function isCallAnswered(session: CallSession): boolean {
  // Human confirmed by AMD
  if (session.answered_by === 'human') return true;
  // AMD uncertain but optimistic
  if (session.answered_by === 'unknown') return true;
  // AMD disabled but call connected
  if (session.answered_by === null && session.seconds_connected > 0) return true;
  // All other cases (machine, fax, no answer)
  return false;
}

function shouldResetMissedCounter(session: CallSession): boolean {
  return (
    isCallAnswered(session) &&
    session.direction === 'outbound' &&
    session.scheduler_idempotency_key?.startsWith('schedule:')
  );
}

function shouldUpdateLastAnsweredCallAt(session: CallSession): boolean {
  // Any answered call updates this (inbound, reminder, scheduled)
  return isCallAnswered(session);
}

function shouldSendMissedAlert(line: LineRow, newCount: number, threshold: number): boolean {
  return newCount >= threshold && !line.missed_alert_sent_at;
}
```

---

## Lazy Notification Preferences Pattern

```typescript
async function getNotificationPreferences(
  accountId: string,
  lineId: string
): Promise<NotificationPreferences> {
  const supabase = getSupabaseClient();

  const { data: linePrefs } = await supabase
    .from('ultaura_notification_preferences')
    .select('*')
    .eq('account_id', accountId)
    .eq('line_id', lineId)
    .single();

  if (linePrefs) return linePrefs;

  // Create line-specific defaults if missing
  const { data: newLinePrefs } = await supabase
    .from('ultaura_notification_preferences')
    .insert({
      account_id: accountId,
      line_id: lineId,
      weekly_summary_enabled: true,
      weekly_summary_format: 'email',
      weekly_summary_day: 'sunday',
      weekly_summary_time: '18:00',
      alert_missed_calls_enabled: true,
      alert_missed_calls_threshold: 3,
    })
    .select()
    .single();

  return newLinePrefs;
}
```

---

## Encryption AAD Structure

```typescript
// For call insights
function buildInsightsAAD(
  accountId: string,
  lineId: string,
  callSessionId: string
): Buffer {
  return Buffer.from(JSON.stringify({
    account_id: accountId,
    line_id: lineId,
    call_session_id: callSessionId,
    type: 'call_insight'
  }), 'utf8');
}

// For weekly summaries
function buildSummaryAAD(
  accountId: string,
  lineId: string,
  weekStartDate: string
): Buffer {
  return Buffer.from(JSON.stringify({
    account_id: accountId,
    line_id: lineId,
    week_start: weekStartDate,
    type: 'weekly_summary'
  }), 'utf8');
}
```
