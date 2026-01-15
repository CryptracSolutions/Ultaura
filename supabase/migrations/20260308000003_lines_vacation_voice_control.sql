-- Add vacation ranges and voice schedule control toggle to lines

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS vacation_ranges jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE ultaura_lines
  ADD COLUMN IF NOT EXISTS allow_voice_schedule_control boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_vacation_ranges_format') THEN
    ALTER TABLE ultaura_lines
      ADD CONSTRAINT chk_vacation_ranges_format CHECK (jsonb_typeof(vacation_ranges) = 'array');
  END IF;
END $$;
