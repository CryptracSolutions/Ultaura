-- Retention mechanics: call previews, segments, story arcs

-- Call Previews
CREATE TABLE IF NOT EXISTS ultaura_call_previews (
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

CREATE INDEX IF NOT EXISTS idx_call_previews_line_pending
  ON ultaura_call_previews(line_id, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_call_previews_line_created
  ON ultaura_call_previews(line_id, created_at DESC);

ALTER TABLE ultaura_call_previews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view call previews for their accounts"
  ON ultaura_call_previews FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- Segment Engagement
CREATE TABLE IF NOT EXISTS ultaura_segment_engagement (
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

CREATE INDEX IF NOT EXISTS idx_segment_engagement_line
  ON ultaura_segment_engagement(line_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_segment_engagement_type
  ON ultaura_segment_engagement(line_id, segment_type, senior_response);

ALTER TABLE ultaura_segment_engagement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view segment engagement for their accounts"
  ON ultaura_segment_engagement FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- Story Arcs
CREATE TABLE IF NOT EXISTS ultaura_story_arcs (
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

CREATE INDEX IF NOT EXISTS idx_story_arcs_line_active
  ON ultaura_story_arcs(line_id, status) WHERE status = 'active';

ALTER TABLE ultaura_story_arcs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view story arcs for their accounts"
  ON ultaura_story_arcs FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- Extend retention cleanup to expire old call previews
CREATE OR REPLACE FUNCTION run_retention_cleanup()
RETURNS jsonb AS $$
DECLARE
  v_account record;
  v_result jsonb;
  v_total_memories int := 0;
  v_total_insights int := 0;
  v_total_queued int := 0;
  v_expired_previews int := 0;
BEGIN
  FOR v_account IN
    SELECT account_id FROM ultaura_account_privacy_settings
    WHERE retention_period != 'indefinite'
  LOOP
    v_result := cleanup_account_retention(v_account.account_id);
    v_total_memories := v_total_memories + coalesce((v_result->>'deleted_memories')::int, 0);
    v_total_insights := v_total_insights + coalesce((v_result->>'deleted_insights')::int, 0);
    v_total_queued := v_total_queued + coalesce((v_result->>'queued_recordings')::int, 0);
  END LOOP;

  UPDATE ultaura_call_previews
  SET status = 'expired'
  WHERE status = 'pending'
    AND created_at < now() - interval '7 days';

  GET DIAGNOSTICS v_expired_previews = row_count;

  RETURN jsonb_build_object(
    'total_deleted_memories', v_total_memories,
    'total_deleted_insights', v_total_insights,
    'total_recordings_queued', v_total_queued,
    'expired_call_previews', v_expired_previews,
    'completed_at', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
