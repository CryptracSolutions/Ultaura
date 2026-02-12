-- Enforce account/line/schedule consistency for schedule exceptions.
-- Keeps existing RLS policies intact and adds a row-level integrity guard.

CREATE OR REPLACE FUNCTION ultaura_validate_schedule_exception_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  schedule_account_id uuid;
  schedule_line_id uuid;
  line_account_id uuid;
BEGIN
  SELECT s.account_id, s.line_id
  INTO schedule_account_id, schedule_line_id
  FROM ultaura_schedules s
  WHERE s.id = NEW.schedule_id;

  IF schedule_account_id IS NULL OR schedule_line_id IS NULL THEN
    RAISE EXCEPTION 'Invalid schedule exception scope'
      USING ERRCODE = '23514',
            DETAIL = 'Referenced schedule is missing or inaccessible.';
  END IF;

  SELECT l.account_id
  INTO line_account_id
  FROM ultaura_lines l
  WHERE l.id = NEW.line_id;

  IF line_account_id IS NULL THEN
    RAISE EXCEPTION 'Invalid schedule exception scope'
      USING ERRCODE = '23514',
            DETAIL = 'Referenced line is missing or inaccessible.';
  END IF;

  IF NEW.account_id <> schedule_account_id
     OR NEW.line_id <> schedule_line_id
     OR NEW.account_id <> line_account_id THEN
    RAISE EXCEPTION 'Invalid schedule exception scope'
      USING ERRCODE = '23514',
            DETAIL = 'account_id, line_id, and schedule_id must describe the same scope.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ultaura_schedule_exceptions_scope
  ON ultaura_schedule_exceptions;

CREATE TRIGGER trg_ultaura_schedule_exceptions_scope
  BEFORE INSERT OR UPDATE OF account_id, line_id, schedule_id
  ON ultaura_schedule_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION ultaura_validate_schedule_exception_scope();
