-- Recurring Reminders Migration
-- Adds support for recurring reminders with custom intervals and skip functionality

-- Add recurrence columns to ultaura_reminders
ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rrule text,
  ADD COLUMN IF NOT EXISTS interval_days int,
  ADD COLUMN IF NOT EXISTS days_of_week int[],
  ADD COLUMN IF NOT EXISTS day_of_month int,
  ADD COLUMN IF NOT EXISTS time_of_day time,
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS occurrence_count int NOT NULL DEFAULT 0;

-- Index for efficient scheduler queries on recurring reminders
CREATE INDEX IF NOT EXISTS idx_ultaura_reminders_recurring
  ON ultaura_reminders(is_recurring, status, due_at)
  WHERE is_recurring = true AND status = 'scheduled';

-- Add constraint for rrule format (basic validation)
ALTER TABLE ultaura_reminders
  ADD CONSTRAINT check_rrule_format
  CHECK (rrule IS NULL OR rrule ~ '^FREQ=(DAILY|WEEKLY|MONTHLY)(;.*)?$');

-- Add constraint: recurring reminders must have time_of_day
ALTER TABLE ultaura_reminders
  ADD CONSTRAINT check_recurring_time
  CHECK (NOT is_recurring OR time_of_day IS NOT NULL);

-- Comments for documentation
COMMENT ON COLUMN ultaura_reminders.is_recurring IS 'Whether this reminder repeats';
COMMENT ON COLUMN ultaura_reminders.rrule IS 'RFC 5545 recurrence rule (e.g., FREQ=WEEKLY;BYDAY=MO,WE,FR)';
COMMENT ON COLUMN ultaura_reminders.interval_days IS 'Custom interval in days (e.g., 3 for every 3 days)';
COMMENT ON COLUMN ultaura_reminders.days_of_week IS 'Days of week [0-6] for weekly patterns (0=Sunday)';
COMMENT ON COLUMN ultaura_reminders.day_of_month IS 'Day of month (1-31) for monthly patterns';
COMMENT ON COLUMN ultaura_reminders.time_of_day IS 'Original time in local timezone (HH:MM format)';
COMMENT ON COLUMN ultaura_reminders.ends_at IS 'Optional end date for recurring series (UTC)';
COMMENT ON COLUMN ultaura_reminders.occurrence_count IS 'Number of times this reminder has been delivered';
