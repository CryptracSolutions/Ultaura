-- Backup and truncate call events to remove historical sensitive payloads

create table if not exists ultaura_call_events_export_backup (
  like ultaura_call_events including all
);

insert into ultaura_call_events_export_backup
select * from ultaura_call_events;

create table if not exists ultaura_migration_log (
  id uuid primary key default gen_random_uuid(),
  migration_name text not null,
  executed_at timestamptz not null default now(),
  record_count bigint,
  notes text
);

insert into ultaura_migration_log (migration_name, record_count, notes)
select
  'call_events_privacy_cleanup',
  count(*),
  'Pre-deletion backup created in ultaura_call_events_export_backup'
from ultaura_call_events;

truncate table ultaura_call_events;
