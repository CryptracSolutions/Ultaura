-- Add recording SID tracking for call sessions
ALTER TABLE ultaura_call_sessions
  ADD COLUMN IF NOT EXISTS recording_sid text;

COMMENT ON COLUMN ultaura_call_sessions.recording_sid IS
  'Twilio recording SID for the call, if recording enabled';

CREATE INDEX IF NOT EXISTS idx_call_sessions_recording_sid
  ON ultaura_call_sessions(recording_sid)
  WHERE recording_sid IS NOT NULL;
