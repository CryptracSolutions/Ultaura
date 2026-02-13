begin;

create extension "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

select tests.create_supabase_user('reminder-user');
select tests.authenticate_as('reminder-user');

select lives_ok($$
  select create_new_organization('Reminder Limits Org');
$$, 'created test organization');

set local role service_role;

-- ---------------------------------------------------------------------------
-- Seed accounts and lines used by tests
-- ---------------------------------------------------------------------------

insert into ultaura_accounts (
  id,
  organization_id,
  name,
  billing_email,
  status,
  plan_id,
  trial_plan_id,
  trial_starts_at,
  trial_ends_at,
  created_by_user_id
) values
  (
    '10000000-0000-0000-0000-000000000001',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Care Account',
    'care@example.com',
    'active',
    'care',
    null,
    null,
    null,
    tests.get_supabase_uid('reminder-user')
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Family Account',
    'family@example.com',
    'active',
    'family',
    null,
    null,
    null,
    tests.get_supabase_uid('reminder-user')
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Missing Plan Account',
    'missing@example.com',
    'trial',
    'care',
    'plan_does_not_exist',
    now() - interval '1 day',
    now() + interval '1 day',
    tests.get_supabase_uid('reminder-user')
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Trial Active Account',
    'trial-active@example.com',
    'trial',
    'family',
    'care',
    now() - interval '1 day',
    now() + interval '1 day',
    tests.get_supabase_uid('reminder-user')
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Trial Expired Account',
    'trial-expired@example.com',
    'trial',
    'care',
    'family',
    now() - interval '4 days',
    now() - interval '1 day',
    tests.get_supabase_uid('reminder-user')
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Update Account',
    'update@example.com',
    'active',
    'care',
    null,
    null,
    null,
    tests.get_supabase_uid('reminder-user')
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    makerkit.get_organization_id('Reminder Limits Org'),
    'Concurrency Account',
    'concurrency@example.com',
    'active',
    'care',
    null,
    null,
    null,
    tests.get_supabase_uid('reminder-user')
  );

insert into ultaura_lines (
  id,
  account_id,
  short_id,
  display_name,
  phone_e164,
  status,
  timezone
) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'careln01', 'Care Line', '+14155550101', 'active', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'famlne01', 'Family Line', '+14155550102', 'active', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'mispln01', 'Missing Plan Line', '+14155550103', 'active', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004', 'tractv01', 'Trial Active Line', '+14155550104', 'active', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000005', 'trexpd01', 'Trial Expired Line', '+14155550105', 'active', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006', 'upline01', 'Update Line', '+14155550106', 'active', 'America/Los_Angeles'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000007', 'concrn01', 'Concurrency Line', '+14155550107', 'active', 'America/Los_Angeles');

insert into ultaura_call_sessions (
  id,
  account_id,
  line_id,
  direction,
  status,
  connected_at
) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'outbound', 'in_progress', now()),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', 'outbound', 'in_progress', now()),
  ('40000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'outbound', 'in_progress', now());

-- ---------------------------------------------------------------------------
-- 1) Care plan: first 5 scheduled succeed, 6th blocked with U0001
-- ---------------------------------------------------------------------------

select lives_ok($$
  insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
  values
    ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '1 day', 'America/Los_Angeles', 'Care 1', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '2 day', 'America/Los_Angeles', 'Care 2', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '3 day', 'America/Los_Angeles', 'Care 3', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '4 day', 'America/Los_Angeles', 'Care 4', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '5 day', 'America/Los_Angeles', 'Care 5', 'scheduled', 'line_only');
$$, 'care line allows five active reminders');

select lives_ok($$
  do $do$
  begin
    begin
      insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
      values ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '6 day', 'America/Los_Angeles', 'Care 6', 'scheduled', 'line_only');
      raise exception 'expected U0001 not raised';
    exception
      when sqlstate 'U0001' then
        null;
    end;
  end
  $do$;
$$, 'care line blocks 6th scheduled reminder with U0001');

-- ---------------------------------------------------------------------------
-- 2) Cancel one, then insert succeeds
-- ---------------------------------------------------------------------------

select lives_ok($$
  update ultaura_reminders
  set status = 'canceled'
  where id = '30000000-0000-0000-0000-000000000005';
$$, 'canceling one scheduled reminder succeeds');

select lives_ok($$
  insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
  values ('30000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', now() + interval '7 day', 'America/Los_Angeles', 'Care replacement', 'scheduled', 'line_only');
$$, 'new insert succeeds after scheduled count drops');

