drop function if exists get_ultaura_total_usage(uuid);

create or replace function get_ultaura_total_usage(p_account_id uuid)
returns table(
  total_minutes int,
  total_cost_cents int,
  trial_minutes int,
  included_minutes int,
  overage_minutes int,
  payg_minutes int
)
language sql
stable
as $$
  select
    coalesce(sum(billable_minutes), 0)::int as total_minutes,
    coalesce(sum(
      case when billable_type in ('overage', 'payg')
           then billable_minutes else 0 end
    ) * 15, 0)::int as total_cost_cents,
    coalesce(sum(case when billable_type = 'trial'    then billable_minutes else 0 end), 0)::int,
    coalesce(sum(case when billable_type = 'included' then billable_minutes else 0 end), 0)::int,
    coalesce(sum(case when billable_type = 'overage'  then billable_minutes else 0 end), 0)::int,
    coalesce(sum(case when billable_type = 'payg'     then billable_minutes else 0 end), 0)::int
  from ultaura_minute_ledger
  where account_id = p_account_id
$$;

create or replace function get_ultaura_monthly_usage(p_account_id uuid)
returns table(
  month text,
  trial_minutes int,
  included_minutes int,
  overage_minutes int,
  payg_minutes int
)
language sql
stable
as $$
  select
    to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
    coalesce(sum(case when billable_type = 'trial'    then billable_minutes else 0 end), 0)::int,
    coalesce(sum(case when billable_type = 'included' then billable_minutes else 0 end), 0)::int,
    coalesce(sum(case when billable_type = 'overage'  then billable_minutes else 0 end), 0)::int,
    coalesce(sum(case when billable_type = 'payg'     then billable_minutes else 0 end), 0)::int
  from ultaura_minute_ledger
  where account_id = p_account_id
  group by date_trunc('month', created_at)
  order by date_trunc('month', created_at) asc
$$;
