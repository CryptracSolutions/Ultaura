-- Migration: recipient_line_assignments
-- Maps notification recipients to specific lines they should receive alerts for.
-- Enables line-scoped notifications so multi-family accounts don't leak data.

-- 1a. Junction table
CREATE TABLE IF NOT EXISTS ultaura_recipient_line_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL
    REFERENCES ultaura_notification_recipients(id) ON DELETE CASCADE,
  line_id uuid NOT NULL
    REFERENCES ultaura_lines(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recipient_line UNIQUE (recipient_id, line_id)
);

COMMENT ON TABLE ultaura_recipient_line_assignments IS
  'Maps notification recipients to specific lines they should receive alerts for.';

-- The unique constraint already creates an index on (recipient_id, line_id).
-- Only add an index on line_id for alert fanout lookups.
CREATE INDEX idx_rla_line_id
  ON ultaura_recipient_line_assignments(line_id);

-- 1b. RLS policies
ALTER TABLE ultaura_recipient_line_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view line assignments for their accounts"
  ON ultaura_recipient_line_assignments FOR SELECT
  USING (
    recipient_id IN (
      SELECT nr.id FROM ultaura_notification_recipients nr
      WHERE can_access_ultaura_account(nr.account_id)
    )
  );

-- INSERT/DELETE: require membership AND exclude dashboard viewers (role -1)
-- Both checks in one permissive policy — no fragile restrictive policy dependency.
CREATE POLICY "Account owners can insert line assignments"
  ON ultaura_recipient_line_assignments FOR INSERT
  WITH CHECK (
    recipient_id IN (
      SELECT nr.id FROM ultaura_notification_recipients nr
      WHERE can_access_ultaura_account(nr.account_id)
        AND NOT is_dashboard_viewer(nr.account_id)
    )
  );

CREATE POLICY "Account owners can delete line assignments"
  ON ultaura_recipient_line_assignments FOR DELETE
  USING (
    recipient_id IN (
      SELECT nr.id FROM ultaura_notification_recipients nr
      WHERE can_access_ultaura_account(nr.account_id)
        AND NOT is_dashboard_viewer(nr.account_id)
    )
  );

-- 1c. Backfill existing recipients
INSERT INTO ultaura_recipient_line_assignments (recipient_id, line_id)
SELECT nr.id, ul.id
FROM ultaura_notification_recipients nr
JOIN ultaura_lines ul ON ul.account_id = nr.account_id
WHERE nr.unsubscribed_at IS NULL
ON CONFLICT (recipient_id, line_id) DO NOTHING;

-- 1d. Orphan cleanup trigger on ultaura_lines
-- Fires AFTER a line is deleted. CASCADE already removed junction rows.
-- Finds any active recipients on the account with zero remaining assignments
-- and auto-unsubscribes them.
CREATE OR REPLACE FUNCTION cleanup_orphaned_recipients_after_line_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ultaura_notification_recipients
  SET unsubscribed_at = now(), updated_at = now()
  WHERE account_id = OLD.account_id
    AND unsubscribed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM ultaura_recipient_line_assignments
      WHERE recipient_id = ultaura_notification_recipients.id
    );
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_cleanup_orphaned_recipients_after_line_delete
  AFTER DELETE ON ultaura_lines
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_orphaned_recipients_after_line_delete();

-- 1e. Viewer line-access function
CREATE OR REPLACE FUNCTION get_viewer_assigned_line_ids(p_account_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT DISTINCT rla.line_id
  FROM ultaura_recipient_line_assignments rla
  JOIN ultaura_notification_recipients nr ON nr.id = rla.recipient_id
  WHERE nr.account_id = p_account_id
    AND nr.unsubscribed_at IS NULL
    AND nr.dashboard_access_user_id = (SELECT auth.uid())
    AND nr.dashboard_access_granted_at IS NOT NULL;
$$;

-- 1f. RLS on ultaura_lines for viewer scoping
DROP POLICY IF EXISTS "Users can view lines for their accounts" ON ultaura_lines;

CREATE POLICY "Users can view lines for their accounts"
  ON ultaura_lines FOR SELECT
  USING (
    can_access_ultaura_account(account_id)
    AND (
      NOT is_dashboard_viewer(account_id)
      OR id IN (SELECT get_viewer_assigned_line_ids(account_id))
    )
  );
