-- Track explicit dashboard-sharing membership ownership on notification recipients
-- so revocation/removal can clean up by stable identifiers.

ALTER TABLE ultaura_notification_recipients
ADD COLUMN IF NOT EXISTS dashboard_access_membership_id bigint REFERENCES memberships(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS dashboard_access_user_id uuid,
ADD COLUMN IF NOT EXISTS dashboard_access_invited_email text;

COMMENT ON COLUMN ultaura_notification_recipients.dashboard_access_membership_id IS
'Membership row created by dashboard-sharing grant flow. Null when no owned membership exists.';

COMMENT ON COLUMN ultaura_notification_recipients.dashboard_access_user_id IS
'Auth user id linked during dashboard-sharing grant when membership is user-based.';

COMMENT ON COLUMN ultaura_notification_recipients.dashboard_access_invited_email IS
'Normalized invited email linked during dashboard-sharing grant when membership is invite-based.';
