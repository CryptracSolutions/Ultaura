alter table ultaura_plans
  drop constraint if exists ultaura_plans_lines_included_payg_null_guard;

alter table ultaura_plans
  add constraint ultaura_plans_lines_included_payg_null_guard
  check (lines_included is not null or id = 'payg') not valid;
