-- Health Profile Reminder Integration Migration
-- Extends ultaura_reminders with pause_sources/source_context,
-- creates the medication-reminder link table, tightens RLS read isolation,
-- and replaces enforce_reminder_limit() with Health-aware counting.

-- ============================================================================
-- 1. Create pause_sources enum
-- ============================================================================

CREATE TYPE ultaura_reminder_pause_source AS ENUM (
  'manual',
  'health_manual_resume_required',
  'health_consent_not_requested',
  'health_consent_denied',
  'health_consent_revoked',
  'health_plan_ineligible'
);

-- ============================================================================
-- 2. Extend ultaura_reminders
-- ============================================================================

ALTER TABLE ultaura_reminders
  ADD COLUMN IF NOT EXISTS source_context text NOT NULL DEFAULT 'general'
    CHECK (source_context IN ('general', 'health_profile')),
  ADD COLUMN IF NOT EXISTS pause_sources ultaura_reminder_pause_source[] NOT NULL DEFAULT '{}';

-- ============================================================================
-- 3. Backfill pause_sources for existing paused reminders
--    MUST run before the canonicalization trigger is installed.
-- ============================================================================

UPDATE ultaura_reminders
SET pause_sources = ARRAY['manual'::ultaura_reminder_pause_source]
WHERE is_paused = true
  AND cardinality(pause_sources) = 0;

-- ============================================================================
-- 4. Canonicalization trigger — keeps is_paused in sync with pause_sources
-- ============================================================================

CREATE OR REPLACE FUNCTION normalize_ultaura_reminder_pause_sources()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  new.pause_sources := coalesce(new.pause_sources, '{}');

  -- de-duplicate and sort for deterministic semantics
  new.pause_sources := (
    SELECT coalesce(array_agg(DISTINCT src ORDER BY src), '{}')
    FROM unnest(new.pause_sources) AS src
  );

  new.is_paused := cardinality(new.pause_sources) > 0;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_reminder_pause_sources ON ultaura_reminders;

CREATE TRIGGER trg_normalize_reminder_pause_sources
BEFORE INSERT OR UPDATE ON ultaura_reminders
FOR EACH ROW
EXECUTE FUNCTION normalize_ultaura_reminder_pause_sources();

-- ============================================================================
-- 5. Health source_context invariant — health reminders must use outbound_call
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_health_reminder_source_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF new.source_context = 'health_profile' AND new.delivery_method <> 'outbound_call' THEN
    RAISE EXCEPTION 'health_profile reminders must use outbound_call delivery method';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_health_reminder_source_context ON ultaura_reminders;

CREATE TRIGGER trg_enforce_health_reminder_source_context
BEFORE INSERT OR UPDATE ON ultaura_reminders
FOR EACH ROW
EXECUTE FUNCTION enforce_health_reminder_source_context();

-- ============================================================================
-- 6. Health medication–reminder link table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ultaura_health_medication_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES ultaura_accounts(id) ON DELETE CASCADE,
  line_id uuid NOT NULL REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  medication_id uuid NOT NULL REFERENCES ultaura_health_medications(id) ON DELETE CASCADE,
  reminder_id uuid NOT NULL REFERENCES ultaura_reminders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Only one active link per reminder at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_medication_reminders_active_reminder
  ON ultaura_health_medication_reminders(reminder_id)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 7. Account/line consistency trigger on link table
--    Reuses enforce_health_account_line_consistency() from Phase 1 migration.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_health_medication_reminders_account_line ON ultaura_health_medication_reminders;

CREATE TRIGGER trg_health_medication_reminders_account_line
BEFORE INSERT OR UPDATE ON ultaura_health_medication_reminders
FOR EACH ROW
EXECUTE FUNCTION enforce_health_account_line_consistency();

-- ============================================================================
-- 8. RLS on link table — owner-only SELECT, no INSERT/UPDATE/DELETE policies
--    (all mutations are service-mediated via service_role)
-- ============================================================================

ALTER TABLE ultaura_health_medication_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_medication_reminders_owner_select
  ON ultaura_health_medication_reminders FOR SELECT
  USING (
    is_ultaura_account_owner(account_id)
    AND can_access_ultaura_health_line(line_id)
  );

-- ============================================================================
-- 9. Replace enforce_reminder_limit() with Health-aware counting
--    Generic reminders always count (even paused).
--    Health-linked reminders count only when active (not paused).
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_reminder_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_namespace text := 'reminder_limit';
  v_effective_plan_id text;
  v_reminders_per_line integer;
  v_scheduled_count integer;
BEGIN
  IF new.status <> 'scheduled' THEN
    RETURN new;
  END IF;

  IF tg_op = 'UPDATE'
     AND old.status = 'scheduled'
     AND new.status = 'scheduled'
     AND old.line_id = new.line_id
     AND old.account_id = new.account_id THEN
    RETURN new;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_lock_namespace), hashtext(new.line_id::text));

  v_effective_plan_id := get_effective_plan_id(new.account_id);

  SELECT p.reminders_per_line
  INTO v_reminders_per_line
  FROM ultaura_plans p
  WHERE p.id = v_effective_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan not found for effective plan id: %', v_effective_plan_id
      USING errcode = 'P0002';
  END IF;

  IF v_reminders_per_line IS NULL THEN
    RETURN new;
  END IF;

  -- Health-aware count:
  --   generic reminders always count toward the limit (even when paused)
  --   health reminders count only when active (not paused)
  SELECT count(*)
  INTO v_scheduled_count
  FROM ultaura_reminders r
  WHERE r.line_id = new.line_id
    AND r.status = 'scheduled'
    AND (
      r.source_context = 'general'
      OR r.is_paused = false
    )
    AND (tg_op <> 'UPDATE' OR r.id <> new.id);

  IF v_scheduled_count >= v_reminders_per_line THEN
    RAISE EXCEPTION 'REMINDER_LIMIT_REACHED: line % allows at most % scheduled reminders', new.line_id, v_reminders_per_line
      USING errcode = 'U0001';
  END IF;

  RETURN new;
