-- Spoken disclaimers + consent system updates

-- Recording consent columns
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS recording_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS recording_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_consent_call_session_id UUID REFERENCES ultaura_call_sessions(id),
  ADD COLUMN IF NOT EXISTS recording_preference_permanent BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recording_reenable_requested_at TIMESTAMPTZ;

-- Sharing consent columns
ALTER TABLE ultaura_line_voice_consent
  ADD COLUMN IF NOT EXISTS sharing_consent ultaura_voice_consent_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sharing_tier TEXT NOT NULL DEFAULT 'tier_1'
    CHECK (sharing_tier IN ('tier_1', 'tier_2', 'tier_3', 'tier_4')),
  ADD COLUMN IF NOT EXISTS sharing_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sharing_consent_call_session_id UUID REFERENCES ultaura_call_sessions(id),
  ADD COLUMN IF NOT EXISTS sharing_last_prompt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sharing_reprompt_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Call session preview flag
ALTER TABLE ultaura_call_sessions
  ADD COLUMN IF NOT EXISTS is_preview_mode BOOLEAN NOT NULL DEFAULT FALSE;

-- Audit action enum extensions
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'recording_consent_updated';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'sharing_consent_updated';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'sharing_enabled_by_self_user';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'onboarding_completed';
ALTER TYPE ultaura_consent_audit_action ADD VALUE IF NOT EXISTS 'consent_incomplete_retry';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_line_voice_consent_recording
  ON ultaura_line_voice_consent(recording_consent)
  WHERE recording_consent != 'pending';

CREATE INDEX IF NOT EXISTS idx_line_voice_consent_sharing
  ON ultaura_line_voice_consent(sharing_consent)
  WHERE sharing_consent != 'pending';

CREATE INDEX IF NOT EXISTS idx_line_voice_consent_onboarding
  ON ultaura_line_voice_consent(onboarding_completed_at)
  WHERE onboarding_completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_voice_consent_sharing_prompt
  ON ultaura_line_voice_consent(sharing_last_prompt_at)
  WHERE sharing_last_prompt_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_voice_consent_sharing_reprompt
  ON ultaura_line_voice_consent(sharing_reprompt_requested_at)
  WHERE sharing_reprompt_requested_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_line_voice_consent_recording_reenable
  ON ultaura_line_voice_consent(recording_reenable_requested_at)
  WHERE recording_reenable_requested_at IS NOT NULL;

-- Comments
COMMENT ON COLUMN ultaura_line_voice_consent.recording_consent IS 'Recording consent status: pending (not asked), granted (yes), denied (no)';
COMMENT ON COLUMN ultaura_line_voice_consent.recording_preference_permanent IS 'If true, denied means never ask again; if false, ask each call';
COMMENT ON COLUMN ultaura_line_voice_consent.recording_reenable_requested_at IS 'Timestamp when payer requested recording re-enable prompt';
COMMENT ON COLUMN ultaura_line_voice_consent.sharing_tier IS 'Family sharing tier: tier_1 (basic), tier_2 (wellness), tier_3 (full), tier_4 (complete)';
COMMENT ON COLUMN ultaura_line_voice_consent.sharing_last_prompt_at IS 'Timestamp when sharing consent was last prompted';
COMMENT ON COLUMN ultaura_line_voice_consent.sharing_reprompt_requested_at IS 'Timestamp when payer requested a sharing preference re-prompt';
COMMENT ON COLUMN ultaura_line_voice_consent.onboarding_completed_at IS 'Timestamp when first call onboarding was completed';
COMMENT ON COLUMN ultaura_call_sessions.is_preview_mode IS 'True for test calls requesting the full onboarding disclosure flow';
