-- Account privacy settings and consent types

-- Extend consent type enum with new values (for audit context only)
ALTER TYPE ultaura_consent_type ADD VALUE IF NOT EXISTS 'audio_processing';
ALTER TYPE ultaura_consent_type ADD VALUE IF NOT EXISTS 'recording';

-- Retention period enum
CREATE TYPE ultaura_retention_period AS ENUM ('30_days', '90_days', '365_days', 'indefinite');

-- Account-level privacy settings
CREATE TABLE ultaura_account_privacy_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Feature toggles (account level)
  recording_enabled boolean NOT NULL DEFAULT false,
  ai_summarization_enabled boolean NOT NULL DEFAULT true,

  -- Data retention
  retention_period ultaura_retention_period NOT NULL DEFAULT '90_days',

  -- Payer acknowledgment of vendor disclosure
  vendor_disclosure_acknowledged_at timestamptz,
  vendor_disclosure_acknowledged_by uuid REFERENCES public.users(id),

  UNIQUE(account_id)
);

CREATE INDEX idx_privacy_settings_account ON ultaura_account_privacy_settings(account_id);

ALTER TABLE ultaura_account_privacy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view privacy settings for their accounts"
  ON ultaura_account_privacy_settings FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can update privacy settings for their accounts"
  ON ultaura_account_privacy_settings FOR UPDATE
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can insert privacy settings for their accounts"
  ON ultaura_account_privacy_settings FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));

-- Auto-create row for new accounts
CREATE OR REPLACE FUNCTION create_privacy_settings_for_account()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ultaura_account_privacy_settings (account_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_create_privacy_settings
AFTER INSERT ON ultaura_accounts
FOR EACH ROW EXECUTE FUNCTION create_privacy_settings_for_account();

-- Backfill existing accounts (if any)
INSERT INTO ultaura_account_privacy_settings (account_id)
SELECT id FROM ultaura_accounts
ON CONFLICT (account_id) DO NOTHING;
