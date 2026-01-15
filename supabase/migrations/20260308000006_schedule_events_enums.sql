-- Convert schedule event columns to enums for consistency

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'ultaura_schedule_event_type'
  ) THEN
    CREATE TYPE ultaura_schedule_event_type AS ENUM (
      'created', 'edited', 'enabled', 'disabled',
      'exception_added', 'exception_removed',
      'vacation_started', 'vacation_ended'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'ultaura_schedule_triggered_by'
  ) THEN
    CREATE TYPE ultaura_schedule_triggered_by AS ENUM ('dashboard', 'voice', 'system');
  END IF;
END $$;

ALTER TABLE ultaura_schedule_events
  DROP CONSTRAINT IF EXISTS chk_schedule_event_type,
  DROP CONSTRAINT IF EXISTS chk_schedule_triggered_by;

ALTER TABLE ultaura_schedule_events
  ALTER COLUMN event_type TYPE ultaura_schedule_event_type
    USING event_type::ultaura_schedule_event_type,
  ALTER COLUMN triggered_by TYPE ultaura_schedule_triggered_by
    USING triggered_by::ultaura_schedule_triggered_by;
