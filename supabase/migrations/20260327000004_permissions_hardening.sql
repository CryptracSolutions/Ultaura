-- Permissions hardening for life chapters and wellness alerts

-- Helper: self-only access for self-managed accounts
create or replace function can_access_self_account(account_id uuid)
returns boolean
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  return account_id in (
    select id
    from ultaura_accounts
    where created_by_user_id = auth.uid()
      and user_type = 'self'
  )
  and can_access_ultaura_account(account_id);
end;
$$;

-- ============================================
-- Life chapters (self-only for dashboard users)
-- ============================================
drop policy if exists "Users can view life chapters for their accounts" on ultaura_life_chapters;
drop policy if exists "Users can insert life chapters for their accounts" on ultaura_life_chapters;
drop policy if exists "Users can update life chapters for their accounts" on ultaura_life_chapters;
drop policy if exists "Users can delete life chapters for their accounts" on ultaura_life_chapters;

create policy "Self users can view life chapters for their accounts"
  on ultaura_life_chapters for select
  using (can_access_self_account(account_id));

create policy "Self users can insert life chapters for their accounts"
  on ultaura_life_chapters for insert
  with check (can_access_self_account(account_id));

create policy "Self users can update life chapters for their accounts"
  on ultaura_life_chapters for update
  using (can_access_self_account(account_id));

create policy "Self users can delete life chapters for their accounts"
  on ultaura_life_chapters for delete
  using (can_access_self_account(account_id));

-- ============================================
-- Wellness alerts (service-role writes only)
-- ============================================
drop policy if exists "Users can view wellness alerts for their accounts" on ultaura_wellness_alerts;
drop policy if exists "Users can insert wellness alerts for their accounts" on ultaura_wellness_alerts;
drop policy if exists "Users can update wellness alerts for their accounts" on ultaura_wellness_alerts;
drop policy if exists "Users can delete wellness alerts for their accounts" on ultaura_wellness_alerts;

create policy "Users can view wellness alerts for their accounts"
  on ultaura_wellness_alerts for select
  using (can_access_ultaura_account(account_id));
