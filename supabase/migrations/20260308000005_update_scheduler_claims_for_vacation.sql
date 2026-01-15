-- Update scheduler claim RPCs to exclude vacationing lines

CREATE OR REPLACE FUNCTION claim_due_schedules(
  p_worker_id text,
  p_batch_size int DEFAULT 10,
  p_claim_ttl_seconds int DEFAULT 120
)
RETURNS SETOF ultaura_schedules
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
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
      AND NOT is_line_on_vacation(s.line_id)
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
  FROM claimed c
  WHERE s.id = c.id
  RETURNING s.*;
END;
$$;

CREATE OR REPLACE FUNCTION claim_due_reminders(
  p_worker_id text,
  p_batch_size int DEFAULT 10,
  p_claim_ttl_seconds int DEFAULT 120
)
RETURNS SETOF ultaura_reminders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_stale_threshold timestamptz := v_now - (p_claim_ttl_seconds || ' seconds')::interval;
BEGIN
  UPDATE ultaura_reminders
  SET processing_claimed_by = NULL, processing_claimed_at = NULL
  WHERE processing_claimed_by IS NOT NULL
    AND processing_claimed_at < v_stale_threshold;

  RETURN QUERY
  WITH claimed AS (
    SELECT r.id
    FROM ultaura_reminders r
    WHERE r.status = 'scheduled'
      AND r.is_paused = false
      AND r.due_at <= v_now
      AND (r.snoozed_until IS NULL OR r.snoozed_until <= v_now)
      AND r.processing_claimed_by IS NULL
      AND NOT is_line_on_vacation(r.line_id)
    ORDER BY r.due_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_reminders r
  SET processing_claimed_by = p_worker_id, processing_claimed_at = v_now
  FROM claimed c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;
