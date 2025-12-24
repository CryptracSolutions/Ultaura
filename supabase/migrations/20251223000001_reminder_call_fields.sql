-- Add reminder call fields to call_sessions
-- These fields track when a call is specifically for delivering a reminder

ALTER TABLE ultaura_call_sessions
ADD COLUMN is_reminder_call boolean NOT NULL DEFAULT false,
ADD COLUMN reminder_id uuid REFERENCES ultaura_reminders(id) ON DELETE SET NULL,
ADD COLUMN reminder_message text;

-- Index for looking up reminder-related calls
CREATE INDEX idx_ultaura_call_sessions_reminder ON ultaura_call_sessions(reminder_id) WHERE reminder_id IS NOT NULL;

COMMENT ON COLUMN ultaura_call_sessions.is_reminder_call IS 'True if this call is specifically for delivering a reminder';
COMMENT ON COLUMN ultaura_call_sessions.reminder_id IS 'Reference to the reminder being delivered';
COMMENT ON COLUMN ultaura_call_sessions.reminder_message IS 'The reminder message to deliver (denormalized for prompt access)';
