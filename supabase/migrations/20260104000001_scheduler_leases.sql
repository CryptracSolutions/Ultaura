-- Distributed scheduler coordination: Lease table
-- Ensures only one telephony instance processes schedules/reminders at a time

-- Worker lease table for distributed scheduler coordination
CREATE TABLE IF NOT EXISTS ultaura_scheduler_leases (
  id text PRIMARY KEY,              -- 'schedules' or 'reminders'
  held_by text,                     -- Worker instance ID (e.g., hostname-uuid)
  acquired_at timestamptz,          -- When lease was first acquired
  expires_at timestamptz,           -- When lease expires if not renewed
  heartbeat_at timestamptz,         -- Last heartbeat timestamp
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Insert the two lease records (one for schedules, one for reminders)
INSERT INTO ultaura_scheduler_leases (id) VALUES ('schedules'), ('reminders')
ON CONFLICT (id) DO NOTHING;

-- Index for expiration queries
CREATE INDEX IF NOT EXISTS idx_scheduler_leases_expires
  ON ultaura_scheduler_leases(expires_at)
  WHERE held_by IS NOT NULL;

-- Enable RLS but only allow service role access
ALTER TABLE ultaura_scheduler_leases ENABLE ROW LEVEL SECURITY;

-- Service role has full access to scheduler leases
CREATE POLICY "Service role full access to scheduler leases"
  ON ultaura_scheduler_leases FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE ultaura_scheduler_leases IS
  'Distributed locking for scheduler coordination. Prevents multiple telephony instances from processing schedules/reminders simultaneously.';
