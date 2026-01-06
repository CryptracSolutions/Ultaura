-- Remove unused rrule column from ultaura_schedules
-- One-off calls now use reminders.

ALTER TABLE ultaura_schedules DROP COLUMN IF EXISTS rrule;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'ultaura_migration_log'
  ) THEN
    INSERT INTO ultaura_migration_log (migration_name, notes)
    VALUES (
      'remove_schedule_rrule',
      'Removed unused rrule column from schedules. One-off calls now use reminders.'
    );
  END IF;
END $$;
