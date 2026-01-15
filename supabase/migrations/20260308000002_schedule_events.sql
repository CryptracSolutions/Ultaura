-- Schedule events (audit trail)

CREATE TABLE IF NOT EXISTS ultaura_schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES ultaura_schedules(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  triggered_by text NOT NULL,
  call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,
  metadata jsonb,
  CONSTRAINT chk_schedule_event_type CHECK (event_type IN (
    'created', 'edited', 'enabled', 'disabled',
    'exception_added', 'exception_removed',
    'vacation_started', 'vacation_ended'
  )),
  CONSTRAINT chk_schedule_triggered_by CHECK (triggered_by IN ('dashboard', 'voice', 'system'))
);

CREATE INDEX IF NOT EXISTS idx_schedule_events_schedule
  ON ultaura_schedule_events(schedule_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_events_line
  ON ultaura_schedule_events(line_id, created_at DESC);

ALTER TABLE ultaura_schedule_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schedule events for their accounts"
  ON ultaura_schedule_events FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Service role has full access"
  ON ultaura_schedule_events FOR ALL
  USING (auth.role() = 'service_role');
