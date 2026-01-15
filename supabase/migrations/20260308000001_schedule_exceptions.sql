-- Schedule exceptions (skip, snooze, reschedule)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ultaura_schedule_exception_type') THEN
    EXECUTE 'CREATE TYPE ultaura_schedule_exception_type AS ENUM (''skip'', ''snooze'', ''reschedule'')';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS ultaura_schedule_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES ultaura_schedules(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  exception_date date NOT NULL,
  exception_type ultaura_schedule_exception_type NOT NULL,
  new_datetime timestamptz,
  reschedule_schedule_id uuid REFERENCES ultaura_schedules(id) ON DELETE SET NULL,
  created_by text NOT NULL CHECK (created_by IN ('dashboard', 'voice')),
  call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,
  metadata jsonb,
  UNIQUE(schedule_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_schedule_date
  ON ultaura_schedule_exceptions(schedule_id, exception_date);

CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_line
  ON ultaura_schedule_exceptions(line_id, exception_date);

ALTER TABLE ultaura_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access schedule exceptions for their accounts"
  ON ultaura_schedule_exceptions FOR ALL
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Service role has full access"
  ON ultaura_schedule_exceptions FOR ALL
  USING (auth.role() = 'service_role');
