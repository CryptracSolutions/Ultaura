-- Migration: Enhanced Reminder Management
-- Adds pause, snooze, edit tracking, delivery status, and caregiver visibility features

-- ============================================================================
-- 1. Add new columns to ultaura_reminders
-- ============================================================================

-- Pause functionality
ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;

ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS paused_at timestamptz;

-- Snooze functionality
ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS original_due_at timestamptz;

ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS current_snooze_count integer NOT NULL DEFAULT 0;

-- Delivery status tracking
ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS last_delivery_status text;

-- Add constraint for delivery status values
ALTER TABLE ultaura_reminders
  ADD CONSTRAINT chk_last_delivery_status
  CHECK (last_delivery_status IS NULL OR last_delivery_status IN ('completed', 'no_answer', 'failed'));

-- Index for paused reminders (scheduler optimization)
CREATE INDEX IF NOT EXISTS idx_ultaura_reminders_paused
  ON ultaura_reminders(is_paused)
  WHERE is_paused = true;

-- Index for snoozed reminders
CREATE INDEX IF NOT EXISTS idx_ultaura_reminders_snoozed
  ON ultaura_reminders(snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- ============================================================================
-- 2. Add voice control toggle to ultaura_lines
-- ============================================================================

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS allow_voice_reminder_control boolean NOT NULL DEFAULT true;

-- ============================================================================
-- 3. Create reminder events table (audit trail for caregivers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ultaura_reminder_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL REFERENCES ultaura_reminders(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  triggered_by text NOT NULL,
  call_session_id uuid REFERENCES ultaura_call_sessions(id) ON DELETE SET NULL,
  metadata jsonb,

  -- Constraints
  CONSTRAINT chk_event_type CHECK (event_type IN (
    'created', 'edited', 'paused', 'resumed', 'snoozed',
    'skipped', 'canceled', 'delivered', 'no_answer', 'failed'
  )),
  CONSTRAINT chk_triggered_by CHECK (triggered_by IN ('dashboard', 'voice', 'system'))
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_reminder_events_reminder
  ON ultaura_reminder_events(reminder_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_events_account
  ON ultaura_reminder_events(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_events_line
  ON ultaura_reminder_events(line_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reminder_events_type
  ON ultaura_reminder_events(event_type, created_at DESC);

-- ============================================================================
-- 4. Enable RLS on reminder events table
-- ============================================================================

ALTER TABLE ultaura_reminder_events ENABLE ROW LEVEL SECURITY;

-- Users can view reminder events for accounts they have access to
CREATE POLICY "Users can view reminder events for their accounts"
  ON ultaura_reminder_events FOR SELECT
  USING (can_access_ultaura_account(account_id));

-- Users can insert reminder events for accounts they have access to
CREATE POLICY "Users can insert reminder events for their accounts"
  ON ultaura_reminder_events FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));

-- Service role can do everything (for telephony backend)
CREATE POLICY "Service role has full access to reminder events"
  ON ultaura_reminder_events FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 5. Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN ultaura_reminders.is_paused IS 'When true, reminder is paused and will not fire until resumed';
COMMENT ON COLUMN ultaura_reminders.paused_at IS 'Timestamp when the reminder was paused';
COMMENT ON COLUMN ultaura_reminders.snoozed_until IS 'If set, reminder is snoozed until this time';
COMMENT ON COLUMN ultaura_reminders.original_due_at IS 'Original due_at before snoozing (for reference)';
COMMENT ON COLUMN ultaura_reminders.current_snooze_count IS 'Number of times snoozed for current occurrence (max 3)';
COMMENT ON COLUMN ultaura_reminders.last_delivery_status IS 'Status of the last delivery attempt: completed, no_answer, or failed';

COMMENT ON COLUMN ultaura_lines.allow_voice_reminder_control IS 'When false, seniors cannot create/edit/pause reminders via phone calls';

COMMENT ON TABLE ultaura_reminder_events IS 'Audit trail of reminder actions for caregiver visibility';
COMMENT ON COLUMN ultaura_reminder_events.event_type IS 'Type of event: created, edited, paused, resumed, snoozed, skipped, canceled, delivered, no_answer, failed';
COMMENT ON COLUMN ultaura_reminder_events.triggered_by IS 'Who triggered the event: dashboard, voice (phone), or system';
COMMENT ON COLUMN ultaura_reminder_events.metadata IS 'Additional context (e.g., snooze_minutes, old/new values for edits)';
