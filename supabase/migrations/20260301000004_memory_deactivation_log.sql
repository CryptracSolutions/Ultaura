-- Memory deactivation audit log

create type ultaura_deactivation_reason as enum (
  'user_request',
  'user_request_bulk',
  'decay',
  'topic_exclusion',
  'temporal_expiry',
  'payer_deletion'
);

create table if not exists ultaura_memory_deactivation_log (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null,
  memory_key text not null,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  reason ultaura_deactivation_reason not null,
  confidence_at_deactivation numeric,
  call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  restored_at timestamptz,
  restored_call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  restored_reason text,
  metadata jsonb
);

create index if not exists idx_deactivation_log_line
  on ultaura_memory_deactivation_log(line_id, created_at desc);

create index if not exists idx_deactivation_log_reason
  on ultaura_memory_deactivation_log(reason);

create index if not exists idx_deactivation_log_memory
  on ultaura_memory_deactivation_log(memory_id);

alter table ultaura_memory_deactivation_log enable row level security;
-- Service role only access (no user policies)
