-- Add short_id column to ultaura_lines for efficient short lookups

ALTER TABLE ultaura_lines
  ADD COLUMN short_id text;

-- Populate short_id for existing lines with collision handling
WITH ranked_lines AS (
  SELECT
    id,
    account_id,
    LOWER(SUBSTRING(id::text, 1, 8)) AS base_short_id,
    ROW_NUMBER() OVER (
      PARTITION BY account_id, LOWER(SUBSTRING(id::text, 1, 8))
      ORDER BY created_at, id
    ) AS collision_rank
  FROM ultaura_lines
)
UPDATE ultaura_lines l
SET short_id = CASE
  WHEN r.collision_rank = 1 THEN r.base_short_id
  ELSE r.base_short_id || '_' || r.collision_rank
END
FROM ranked_lines r
WHERE l.id = r.id;

ALTER TABLE ultaura_lines
  ALTER COLUMN short_id SET NOT NULL;

ALTER TABLE ultaura_lines
  ADD CONSTRAINT ultaura_lines_account_short_id_unique
  UNIQUE (account_id, short_id);

CREATE INDEX idx_ultaura_lines_short_id ON ultaura_lines (short_id);