-- ---------------------------------------------------------------------------
-- 3) Family plan unlimited (NULL limit)
-- ---------------------------------------------------------------------------

select lives_ok($$
  insert into ultaura_reminders (account_id, line_id, due_at, timezone, message, status, privacy_scope)
  select
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    now() + (g || ' day')::interval,
    'America/Los_Angeles',
    'Family ' || g,
    'scheduled',
    'line_only'
  from generate_series(1, 25) g;
$$, 'family line accepts many scheduled reminders (unlimited)');

-- ---------------------------------------------------------------------------
-- 4) UPDATE canceled -> scheduled blocked at limit
-- ---------------------------------------------------------------------------

select lives_ok($$
  insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
  values
    ('30000000-0000-0000-0000-000000000101', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', now() + interval '1 day', 'America/Los_Angeles', 'Update 1', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000102', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', now() + interval '2 day', 'America/Los_Angeles', 'Update 2', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000103', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', now() + interval '3 day', 'America/Los_Angeles', 'Update 3', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000104', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', now() + interval '4 day', 'America/Los_Angeles', 'Update 4', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000105', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', now() + interval '5 day', 'America/Los_Angeles', 'Update 5', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000106', '10000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000006', now() + interval '6 day', 'America/Los_Angeles', 'Update canceled', 'canceled', 'line_only');
$$, 'seeded update-limit scenario reminders');

select lives_ok($$
  do $do$
  begin
    begin
      update ultaura_reminders
      set status = 'scheduled'
      where id = '30000000-0000-0000-0000-000000000106';
      raise exception 'expected U0001 not raised';
    exception
      when sqlstate 'U0001' then
        null;
    end;
  end
  $do$;
$$, 'update canceled->scheduled is blocked with U0001 at limit');

-- ---------------------------------------------------------------------------
-- 5) Missing effective plan row => fail-closed P0002
-- ---------------------------------------------------------------------------

select lives_ok($$
  do $do$
  begin
    begin
      insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
      values ('30000000-0000-0000-0000-000000000201', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', now() + interval '1 day', 'America/Los_Angeles', 'Missing plan', 'scheduled', 'line_only');
      raise exception 'expected P0002 not raised';
    exception
      when sqlstate 'P0002' then
        null;
    end;
  end
  $do$;
$$, 'missing effective plan fails closed with P0002');

-- ---------------------------------------------------------------------------
-- 6) Trial precedence tests
-- ---------------------------------------------------------------------------

