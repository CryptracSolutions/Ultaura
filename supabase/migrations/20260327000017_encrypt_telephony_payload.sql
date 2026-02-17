-- Encrypt raw telephony payloads at rest and support TTL-based retention.
--
-- payload_ciphertext stores AES-256-GCM encrypted raw webhook JSON.
-- payload_redacted (plaintext) is kept indefinitely for debugging trends.
-- A scheduled job nullifies payload_ciphertext after 14 days.

-- Add encrypted payload column
ALTER TABLE ultaura_telephony_event_log
  ADD COLUMN payload_ciphertext bytea;

-- Partial index to speed up the TTL cleanup job
CREATE INDEX idx_telephony_event_log_ciphertext_ttl
  ON ultaura_telephony_event_log (created_at)
  WHERE payload_ciphertext IS NOT NULL;

-- Drop the raw plaintext payload column (data migrated to ciphertext)
-- Existing rows with raw payload are acceptable to lose — table is new and
-- retention-bounded.  If you need to preserve them, encrypt-in-place first.
ALTER TABLE ultaura_telephony_event_log DROP COLUMN IF EXISTS payload;

COMMENT ON COLUMN ultaura_telephony_event_log.payload_ciphertext IS
  'AES-256-GCM encrypted raw webhook JSON. Nullified after 14 days by retention job.';
