-- Privacy integrity hardening: prevent duplicate in-progress exports per account

with ranked as (
  select
    id,
    row_number() over (
      partition by account_id
      order by created_at desc
    ) as rn
  from ultaura_data_export_requests
  where status in ('pending', 'processing')
)
update ultaura_data_export_requests r
set
  status = 'failed',
  processed_at = now(),
  error_message = coalesce(error_message, 'Superseded by a newer export request')
from ranked
where r.id = ranked.id
  and ranked.rn > 1;

create unique index if not exists idx_export_requests_one_in_progress_per_account
  on ultaura_data_export_requests(account_id)
  where status in ('pending', 'processing');
