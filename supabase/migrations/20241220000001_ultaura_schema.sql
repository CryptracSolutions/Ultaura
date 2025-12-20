-- Ultaura Schema Migration
-- AI Voice Companion Service

-- ============================================
-- ENUMS
-- ============================================

create type ultaura_account_status as enum ('trial', 'active', 'past_due', 'canceled');
create type ultaura_line_status as enum ('active', 'paused', 'disabled');
create type ultaura_call_status as enum ('created', 'ringing', 'in_progress', 'completed', 'failed', 'canceled');
create type ultaura_call_direction as enum ('inbound', 'outbound');
create type ultaura_billable_type as enum ('trial', 'included', 'overage', 'payg');
create type ultaura_schedule_result as enum ('success', 'missed', 'suppressed_quiet_hours', 'failed');
create type ultaura_reminder_status as enum ('scheduled', 'sent', 'missed', 'canceled');
create type ultaura_privacy_scope as enum ('line_only', 'shareable_with_payer');
create type ultaura_memory_type as enum ('fact', 'preference', 'follow_up');
create type ultaura_safety_tier as enum ('low', 'medium', 'high');
create type ultaura_consent_type as enum ('outbound_calls', 'trusted_contact_notify', 'sms_to_payer', 'data_retention');
create type ultaura_opt_out_channel as enum ('outbound_calls', 'sms', 'all');
create type ultaura_call_end_reason as enum ('hangup', 'no_answer', 'busy', 'trial_cap', 'minutes_cap', 'error');

-- ============================================
-- PLANS (Reference table)
-- ============================================

create table ultaura_plans (
  id text primary key,
  display_name text not null,
  monthly_price_cents int not null default 0,
  annual_price_cents int not null default 0,
  minutes_included int not null default 0,
  lines_included int not null default 1,
  overage_rate_cents_per_min int not null default 15,
  created_at timestamptz not null default now()
);

-- Insert plan data
insert into ultaura_plans (id, display_name, monthly_price_cents, annual_price_cents, minutes_included, lines_included, overage_rate_cents_per_min) values
  ('free_trial', 'Free Trial', 0, 0, 20, 1, 0),
  ('care', 'Care', 4000, 40000, 300, 1, 15),
  ('comfort', 'Comfort', 10000, 100000, 900, 2, 15),
  ('family', 'Family', 20000, 200000, 2000, 4, 15),
  ('payg', 'Pay As You Go', 0, 0, 0, 4, 15);

-- ============================================
-- ULTAURA ACCOUNTS
-- ============================================

create table ultaura_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id bigint not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  billing_email text not null,
  default_locale text not null default 'en-US',
  status ultaura_account_status not null default 'trial',
  plan_id text references ultaura_plans(id) default 'free_trial',
  minutes_included int not null default 20,
  minutes_used int not null default 0,
  cycle_start timestamptz,
  cycle_end timestamptz,
  overage_cents_cap int not null default 10000,
  created_by_user_id uuid references public.users(id)
);

create index idx_ultaura_accounts_organization on ultaura_accounts(organization_id);
create index idx_ultaura_accounts_status on ultaura_accounts(status);
create index idx_ultaura_accounts_cycle_end on ultaura_accounts(cycle_end);

-- ============================================
-- LINES (Phone numbers / profiles)
-- ============================================

create table ultaura_lines (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  display_name text not null,
  phone_e164 text not null unique,
  phone_verified_at timestamptz,
  status ultaura_line_status not null default 'paused',
  preferred_language text not null default 'auto' check (preferred_language in ('auto', 'en', 'es')),
  spanish_formality text not null default 'usted' check (spanish_formality in ('usted', 'tu')),
  timezone text not null default 'America/Los_Angeles',
  quiet_hours_start time not null default '21:00',
  quiet_hours_end time not null default '09:00',
  do_not_call boolean not null default false,
  inbound_allowed boolean not null default true,
  last_successful_call_at timestamptz,
  next_scheduled_call_at timestamptz,
  seed_interests text[],
  seed_avoid_topics text[]
);

create unique index idx_ultaura_lines_phone on ultaura_lines(phone_e164);
create index idx_ultaura_lines_account_status on ultaura_lines(account_id, status);
create index idx_ultaura_lines_account_next_call on ultaura_lines(account_id, next_scheduled_call_at);

-- ============================================
-- SUBSCRIPTIONS (Stripe-backed)
-- ============================================

