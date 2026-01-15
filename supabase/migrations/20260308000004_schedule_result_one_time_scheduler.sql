-- Extend schedule result enum, add one-time flag, and update scheduler helpers

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ultaura_schedule_result'
      AND e.enumlabel = 'skipped'
  ) THEN
    EXECUTE 'ALTER TYPE ultaura_schedule_result ADD VALUE ''skipped''';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'ultaura_schedule_result'
      AND e.enumlabel = 'suppressed_vacation'
  ) THEN
    EXECUTE 'ALTER TYPE ultaura_schedule_result ADD VALUE ''suppressed_vacation''';
  END IF;
END $$;

ALTER TABLE ultaura_schedules
  ADD COLUMN IF NOT EXISTS is_one_time boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION is_line_on_vacation(p_line_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_vacation_ranges jsonb;
  v_today date;
  v_range jsonb;
BEGIN
  SELECT vacation_ranges, (now() AT TIME ZONE timezone)::date
  INTO v_vacation_ranges, v_today
  FROM ultaura_lines WHERE id = p_line_id;

  IF v_vacation_ranges IS NULL OR jsonb_array_length(v_vacation_ranges) = 0 THEN
    RETURN false;
  END IF;

  FOR v_range IN SELECT * FROM jsonb_array_elements(v_vacation_ranges)
  LOOP
    IF v_today >= (v_range->>'start')::date AND v_today <= (v_range->>'end')::date THEN
      RETURN true;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION claim_due_schedules(
  p_worker_id text,
  p_batch_size int DEFAULT 10,
  p_claim_ttl_seconds int DEFAULT 120
)
RETURNS SETOF ultaura_schedules
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_now timestamptz := now();
  v_stale_threshold timestamptz := v_now - (p_claim_ttl_seconds || ' seconds')::interval;
BEGIN
  UPDATE ultaura_schedules
  SET processing_claimed_by = NULL, processing_claimed_at = NULL
  WHERE processing_claimed_by IS NOT NULL
    AND processing_claimed_at < v_stale_threshold;

  RETURN QUERY
  WITH claimed AS (
    SELECT s.id
    FROM ultaura_schedules s
    WHERE s.enabled = true
      AND s.next_run_at IS NOT NULL
      AND s.next_run_at <= v_now
      AND s.processing_claimed_by IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM ultaura_schedule_exceptions se
        WHERE se.schedule_id = s.id
          AND se.exception_date = (v_now AT TIME ZONE s.timezone)::date
          AND se.exception_type IN ('skip', 'reschedule')
      )
    ORDER BY s.next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_schedules s
  SET processing_claimed_by = p_worker_id, processing_claimed_at = v_now
  FROM claimed c WHERE s.id = c.id
  RETURNING s.*;
END;
$$;

GRANT EXECUTE ON FUNCTION is_line_on_vacation(uuid) TO service_role;
