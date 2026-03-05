-- =============================================================
-- Dashboard Sharing: schema changes, functions, and RLS policies
-- =============================================================

ALTER TABLE ultaura_notification_recipients
ADD COLUMN IF NOT EXISTS dashboard_access_granted_at timestamptz;

COMMENT ON COLUMN ultaura_notification_recipients.dashboard_access_granted_at IS
'Timestamp when dashboard sharing was granted. NULL means not granted.';

CREATE INDEX IF NOT EXISTS idx_notification_recipients_dashboard_access
ON ultaura_notification_recipients(account_id)
WHERE dashboard_access_granted_at IS NOT NULL;

CREATE OR REPLACE FUNCTION is_dashboard_viewer(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
SELECT EXISTS (
  SELECT 1
  FROM memberships m
  JOIN ultaura_accounts ua ON ua.organization_id = m.organization_id
  WHERE ua.id = p_account_id
    AND m.user_id = auth.uid()
    AND m.role = -1
);
$$;

CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
STABLE
AS $$
SELECT id
FROM auth.users
WHERE email = lower(trim(lookup_email))
LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION get_auth_user_id_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_auth_user_id_by_email(text) TO service_role;

-- Core restrictive write policies for dashboard viewers
CREATE POLICY "Dashboard viewers cannot modify accounts"
ON ultaura_accounts AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(id));

CREATE POLICY "Dashboard viewers cannot insert lines"
ON ultaura_lines AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update lines"
ON ultaura_lines AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete lines"
ON ultaura_lines AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert schedules"
ON ultaura_schedules AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update schedules"
ON ultaura_schedules AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete schedules"
ON ultaura_schedules AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert reminders"
ON ultaura_reminders AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update reminders"
ON ultaura_reminders AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete reminders"
ON ultaura_reminders AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert recipients"
ON ultaura_notification_recipients AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update recipients"
ON ultaura_notification_recipients AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete recipients"
ON ultaura_notification_recipients AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert contacts"
ON ultaura_trusted_contacts AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update contacts"
ON ultaura_trusted_contacts AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete contacts"
ON ultaura_trusted_contacts AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert milestones"
ON ultaura_milestones AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update milestones"
ON ultaura_milestones AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete milestones"
ON ultaura_milestones AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update privacy settings"
ON ultaura_account_privacy_settings AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert privacy settings"
ON ultaura_account_privacy_settings AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert consents"
ON ultaura_consents AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert notification prefs"
ON ultaura_notification_preferences AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update notification prefs"
ON ultaura_notification_preferences AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete notification prefs"
ON ultaura_notification_preferences AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert schedule exceptions"
ON ultaura_schedule_exceptions AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update schedule exceptions"
ON ultaura_schedule_exceptions AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete schedule exceptions"
ON ultaura_schedule_exceptions AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update insight privacy"
ON ultaura_insight_privacy AS RESTRICTIVE
FOR UPDATE
USING (
  NOT is_dashboard_viewer((SELECT account_id FROM ultaura_lines WHERE id = ultaura_insight_privacy.line_id))
);

CREATE POLICY "Dashboard viewers cannot insert export requests"
ON ultaura_data_export_requests AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert life chapters"
ON ultaura_life_chapters AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update life chapters"
ON ultaura_life_chapters AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete life chapters"
ON ultaura_life_chapters AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert wellness alerts"
ON ultaura_wellness_alerts AS RESTRICTIVE
FOR INSERT
WITH CHECK (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot update wellness alerts"
ON ultaura_wellness_alerts AS RESTRICTIVE
FOR UPDATE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot delete wellness alerts"
ON ultaura_wellness_alerts AS RESTRICTIVE
FOR DELETE
USING (NOT is_dashboard_viewer(account_id));

CREATE POLICY "Dashboard viewers cannot insert accessibility settings"
ON ultaura_accessibility_settings AS RESTRICTIVE
FOR INSERT
WITH CHECK (
  NOT is_dashboard_viewer(
    (
      SELECT account_id
      FROM ultaura_lines
      WHERE id = ultaura_accessibility_settings.line_id
    )
  )
);

CREATE POLICY "Dashboard viewers cannot update accessibility settings"
ON ultaura_accessibility_settings AS RESTRICTIVE
FOR UPDATE
USING (
  NOT is_dashboard_viewer(
    (
      SELECT account_id
      FROM ultaura_lines
      WHERE id = ultaura_accessibility_settings.line_id
    )
  )
);

CREATE POLICY "Dashboard viewers cannot delete accessibility settings"
ON ultaura_accessibility_settings AS RESTRICTIVE
FOR DELETE
USING (
  NOT is_dashboard_viewer(
    (
      SELECT account_id
      FROM ultaura_lines
      WHERE id = ultaura_accessibility_settings.line_id
    )
  )
);
