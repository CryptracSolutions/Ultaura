alter table ultaura_plans
  alter column lines_included drop not null;

update ultaura_plans
set lines_included = null
where id = 'payg'
  and lines_included is not null;
