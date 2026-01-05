-- Distributed scheduler coordination: Schedule processing claims
-- Adds columns for atomic processing claims on ultaura_schedules

-- Add processing claim columns to schedules
ALTER TABLE ultaura_schedules
  ADD COLUMN IF NOT EXISTS processing_claimed_by text,
  ADD COLUMN IF NOT EXISTS processing_claimed_at timestamptz;

-- Index for unclaimed due items (efficient scheduler query)
CREATE INDEX IF NOT EXISTS idx_schedules_unclaimed_due
  ON ultaura_schedules(next_run_at)
  WHERE enabled = true
    AND next_run_at IS NOT NULL
    AND processing_claimed_by IS NULL;

-- Index for stale claims (TTL recovery)
CREATE INDEX IF NOT EXISTS idx_schedules_stale_claims
  ON ultaura_schedules(processing_claimed_at)
  WHERE processing_claimed_by IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ultaura_schedules.processing_claimed_by IS
  'Worker instance ID that has claimed this schedule for processing';
COMMENT ON COLUMN ultaura_schedules.processing_claimed_at IS
  'Timestamp when the claim was made (used for TTL-based recovery)';
