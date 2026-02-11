-- Onboarding checkout state persistence for Stripe return flows.
-- Stores short-lived, single-use onboarding snapshots keyed by opaque state token.

create table if not exists ultaura_onboarding_state (
  id uuid primary key default gen_random_uuid(),
  state_token text not null unique,
  auth_user_id uuid not null,
  state jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ultaura_onboarding_state_expires_at
  on ultaura_onboarding_state (expires_at);

create index if not exists idx_ultaura_onboarding_state_auth_user_id
  on ultaura_onboarding_state (auth_user_id);

alter table ultaura_onboarding_state enable row level security;

create policy "Service role full access to onboarding state"
  on ultaura_onboarding_state
  for all
  using (auth.role() = 'service_role');

comment on table ultaura_onboarding_state is
  'Short-lived onboarding state snapshots for Stripe checkout redirects. Single-use via delete-on-load.';
