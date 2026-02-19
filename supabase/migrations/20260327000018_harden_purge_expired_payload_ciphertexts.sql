-- Harden ciphertext retention RPC permissions and input bounds.

CREATE OR REPLACE FUNCTION purge_expired_payload_ciphertexts(
  cutoff_ts timestamptz,
  batch_limit int DEFAULT 500
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purged int;
  effective_batch_limit int;
BEGIN
  PERFORM assert_service_role();

  effective_batch_limit := GREATEST(1, LEAST(COALESCE(batch_limit, 500), 5000));

  WITH expired AS (
    SELECT id
    FROM ultaura_telephony_event_log
    WHERE payload_ciphertext IS NOT NULL
      AND created_at < cutoff_ts
    LIMIT effective_batch_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_telephony_event_log t
  SET payload_ciphertext = NULL
  FROM expired e
  WHERE t.id = e.id;

  GET DIAGNOSTICS purged = ROW_COUNT;
  RETURN purged;
END;
$$;

REVOKE EXECUTE
  ON FUNCTION purge_expired_payload_ciphertexts(timestamptz, int)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
  ON FUNCTION purge_expired_payload_ciphertexts(timestamptz, int)
  TO service_role;
