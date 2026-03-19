-- Session handoff tracking for 30-minute Grok voice API limit
CREATE TABLE IF NOT EXISTS ultaura_session_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id uuid NOT NULL REFERENCES ultaura_call_sessions(id) ON DELETE CASCADE,
  handoff_number integer NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'failed', 'retried')),
  duration_ms integer,
  summary_source text CHECK (summary_source IN ('ai', 'fallback')),
  summary_length integer,
  prewarm_duration_ms integer,
  error_message text CHECK (length(error_message) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ultaura_session_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to session handoffs"
  ON ultaura_session_handoffs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Super admins can read session handoffs" ON ultaura_session_handoffs;
CREATE POLICY "Super admins can read session handoffs"
  ON ultaura_session_handoffs FOR SELECT TO authenticated
  USING (
    (select auth.jwt()) -> 'app_metadata' ->> 'role' = 'super-admin'
  );

CREATE INDEX IF NOT EXISTS idx_session_handoffs_call_session_id
  ON ultaura_session_handoffs (call_session_id);

CREATE INDEX IF NOT EXISTS idx_session_handoffs_created_at
  ON ultaura_session_handoffs (created_at);
