-- Per-line usage: index and query functions
-- Adds an index on minute_ledger(line_id, created_at) and two SQL functions
-- for querying usage at the individual line level.

-- Index for per-line usage queries
create index if not exists idx_ultaura_ledger_line_created
  on ultaura_minute_ledger(line_id, created_at);

-- Get usage for a single line
create or replace function get_ultaura_line_usage(p_line_id uuid)
returns table(
  cycle_minutes int,
  total_minutes int,
  cycle_start timestamptz,
  cycle_end timestamptz
)
language sql
stable
as $$
  select
    coalesce((select sum(billable_minutes) from ultaura_minute_ledger
       where line_id = p_line_id
       and created_at >= a.cycle_start
       and created_at < a.cycle_end), 0)::int as cycle_minutes,
    coalesce((select sum(billable_minutes) from ultaura_minute_ledger
       where line_id = p_line_id), 0)::int as total_minutes,
    a.cycle_start,
    a.cycle_end
  from ultaura_lines l
  join ultaura_accounts a on a.id = l.account_id
  where l.id = p_line_id
$$;

-- Get per-line usage breakdown for all lines in an account
create or replace function get_ultaura_per_line_usage(p_account_id uuid)
returns table(
  line_id uuid,
  display_name text,
  status ultaura_line_status,
  cycle_minutes int,
  total_minutes int
)
language sql
stable
as $$
  select
    l.id as line_id,
    l.display_name,
    l.status,
    coalesce((select sum(billable_minutes) from ultaura_minute_ledger m
       where m.line_id = l.id
       and m.created_at >= a.cycle_start
       and m.created_at < a.cycle_end), 0)::int as cycle_minutes,
    coalesce((select sum(billable_minutes) from ultaura_minute_ledger m
       where m.line_id = l.id), 0)::int as total_minutes
  from ultaura_lines l
  join ultaura_accounts a on a.id = l.account_id
  where l.account_id = p_account_id
  order by l.created_at asc
$$;
