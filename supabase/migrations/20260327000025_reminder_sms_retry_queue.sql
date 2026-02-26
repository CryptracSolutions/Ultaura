ALTER TABLE public.ultaura_reminders
  ADD COLUMN delivery_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN next_delivery_attempt_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_unclaimed_effective_due
  ON public.ultaura_reminders ((COALESCE(next_delivery_attempt_at, due_at)), due_at)
  WHERE status = 'scheduled'
    AND is_paused = false
    AND processing_claimed_by IS NULL;

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
      AND COALESCE(r.next_delivery_attempt_at, r.due_at) <= v_now
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
