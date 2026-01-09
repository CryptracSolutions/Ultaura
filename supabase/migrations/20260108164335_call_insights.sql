-- Call insights core schema (Part 1)

-- ============================================
-- CALL INSIGHTS (Encrypted at rest)
-- ============================================

CREATE TABLE IF NOT EXISTS ultaura_call_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Encrypted insights JSON
  insights_ciphertext bytea NOT NULL,
  insights_iv bytea NOT NULL,
  insights_tag bytea NOT NULL,
  insights_alg text NOT NULL DEFAULT 'aes-256-gcm',
  insights_kid text NOT NULL DEFAULT 'kek_v1',

  -- Non-encrypted metadata for queries
  extraction_method text NOT NULL CHECK (extraction_method IN ('tool_call', 'post_call_fallback')),
  duration_seconds integer,
  has_concerns boolean NOT NULL DEFAULT false,
  needs_follow_up boolean NOT NULL DEFAULT false,
  has_baseline boolean NOT NULL DEFAULT false,

  UNIQUE(call_session_id)
);

CREATE INDEX IF NOT EXISTS idx_insights_line_created
  ON ultaura_call_insights(line_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_account_created
  ON ultaura_call_insights(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_concerns
  ON ultaura_call_insights(line_id, has_concerns)
  WHERE has_concerns = true;
CREATE INDEX IF NOT EXISTS idx_insights_followup
  ON ultaura_call_insights(line_id, needs_follow_up)
  WHERE needs_follow_up = true;

ALTER TABLE ultaura_call_insights ENABLE ROW LEVEL SECURITY;

-- No RLS policies: service role only (encrypted data)

-- ============================================
-- LINE BASELINES (Derived, non-encrypted)
-- ============================================

CREATE TABLE IF NOT EXISTS ultaura_line_baselines (
  line_id uuid PRIMARY KEY REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Rolling 14-day averages
  avg_engagement decimal(4,2),
  avg_duration_seconds integer,
  calls_per_week decimal(4,2),
  answer_rate decimal(4,3),

  -- Mood distribution (fractions 0-1 over 14 days)
  mood_distribution jsonb NOT NULL DEFAULT '{"positive": 0, "neutral": 0, "low": 0}',

  -- For novelty detection
  recent_concern_codes text[] NOT NULL DEFAULT '{}',

  -- Call count for baseline validity
  baseline_call_count integer NOT NULL DEFAULT 0
);

ALTER TABLE ultaura_line_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view line baselines for their accounts"
  ON ultaura_line_baselines FOR SELECT
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE POLICY "Users can update line baselines for their accounts"
  ON ultaura_line_baselines FOR UPDATE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE POLICY "Users can insert line baselines for their accounts"
  ON ultaura_line_baselines FOR INSERT
  WITH CHECK (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

CREATE POLICY "Users can delete line baselines for their accounts"
  ON ultaura_line_baselines FOR DELETE
  USING (line_id IN (
    SELECT id FROM ultaura_lines WHERE can_access_ultaura_account(account_id)
  ));

-- ============================================
-- INSIGHT PRIVACY (Per-line controls)
-- ============================================

CREATE TABLE IF NOT EXISTS ultaura_insight_privacy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Master toggle for insights
  insights_enabled boolean NOT NULL DEFAULT true,

  -- Topics marked as private in settings
  private_topic_codes text[] NOT NULL DEFAULT '{}',

  -- Pause mode
  is_paused boolean NOT NULL DEFAULT false,
  paused_at timestamptz,
  paused_reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insight_privacy_line
  ON ultaura_insight_privacy(line_id);

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

DROP TRIGGER IF EXISTS trg_create_insight_privacy ON ultaura_lines;
CREATE TRIGGER trg_create_insight_privacy
AFTER INSERT ON ultaura_lines
FOR EACH ROW EXECUTE FUNCTION create_insight_privacy_for_line();

-- Backfill existing lines
INSERT INTO ultaura_insight_privacy (line_id)
SELECT id FROM ultaura_lines
ON CONFLICT (line_id) DO NOTHING;

-- ============================================
-- EXTEND LINES / CALL SESSIONS
-- ============================================

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS consecutive_missed_calls integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_answered_call_at timestamptz,
  ADD COLUMN IF NOT EXISTS missed_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_weekly_summary_at timestamptz;

ALTER TABLE ultaura_call_sessions
  ADD COLUMN IF NOT EXISTS is_test_call boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_call_sessions_test
  ON ultaura_call_sessions(is_test_call)
  WHERE is_test_call = true;
