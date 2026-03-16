-- Observations table
CREATE TABLE IF NOT EXISTS ultaura_health_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_by_user_id uuid REFERENCES public.users(id),
  updated_by_user_id uuid REFERENCES public.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  payload_ciphertext bytea NOT NULL,
  payload_iv bytea NOT NULL,
  payload_tag bytea NOT NULL,
  payload_alg text NOT NULL DEFAULT 'aes-256-gcm',
  payload_kid text
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_observations_line_created ON ultaura_health_observations(line_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_health_observations_line_deleted ON ultaura_health_observations(line_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_health_observations_account_deleted ON ultaura_health_observations(account_id, deleted_at);

-- RLS
ALTER TABLE ultaura_health_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY ultaura_health_observations_owner_select
  ON ultaura_health_observations FOR SELECT
  USING (is_ultaura_account_owner(account_id) AND can_access_ultaura_health_line(line_id));

-- Account/line consistency trigger (reuses existing function from Phase 1)
DROP TRIGGER IF EXISTS trg_health_observations_account_line ON ultaura_health_observations;
CREATE TRIGGER trg_health_observations_account_line
  BEFORE INSERT OR UPDATE ON ultaura_health_observations
  FOR EACH ROW EXECUTE FUNCTION enforce_health_account_line_consistency();
