-- Add retry_count column for tracking call retry attempts
-- This column tracks how many times the scheduler has retried a call
-- within the current retry window

ALTER TABLE ultaura_schedules
ADD COLUMN retry_count int NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN ultaura_schedules.retry_count IS 'Number of retry attempts for the current scheduling window. Reset to 0 after successful call or retry window expires.';

-- Add index for efficient querying of schedules that need retry processing
CREATE INDEX idx_ultaura_schedules_retry ON ultaura_schedules(line_id, retry_count)
WHERE enabled = true;
