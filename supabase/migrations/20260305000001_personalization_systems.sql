-- Personalization systems: life story, emotional intelligence, relationships, accessibility, wellness

-- ============================================
-- Extend lines with personalization context
-- ============================================
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS birth_year integer,
  ADD COLUMN IF NOT EXISTS birth_decade integer GENERATED ALWAYS AS ((birth_year / 10) * 10) STORED,
  ADD COLUMN IF NOT EXISTS formative_decade integer,
  ADD COLUMN IF NOT EXISTS hometown text,
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS optimal_call_time time,
  ADD COLUMN IF NOT EXISTS optimal_call_time_source text CHECK (optimal_call_time_source IN ('family_set', 'ai_learned', 'senior_request')),
  ADD COLUMN IF NOT EXISTS optimal_call_days integer[],
  ADD COLUMN IF NOT EXISTS interruption_tolerance text DEFAULT 'normal' CHECK (interruption_tolerance IN ('high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS filler_word_patience text DEFAULT 'normal' CHECK (filler_word_patience IN ('high', 'normal', 'low')),
  ADD COLUMN IF NOT EXISTS silence_tolerance_ms integer DEFAULT 2000,
  ADD COLUMN IF NOT EXISTS crosstalk_recovery_mode text DEFAULT 'patient' CHECK (crosstalk_recovery_mode IN ('immediate', 'patient', 'very_patient'));

-- ============================================
-- Extend story arcs for personalization
-- ============================================
ALTER TABLE ultaura_story_arcs
  ADD COLUMN IF NOT EXISTS personalization_context jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS era_setting text,
  ADD COLUMN IF NOT EXISTS themes text[],
  ADD COLUMN IF NOT EXISTS engagement_score decimal(3,2);

-- ============================================
-- Extend memories for call association
-- ============================================
ALTER TABLE ultaura_memories
  ADD COLUMN IF NOT EXISTS created_in_call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_memories_call_session
  ON ultaura_memories (created_in_call_session_id)
  WHERE created_in_call_session_id IS NOT NULL;

-- ============================================
-- Life chapters (encrypted narrative, line DEK)
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_life_chapters (
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

CREATE INDEX IF NOT EXISTS idx_life_chapters_line
  ON ultaura_life_chapters(line_id);
CREATE INDEX IF NOT EXISTS idx_life_chapters_type
  ON ultaura_life_chapters(line_id, chapter_type);

ALTER TABLE ultaura_life_chapters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view life chapters for their accounts"
  ON ultaura_life_chapters FOR SELECT
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can insert life chapters for their accounts"
  ON ultaura_life_chapters FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));
CREATE POLICY "Users can update life chapters for their accounts"
  ON ultaura_life_chapters FOR UPDATE
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can delete life chapters for their accounts"
  ON ultaura_life_chapters FOR DELETE
  USING (can_access_ultaura_account(account_id));

-- ============================================
-- Mood snapshots + emotional patterns
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_mood_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

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

CREATE INDEX IF NOT EXISTS idx_mood_snapshots_line
  ON ultaura_mood_snapshots(line_id, created_at DESC);

ALTER TABLE ultaura_mood_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view mood snapshots for their accounts"
  ON ultaura_mood_snapshots FOR SELECT
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can insert mood snapshots for their accounts"
  ON ultaura_mood_snapshots FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));
CREATE POLICY "Users can update mood snapshots for their accounts"
  ON ultaura_mood_snapshots FOR UPDATE
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can delete mood snapshots for their accounts"
  ON ultaura_mood_snapshots FOR DELETE
  USING (can_access_ultaura_account(account_id));

