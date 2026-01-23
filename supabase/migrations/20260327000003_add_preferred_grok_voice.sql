-- Add preferred Grok voice selection to lines

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS preferred_grok_voice TEXT;

UPDATE ultaura_lines
SET preferred_grok_voice = 'Ara'
WHERE preferred_grok_voice IS NULL
   OR preferred_grok_voice NOT IN ('Ara', 'Eve', 'Leo', 'Rex', 'Sal');

ALTER TABLE ultaura_lines
  ALTER COLUMN preferred_grok_voice SET DEFAULT 'Ara';

ALTER TABLE ultaura_lines
  ALTER COLUMN preferred_grok_voice SET NOT NULL;

ALTER TABLE ultaura_lines
  DROP CONSTRAINT IF EXISTS ultaura_lines_preferred_grok_voice_check;

ALTER TABLE ultaura_lines
  ADD CONSTRAINT ultaura_lines_preferred_grok_voice_check
  CHECK (preferred_grok_voice IN ('Ara', 'Eve', 'Leo', 'Rex', 'Sal'));

COMMENT ON COLUMN ultaura_lines.preferred_grok_voice IS
  'Preferred Grok voice for this line; applies to the next call.';
