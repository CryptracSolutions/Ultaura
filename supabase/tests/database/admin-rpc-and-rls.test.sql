begin;

create extension "basejump-supabase_test_helpers" version '0.0.6';

select
  no_plan();

select
  tests.create_supabase_user('admin-audit-user');

select
  tests.create_supabase_user('admin-audit-user-2');

grant usage on schema tests to service_role;

set local role postgres;

update auth.users
set
  email = 'AuditTarget@Example.com',
  phone = '+15555550101',
  created_at = '2026-01-01 00:00:00+00'::timestamptz,
  last_sign_in_at = '2026-01-15 00:00:00+00'::timestamptz,
  banned_until = '2026-02-01 00:00:00+00'::timestamptz
where id = tests.get_supabase_uid('admin-audit-user');

update auth.users
set
  email = 'SomeoneElse@Example.com',
  created_at = '2026-01-02 00:00:00+00'::timestamptz
where id = tests.get_supabase_uid('admin-audit-user-2');

insert into auth.users (
  id,
  email,
  created_at,
  last_sign_in_at
)
select
  gen_random_uuid(),
  format('bulk-audit-user-%s@example.com', lpad(gs::text, 3, '0')),
  '2026-01-10 00:00:00+00'::timestamptz + (gs || ' minutes')::interval,
  '2026-01-11 00:00:00+00'::timestamptz + (gs || ' minutes')::interval
from generate_series(1, 120) as gs;

insert into public.ultaura_debug_logs (
  event_type,
  payload
)
values (
  'admin_audit_pgtap_rls',
  '{"source":"pgtap"}'::jsonb
);

insert into public.ultaura_rate_limit_events (
  event_type,
  action,
  was_allowed
)
values (
  'admin_audit_pgtap_rls',
  'blocked',
  false
);

set local role service_role;

select
  is(
    public.get_user_id_by_email('audittarget@example.com'),
    tests.get_supabase_uid('admin-audit-user'),
    'get_user_id_by_email finds an auth user by case-insensitive email'
  );

select
  is(
    public.get_user_id_by_email('missing-user@example.com'),
    null::uuid,
    'get_user_id_by_email returns null when no auth user matches'
  );

select
  isnt_empty($$
    select
      1
    from public.search_auth_users_by_email('audittarget@example.com', 10)
    where
      id = tests.get_supabase_uid('admin-audit-user')
      and email = 'AuditTarget@Example.com'
      and phone = '+15555550101'
      and banned_until = '2026-02-01 00:00:00+00'::timestamptz
$$,
    'search_auth_users_by_email returns matching auth user fields'
  );

select
  is(
    (
      select count(*)::int
      from public.search_auth_users_by_email('bulk-audit-user-', 7)
    ),
    7,
    'search_auth_users_by_email applies explicit result_limit'
  );

select
  is(
    (
      select count(*)::int
      from public.search_auth_users_by_email('bulk-audit-user-', null::int)
    ),
    50,
    'search_auth_users_by_email defaults null result_limit to 50'
  );

select
  is(
    (
      select count(*)::int
      from public.search_auth_users_by_email('bulk-audit-user-', 1000)
    ),
    100,
    'search_auth_users_by_email caps result_limit at 100'
  );

select
  is(
    (
      select count(*)::int
      from public.search_auth_users_by_email('bulk-audit-user-', -5)
    ),
    0,
    'search_auth_users_by_email floors negative result_limit to 0'
  );

set local role anon;

select
  throws_ok($$
    select
      public.get_user_id_by_email('audittarget@example.com');
$$,
    'permission denied for function get_user_id_by_email'
  );

select
  throws_ok($$
    select count(*)
    from public.search_auth_users_by_email('bulk-audit-user-', 1);
$$,
    'permission denied for function search_auth_users_by_email'
  );

set local role authenticated;

select
  throws_ok($$
    select
      public.get_user_id_by_email('audittarget@example.com');
$$,
    'permission denied for function get_user_id_by_email'
  );

select
  throws_ok($$
    select count(*)
    from public.search_auth_users_by_email('bulk-audit-user-', 1);
$$,
    'permission denied for function search_auth_users_by_email'
  );

set local role postgres;

select
  tests.authenticate_as('admin-audit-user');

select
  is_empty($$
    select
      1
    from public.ultaura_debug_logs
    where
      event_type = 'admin_audit_pgtap_rls'
$$,
    'authenticated non-super-admin cannot view debug logs rows'
  );

select
  is_empty($$
    select
      1
    from public.ultaura_rate_limit_events
    where
      event_type = 'admin_audit_pgtap_rls'
$$,
    'authenticated non-super-admin cannot view rate limit events rows'
  );

set local role authenticated;

select
  set_config(
    'request.jwt.claims',
    json_build_object(
      'role', 'authenticated',
      'sub', '00000000-0000-0000-0000-000000000001',
      'email', 'super-admin@example.com',
      'app_metadata', json_build_object('role', 'super-admin')
    )::text,
    true
  );

select
  isnt_empty($$
    select
      1
    from public.ultaura_debug_logs
    where
      event_type = 'admin_audit_pgtap_rls'
$$,
    'authenticated super-admin can view debug logs rows'
  );

select
  isnt_empty($$
    select
      1
    from public.ultaura_rate_limit_events
    where
      event_type = 'admin_audit_pgtap_rls'
$$,
    'authenticated super-admin can view rate limit events rows'
  );

select
  *
from
  finish();

rollback;
