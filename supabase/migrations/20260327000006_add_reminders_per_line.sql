-- Add per-line reminder limits by plan and enforce limits at write time.

alter table ultaura_plans
  add column if not exists reminders_per_line integer;

alter table ultaura_plans
  drop constraint if exists ultaura_plans_reminders_per_line_nonnegative;

alter table ultaura_plans
  add constraint ultaura_plans_reminders_per_line_nonnegative
  check (reminders_per_line is null or reminders_per_line >= 0);

update ultaura_plans
set reminders_per_line = case id
  when 'free_trial' then 3
  when 'care' then 3
  when 'comfort' then 10
  else reminders_per_line
end
where id in ('free_trial', 'care', 'comfort');

create index if not exists idx_reminders_line_scheduled
  on ultaura_reminders(line_id)
  where status = 'scheduled';

create or replace function get_effective_plan_id(p_account_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_account ultaura_accounts%rowtype;
  v_effective_plan_id text;
begin
  select *
  into v_account
  from ultaura_accounts
  where id = p_account_id;

  if not found then
    raise exception 'account not found: %', p_account_id
      using errcode = 'P0002';
  end if;

  v_effective_plan_id := case
    when v_account.status = 'trial'
      and v_account.trial_plan_id is not null
      and (v_account.trial_ends_at is null or now() < v_account.trial_ends_at)
    then v_account.trial_plan_id
    else v_account.plan_id
  end;

  if v_effective_plan_id is null then
    raise exception 'effective plan id missing for account: %', p_account_id
      using errcode = 'P0002';
  end if;

  return v_effective_plan_id;
end;
$$;

create or replace function enforce_reminder_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lock_namespace text := 'reminder_limit';
  v_effective_plan_id text;
  v_reminders_per_line integer;
  v_scheduled_count integer;
begin
  if new.status <> 'scheduled' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'scheduled'
     and new.status = 'scheduled'
     and old.line_id = new.line_id
     and old.account_id = new.account_id then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext(v_lock_namespace), hashtext(new.line_id::text));

  v_effective_plan_id := get_effective_plan_id(new.account_id);

  select p.reminders_per_line
  into v_reminders_per_line
  from ultaura_plans p
  where p.id = v_effective_plan_id;

  if not found then
    raise exception 'plan not found for effective plan id: %', v_effective_plan_id
      using errcode = 'P0002';
  end if;

  if v_reminders_per_line is null then
    return new;
  end if;

  select count(*)
  into v_scheduled_count
  from ultaura_reminders r
  where r.line_id = new.line_id
    and r.status = 'scheduled'
    and (tg_op <> 'UPDATE' or r.id <> new.id);

  if v_scheduled_count >= v_reminders_per_line then
    raise exception 'REMINDER_LIMIT_REACHED: line % allows at most % scheduled reminders', new.line_id, v_reminders_per_line
      using errcode = 'U0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_reminder_limit on ultaura_reminders;

create trigger trg_enforce_reminder_limit
before insert or update on ultaura_reminders
for each row
execute function enforce_reminder_limit();
