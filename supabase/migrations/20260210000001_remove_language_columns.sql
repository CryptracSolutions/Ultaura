-- Remove preferred_language and spanish_formality from ultaura_lines

ALTER TABLE ultaura_lines
  DROP CONSTRAINT IF EXISTS ultaura_lines_preferred_language_check,
  DROP CONSTRAINT IF EXISTS ultaura_lines_spanish_formality_check;

ALTER TABLE ultaura_lines
  DROP COLUMN IF EXISTS preferred_language,
  DROP COLUMN IF EXISTS spanish_formality;