END;
$$;

-- Trigger already exists from the previous migration; DROP + recreate to be safe.
DROP TRIGGER IF EXISTS trg_enforce_reminder_limit ON ultaura_reminders;

CREATE TRIGGER trg_enforce_reminder_limit
BEFORE INSERT OR UPDATE ON ultaura_reminders
FOR EACH ROW
EXECUTE FUNCTION enforce_reminder_limit();

-- ============================================================================
-- 10. DB-enforced read isolation on ultaura_reminders
--     Drop the broad member-level SELECT policy and replace with two
--     source_context-scoped policies.
-- ============================================================================

-- Drop original broad SELECT policy (20241220000001_ultaura_schema.sql, line 481)
DROP POLICY IF EXISTS "Users can view reminders for their accounts" ON ultaura_reminders;

-- General reminders: readable by account members (existing access pattern)
CREATE POLICY reminders_general_member_select
  ON ultaura_reminders FOR SELECT
  USING (
    can_access_ultaura_account(account_id)
    AND source_context = 'general'
  );

-- Health reminders: owner-only read
CREATE POLICY reminders_health_owner_select
  ON ultaura_reminders FOR SELECT
  USING (
    is_ultaura_account_owner(account_id)
    AND source_context = 'health_profile'
  );

-- ============================================================================
-- 11. DB-enforced read isolation on ultaura_reminder_events
--     Drop the broad member-level SELECT policy and replace with two
--     source_context-scoped policies (joining through ultaura_reminders).
-- ============================================================================

-- Drop original broad SELECT policy (20251226000003_reminder_management.sql, line 94)
DROP POLICY IF EXISTS "Users can view reminder events for their accounts" ON ultaura_reminder_events;

-- General reminder events: readable by account members
CREATE POLICY reminder_events_general_member_select
  ON ultaura_reminder_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ultaura_reminders r
      WHERE r.id = ultaura_reminder_events.reminder_id
        AND can_access_ultaura_account(r.account_id)
        AND r.source_context = 'general'
    )
  );

-- Health reminder events: owner-only
CREATE POLICY reminder_events_health_owner_select
  ON ultaura_reminder_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM ultaura_reminders r
      WHERE r.id = ultaura_reminder_events.reminder_id
        AND is_ultaura_account_owner(r.account_id)
        AND r.source_context = 'health_profile'
    )
  );

-- ============================================================================
-- 12. Index for source_context filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_reminders_source_context
  ON ultaura_reminders(source_context)
  WHERE source_context = 'health_profile';

-- ============================================================================
-- 13. Update CHECK constraint on ultaura_reminder_events for Health event types
-- ============================================================================

ALTER TABLE ultaura_reminder_events DROP CONSTRAINT IF EXISTS chk_event_type;
ALTER TABLE ultaura_reminder_events ADD CONSTRAINT chk_event_type CHECK (event_type IN (
  'created', 'edited', 'paused', 'resumed', 'snoozed',
  'skipped', 'canceled', 'delivered', 'no_answer', 'failed',
  'health_link_created', 'health_link_paused', 'health_link_resumed',
  'health_link_canceled', 'health_link_schedule_mismatch_prompted'
));

-- ============================================================================
-- 14. DB invariant: health_profile reminders must have an active link row,
--     and general reminders cannot be linked into Health.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_health_medication_link_source_context()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_source_context text;
BEGIN
  -- The linked reminder must be a health_profile reminder
  SELECT source_context INTO v_source_context
  FROM ultaura_reminders
  WHERE id = new.reminder_id;

  IF v_source_context IS NULL THEN
    RAISE EXCEPTION 'health medication reminder link references non-existent reminder %', new.reminder_id;
  END IF;

  IF v_source_context <> 'health_profile' THEN
    RAISE EXCEPTION 'cannot link a general reminder into Health — reminder % has source_context=%', new.reminder_id, v_source_context;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_health_link_source_context ON ultaura_health_medication_reminders;
CREATE TRIGGER trg_enforce_health_link_source_context
BEFORE INSERT OR UPDATE ON ultaura_health_medication_reminders
FOR EACH ROW EXECUTE FUNCTION enforce_health_medication_link_source_context();

-- ============================================================================
-- 15. Row-locking helper for pause_sources mutations (spec Section 7.12)
-- ============================================================================

CREATE OR REPLACE FUNCTION lock_reminder_for_update(p_reminder_id uuid)
RETURNS TABLE(
  id uuid,
  status text,
  source_context text,
  pause_sources text[],
  is_paused boolean,
  line_id uuid,
  account_id uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.status::text, r.source_context, r.pause_sources::text[],
         r.is_paused, r.line_id, r.account_id
  FROM ultaura_reminders r
  WHERE r.id = p_reminder_id
  FOR UPDATE;
$$;
