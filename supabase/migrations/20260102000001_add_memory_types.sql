-- Add new memory types to the enum
-- PostgreSQL ALTER TYPE ... ADD VALUE is safe and non-blocking

ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'context';
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'history';
ALTER TYPE ultaura_memory_type ADD VALUE IF NOT EXISTS 'wellbeing';

-- Add index for faster memory lookups during refresh
CREATE INDEX IF NOT EXISTS idx_ultaura_memories_line_updated
  ON ultaura_memories (line_id, updated_at DESC)
  WHERE active = true;

COMMENT ON TYPE ultaura_memory_type IS 'Memory categories:
  fact - Personal information (name, family, pets, location)
  preference - Likes/dislikes, interests, habits
  follow_up - Things to ask about in future calls
  context - Living situation, environment, daily patterns
  history - Past experiences, stories shared
  wellbeing - Non-medical wellness observations';
