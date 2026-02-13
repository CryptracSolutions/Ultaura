-- Harden live-call reminder creation with race-safe per-session limits.

create or replace function create_ultaura_call_reminder(
  p_call_session_id uuid,
  p_session_limit integer,
  p_account_id uuid,
  p_line_id uuid,
  p_due_at timestamptz,
  p_timezone text,
  p_message text,
  p_delivery_method text default 'outbound_call',
  p_status ultaura_reminder_status default 'scheduled',
  p_privacy_scope ultaura_privacy_scope default 'line_only',
  p_message_ciphertext bytea default null,
  p_message_iv bytea default null,
  p_message_tag bytea default null,
  p_message_alg text default null,
  p_message_kid text default null,
  p_search_tokens text[] default null,
  p_is_recurring boolean default false,
  p_rrule text default null,
  p_interval_days integer default null,
  p_days_of_week integer[] default null,
  p_day_of_month integer default null,
  p_time_of_day time default null,
  p_ends_at timestamptz default null
)
returns table(
  success boolean,
  code text,
  message text,
  current_count integer,
  "limit" integer,
  remaining_allowance integer,
  next_action text,
  reason text,
  reminder_id uuid,
  due_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_call_session ultaura_call_sessions%rowtype;
  v_target_status ultaura_reminder_status := coalesce(p_status, 'scheduled');
  v_session_scheduled_count integer := 0;
  v_current_count integer := 0;
  v_line_scheduled_count integer := 0;
  v_effective_plan_id text;
  v_line_limit integer;
  v_reminder_id uuid;
  v_due_at timestamptz;
begin
  if p_call_session_id is null
     or p_account_id is null
     or p_line_id is null
     or p_due_at is null
     or p_timezone is null
     or p_session_limit is null
     or p_session_limit < 0 then
    return query
    select
      false,
      'invalid_input',
      'Invalid reminder payload.',
      0,
      p_session_limit,
      case when p_session_limit is null then null else greatest(p_session_limit, 0) end,
      'fix_payload',
      'invalid_input',
      null::uuid,
      null::timestamptz;
    return;
  end if;

  select *
  into v_call_session
  from ultaura_call_sessions
  where id = p_call_session_id;

  if not found then
    return query
    select
      false,
      'call_session_not_found',
      'Call session was not found.',
      0,
      p_session_limit,
      p_session_limit,
      'start_new_call',
      'missing_call_session',
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_call_session.status <> 'in_progress' then
    return query
    select
      false,
      'call_session_not_in_progress',
      'Call session must be in progress to create reminders.',
      0,
      p_session_limit,
      p_session_limit,
      'start_new_call',
      'call_not_live',
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_call_session.account_id <> p_account_id or v_call_session.line_id <> p_line_id then
    return query
    select
      false,
      'call_session_context_mismatch',
      'Reminder payload does not match call session account/line.',
      0,
      p_session_limit,
      p_session_limit,
      'refresh_call_context',
      'context_mismatch',
      null::uuid,
      null::timestamptz;
    return;
  end if;

  if v_target_status = 'scheduled' then
    perform pg_advisory_xact_lock(
      hashtext('ultaura_call_reminder_session_limit'),
      hashtext(p_call_session_id::text)
    );

    select count(*)::integer
    into v_session_scheduled_count
    from ultaura_reminders r
    where r.created_by_call_session_id = p_call_session_id
      and r.status = 'scheduled';

    if v_session_scheduled_count >= p_session_limit then
      return query
      select
        false,
        'session_limit_reached',
        'Maximum scheduled reminders reached for this live call.',
        v_session_scheduled_count,
        p_session_limit,
        0,
        'try_next_call',
        'session_limit',
        null::uuid,
        null::timestamptz;
      return;
    end if;
  end if;

  begin
    insert into ultaura_reminders (
      account_id,
      line_id,
      due_at,
      timezone,
      message,
      delivery_method,
      status,
      privacy_scope,
      created_by_call_session_id,
      message_ciphertext,
      message_iv,
      message_tag,
      message_alg,
      message_kid,
      search_tokens,
      is_recurring,
      rrule,
      interval_days,
      days_of_week,
      day_of_month,
      time_of_day,
      ends_at
    )
    values (
      p_account_id,
      p_line_id,
      p_due_at,
      p_timezone,
      p_message,
      coalesce(p_delivery_method, 'outbound_call'),
      v_target_status,
      coalesce(p_privacy_scope, 'line_only'),
      p_call_session_id,
      p_message_ciphertext,
      p_message_iv,
      p_message_tag,
      p_message_alg,
      p_message_kid,
      p_search_tokens,
      coalesce(p_is_recurring, false),
      p_rrule,
      p_interval_days,
      p_days_of_week,
      p_day_of_month,
      p_time_of_day,
      p_ends_at
    )
    returning id, ultaura_reminders.due_at
    into v_reminder_id, v_due_at;
  exception
    when sqlstate 'U0001' then
      select count(*)::integer
      into v_line_scheduled_count
      from ultaura_reminders r
      where r.line_id = p_line_id
        and r.status = 'scheduled';

      begin
        v_effective_plan_id := get_effective_plan_id(p_account_id);

        select p.reminders_per_line
        into v_line_limit
        from ultaura_plans p
        where p.id = v_effective_plan_id;
      exception
        when others then
          v_line_limit := null;
      end;

      return query
      select
        false,
        'line_limit_reached',
        'Reminder limit reached for this line.',
        v_line_scheduled_count,
        v_line_limit,
        case when v_line_limit is null then null else greatest(v_line_limit - v_line_scheduled_count, 0) end,
        'cancel_or_upgrade',
        'line_limit',
        null::uuid,
        null::timestamptz;
      return;
  end;

  v_current_count := case
    when v_target_status = 'scheduled' then v_session_scheduled_count + 1
    else v_session_scheduled_count
  end;

  return query
  select
    true,
    'ok',
    'Reminder created.',
    v_current_count,
    p_session_limit,
    greatest(p_session_limit - v_current_count, 0),
    'none',
    null::text,
    v_reminder_id,
    v_due_at;
end;
$$;

revoke all on function create_ultaura_call_reminder(
  uuid,
  integer,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  ultaura_reminder_status,
  ultaura_privacy_scope,
  bytea,
  bytea,
  bytea,
  text,
  text,
  text[],
  boolean,
  text,
  integer,
  integer[],
  integer,
  time,
  timestamptz
) from public, anon, authenticated;

grant execute on function create_ultaura_call_reminder(
  uuid,
  integer,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  ultaura_reminder_status,
  ultaura_privacy_scope,
  bytea,
  bytea,
  bytea,
  text,
  text,
  text[],
  boolean,
  text,
  integer,
  integer[],
  integer,
  time,
  timestamptz
) to service_role;

comment on function create_ultaura_call_reminder(
  uuid,
  integer,
  uuid,
  uuid,
  timestamptz,
  text,
  text,
  text,
  ultaura_reminder_status,
  ultaura_privacy_scope,
  bytea,
  bytea,
  bytea,
  text,
  text,
  text[],
  boolean,
  text,
  integer,
  integer[],
  integer,
  time,
  timestamptz
) is
  'Creates a reminder for an in-progress call session with atomic per-session scheduled limits and structured limit responses.';