create table ultaura_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  plan_id text references ultaura_plans(id),
  billing_interval text check (billing_interval in ('month', 'year')),
  status text not null default 'trialing' check (status in ('trialing', 'active', 'past_due', 'canceled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false
);

create index idx_ultaura_subscriptions_account on ultaura_subscriptions(account_id, status);
create unique index idx_ultaura_subscriptions_stripe on ultaura_subscriptions(stripe_subscription_id);

-- ============================================
-- MINUTE LEDGER (Authoritative usage)
-- ============================================

create table ultaura_minute_ledger (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  call_session_id uuid not null,
  created_at timestamptz not null default now(),
  cycle_start timestamptz,
  cycle_end timestamptz,
  seconds_connected int not null,
  billable_minutes int not null,
  direction ultaura_call_direction not null,
  billable_type ultaura_billable_type not null,
  stripe_usage_reported boolean not null default false,
  stripe_usage_record_id text,
  idempotency_key text not null unique
);

create index idx_ultaura_ledger_account_created on ultaura_minute_ledger(account_id, created_at);
create index idx_ultaura_ledger_stripe_reported on ultaura_minute_ledger(account_id, stripe_usage_reported);

-- ============================================
-- CALL SESSIONS
-- ============================================

create table ultaura_call_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  direction ultaura_call_direction not null,
  status ultaura_call_status not null default 'created',
  started_at timestamptz,
  connected_at timestamptz,
  ended_at timestamptz,
  seconds_connected int,
  twilio_call_sid text unique,
  twilio_from text,
  twilio_to text,
  end_reason ultaura_call_end_reason,
  language_detected text,
  tool_invocations int not null default 0,
  cost_estimate_cents_twilio int,
  cost_estimate_cents_model int
);

create index idx_ultaura_sessions_account_created on ultaura_call_sessions(account_id, created_at desc);
create index idx_ultaura_sessions_line_created on ultaura_call_sessions(line_id, created_at desc);
create unique index idx_ultaura_sessions_twilio_sid on ultaura_call_sessions(twilio_call_sid);

-- ============================================
-- CALL EVENTS (Minimal, no transcripts)
-- ============================================

create table ultaura_call_events (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references ultaura_call_sessions(id) on delete cascade,
  created_at timestamptz not null default now(),
  type text not null check (type in ('dtmf', 'tool_call', 'state_change', 'error', 'safety_tier')),
  payload jsonb
);

create index idx_ultaura_events_session_created on ultaura_call_events(call_session_id, created_at);

-- ============================================
-- SCHEDULES
-- ============================================

create table ultaura_schedules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  enabled boolean not null default true,
  timezone text not null,
  rrule text not null,
  days_of_week int[] not null default '{}',
  time_of_day time not null default '18:00',
  next_run_at timestamptz,
  retry_policy jsonb not null default '{"max_retries": 2, "retry_window_minutes": 30}',
  last_run_at timestamptz,
  last_result ultaura_schedule_result
);

create index idx_ultaura_schedules_enabled_next on ultaura_schedules(enabled, next_run_at);
create index idx_ultaura_schedules_line on ultaura_schedules(line_id, enabled);

-- ============================================
-- REMINDERS
-- ============================================

create table ultaura_reminders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  due_at timestamptz not null,
  timezone text not null,
  message text not null,
  delivery_method text not null default 'outbound_call',
  status ultaura_reminder_status not null default 'scheduled',
  privacy_scope ultaura_privacy_scope not null default 'line_only',
  created_by_call_session_id uuid references ultaura_call_sessions(id)
);

create index idx_ultaura_reminders_status_due on ultaura_reminders(status, due_at);
create index idx_ultaura_reminders_line on ultaura_reminders(line_id, status);

-- ============================================
-- ACCOUNT CRYPTO KEYS (for memory encryption)
-- ============================================

create table ultaura_account_crypto_keys (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade unique,
  created_at timestamptz not null default now(),
  dek_wrapped bytea not null,
  dek_wrap_iv bytea not null,
  dek_wrap_tag bytea not null,
  dek_kid text not null default 'kek_v1',
  dek_alg text not null default 'AES-256-GCM',
  rotated_at timestamptz
);

create unique index idx_ultaura_crypto_keys_account on ultaura_account_crypto_keys(account_id);

-- ============================================
-- MEMORIES (Encrypted at rest)
-- ============================================

create table ultaura_memories (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  type ultaura_memory_type not null,
  key text not null,
  value_ciphertext bytea not null,
  value_iv bytea not null,
  value_tag bytea not null,
  value_alg text not null default 'AES-256-GCM',
  value_kid text not null,
  confidence numeric check (confidence >= 0 and confidence <= 1),
  source text check (source in ('onboarding', 'conversation', 'caregiver_seed')),
  version int not null default 1,
  active boolean not null default true,
  privacy_scope ultaura_privacy_scope not null default 'line_only',
  redaction_level text not null default 'none' check (redaction_level in ('none', 'low', 'high'))
);

create index idx_ultaura_memories_line_active on ultaura_memories(line_id, active);
create index idx_ultaura_memories_line_type on ultaura_memories(line_id, type, key);
create index idx_ultaura_memories_account_line on ultaura_memories(account_id, line_id);