CREATE TABLE IF NOT EXISTS ultaura_emotional_patterns (
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

ALTER TABLE ultaura_emotional_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view emotional patterns for their accounts"
  ON ultaura_emotional_patterns FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert emotional patterns for their accounts"
  ON ultaura_emotional_patterns FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update emotional patterns for their accounts"
  ON ultaura_emotional_patterns FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete emotional patterns for their accounts"
  ON ultaura_emotional_patterns FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- Content preferences
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_content_preferences (
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

ALTER TABLE ultaura_content_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view content preferences for their accounts"
  ON ultaura_content_preferences FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert content preferences for their accounts"
  ON ultaura_content_preferences FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update content preferences for their accounts"
  ON ultaura_content_preferences FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete content preferences for their accounts"
  ON ultaura_content_preferences FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- Relationships
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  name text NOT NULL,
  nickname text,
  relation_type text NOT NULL,
  relation_role text NOT NULL,

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

  is_deceased boolean DEFAULT false,
  passed_at timestamptz,
  death_mentioned_at timestamptz,
  grief_sensitivity text CHECK (grief_sensitivity IN ('high', 'medium', 'low')),

  privacy_scope text DEFAULT 'line_only' CHECK (privacy_scope IN ('line_only', 'shareable_with_payer'))
);

CREATE INDEX IF NOT EXISTS idx_relationships_line
  ON ultaura_relationships(line_id);
CREATE INDEX IF NOT EXISTS idx_relationships_deceased
  ON ultaura_relationships(line_id, is_deceased)
  WHERE is_deceased = true;

ALTER TABLE ultaura_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view relationships for their accounts"
  ON ultaura_relationships FOR SELECT
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can insert relationships for their accounts"
  ON ultaura_relationships FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));
CREATE POLICY "Users can update relationships for their accounts"
  ON ultaura_relationships FOR UPDATE
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can delete relationships for their accounts"
  ON ultaura_relationships FOR DELETE
  USING (can_access_ultaura_account(account_id));

