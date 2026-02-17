-- Encrypt raw telephony payloads at rest and support TTL-based retention.
--
-- payload_ciphertext stores base64-encoded AES-256-GCM encrypted raw webhook JSON.
-- payload_redacted (plaintext) is kept indefinitely for debugging trends.
-- A scheduled job nullifies payload_ciphertext after 14 days.

-- Add encrypted payload column (text for base64; avoids bytea/Buffer serialization issues)
ALTER TABLE ultaura_telephony_event_log
  ADD COLUMN payload_ciphertext text;

-- Partial index to speed up the TTL cleanup job
CREATE INDEX idx_telephony_event_log_ciphertext_ttl
  ON ultaura_telephony_event_log (created_at)
  WHERE payload_ciphertext IS NOT NULL;

-- Drop the raw plaintext payload column (data migrated to ciphertext)
-- Existing rows with raw payload are acceptable to lose — table is new and
-- retention-bounded.  If you need to preserve them, encrypt-in-place first.
ALTER TABLE ultaura_telephony_event_log DROP COLUMN IF EXISTS payload;

-- RPC for batched payload retention (PostgREST may ignore LIMIT on UPDATE)
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
BEGIN
  WITH expired AS (
    SELECT id
    FROM ultaura_telephony_event_log
    WHERE payload_ciphertext IS NOT NULL
      AND created_at < cutoff_ts
    LIMIT batch_limit
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

COMMENT ON COLUMN ultaura_telephony_event_log.payload_ciphertext IS
  'Base64-encoded AES-256-GCM encrypted raw webhook JSON. Nullified after 14 days by retention job.';