-- ============================================
-- CONSENTS
-- ============================================

create table ultaura_consents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  type ultaura_consent_type not null,
  granted boolean not null,
  granted_by text not null check (granted_by in ('payer_ack', 'line_voice')),
  evidence jsonb,
  revoked_at timestamptz
);

create index idx_ultaura_consents_line_type on ultaura_consents(line_id, type, granted);

-- ============================================
-- OPT-OUTS
-- ============================================

create table ultaura_opt_outs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  channel ultaura_opt_out_channel not null,
  reason text,
  source text not null check (source in ('dtmf', 'voice', 'dashboard')),
  call_session_id uuid references ultaura_call_sessions(id)
);

create index idx_ultaura_opt_outs_line on ultaura_opt_outs(line_id, channel);

-- ============================================
-- TRUSTED CONTACTS
-- ============================================

create table ultaura_trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  relationship text,
  phone_e164 text not null,
  notify_on text[] not null default '{}',
  enabled boolean not null default true
);

create index idx_ultaura_trusted_contacts_line on ultaura_trusted_contacts(line_id, enabled);

-- ============================================
-- SAFETY EVENTS
-- ============================================

create table ultaura_safety_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  tier ultaura_safety_tier not null,
  signals jsonb,
  action_taken text check (action_taken in ('none', 'suggested_988', 'suggested_911', 'notified_contact', 'transferred_call'))
);

create index idx_ultaura_safety_events_line on ultaura_safety_events(line_id, created_at desc);
create index idx_ultaura_safety_events_tier on ultaura_safety_events(tier, created_at desc);

-- ============================================
-- PHONE VERIFICATION (for Twilio Verify)
-- ============================================

create table ultaura_phone_verifications (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  channel text not null check (channel in ('sms', 'call')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'canceled', 'expired')),
  twilio_verification_sid text
);

create index idx_ultaura_phone_verifications_line on ultaura_phone_verifications(line_id, status);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table ultaura_plans enable row level security;
alter table ultaura_accounts enable row level security;
alter table ultaura_lines enable row level security;
alter table ultaura_subscriptions enable row level security;
alter table ultaura_minute_ledger enable row level security;
alter table ultaura_call_sessions enable row level security;
alter table ultaura_call_events enable row level security;
alter table ultaura_schedules enable row level security;
alter table ultaura_reminders enable row level security;
alter table ultaura_account_crypto_keys enable row level security;
alter table ultaura_memories enable row level security;
alter table ultaura_consents enable row level security;
alter table ultaura_opt_outs enable row level security;
alter table ultaura_trusted_contacts enable row level security;
alter table ultaura_safety_events enable row level security;
alter table ultaura_phone_verifications enable row level security;

-- Plans are readable by anyone
create policy "Plans are readable by anyone" on ultaura_plans for select using (true);

-- Helper function to get Ultaura account IDs for authenticated user
create or replace function get_ultaura_accounts_for_user()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select ua.id
  from ultaura_accounts ua
  join memberships m on m.organization_id = ua.organization_id
  where m.user_id = auth.uid()
$$;

-- Helper function to check if user can access an account
create or replace function can_access_ultaura_account(account_id uuid)
returns boolean
language plpgsql
as $$
begin
  return account_id in (select get_ultaura_accounts_for_user());
end;
$$;

-- Accounts: users can only see accounts for their organizations
create policy "Users can view their organization's Ultaura accounts"
  on ultaura_accounts for select
  using (can_access_ultaura_account(id));

create policy "Users can update their organization's Ultaura accounts"
  on ultaura_accounts for update
  using (can_access_ultaura_account(id));

-- Lines: users can only see lines for their accounts
create policy "Users can view lines for their accounts"
  on ultaura_lines for select
  using (can_access_ultaura_account(account_id));

create policy "Users can insert lines for their accounts"
  on ultaura_lines for insert
  with check (can_access_ultaura_account(account_id));

create policy "Users can update lines for their accounts"
  on ultaura_lines for update
  using (can_access_ultaura_account(account_id));

create policy "Users can delete lines for their accounts"
  on ultaura_lines for delete
  using (can_access_ultaura_account(account_id));

-- Subscriptions
create policy "Users can view subscriptions for their accounts"
  on ultaura_subscriptions for select
  using (can_access_ultaura_account(account_id));

-- Minute ledger
create policy "Users can view ledger for their accounts"
  on ultaura_minute_ledger for select
  using (can_access_ultaura_account(account_id));

-- Call sessions
create policy "Users can view call sessions for their accounts"
  on ultaura_call_sessions for select
  using (can_access_ultaura_account(account_id));

-- Call events
create policy "Users can view call events for their accounts"
  on ultaura_call_events for select
  using (
    call_session_id in (
      select id from ultaura_call_sessions where can_access_ultaura_account(account_id)
    )
  );

