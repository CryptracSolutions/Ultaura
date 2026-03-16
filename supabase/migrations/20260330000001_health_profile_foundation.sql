-- =============================================================
-- Health Profile Foundation Migration
-- Creates all enums, helper functions, tables, indexes, RLS
-- policies, triggers, and backfill for the Health Profile v1
-- feature. Section references correspond to specs/health-profile.md.
-- =============================================================

-- =============================================================
-- SECTION 7.1B: Runtime Feature Flag Table
-- =============================================================

create table if not exists ultaura_runtime_feature_flags (
  flag_key text primary key,
  enabled boolean not null,
  updated_at timestamptz not null default now()
);

alter table ultaura_runtime_feature_flags enable row level security;

-- No browser-facing RLS policies for this table (intentional).

create or replace function is_runtime_feature_enabled(target_flag_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select enabled
     from ultaura_runtime_feature_flags
     where flag_key = target_flag_key),
    false
  );
$$;

-- Seed the health_profile flag as disabled (fail closed).
insert into ultaura_runtime_feature_flags (flag_key, enabled)
values ('health_profile', false)
on conflict (flag_key) do nothing;

-- =============================================================
-- SECTION 7.2: Consent Enums
-- =============================================================

create type ultaura_health_consent_status as enum (
  'not_requested',
  'granted',
  'denied',
  'revoked'
);

create type ultaura_health_consent_event_type as enum (
  'owner_request',
  'spoken_prompt',
  'spoken_decision',
  'self_service_decision'
);

-- =============================================================
-- SECTION 7.6: Conditions Enum
-- =============================================================

create type ultaura_health_condition_status as enum ('active', 'monitoring', 'resolved');

-- =============================================================
-- SECTION 7.7: Medications Enum
-- =============================================================

create type ultaura_health_medication_status as enum ('current', 'as_needed', 'discontinued');

-- =============================================================
-- SECTION 7.8: Suggestion Enums
-- =============================================================

create type ultaura_health_suggestion_type as enum ('condition', 'medication');
create type ultaura_health_suggestion_mode as enum ('new', 'update');
create type ultaura_health_suggestion_status as enum ('pending', 'approved', 'dismissed');
create type ultaura_health_suggestion_dismiss_reason as enum ('owner_dismissed', 'system_stale');
create type ultaura_health_suggestion_suppression_reason as enum ('owner_private_disclosure');

-- =============================================================
-- SECTION 7.9: Observation Enums (table created in migration 000004)
-- =============================================================

create type ultaura_health_observation_category as enum (
  'memory',
  'mood_emotional',
  'physical_mobility',
  'nutrition_eating',
  'sleep',
  'social_engagement',
  'medication_compliance',
  'general_other'
);

create type ultaura_health_observation_concern as enum ('note', 'mild_concern', 'significant_concern');

-- =============================================================
-- SECTION 7.11: Item History Enums
-- =============================================================

create type ultaura_health_item_kind as enum ('condition', 'medication', 'document', 'observation', 'suggestion');
create type ultaura_health_item_action as enum (
  'created',
  'edited',
  'deleted',
  'suggestion_approved',
  'suggestion_dismissed',
  'system_stale_dismissed'
);
create type ultaura_health_actor_type as enum ('owner', 'system', 'telephony');

-- =============================================================
-- SECTION 7.13: Call Notice Enums
-- =============================================================

create type ultaura_health_call_notice_type as enum ('consent_change', 'major_profile_change');
create type ultaura_health_call_notice_status as enum ('pending', 'delivered', 'superseded', 'canceled');

-- =============================================================
-- SECTION 7.4: Owner-Only Helper Functions
-- =============================================================

create or replace function is_ultaura_account_owner(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ultaura_accounts a
    where a.id = target_account_id
      and a.created_by_user_id = auth.uid()
  );
$$;

