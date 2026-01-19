-- Multi-instance scaling fixes
-- Adds lease rows for weekly summaries and recording deletions

INSERT INTO ultaura_scheduler_leases (id)
VALUES
  ('weekly-summaries'),
  ('recording-deletions')
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE ultaura_scheduler_leases IS
  'Distributed locking for scheduler coordination. Lease IDs: schedules, reminders, weekly-summaries, recording-deletions, embeddings, decay-job.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ultaura_scheduler_leases WHERE id = 'schedules') THEN
    INSERT INTO ultaura_scheduler_leases (id) VALUES ('schedules');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM ultaura_scheduler_leases WHERE id = 'reminders') THEN
    INSERT INTO ultaura_scheduler_leases (id) VALUES ('reminders');
  END IF;
END $$;
