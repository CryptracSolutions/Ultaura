-- Admin audit hardening: service-role-only auth email lookup RPCs and super-admin-only RLS

create or replace function public.get_user_id_by_email(lookup_email text)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select
    u.id
  from auth.users as u
  where lower(u.email) = lower(lookup_email)
  limit 1;
$$;

revoke execute on function public.get_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.get_user_id_by_email(text) to service_role;

create or replace function public.search_auth_users_by_email(query text, result_limit int default 50)
returns table(
  id uuid,
  email text,
  phone text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  banned_until timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id,
    u.email,
    u.phone,
    u.created_at,
    u.last_sign_in_at,
    u.banned_until
  from auth.users as u
  where u.email is not null
    and lower(u.email) like '%' || lower(query) || '%'
  order by u.created_at desc, u.id desc
  limit greatest(0, least(coalesce(result_limit, 50), 100));
$$;

revoke execute on function public.search_auth_users_by_email(text, int) from public, anon, authenticated;
grant execute on function public.search_auth_users_by_email(text, int) to service_role;

drop policy if exists "Admins can view debug logs" on public.ultaura_debug_logs;
drop policy if exists "Super-admins can view debug logs" on public.ultaura_debug_logs;

create policy "Super-admins can view debug logs"
  on public.ultaura_debug_logs for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin');

drop policy if exists "Admins can view rate limit events" on public.ultaura_rate_limit_events;
drop policy if exists "Super-admins can view rate limit events" on public.ultaura_rate_limit_events;

create policy "Super-admins can view rate limit events"
  on public.ultaura_rate_limit_events for select to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super-admin');
