-- Add language preference columns to ultaura_lines
-- preferred_language_bcp47: Full BCP-47 tag (e.g., 'es-MX', 'zh-Hans')
-- preferred_language_iso: Normalized ISO 639-1 code (e.g., 'es', 'zh')
-- When BOTH are NULL = auto-detect mode

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS preferred_language_bcp47 TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language_iso TEXT;

-- Add constraint to ensure ISO code is valid if provided
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ultaura_lines_preferred_language_iso_check'
  ) THEN
    ALTER TABLE ultaura_lines
      ADD CONSTRAINT ultaura_lines_preferred_language_iso_check
      CHECK (
        preferred_language_iso IS NULL
        OR preferred_language_iso IN (
          'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh',
          'nl', 'ru', 'ar', 'hi', 'tr', 'pl', 'sv', 'da', 'no',
          'fi', 'cs', 'th', 'vi', 'id', 'ms', 'tl', 'uk', 'el',
          'he', 'ro', 'hu'
        )
      );
  END IF;
END $$;

-- Add index for querying by language (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_ultaura_lines_preferred_language_iso
  ON ultaura_lines(preferred_language_iso)
  WHERE preferred_language_iso IS NOT NULL;

COMMENT ON COLUMN ultaura_lines.preferred_language_bcp47 IS 'Full BCP-47 language tag (e.g., es-MX). NULL means auto-detect mode.';
COMMENT ON COLUMN ultaura_lines.preferred_language_iso IS 'ISO 639-1 language code (e.g., es). NULL means auto-detect mode. Derived from BCP-47 tag.';
