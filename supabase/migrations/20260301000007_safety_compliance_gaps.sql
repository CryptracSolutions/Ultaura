-- ============================================
-- Safety Categories and Confidence (Gaps 4 & 5)
-- ============================================

-- Create safety category enum
CREATE TYPE ultaura_safety_category AS ENUM (
  'SUICIDAL_IDEATION',
  'SELF_HARM',
  'HOPELESSNESS',
  'ISOLATION_DISTRESS',
  'PHYSICAL_DANGER',
  'MEDICAL_EMERGENCY',
  'ABUSE_CONCERN',
  'COGNITIVE_DECLINE',
  'GENERAL_CONCERN'
);

-- Add category column to safety_events (nullable for backward compatibility)
ALTER TABLE ultaura_safety_events
ADD COLUMN category ultaura_safety_category;

-- Add confidence column to safety_events
ALTER TABLE ultaura_safety_events
ADD COLUMN confidence numeric(3,2) CHECK (confidence >= 0 AND confidence <= 1);

-- Index for category filtering
CREATE INDEX idx_ultaura_safety_events_category
ON ultaura_safety_events(category, created_at DESC);

COMMENT ON COLUMN ultaura_safety_events.category IS 'Clinical taxonomy category for the safety concern';
COMMENT ON COLUMN ultaura_safety_events.confidence IS 'Model confidence score (0.0-1.0), 1.0 for keyword backstop matches';

-- ============================================
-- SMS Opt-Out Table (Gap 6)
-- ============================================

-- Create phone-level SMS opt-out table
CREATE TABLE ultaura_sms_opt_outs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL CHECK (source IN ('sms_keyword', 'dashboard', 'api')),
  keyword text
);

-- Index for fast lookup
CREATE INDEX idx_ultaura_sms_opt_outs_phone ON ultaura_sms_opt_outs(phone_e164);

-- Enable RLS (service role only for now)
ALTER TABLE ultaura_sms_opt_outs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ultaura_sms_opt_outs IS 'Phone-level SMS opt-out tracking. Applies to all Ultaura SMS (safety alerts, etc.) except verification codes.';

-- ============================================
-- Update opt_outs source constraint (Gap 6)
-- ============================================

-- Update source constraint to include sms_keyword
ALTER TABLE ultaura_opt_outs
DROP CONSTRAINT IF EXISTS ultaura_opt_outs_source_check;

ALTER TABLE ultaura_opt_outs
ADD CONSTRAINT ultaura_opt_outs_source_check
CHECK (source IN ('dtmf', 'voice', 'dashboard', 'sms_keyword'));
