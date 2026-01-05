-- Distributed scheduler coordination: RPC functions for atomic operations
-- These functions provide atomic claim/release/complete operations for the scheduler

-- Function: Try to acquire a scheduler lease
-- Returns true if lease was acquired, false if held by another worker
CREATE OR REPLACE FUNCTION try_acquire_scheduler_lease(
  p_lease_id text,
  p_worker_id text,
  p_lease_duration_seconds int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated int;
BEGIN
  -- Try to acquire or renew the lease
  -- Succeeds if: not held, held by us (renewal), or expired
  UPDATE ultaura_scheduler_leases
  SET
    held_by = p_worker_id,
    acquired_at = CASE
      WHEN held_by IS NULL OR held_by = p_worker_id THEN COALESCE(acquired_at, v_now)
      ELSE v_now
    END,
    expires_at = v_now + (p_lease_duration_seconds || ' seconds')::interval,
    heartbeat_at = v_now
  WHERE id = p_lease_id
    AND (
      held_by IS NULL              -- Not held
      OR held_by = p_worker_id     -- We already hold it (renewal)
      OR expires_at < v_now        -- Expired lease (takeover)
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Release a scheduler lease
-- Only releases if we own the lease
CREATE OR REPLACE FUNCTION release_scheduler_lease(
  p_lease_id text,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE ultaura_scheduler_leases
  SET
    held_by = NULL,
    acquired_at = NULL,
    expires_at = NULL,
    heartbeat_at = NULL
  WHERE id = p_lease_id
    AND held_by = p_worker_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Heartbeat to extend lease
-- Extends the lease TTL while processing
CREATE OR REPLACE FUNCTION heartbeat_scheduler_lease(
  p_lease_id text,
  p_worker_id text,
  p_extend_seconds int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_updated int;
BEGIN
  UPDATE ultaura_scheduler_leases
  SET
    expires_at = v_now + (p_extend_seconds || ' seconds')::interval,
    heartbeat_at = v_now
  WHERE id = p_lease_id
    AND held_by = p_worker_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Claim schedules for processing (atomic batch claim)
-- Uses FOR UPDATE SKIP LOCKED for true atomic claiming
CREATE OR REPLACE FUNCTION claim_due_schedules(
  p_worker_id text,
  p_batch_size int DEFAULT 10,
  p_claim_ttl_seconds int DEFAULT 120
)
RETURNS SETOF ultaura_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_stale_threshold timestamptz := v_now - (p_claim_ttl_seconds || ' seconds')::interval;
BEGIN
  -- First, clear any stale claims (TTL expired)
  UPDATE ultaura_schedules
  SET processing_claimed_by = NULL, processing_claimed_at = NULL
  WHERE processing_claimed_by IS NOT NULL
    AND processing_claimed_at < v_stale_threshold;

  -- Atomically claim and return schedules using FOR UPDATE SKIP LOCKED
  RETURN QUERY
  WITH claimed AS (
    SELECT s.id
    FROM ultaura_schedules s
    WHERE s.enabled = true
      AND s.next_run_at IS NOT NULL
      AND s.next_run_at <= v_now
      AND s.processing_claimed_by IS NULL
    ORDER BY s.next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_schedules s
  SET
    processing_claimed_by = p_worker_id,
    processing_claimed_at = v_now
  FROM claimed c
  WHERE s.id = c.id
  RETURNING s.*;
END;
$$;

-- Function: Complete schedule processing (update next_run_at and release claim)
-- Atomically updates and releases claim, verifying ownership
CREATE OR REPLACE FUNCTION complete_schedule_processing(
  p_schedule_id uuid,
  p_worker_id text,
  p_result text,  -- 'success', 'missed', 'suppressed_quiet_hours', 'failed'
  p_next_run_at timestamptz,
  p_reset_retry_count boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE ultaura_schedules
  SET
    last_run_at = now(),
    last_result = p_result::ultaura_schedule_result,
    next_run_at = p_next_run_at,
    retry_count = CASE WHEN p_reset_retry_count THEN 0 ELSE retry_count END,
    processing_claimed_by = NULL,
    processing_claimed_at = NULL
  WHERE id = p_schedule_id
    AND processing_claimed_by = p_worker_id;  -- Verify we still own the claim

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Increment retry count for schedule
CREATE OR REPLACE FUNCTION increment_schedule_retry(
  p_schedule_id uuid,
  p_worker_id text,
  p_next_run_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE ultaura_schedules
  SET
    last_run_at = now(),
    last_result = 'failed'::ultaura_schedule_result,
    next_run_at = p_next_run_at,
    retry_count = retry_count + 1,
    processing_claimed_by = NULL,
    processing_claimed_at = NULL
  WHERE id = p_schedule_id
    AND processing_claimed_by = p_worker_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Function: Claim reminders for processing (atomic batch claim)
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
  -- First, clear any stale claims (TTL expired)
  UPDATE ultaura_reminders
  SET processing_claimed_by = NULL, processing_claimed_at = NULL
  WHERE processing_claimed_by IS NOT NULL
    AND processing_claimed_at < v_stale_threshold;

  -- Atomically claim and return reminders using FOR UPDATE SKIP LOCKED
  RETURN QUERY
  WITH claimed AS (
    SELECT r.id
    FROM ultaura_reminders r
    WHERE r.status = 'scheduled'
      AND r.is_paused = false
      AND r.due_at <= v_now
      AND (r.snoozed_until IS NULL OR r.snoozed_until <= v_now)
      AND r.processing_claimed_by IS NULL
    ORDER BY r.due_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE ultaura_reminders r
  SET
    processing_claimed_by = p_worker_id,
    processing_claimed_at = v_now
  FROM claimed c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

-- Function: Complete reminder processing (release claim)
-- For reminders, the caller updates the reminder status separately
CREATE OR REPLACE FUNCTION complete_reminder_processing(
  p_reminder_id uuid,
  p_worker_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE ultaura_reminders
  SET
    processing_claimed_by = NULL,
    processing_claimed_at = NULL
  WHERE id = p_reminder_id
    AND processing_claimed_by = p_worker_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- Grant execute permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION try_acquire_scheduler_lease(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION release_scheduler_lease(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION heartbeat_scheduler_lease(text, text, int) TO service_role;
GRANT EXECUTE ON FUNCTION claim_due_schedules(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION complete_schedule_processing(uuid, text, text, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION increment_schedule_retry(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION claim_due_reminders(text, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION complete_reminder_processing(uuid, text) TO service_role;

-- Add comments for documentation
COMMENT ON FUNCTION try_acquire_scheduler_lease IS
  'Atomically acquire a scheduler lease. Returns true if acquired.';
COMMENT ON FUNCTION release_scheduler_lease IS
  'Release a scheduler lease. Only succeeds if caller owns the lease.';
COMMENT ON FUNCTION heartbeat_scheduler_lease IS
  'Extend a scheduler lease TTL. Used during long processing.';
COMMENT ON FUNCTION claim_due_schedules IS
  'Atomically claim a batch of due schedules for processing.';
COMMENT ON FUNCTION complete_schedule_processing IS
  'Complete schedule processing: update result and release claim.';
COMMENT ON FUNCTION claim_due_reminders IS
  'Atomically claim a batch of due reminders for processing.';
COMMENT ON FUNCTION complete_reminder_processing IS
  'Release reminder processing claim.';
