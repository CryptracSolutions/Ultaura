-- Add voicemail preference to lines
ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS voicemail_behavior text NOT NULL DEFAULT 'brief'
  CHECK (voicemail_behavior IN ('none', 'brief', 'detailed'));

COMMENT ON COLUMN ultaura_lines.voicemail_behavior IS
  'What to do when call reaches answering machine: none (hang up), brief (short message), detailed (includes call reason)';

-- Add AMD tracking to call sessions
ALTER TABLE ultaura_call_sessions
  ADD COLUMN IF NOT EXISTS answered_by text
  CHECK (answered_by IS NULL OR answered_by IN (
    'human',
    'machine_start',
    'machine_end_beep',
    'machine_end_silence',
    'machine_end_other',
    'fax',
    'unknown'
  ));

COMMENT ON COLUMN ultaura_call_sessions.answered_by IS
  'Twilio AMD result: human, machine_*, fax, unknown, or NULL if AMD disabled';

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_call_sessions_answered_by
  ON ultaura_call_sessions(answered_by)
  WHERE answered_by IS NOT NULL;
