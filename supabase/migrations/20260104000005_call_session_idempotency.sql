-- Distributed scheduler coordination: Call session idempotency
-- Adds idempotency key to prevent duplicate scheduler-initiated calls

-- Add idempotency key column for scheduler-initiated calls
ALTER TABLE ultaura_call_sessions
  ADD COLUMN IF NOT EXISTS scheduler_idempotency_key text;

-- Unique index to prevent duplicates (allows NULL for non-scheduled calls)
-- Format: schedule:{scheduleId}:{next_run_at} or reminder:{reminderId}:{due_at}
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_sessions_scheduler_idempotency
  ON ultaura_call_sessions(scheduler_idempotency_key)
  WHERE scheduler_idempotency_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN ultaura_call_sessions.scheduler_idempotency_key IS
  'Unique key for scheduler-initiated calls to prevent duplicates. Format: schedule:{id}:{timestamp} or reminder:{id}:{timestamp}';
