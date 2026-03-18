-- Performance: wrap auth.*() calls in RLS policies with (select ...) to prevent
-- per-row re-evaluation, and drop duplicate indexes.
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan
-- See: https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index

-- ============================================
-- 1. RLS initplan fixes — auth.uid() policies
-- ============================================

-- subscriptions: "Subscriptions can only be selectable by members that belong to\n  the organization"
DROP POLICY IF EXISTS "Subscriptions can only be selectable by members that belong to
  the organization" ON subscriptions;
CREATE POLICY "Subscriptions can only be selectable by members that belong to the organization"
  ON subscriptions FOR SELECT
  USING (EXISTS (
    SELECT 1
    FROM memberships
    JOIN organizations_subscriptions ON organizations_subscriptions.organization_id = memberships.organization_id
    WHERE memberships.organization_id = organizations_subscriptions.organization_id
      AND subscriptions.id = organizations_subscriptions.subscription_id
      AND memberships.user_id = (select auth.uid())
  ));

-- users: select
DROP POLICY IF EXISTS "Users can select data to their records" ON users;
CREATE POLICY "Users can select data to their records"
  ON users AS PERMISSIVE FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

-- users: update
DROP POLICY IF EXISTS "Users can update data to only their records" ON users;
CREATE POLICY "Users can update data to only their records"
  ON users AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- organizations_subscriptions: select
DROP POLICY IF EXISTS "Users can read subscriptions if they belong to the organization" ON organizations_subscriptions;
CREATE POLICY "Users can read subscriptions if they belong to the organization"
  ON organizations_subscriptions AS PERMISSIVE FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.user_id = (select auth.uid())
      AND organizations_subscriptions.organization_id = memberships.organization_id
  ));

-- ultaura_changelog_dismissals: select
DROP POLICY IF EXISTS "Users can view their own changelog dismissals" ON ultaura_changelog_dismissals;
CREATE POLICY "Users can view their own changelog dismissals"
  ON ultaura_changelog_dismissals FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- ultaura_changelog_dismissals: insert
DROP POLICY IF EXISTS "Users can insert their own changelog dismissals" ON ultaura_changelog_dismissals;
CREATE POLICY "Users can insert their own changelog dismissals"
  ON ultaura_changelog_dismissals FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- ultaura_changelog_dismissals: update
DROP POLICY IF EXISTS "Users can update their own changelog dismissals" ON ultaura_changelog_dismissals;
CREATE POLICY "Users can update their own changelog dismissals"
  ON ultaura_changelog_dismissals FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================
-- 2. RLS initplan fixes — auth.role() policies
-- ============================================

-- ultaura_reminder_events
DROP POLICY IF EXISTS "Service role has full access to reminder events" ON ultaura_reminder_events;
CREATE POLICY "Service role has full access to reminder events"
  ON ultaura_reminder_events FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ultaura_scheduler_leases
DROP POLICY IF EXISTS "Service role full access to scheduler leases" ON ultaura_scheduler_leases;
CREATE POLICY "Service role full access to scheduler leases"
  ON ultaura_scheduler_leases FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ultaura_debug_logs: insert
DROP POLICY IF EXISTS "Service role can insert debug logs" ON ultaura_debug_logs;
CREATE POLICY "Service role can insert debug logs"
  ON ultaura_debug_logs FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- ultaura_debug_logs: delete
DROP POLICY IF EXISTS "Service role can delete debug logs" ON ultaura_debug_logs;
CREATE POLICY "Service role can delete debug logs"
  ON ultaura_debug_logs FOR DELETE
  USING ((select auth.role()) = 'service_role');

-- ultaura_debug_logs: super-admin select
DROP POLICY IF EXISTS "Super-admins can view debug logs" ON ultaura_debug_logs;
CREATE POLICY "Super-admins can view debug logs"
  ON ultaura_debug_logs FOR SELECT TO authenticated
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'super-admin');

-- ultaura_schedule_exceptions
DROP POLICY IF EXISTS "Service role has full access" ON ultaura_schedule_exceptions;
CREATE POLICY "Service role has full access"
  ON ultaura_schedule_exceptions FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ultaura_schedule_events
DROP POLICY IF EXISTS "Service role has full access" ON ultaura_schedule_events;
CREATE POLICY "Service role has full access"
  ON ultaura_schedule_events FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ultaura_trial_daily_cap_reservations
DROP POLICY IF EXISTS "Service role has full access to trial cap reservations" ON ultaura_trial_daily_cap_reservations;
CREATE POLICY "Service role has full access to trial cap reservations"
  ON ultaura_trial_daily_cap_reservations FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ultaura_onboarding_state
DROP POLICY IF EXISTS "Service role full access to onboarding state" ON ultaura_onboarding_state;
CREATE POLICY "Service role full access to onboarding state"
  ON ultaura_onboarding_state FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ultaura_rate_limit_events: super-admin select
DROP POLICY IF EXISTS "Super-admins can view rate limit events" ON ultaura_rate_limit_events;
CREATE POLICY "Super-admins can view rate limit events"
  ON ultaura_rate_limit_events FOR SELECT TO authenticated
  USING ((select auth.jwt()) -> 'app_metadata' ->> 'role' = 'super-admin');

-- ============================================
-- 3. Drop duplicate indexes
-- ============================================
-- In each case, the UNIQUE column constraint already created an implicit index.
-- The explicit CREATE UNIQUE INDEX is redundant.

DROP INDEX IF EXISTS idx_ultaura_crypto_keys_account;
DROP INDEX IF EXISTS idx_ultaura_sessions_twilio_sid;
DROP INDEX IF EXISTS idx_line_crypto_keys_line;
DROP INDEX IF EXISTS idx_ultaura_lines_phone;
DROP INDEX IF EXISTS idx_ultaura_subscriptions_stripe;
