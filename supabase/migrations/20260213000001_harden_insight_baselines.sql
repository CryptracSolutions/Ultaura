-- Follow-up: lock baseline writes and harden SECURITY DEFINER search_path

DROP POLICY IF EXISTS "Users can update line baselines for their accounts"
  ON ultaura_line_baselines;
DROP POLICY IF EXISTS "Users can insert line baselines for their accounts"
  ON ultaura_line_baselines;
DROP POLICY IF EXISTS "Users can delete line baselines for their accounts"
  ON ultaura_line_baselines;

CREATE OR REPLACE FUNCTION create_insight_privacy_for_line()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO ultaura_insight_privacy (line_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
