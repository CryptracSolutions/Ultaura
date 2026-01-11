-- Data export requests

create type ultaura_export_status as enum ('pending', 'processing', 'ready', 'expired', 'failed');
create type ultaura_export_format as enum ('json', 'csv');

create table ultaura_data_export_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  requested_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),

  -- Export config
  format ultaura_export_format not null default 'json',
  include_memories boolean not null default true,
  include_call_metadata boolean not null default true,
  include_reminders boolean not null default true,

  -- Status
  status ultaura_export_status not null default 'pending',
  processed_at timestamptz,
  expires_at timestamptz,

  -- Download
  download_url text,
  file_size_bytes bigint,

  -- Error handling
  error_message text
);

create index idx_export_requests_account on ultaura_data_export_requests(account_id, created_at desc);
create index idx_export_requests_status on ultaura_data_export_requests(status) where status in ('pending', 'processing');

alter table ultaura_data_export_requests enable row level security;

create policy "Users can view export requests for their accounts"
  on ultaura_data_export_requests for select
  using (can_access_ultaura_account(account_id));

create policy "Users can insert export requests for their accounts"
  on ultaura_data_export_requests for insert
  with check (can_access_ultaura_account(account_id));