create or replace function can_access_ultaura_health_line(target_line_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from ultaura_lines l
    join ultaura_accounts a on a.id = l.account_id
    where l.id = target_line_id
      and a.created_by_user_id = auth.uid()
  );
$$;

-- =============================================================
-- SECTION 7.1A: Account/Line Consistency Trigger Function
-- =============================================================

create or replace function enforce_health_account_line_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from ultaura_lines
    where id = new.line_id
      and account_id = new.account_id
  ) then
    raise exception
      'Health table consistency violation: line_id % does not belong to account_id %',
      new.line_id, new.account_id;
  end if;
  return new;
end;
$$;

-- =============================================================
-- SECTION 7.2: Consent Tables
-- =============================================================

create table if not exists ultaura_health_line_consent (
  line_id uuid primary key references ultaura_lines(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  health_consent ultaura_health_consent_status not null default 'not_requested',
  health_consent_requested_at timestamptz,
  health_first_consent_requested_at timestamptz,
  health_last_prompted_at timestamptz,
  health_last_prompt_call_session_id uuid references ultaura_call_sessions(id),
  self_explanation_requested_at timestamptz,
  self_explanation_last_prompted_at timestamptz,
  self_explanation_last_prompt_call_session_id uuid references ultaura_call_sessions(id),
  health_consent_at timestamptz,
  health_consent_call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_health_line_consent_status
  on ultaura_health_line_consent(health_consent)
  where health_consent != 'not_requested';

create index if not exists idx_health_line_consent_requested_at
  on ultaura_health_line_consent(health_consent_requested_at)
  where health_consent_requested_at is not null;

create index if not exists idx_health_line_consent_prompted_at
  on ultaura_health_line_consent(health_last_prompted_at)
  where health_last_prompted_at is not null;

alter table ultaura_health_line_consent enable row level security;

-- Class 1: owner-readable, no direct writes from browser clients.
create policy ultaura_health_line_consent_owner_select
  on ultaura_health_line_consent for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_line_consent_account_line_check
  before insert or update on ultaura_health_line_consent
  for each row execute function enforce_health_account_line_consistency();

-- Consent line-type enforcement: self-managed lines must never have 'denied'.
-- Spec Section 7.2 — fail-closed NULL check + account user_type join.
create or replace function enforce_health_consent_line_type_rules()
returns trigger
language plpgsql
as $$
declare
  account_user_type text;
begin
  select a.user_type into account_user_type
  from ultaura_lines l
  join ultaura_accounts a on a.id = l.account_id
  where l.id = new.line_id;

  if account_user_type is null then
    raise exception 'health consent trigger could not resolve account user_type for line %', new.line_id;
  end if;

  if account_user_type = 'self' and new.health_consent = 'denied' then
    raise exception 'self-managed lines cannot use denied health consent state';
  end if;

  return new;
end;
$$;

create trigger trg_health_consent_line_type_rules
  before insert or update on ultaura_health_line_consent
  for each row execute function enforce_health_consent_line_type_rules();

-- =============================================================

create table if not exists ultaura_health_consent_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  event_type ultaura_health_consent_event_type not null,
  resulting_status ultaura_health_consent_status,
  actor_user_id uuid references public.users(id),
  call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

create index if not exists idx_health_consent_history_line_created_at
  on ultaura_health_consent_history(line_id, created_at desc);

alter table ultaura_health_consent_history enable row level security;

-- Class 2: owner-readable history, no direct writes.
create policy ultaura_health_consent_history_owner_select
  on ultaura_health_consent_history for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_consent_history_account_line_check
  before insert or update on ultaura_health_consent_history
  for each row execute function enforce_health_account_line_consistency();

-- =============================================================
-- SECTION 7.3: Account-Level Health State Table
-- =============================================================

create table if not exists ultaura_health_account_state (
  account_id uuid primary key references ultaura_accounts(id) on delete cascade,
  disclaimer_acknowledged_at timestamptz,
  disclaimer_acknowledged_by uuid references public.users(id),
  disclaimer_version text,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  first_item_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ultaura_health_account_state enable row level security;

-- Account-scoped owner-only select.
create policy health_account_state_owner_select
  on ultaura_health_account_state for select
  using (is_ultaura_account_owner(account_id));

-- =============================================================
-- SECTION 7.6: Conditions Table
-- =============================================================

create table if not exists ultaura_health_conditions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  status ultaura_health_condition_status not null,
  source text not null check (source in ('owner_manual', 'suggestion_approved')),
  created_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored writes must populate
  updated_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored edits must populate
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

create index if not exists idx_health_conditions_line_status_created
  on ultaura_health_conditions(line_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_health_conditions_line_deleted
  on ultaura_health_conditions(line_id, deleted_at);

create index if not exists idx_health_conditions_account_deleted
  on ultaura_health_conditions(account_id, deleted_at);

alter table ultaura_health_conditions enable row level security;

-- Class 1: owner-readable, no direct writes.
create policy ultaura_health_conditions_owner_select
  on ultaura_health_conditions for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_conditions_account_line_check
  before insert or update on ultaura_health_conditions
  for each row execute function enforce_health_account_line_consistency();

-- =============================================================
-- SECTION 7.7: Medications Table
-- =============================================================

create table if not exists ultaura_health_medications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  linked_condition_id uuid references ultaura_health_conditions(id) on delete set null,
  status ultaura_health_medication_status not null,
  source text not null check (source in ('owner_manual', 'suggestion_approved')),
  created_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored writes must populate
  updated_by_user_id uuid references public.users(id), -- nullable only for legacy/system repair paths; owner-authored edits must populate
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

create index if not exists idx_health_medications_line_status_created
  on ultaura_health_medications(line_id, status, created_at desc)
  where deleted_at is null;

create index if not exists idx_health_medications_line_deleted
  on ultaura_health_medications(line_id, deleted_at);

create index if not exists idx_health_medications_account_deleted
  on ultaura_health_medications(account_id, deleted_at);

alter table ultaura_health_medications enable row level security;

-- Class 1: owner-readable, no direct writes.
create policy ultaura_health_medications_owner_select
  on ultaura_health_medications for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_medications_account_line_check
  before insert or update on ultaura_health_medications
  for each row execute function enforce_health_account_line_consistency();

-- =============================================================
-- SECTION 7.8: Health Suggestions Table
-- =============================================================

create table if not exists ultaura_health_suggestions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  suggestion_type ultaura_health_suggestion_type not null,
  suggestion_mode ultaura_health_suggestion_mode not null,
  status ultaura_health_suggestion_status not null default 'pending',
  dismiss_reason ultaura_health_suggestion_dismiss_reason,
  dedupe_key text not null,
  material_evidence_key text not null,
  similar_item_id uuid,
  resulting_item_id uuid,
  source_call_session_id uuid references ultaura_call_sessions(id),
  source_call_started_at timestamptz,
  reviewed_by_user_id uuid references public.users(id),
  reviewed_at timestamptz,
  suppressed_at timestamptz,
  suppression_reason ultaura_health_suggestion_suppression_reason,
  suppressed_by_call_session_id uuid references ultaura_call_sessions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

-- Unique partial index: one pending unsuppressed suggestion per (line, dedupe_key).
create unique index if not exists idx_health_suggestions_pending_dedupe
  on ultaura_health_suggestions(line_id, dedupe_key)
  where status = 'pending' and suppressed_at is null;

create index if not exists idx_health_suggestions_material_evidence
  on ultaura_health_suggestions(line_id, material_evidence_key, created_at desc);

alter table ultaura_health_suggestions enable row level security;

-- Class 1: owner-readable, no direct writes.
create policy ultaura_health_suggestions_owner_select
  on ultaura_health_suggestions for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_suggestions_account_line_check
  before insert or update on ultaura_health_suggestions
  for each row execute function enforce_health_account_line_consistency();

-- =============================================================
-- SECTION 7.11: Health Item History Table
-- =============================================================

create table if not exists ultaura_health_item_history (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  item_kind ultaura_health_item_kind not null,
  item_id uuid,
  action ultaura_health_item_action not null,
  actor_type ultaura_health_actor_type not null,
  actor_user_id uuid references public.users(id),
  created_at timestamptz not null default now(),
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

create index if not exists idx_health_item_history_line_created_at
  on ultaura_health_item_history(line_id, created_at desc);

create index if not exists idx_health_item_history_account_created_at
  on ultaura_health_item_history(account_id, created_at desc);

alter table ultaura_health_item_history enable row level security;

-- Class 2: owner-readable history, no direct writes.
create policy ultaura_health_item_history_owner_select
  on ultaura_health_item_history for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_item_history_account_line_check
  before insert or update on ultaura_health_item_history
  for each row execute function enforce_health_account_line_consistency();

-- =============================================================
-- SECTION 7.13: Pending Call Notices Table
-- =============================================================

create table if not exists ultaura_health_call_notices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  notice_type ultaura_health_call_notice_type not null,
  status ultaura_health_call_notice_status not null default 'pending',
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  payload_ciphertext bytea not null,
  payload_iv bytea not null,
  payload_tag bytea not null,
  payload_alg text not null default 'aes-256-gcm',
  payload_kid text
);

-- Unique partial index: only one pending major_profile_change notice per line.
create unique index if not exists idx_health_call_notices_pending_major_profile_change
  on ultaura_health_call_notices(line_id)
  where notice_type = 'major_profile_change' and status = 'pending';

alter table ultaura_health_call_notices enable row level security;

-- Class 3: service-managed lifecycle, owner read-only.
create policy health_call_notices_owner_select
  on ultaura_health_call_notices for select
  using (is_ultaura_account_owner(account_id) and can_access_ultaura_health_line(line_id));

-- Attach account/line consistency trigger.
create trigger trg_health_call_notices_account_line_check
  before insert or update on ultaura_health_call_notices
  for each row execute function enforce_health_account_line_consistency();

-- =============================================================
-- Auto-create consent row for new lines (mirrors voice consent pattern)
-- =============================================================

create or replace function create_health_consent_for_line()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into ultaura_health_line_consent (line_id, account_id)
  values (new.id, new.account_id);
  return new;
end;
$$;

create trigger trg_create_health_consent
  after insert on ultaura_lines
  for each row execute function create_health_consent_for_line();

-- =============================================================
-- Backfill: one consent row per existing line
-- =============================================================

insert into ultaura_health_line_consent (line_id, account_id)
select id, account_id from ultaura_lines
on conflict (line_id) do nothing;

-- =============================================================
-- SECTION 7.15: Existing Health-Mention Suppression Support
-- =============================================================

alter table ultaura_health_mentions
  add column if not exists suppressed_at timestamptz,
  add column if not exists suppression_reason text
    check (suppression_reason in ('owner_private_disclosure')),
  add column if not exists suppressed_by_call_session_id uuid references ultaura_call_sessions(id);

create index if not exists idx_health_mentions_unsuppressed_alert
  on ultaura_health_mentions(triggers_alert)
  where triggers_alert = true and suppressed_at is null;

-- =============================================================
-- SECTION 7.16: Call-Level Durable Suppression Marker
-- =============================================================

alter table ultaura_call_sessions
  add column if not exists health_private_disclosure_suppressed_at timestamptz,
  add column if not exists health_private_disclosure_suppression_reason text
    check (health_private_disclosure_suppression_reason in ('owner_private_disclosure'));

create index if not exists idx_call_sessions_health_private_suppressed
  on ultaura_call_sessions(health_private_disclosure_suppressed_at)
  where health_private_disclosure_suppressed_at is not null;
