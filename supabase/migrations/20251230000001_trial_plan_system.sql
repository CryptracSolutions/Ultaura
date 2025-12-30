-- Trial Plan System Migration
-- Convert Ultaura trial from minute-based free_trial to 3-day time-based trial on chosen plan

-- ============================================
-- ULTAURA ACCOUNTS: TRIAL METADATA
-- ============================================

alter table ultaura_accounts
  add column if not exists trial_plan_id text,
  add column if not exists trial_starts_at timestamptz,
  add column if not exists trial_ends_at timestamptz;

create index if not exists idx_ultaura_accounts_trial_ends
  on ultaura_accounts(trial_ends_at)
  where status = 'trial' and trial_ends_at is not null;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if a trial is active for an account
create or replace function is_ultaura_trial_active(p_account_id uuid)
returns boolean
language sql
stable
as $$
  select coalesce((
    select
      a.status = 'trial'
      and a.trial_ends_at is not null
      and now() < a.trial_ends_at
    from ultaura_accounts a
    where a.id = p_account_id
  ), false)
$$;

