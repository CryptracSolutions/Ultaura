-- SMS Alerts V1: account-owner alert delivery + recipient delivery channel metadata

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ultaura_alert_delivery_channel') THEN
    EXECUTE 'CREATE TYPE ultaura_alert_delivery_channel AS ENUM (''email'', ''sms'', ''both'')';
  END IF;
END $$;

ALTER TYPE ultaura_alert_delivery_channel ADD VALUE IF NOT EXISTS 'both';

CREATE TABLE IF NOT EXISTS ultaura_account_alert_delivery (
  account_id uuid PRIMARY KEY REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  delivery_channel ultaura_alert_delivery_channel NOT NULL DEFAULT 'email',
  sms_consent_acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ultaura_account_alert_delivery ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ultaura_account_alert_delivery'
      AND policyname = 'Users can view account alert delivery for their accounts'
  ) THEN
    CREATE POLICY "Users can view account alert delivery for their accounts"
      ON ultaura_account_alert_delivery FOR SELECT
      USING (can_access_ultaura_account(account_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ultaura_account_alert_delivery'
      AND policyname = 'Users can insert account alert delivery for their accounts'
  ) THEN
    CREATE POLICY "Users can insert account alert delivery for their accounts"
      ON ultaura_account_alert_delivery FOR INSERT
      WITH CHECK (can_access_ultaura_account(account_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ultaura_account_alert_delivery'
      AND policyname = 'Users can update account alert delivery for their accounts'
  ) THEN
    CREATE POLICY "Users can update account alert delivery for their accounts"
      ON ultaura_account_alert_delivery FOR UPDATE
      USING (can_access_ultaura_account(account_id));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ultaura_account_alert_delivery'
      AND policyname = 'Users can delete account alert delivery for their accounts'
  ) THEN
    CREATE POLICY "Users can delete account alert delivery for their accounts"
      ON ultaura_account_alert_delivery FOR DELETE
      USING (can_access_ultaura_account(account_id));
  END IF;
END $$;

INSERT INTO ultaura_account_alert_delivery (account_id, delivery_channel)
SELECT id, 'email'::ultaura_alert_delivery_channel
FROM ultaura_accounts
ON CONFLICT (account_id) DO NOTHING;

ALTER TABLE ultaura_notification_recipients
  ADD COLUMN IF NOT EXISTS delivery_channel ultaura_alert_delivery_channel,
  ADD COLUMN IF NOT EXISTS sms_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_consent_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_verify_access_token_hash text,
  ADD COLUMN IF NOT EXISTS sms_verify_access_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS sms_verify_last_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notification_recipients_sms_verify_access_token_hash
  ON ultaura_notification_recipients(sms_verify_access_token_hash)
  WHERE sms_verify_access_token_hash IS NOT NULL;

UPDATE ultaura_notification_recipients
SET delivery_channel = 'email'::ultaura_alert_delivery_channel
WHERE delivery_channel IS NULL;

ALTER TABLE ultaura_notification_recipients
  ALTER COLUMN delivery_channel SET DEFAULT 'email'::ultaura_alert_delivery_channel,
  ALTER COLUMN delivery_channel SET NOT NULL;

ALTER TABLE ultaura_wellness_alerts
  DROP CONSTRAINT IF EXISTS ultaura_wellness_alerts_delivery_method_check;

ALTER TABLE ultaura_wellness_alerts
  ADD CONSTRAINT ultaura_wellness_alerts_delivery_method_check
  CHECK (delivery_method IN ('email', 'sms', 'push', 'dashboard_only', 'multi'));