-- ============================================
-- Accessibility + cognitive support
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_accessibility_settings (
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

ALTER TABLE ultaura_accessibility_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view accessibility settings for their accounts"
  ON ultaura_accessibility_settings FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert accessibility settings for their accounts"
  ON ultaura_accessibility_settings FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update accessibility settings for their accounts"
  ON ultaura_accessibility_settings FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete accessibility settings for their accounts"
  ON ultaura_accessibility_settings FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE TABLE IF NOT EXISTS ultaura_cognitive_observations (
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

CREATE INDEX IF NOT EXISTS idx_cognitive_observations_line
  ON ultaura_cognitive_observations(line_id, created_at DESC);

ALTER TABLE ultaura_cognitive_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view cognitive observations for their accounts"
  ON ultaura_cognitive_observations FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert cognitive observations for their accounts"
  ON ultaura_cognitive_observations FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update cognitive observations for their accounts"
  ON ultaura_cognitive_observations FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete cognitive observations for their accounts"
  ON ultaura_cognitive_observations FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE TABLE IF NOT EXISTS ultaura_cognitive_flags (
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

ALTER TABLE ultaura_cognitive_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view cognitive flags for their accounts"
  ON ultaura_cognitive_flags FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert cognitive flags for their accounts"
  ON ultaura_cognitive_flags FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update cognitive flags for their accounts"
  ON ultaura_cognitive_flags FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete cognitive flags for their accounts"
  ON ultaura_cognitive_flags FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- Persona adaptations
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_persona_adaptations (
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

ALTER TABLE ultaura_persona_adaptations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view persona adaptations for their accounts"
  ON ultaura_persona_adaptations FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert persona adaptations for their accounts"
  ON ultaura_persona_adaptations FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update persona adaptations for their accounts"
  ON ultaura_persona_adaptations FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete persona adaptations for their accounts"
  ON ultaura_persona_adaptations FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- Milestones + grief interactions
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_milestones (
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

CREATE INDEX IF NOT EXISTS idx_milestones_upcoming
  ON ultaura_milestones(date_month, date_day);

ALTER TABLE ultaura_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view milestones for their accounts"
  ON ultaura_milestones FOR SELECT
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can insert milestones for their accounts"
  ON ultaura_milestones FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));
CREATE POLICY "Users can update milestones for their accounts"
  ON ultaura_milestones FOR UPDATE
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can delete milestones for their accounts"
  ON ultaura_milestones FOR DELETE
  USING (can_access_ultaura_account(account_id));

CREATE TABLE IF NOT EXISTS ultaura_grief_interactions (
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

ALTER TABLE ultaura_grief_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view grief interactions for their accounts"
  ON ultaura_grief_interactions FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert grief interactions for their accounts"
  ON ultaura_grief_interactions FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update grief interactions for their accounts"
  ON ultaura_grief_interactions FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete grief interactions for their accounts"
  ON ultaura_grief_interactions FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- Daily rhythms
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_daily_rhythms (
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

ALTER TABLE ultaura_daily_rhythms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view daily rhythms for their accounts"
  ON ultaura_daily_rhythms FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can insert daily rhythms for their accounts"
  ON ultaura_daily_rhythms FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can update daily rhythms for their accounts"
  ON ultaura_daily_rhythms FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));
CREATE POLICY "Users can delete daily rhythms for their accounts"
  ON ultaura_daily_rhythms FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- Health mentions (encrypted, account DEK) - service role only
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_health_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

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

CREATE INDEX IF NOT EXISTS idx_health_mentions_alert
  ON ultaura_health_mentions(triggers_alert)
  WHERE triggers_alert = true;

ALTER TABLE ultaura_health_mentions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Wellness alerts
-- ============================================
CREATE TABLE IF NOT EXISTS ultaura_wellness_alerts (
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

ALTER TABLE ultaura_wellness_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view wellness alerts for their accounts"
  ON ultaura_wellness_alerts FOR SELECT
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can insert wellness alerts for their accounts"
  ON ultaura_wellness_alerts FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));
CREATE POLICY "Users can update wellness alerts for their accounts"
  ON ultaura_wellness_alerts FOR UPDATE
  USING (can_access_ultaura_account(account_id));
CREATE POLICY "Users can delete wellness alerts for their accounts"
  ON ultaura_wellness_alerts FOR DELETE
  USING (can_access_ultaura_account(account_id));

ALTER TABLE ultaura_notification_preferences
  ADD COLUMN IF NOT EXISTS health_mention_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS mood_drop_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS cognitive_concern_alerts boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS alert_delivery_method text DEFAULT 'email';

-- ============================================
-- Update memory upsert function to store call association
-- ============================================
CREATE OR REPLACE FUNCTION upsert_ultaura_memory(
  p_account_id uuid,
  p_line_id uuid,
  p_type ultaura_memory_type,
  p_key text,
  p_value_ciphertext bytea,
  p_value_iv bytea,
  p_value_tag bytea,
  p_value_alg text,
  p_value_kid text,
  p_confidence numeric,
  p_source text,
  p_privacy_scope ultaura_privacy_scope,
  p_redaction_level text,
  p_memory_id uuid,
  p_created_in_call_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
  memory_id uuid,
  action text,
  version int
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing ultaura_memories%rowtype;
  v_new_version int := 1;
  v_action text := 'created';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_line_id::text || ':' || lower(p_key)));

  SELECT * INTO v_existing
  FROM ultaura_memories
  WHERE line_id = p_line_id
    AND account_id = p_account_id
    AND lower(key) = lower(p_key)
    AND active = true
  FOR UPDATE;

  IF FOUND THEN
    UPDATE ultaura_memories
      SET active = false,
          updated_at = now()
    WHERE id = v_existing.id;

    v_new_version := v_existing.version + 1;
    v_action := 'updated';
  END IF;

  INSERT INTO ultaura_memories (
    id,
    account_id,
    line_id,
    type,
    key,
    value_ciphertext,
    value_iv,
    value_tag,
    value_alg,
    value_kid,
    confidence,
    source,
    version,
    active,
    privacy_scope,
    redaction_level,
    updated_at,
    created_in_call_session_id
  ) VALUES (
    p_memory_id,
    p_account_id,
    p_line_id,
    p_type,
    p_key,
    p_value_ciphertext,
    p_value_iv,
    p_value_tag,
    p_value_alg,
    p_value_kid,
    p_confidence,
    p_source,
    v_new_version,
    true,
    p_privacy_scope,
    p_redaction_level,
    now(),
    p_created_in_call_session_id
  );

  memory_id := p_memory_id;
  action := v_action;
  version := v_new_version;
  RETURN NEXT;
END;
$$;
