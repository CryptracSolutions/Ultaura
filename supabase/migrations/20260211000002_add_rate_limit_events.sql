-- Audit logging for rate limit events

create table if not exists ultaura_rate_limit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  event_type text not null,
  action text not null,
  ip_address text,
  phone_number text,
  account_id uuid references ultaura_accounts(id) on delete set null,
  call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  limit_type text,
  remaining integer,
  was_allowed boolean not null,
  redis_available boolean default true,
  metadata jsonb
);

create index if not exists idx_rate_limit_events_created
  on ultaura_rate_limit_events(created_at desc);
create index if not exists idx_rate_limit_events_ip
  on ultaura_rate_limit_events(ip_address, created_at desc);
create index if not exists idx_rate_limit_events_account
  on ultaura_rate_limit_events(account_id, created_at desc);

alter table ultaura_rate_limit_events enable row level security;

create policy "Admins can view rate limit events"
  on ultaura_rate_limit_events for select
  using (
    (select email from auth.users where id = auth.uid()) like '%@ultaura.com'
    or (auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin'
  );

-- Cleanup helper
create or replace function cleanup_old_rate_limit_events()
returns void as $$
begin
  delete from ultaura_rate_limit_events
  where created_at < now() - interval '30 days';
end;
$$ language plpgsql;

-- pg_cron may be unavailable on Supabase free tier; run cleanup manually if needed.
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'cleanup-rate-limit-events',
  '0 3 * * *',
  $$delete from ultaura_rate_limit_events where created_at < now() - interval '30 days'$$
);