-- Schedules
create policy "Users can view schedules for their accounts"
  on ultaura_schedules for select
  using (can_access_ultaura_account(account_id));

create policy "Users can insert schedules for their accounts"
  on ultaura_schedules for insert
  with check (can_access_ultaura_account(account_id));

create policy "Users can update schedules for their accounts"
  on ultaura_schedules for update
  using (can_access_ultaura_account(account_id));

create policy "Users can delete schedules for their accounts"
  on ultaura_schedules for delete
  using (can_access_ultaura_account(account_id));

-- Reminders
create policy "Users can view reminders for their accounts"
  on ultaura_reminders for select
  using (can_access_ultaura_account(account_id));

-- Crypto keys - never expose to users, only service role
-- No policies created intentionally

-- Memories - never expose to users in dashboard, only service role
-- No policies created intentionally

-- Consents
create policy "Users can view consents for their accounts"
  on ultaura_consents for select
  using (can_access_ultaura_account(account_id));

create policy "Users can insert consents for their accounts"
  on ultaura_consents for insert
  with check (can_access_ultaura_account(account_id));

-- Opt-outs
create policy "Users can view opt-outs for their accounts"
  on ultaura_opt_outs for select
  using (can_access_ultaura_account(account_id));

-- Trusted contacts
create policy "Users can view trusted contacts for their accounts"
  on ultaura_trusted_contacts for select
  using (can_access_ultaura_account(account_id));

create policy "Users can insert trusted contacts for their accounts"
  on ultaura_trusted_contacts for insert
  with check (can_access_ultaura_account(account_id));

create policy "Users can update trusted contacts for their accounts"
  on ultaura_trusted_contacts for update
  using (can_access_ultaura_account(account_id));

create policy "Users can delete trusted contacts for their accounts"
  on ultaura_trusted_contacts for delete
  using (can_access_ultaura_account(account_id));

-- Safety events - minimal access for privacy
create policy "Users can view safety events for their accounts"
  on ultaura_safety_events for select
  using (can_access_ultaura_account(account_id));

-- Phone verifications
create policy "Users can view phone verifications for their accounts"
  on ultaura_phone_verifications for select
  using (
    line_id in (
      select id from ultaura_lines where can_access_ultaura_account(account_id)
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get minutes remaining for an account
create or replace function get_ultaura_minutes_remaining(p_account_id uuid)
returns int
language sql
stable
as $$
  select greatest(
    coalesce(a.minutes_included, 0) - coalesce(
      (select sum(billable_minutes) from ultaura_minute_ledger
       where account_id = p_account_id
       and created_at >= a.cycle_start
       and created_at < a.cycle_end), 0
    )::int, 0
  )
  from ultaura_accounts a
  where a.id = p_account_id
$$;

-- Get usage summary for an account
create or replace function get_ultaura_usage_summary(p_account_id uuid)
returns table(
  minutes_included int,
  minutes_used int,
  minutes_remaining int,
  overage_minutes int,
  cycle_start timestamptz,
  cycle_end timestamptz
)
language sql
stable
as $$
  select
    a.minutes_included,
    coalesce((select sum(billable_minutes) from ultaura_minute_ledger
       where account_id = p_account_id
       and created_at >= a.cycle_start
       and created_at < a.cycle_end), 0)::int as minutes_used,
    greatest(a.minutes_included - coalesce(
      (select sum(billable_minutes) from ultaura_minute_ledger
       where account_id = p_account_id
       and created_at >= a.cycle_start
       and created_at < a.cycle_end), 0
    )::int, 0) as minutes_remaining,
    greatest(coalesce(
      (select sum(billable_minutes) from ultaura_minute_ledger
       where account_id = p_account_id
       and created_at >= a.cycle_start
       and created_at < a.cycle_end), 0
    )::int - a.minutes_included, 0) as overage_minutes,
    a.cycle_start,
    a.cycle_end
  from ultaura_accounts a
  where a.id = p_account_id
$$;

-- Create an Ultaura account for an organization
create or replace function create_ultaura_account(
  p_organization_id bigint,
  p_name text,
  p_billing_email text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_account_id uuid;
begin
  insert into ultaura_accounts (organization_id, name, billing_email, created_by_user_id, cycle_start, cycle_end)
  values (p_organization_id, p_name, p_billing_email, p_user_id, now(), now() + interval '30 days')
  returning id into v_account_id;

  return v_account_id;
end;
$$;

-- Update account usage (to be called by service role)
create or replace function update_ultaura_account_usage(p_account_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update ultaura_accounts
  set minutes_used = (
    select coalesce(sum(billable_minutes), 0)
    from ultaura_minute_ledger
    where account_id = p_account_id
    and created_at >= ultaura_accounts.cycle_start
    and created_at < ultaura_accounts.cycle_end
  )
  where id = p_account_id;
end;
$$;