select lives_ok($$
  insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
  values
    ('30000000-0000-0000-0000-000000000301', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', now() + interval '1 day', 'America/Los_Angeles', 'Trial active 1', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000302', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', now() + interval '2 day', 'America/Los_Angeles', 'Trial active 2', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000303', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', now() + interval '3 day', 'America/Los_Angeles', 'Trial active 3', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000304', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', now() + interval '4 day', 'America/Los_Angeles', 'Trial active 4', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000305', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', now() + interval '5 day', 'America/Los_Angeles', 'Trial active 5', 'scheduled', 'line_only');
$$, 'active trial account allows five reminders');

select lives_ok($$
  do $do$
  begin
    begin
      insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
      values ('30000000-0000-0000-0000-000000000306', '10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000004', now() + interval '6 day', 'America/Los_Angeles', 'Trial active 6', 'scheduled', 'line_only');
      raise exception 'expected U0001 not raised';
    exception
      when sqlstate 'U0001' then
        null;
    end;
  end
  $do$;
$$, 'active trial uses trial_plan_id limit (care=5)');

select lives_ok($$
  insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
  values
    ('30000000-0000-0000-0000-000000000401', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', now() + interval '1 day', 'America/Los_Angeles', 'Trial expired 1', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000402', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', now() + interval '2 day', 'America/Los_Angeles', 'Trial expired 2', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000403', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', now() + interval '3 day', 'America/Los_Angeles', 'Trial expired 3', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000404', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', now() + interval '4 day', 'America/Los_Angeles', 'Trial expired 4', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000405', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', now() + interval '5 day', 'America/Los_Angeles', 'Trial expired 5', 'scheduled', 'line_only');
$$, 'expired trial account allows five reminders');

select lives_ok($$
  do $do$
  begin
    begin
      insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
      values ('30000000-0000-0000-0000-000000000406', '10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005', now() + interval '6 day', 'America/Los_Angeles', 'Trial expired 6', 'scheduled', 'line_only');
      raise exception 'expected U0001 not raised';
    exception
      when sqlstate 'U0001' then
        null;
    end;
  end
  $do$;
$$, 'expired trial falls back to plan_id limit (care=5)');

-- ---------------------------------------------------------------------------
-- 7) Gated concurrency check (dblink if available)
-- ---------------------------------------------------------------------------

select lives_ok($$
  insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
  values
    ('30000000-0000-0000-0000-000000000501', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', now() + interval '1 day', 'America/Los_Angeles', 'Concurrency 1', 'scheduled', 'line_only'),
    ('30000000-0000-0000-0000-000000000502', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', now() + interval '2 day', 'America/Los_Angeles', 'Concurrency 2', 'scheduled', 'line_only');
$$, 'seeded concurrency line with two reminders');

select case
  when exists (select 1 from pg_available_extensions where name = 'dblink') then
    lives_ok($$
      do $do$
      declare
        v_busy integer;
        v_status text;
      begin
        create extension if not exists dblink;

        begin
          perform dblink_connect('rl_conn1', format('dbname=%I', current_database()));
          perform dblink_connect('rl_conn2', format('dbname=%I', current_database()));

          perform dblink_exec('rl_conn1', 'begin');
          perform dblink_exec('rl_conn2', 'begin');

          perform dblink_exec(
            'rl_conn1',
            $q1$insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
              values ('30000000-0000-0000-0000-000000000503', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', now() + interval '3 day', 'America/Los_Angeles', 'Concurrency winner', 'scheduled', 'line_only')$q1$
          );

          perform dblink_send_query(
            'rl_conn2',
            $q2$insert into ultaura_reminders (id, account_id, line_id, due_at, timezone, message, status, privacy_scope)
              values ('30000000-0000-0000-0000-000000000504', '10000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000007', now() + interval '4 day', 'America/Los_Angeles', 'Concurrency loser', 'scheduled', 'line_only')$q2$
          );

          perform pg_sleep(0.2);
          v_busy := dblink_is_busy('rl_conn2');
          if v_busy <> 1 then
            raise exception 'expected second session to wait on advisory lock';
          end if;

          perform dblink_exec('rl_conn1', 'commit');

          select status
          into v_status
          from dblink_get_result('rl_conn2', false) as t(status text);

          if v_status not like 'ERROR%' then
            raise exception 'expected second concurrent insert to fail after lock release, got: %', coalesce(v_status, '<null>');
          end if;

          perform dblink_exec('rl_conn2', 'rollback');
          perform dblink_disconnect('rl_conn1');
          perform dblink_disconnect('rl_conn2');

          if (select count(*) from ultaura_reminders where line_id = '20000000-0000-0000-0000-000000000007' and status = 'scheduled') <> 3 then
            raise exception 'concurrency test overshot scheduled reminder limit';
          end if;
        exception
          when sqlstate '2F003' then
            raise notice 'dblink connection requires password; skipping concurrency execution';
        end;
      end
      $do$;
    $$, 'dblink concurrency check: advisory lock serializes inserts and prevents overshoot')
  else
    pass('dblink extension unavailable; skipped concurrency test')
end;

-- ---------------------------------------------------------------------------
-- 8) Session cap enforcement counts only scheduled reminders
-- ---------------------------------------------------------------------------

select lives_ok($$
  do $do$
  declare
    v_result record;
  begin
    select *
    into v_result
    from create_ultaura_call_reminder(
      '40000000-0000-0000-0000-000000000003',
      1,
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      now() + interval '7 day',
      'America/Los_Angeles',
      'Canceled should not count',
      'outbound_call',
      'canceled',
      'line_only',
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      null,
      null,
      null
    );

    if not v_result.success then
      raise exception 'expected canceled reminder creation to succeed';
    end if;

    select *
    into v_result
    from create_ultaura_call_reminder(
      '40000000-0000-0000-0000-000000000003',
      1,
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      now() + interval '8 day',
      'America/Los_Angeles',
      'First scheduled in-session',
      'outbound_call',
      'scheduled',
      'line_only',
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      null,
      null,
      null
    );

    if not v_result.success then
      raise exception 'expected first scheduled reminder to succeed';
    end if;

    if v_result.current_count <> 1 or v_result."limit" <> 1 or v_result.remaining_allowance <> 0 then
      raise exception 'expected first scheduled result counts to be 1/1/0, got current=% limit=% remaining=%',
        v_result.current_count,
        v_result."limit",
        v_result.remaining_allowance;
    end if;

    select *
    into v_result
    from create_ultaura_call_reminder(
      '40000000-0000-0000-0000-000000000003',
      1,
      '10000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      now() + interval '9 day',
      'America/Los_Angeles',
      'Second scheduled in-session',
      'outbound_call',
      'scheduled',
      'line_only',
      null,
      null,
      null,
      null,
      null,
      null,
      false,
      null,
      null,
      null,
      null,
      null,
      null
    );

    if v_result.success then
      raise exception 'expected second scheduled reminder to be blocked by session cap';
    end if;

    if v_result.code <> 'session_limit_reached' then
      raise exception 'expected session_limit_reached, got %', v_result.code;
    end if;

    if v_result.current_count <> 1 or v_result."limit" <> 1 or v_result.remaining_allowance <> 0 then
      raise exception 'expected blocked result counts to be 1/1/0, got current=% limit=% remaining=%',
        v_result.current_count,
        v_result."limit",
        v_result.remaining_allowance;
    end if;
  end
  $do$;
$$, 'session cap counts scheduled reminders only and returns structured block metadata');

-- ---------------------------------------------------------------------------
-- 9) Gated session-cap concurrency check (dblink if available)
-- ---------------------------------------------------------------------------

select case
  when exists (select 1 from pg_available_extensions where name = 'dblink') then
    lives_ok($$
      do $do$
      declare
        v_busy integer;
        v_conn1_success boolean;
        v_conn1_code text;
        v_conn2_success boolean;
        v_conn2_code text;
      begin
        create extension if not exists dblink;

        begin
          perform dblink_connect('rls_conn1', format('dbname=%I', current_database()));
          perform dblink_connect('rls_conn2', format('dbname=%I', current_database()));

          perform dblink_exec('rls_conn1', 'begin');
          perform dblink_exec('rls_conn2', 'begin');

          perform dblink_send_query(
            'rls_conn1',
            $q1$select success, code
              from create_ultaura_call_reminder(
                '40000000-0000-0000-0000-000000000003',
                1,
                '10000000-0000-0000-0000-000000000002',
                '20000000-0000-0000-0000-000000000002',
                now() + interval '7 day',
                'America/Los_Angeles',
                'Session race winner',
                'outbound_call',
                'scheduled',
                'line_only',
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                null,
                null,
                null,
                null,
                null,
                null
              )$q1$
          );

          select success, code
          into v_conn1_success, v_conn1_code
          from dblink_get_result('rls_conn1', false) as t(success boolean, code text);

          if not v_conn1_success then
            raise exception 'expected first session call to succeed, got code %', v_conn1_code;
          end if;

          perform dblink_send_query(
            'rls_conn2',
            $q2$select success, code
              from create_ultaura_call_reminder(
                '40000000-0000-0000-0000-000000000003',
                1,
                '10000000-0000-0000-0000-000000000002',
                '20000000-0000-0000-0000-000000000002',
                now() + interval '8 day',
                'America/Los_Angeles',
                'Session race loser',
                'outbound_call',
                'scheduled',
                'line_only',
                null,
                null,
                null,
                null,
                null,
                null,
                false,
                null,
                null,
                null,
                null,
                null,
                null
              )$q2$
          );

          perform pg_sleep(0.2);
          v_busy := dblink_is_busy('rls_conn2');
          if v_busy <> 1 then
            raise exception 'expected second session to wait on session advisory lock';
          end if;

          perform dblink_exec('rls_conn1', 'commit');

          select success, code
          into v_conn2_success, v_conn2_code
          from dblink_get_result('rls_conn2', false) as t(success boolean, code text);

          if v_conn2_success or v_conn2_code <> 'session_limit_reached' then
            raise exception 'expected second concurrent call to return session_limit_reached, got success=% code=%',
              v_conn2_success,
              coalesce(v_conn2_code, '<null>');
          end if;

          perform dblink_exec('rls_conn2', 'commit');
          perform dblink_disconnect('rls_conn1');
          perform dblink_disconnect('rls_conn2');

          if (
            select count(*)
            from ultaura_reminders
            where created_by_call_session_id = '40000000-0000-0000-0000-000000000003'
              and status = 'scheduled'
          ) <> 1 then
            raise exception 'session concurrency test overshot session scheduled reminder limit';
          end if;
        exception
          when sqlstate '2F003' then
            raise notice 'dblink connection requires password; skipping session concurrency execution';
        end;
      end
      $do$;
    $$, 'dblink session concurrency check: advisory lock serializes session-cap evaluation')
  else
    pass('dblink extension unavailable; skipped session concurrency test')
end;

select * from finish();

rollback;
