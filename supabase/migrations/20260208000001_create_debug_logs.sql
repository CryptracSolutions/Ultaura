-- Debug logs for admin-only access

create table if not exists ultaura_debug_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  call_session_id uuid references ultaura_call_sessions(id) on delete cascade,
  account_id uuid references ultaura_accounts(id) on delete cascade,
  event_type text not null,
  tool_name text,
  payload jsonb not null,
  metadata jsonb
);

create index if not exists idx_debug_logs_created on ultaura_debug_logs(created_at desc);
create index if not exists idx_debug_logs_session on ultaura_debug_logs(call_session_id);
create index if not exists idx_debug_logs_account on ultaura_debug_logs(account_id);
create index if not exists idx_debug_logs_type on ultaura_debug_logs(event_type);
create index if not exists idx_debug_logs_tool on ultaura_debug_logs(tool_name);

alter table ultaura_debug_logs enable row level security;

create policy "Admins can view debug logs"
  on ultaura_debug_logs for select
  using (
    (select email from auth.users where id = auth.uid()) like '%@ultaura.com'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin'
  );

create policy "Service role can insert debug logs"
  on ultaura_debug_logs for insert
  with check (auth.role() = 'service_role');

create policy "Service role can delete debug logs"
  on ultaura_debug_logs for delete
  using (auth.role() = 'service_role');

insert into storage.buckets (id, name, public)
  values ('backups', 'backups', false)
  on conflict (id) do nothing;
