-- Trial daily cap reservations and race-safe enforcement

create index if not exists idx_ultaura_ledger_trial_account_created
  on ultaura_minute_ledger(account_id, created_at)
  where billable_type = 'trial';

create table if not exists ultaura_trial_daily_cap_reservations (
  call_session_id uuid primary key references ultaura_call_sessions(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_timezone text not null,
  day_start_utc timestamptz not null,
  day_end_utc timestamptz not null,
  reserved_minutes int not null check (reserved_minutes > 0),
  actual_billable_minutes int,
  end_reason ultaura_call_end_reason,
  status text not null default 'reserved' check (status in ('reserved', 'released')),
  created_at timestamptz not null default now(),
  released_at timestamptz,
  check (actual_billable_minutes is null or actual_billable_minutes >= 0)
);

create index if not exists idx_trial_daily_cap_reservations_account_day
  on ultaura_trial_daily_cap_reservations(account_id, day_start_utc, day_end_utc);

create index if not exists idx_trial_daily_cap_reservations_active
  on ultaura_trial_daily_cap_reservations(account_id, day_start_utc)
  where status = 'reserved';

alter table ultaura_trial_daily_cap_reservations enable row level security;

create policy "Users can view trial cap reservations for their accounts"
  on ultaura_trial_daily_cap_reservations for select
  using (can_access_ultaura_account(account_id));

create policy "Service role has full access to trial cap reservations"
  on ultaura_trial_daily_cap_reservations for all
  using (auth.role() = 'service_role');

create or replace function reserve_trial_daily_cap(
  p_account_id uuid,
  p_line_timezone text,
  p_call_session_id uuid
)
returns table(
  allowed boolean,
  reason text,
  reserved_minutes int,
  minutes_used_today int,
  minutes_reserved_today int,
  minutes_remaining_today int,
  day_start_utc timestamptz,
  day_end_utc timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_daily_limit_minutes constant int := 20;
  v_local_day_start timestamp;
  v_day_start_utc timestamptz;
  v_day_end_utc timestamptz;
  v_used_today int := 0;
  v_reserved_today int := 0;
  v_available int := 0;
  v_existing ultaura_trial_daily_cap_reservations%rowtype;
begin
  if p_account_id is null or p_call_session_id is null then
    return query
    select false, 'invalid_input', 0, 0, 0, 0, null::timestamptz, null::timestamptz;
    return;
  end if;

  begin
    v_local_day_start := date_trunc('day', now() at time zone p_line_timezone);
  exception
    when others then
      return query
      select false, 'invalid_timezone', 0, 0, 0, 0, null::timestamptz, null::timestamptz;
      return;
  end;

  v_day_start_utc := v_local_day_start at time zone p_line_timezone;
  v_day_end_utc := (v_local_day_start + interval '1 day') at time zone p_line_timezone;

  perform pg_advisory_xact_lock(hashtext('ultaura_trial_daily_cap'), hashtext(p_account_id::text));

  -- Release stale reservations for sessions that already finalized without explicit release.
  update ultaura_trial_daily_cap_reservations r
  set
    status = 'released',
    actual_billable_minutes = coalesce(
      r.actual_billable_minutes,
      least(
        coalesce(
          (
            select sum(l.billable_minutes)::int
            from ultaura_minute_ledger l
            where l.call_session_id = r.call_session_id
              and l.billable_type = 'trial'
          ),
          0
        ),
        r.reserved_minutes
      )
    ),
    end_reason = coalesce(r.end_reason, s.end_reason, 'hangup'),
    released_at = coalesce(r.released_at, now())
  from ultaura_call_sessions s
  where r.account_id = p_account_id
    and r.status = 'reserved'
    and r.call_session_id = s.id
    and s.status in ('completed', 'failed', 'canceled');

  select *
  into v_existing
  from ultaura_trial_daily_cap_reservations
  where call_session_id = p_call_session_id
  for update;

  if found then
    select coalesce(sum(billable_minutes), 0)::int
      into v_used_today
    from ultaura_minute_ledger
    where account_id = v_existing.account_id
      and billable_type = 'trial'
      and created_at >= v_existing.day_start_utc
      and created_at < v_existing.day_end_utc;

    select coalesce(sum(reserved_minutes), 0)::int
      into v_reserved_today
    from ultaura_trial_daily_cap_reservations
    where account_id = v_existing.account_id
      and status = 'reserved'
      and day_start_utc = v_existing.day_start_utc
      and day_end_utc = v_existing.day_end_utc;

    return query
    select
      (v_existing.status = 'reserved') as allowed,
      case when v_existing.status = 'reserved' then null else 'already_released' end as reason,
      case when v_existing.status = 'reserved' then v_existing.reserved_minutes else 0 end as reserved_minutes,
      v_used_today as minutes_used_today,
      v_reserved_today as minutes_reserved_today,
      greatest(v_daily_limit_minutes - v_used_today - v_reserved_today, 0)::int as minutes_remaining_today,
      v_existing.day_start_utc,
      v_existing.day_end_utc;
    return;
  end if;

  select coalesce(sum(billable_minutes), 0)::int
    into v_used_today
  from ultaura_minute_ledger
  where account_id = p_account_id
    and billable_type = 'trial'
    and created_at >= v_day_start_utc
    and created_at < v_day_end_utc;

  select coalesce(sum(reserved_minutes), 0)::int
    into v_reserved_today
  from ultaura_trial_daily_cap_reservations
  where account_id = p_account_id
    and status = 'reserved'
    and day_start_utc = v_day_start_utc
    and day_end_utc = v_day_end_utc;

  v_available := greatest(v_daily_limit_minutes - v_used_today - v_reserved_today, 0);

  if v_available <= 0 then
    return query
    select
      false,
      'trial_cap',
      0,
      v_used_today,
      v_reserved_today,
      0,
      v_day_start_utc,
      v_day_end_utc;
    return;
  end if;

  insert into ultaura_trial_daily_cap_reservations (
    call_session_id,
    account_id,
    line_timezone,
    day_start_utc,
    day_end_utc,
    reserved_minutes,
    status
  )
  values (
    p_call_session_id,
    p_account_id,
    p_line_timezone,
    v_day_start_utc,
    v_day_end_utc,
    v_available,
    'reserved'
  );

  v_reserved_today := v_reserved_today + v_available;

  return query
  select
    true,
    null::text,
    v_available,
    v_used_today,
    v_reserved_today,
    greatest(v_daily_limit_minutes - v_used_today - v_reserved_today, 0)::int,
    v_day_start_utc,
    v_day_end_utc;
end;
$$;

create or replace function release_trial_daily_cap(
  p_call_session_id uuid,
  p_end_reason ultaura_call_end_reason,
  p_actual_billable_minutes int
)
returns table(
  released boolean,
  reserved_minutes int,
  actual_billable_minutes int,
  end_reason ultaura_call_end_reason
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row ultaura_trial_daily_cap_reservations%rowtype;
  v_actual int := greatest(coalesce(p_actual_billable_minutes, 0), 0);
begin
  if p_call_session_id is null then
    return query
    select false, 0, v_actual, null::ultaura_call_end_reason;
    return;
  end if;

  select *
  into v_row
  from ultaura_trial_daily_cap_reservations
  where call_session_id = p_call_session_id
  for update;

  if not found then
    return query
    select false, 0, v_actual, null::ultaura_call_end_reason;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtext('ultaura_trial_daily_cap'), hashtext(v_row.account_id::text));

  if v_row.status = 'released' then
    return query
    select true,
      v_row.reserved_minutes,
      coalesce(v_row.actual_billable_minutes, 0),
      v_row.end_reason;
    return;
  end if;

  update ultaura_trial_daily_cap_reservations
  set
    status = 'released',
    actual_billable_minutes = least(v_actual, v_row.reserved_minutes),
    end_reason = coalesce(p_end_reason, 'hangup'),
    released_at = now()
  where call_session_id = p_call_session_id
  returning * into v_row;

  return query
  select true,
    v_row.reserved_minutes,
    coalesce(v_row.actual_billable_minutes, 0),
    v_row.end_reason;
end;
$$;

revoke all on function reserve_trial_daily_cap(uuid, text, uuid) from public, anon, authenticated;
revoke all on function release_trial_daily_cap(uuid, ultaura_call_end_reason, int) from public, anon, authenticated;

grant execute on function reserve_trial_daily_cap(uuid, text, uuid) to service_role;
grant execute on function release_trial_daily_cap(uuid, ultaura_call_end_reason, int) to service_role;
