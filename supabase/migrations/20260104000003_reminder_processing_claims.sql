-- Distributed scheduler coordination: Reminder processing claims
-- Adds columns for atomic processing claims on ultaura_reminders

-- Add processing claim columns to reminders
ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS processing_claimed_by text,
  ADD COLUMN IF NOT EXISTS processing_claimed_at timestamptz;

-- Index for unclaimed due items (efficient scheduler query)
CREATE INDEX IF NOT EXISTS idx_reminders_unclaimed_due
  ON ultaura_reminders(due_at)
  WHERE status = 'scheduled'
    AND is_paused = false
    AND processing_claimed_by IS NULL;

-- Index for stale claims (TTL recovery)
CREATE INDEX IF NOT EXISTS idx_reminders_stale_claims
  ON ultaura_reminders(processing_claimed_at)
  WHERE processing_claimed_by IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ultaura_reminders.processing_claimed_by IS
  'Worker instance ID that has claimed this reminder for processing';
COMMENT ON COLUMN ultaura_reminders.processing_claimed_at IS
  'Timestamp when the claim was made (used for TTL-based recovery)';
