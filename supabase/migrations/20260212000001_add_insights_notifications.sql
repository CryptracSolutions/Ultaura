-- Weekly summaries + notification preferences (Part 2)

CREATE TABLE IF NOT EXISTS ultaura_weekly_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Aggregated data (encrypted)
  summary_ciphertext bytea NOT NULL,
  summary_iv bytea NOT NULL,
  summary_tag bytea NOT NULL,
  summary_alg text NOT NULL DEFAULT 'aes-256-gcm',
  summary_kid text NOT NULL DEFAULT 'kek_v1',

  -- Delivery tracking
  email_sent_at timestamptz,
  sms_sent_at timestamptz,

  UNIQUE(line_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_summaries_line_week
  ON ultaura_weekly_summaries(line_id, week_start_date DESC);

ALTER TABLE ultaura_weekly_summaries ENABLE ROW LEVEL SECURITY;

-- No RLS policies: service role only

CREATE TABLE IF NOT EXISTS ultaura_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Weekly summary preferences
  weekly_summary_enabled boolean NOT NULL DEFAULT true,
  weekly_summary_format text NOT NULL DEFAULT 'email' CHECK (weekly_summary_format IN ('email', 'sms', 'both')),
  weekly_summary_day text NOT NULL DEFAULT 'sunday' CHECK (weekly_summary_day IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')),
  weekly_summary_time time NOT NULL DEFAULT '18:00',

  -- Immediate alert preferences
  alert_missed_calls_enabled boolean NOT NULL DEFAULT true,
  alert_missed_calls_threshold integer NOT NULL DEFAULT 3,

  UNIQUE(account_id, line_id)
);

ALTER TABLE ultaura_notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view notification preferences for their accounts"
  ON ultaura_notification_preferences FOR SELECT
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can insert notification preferences for their accounts"
  ON ultaura_notification_preferences FOR INSERT
  WITH CHECK (can_access_ultaura_account(account_id));

CREATE POLICY "Users can update notification preferences for their accounts"
  ON ultaura_notification_preferences FOR UPDATE
  USING (can_access_ultaura_account(account_id));

CREATE POLICY "Users can delete notification preferences for their accounts"
  ON ultaura_notification_preferences FOR DELETE
  USING (can_access_ultaura_account(account_id));
