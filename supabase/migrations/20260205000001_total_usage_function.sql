create or replace function get_ultaura_total_usage(p_account_id uuid)
returns table(
  total_minutes int,
  total_cost_cents int
)
language sql
stable
as $$
  select
    coalesce(sum(billable_minutes), 0)::int as total_minutes,
    (coalesce(sum(billable_minutes), 0) * 15)::int as total_cost_cents
  from ultaura_minute_ledger
  where account_id = p_account_id
$$;
