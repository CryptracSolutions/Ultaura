-- Add optional gender field to lines

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE ultaura_lines
  ADD CONSTRAINT ultaura_lines_gender_check
  CHECK (
    gender IS NULL
    OR gender IN ('male', 'female', 'non_binary', 'prefer_not_to_say')
  );

COMMENT ON COLUMN ultaura_lines.gender IS
  'Gender of the senior. Used for pronoun selection and culturally appropriate conversation.';
