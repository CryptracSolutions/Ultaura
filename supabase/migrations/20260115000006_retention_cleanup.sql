-- Retention cleanup and recording deletion queue

create table if not exists ultaura_pending_recording_deletions (
  id uuid primary key default gen_random_uuid(),
  recording_sid text not null,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  reason text not null check (reason in ('retention_policy', 'user_request', 'account_deletion')),
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,

  unique(recording_sid)
);

create index if not exists idx_pending_deletions_status
  on ultaura_pending_recording_deletions(processed_at, attempts)
  where processed_at is null;

alter table ultaura_pending_recording_deletions enable row level security;

-- Function to calculate retention cutoff date
create or replace function get_retention_cutoff(p_account_id uuid)
returns timestamptz as $$
declare
  v_retention_period ultaura_retention_period;
  v_cutoff timestamptz;
begin
  select retention_period into v_retention_period
  from ultaura_account_privacy_settings
  where account_id = p_account_id;

  if v_retention_period is null or v_retention_period = 'indefinite' then
    return null;
  end if;

  case v_retention_period
    when '30_days' then v_cutoff := now() - interval '30 days';
    when '90_days' then v_cutoff := now() - interval '90 days';
    when '365_days' then v_cutoff := now() - interval '365 days';
    else v_cutoff := null;
  end case;

  return v_cutoff;
end;
$$ language plpgsql security definer;

-- Function to cleanup data for a single account (queues recordings for deletion)
create or replace function cleanup_account_retention(p_account_id uuid)
returns jsonb as $$
declare
  v_cutoff timestamptz;
  v_deleted_memories int := 0;
  v_deleted_insights int := 0;
  v_queued_recordings int := 0;
begin
  v_cutoff := get_retention_cutoff(p_account_id);

  if v_cutoff is null then
    return jsonb_build_object('skipped', true, 'reason', 'indefinite_retention');
  end if;

  -- Hard delete memories older than cutoff
  with deleted as (
    delete from ultaura_memories
    where account_id = p_account_id
      and created_at < v_cutoff
    returning id
  )
  select count(*) into v_deleted_memories from deleted;

  -- Hard delete call insights older than cutoff
  with deleted as (
    delete from ultaura_call_insights
    where account_id = p_account_id
      and created_at < v_cutoff
    returning id
  )
  select count(*) into v_deleted_insights from deleted;

  -- Queue recording SIDs for deletion
  insert into ultaura_pending_recording_deletions (
    recording_sid,
    account_id,
    call_session_id,
    reason
  )
  select recording_sid, account_id, id, 'retention_policy'
  from ultaura_call_sessions
  where account_id = p_account_id
    and created_at < v_cutoff
    and recording_sid is not null
    and recording_deleted_at is null
  on conflict (recording_sid) do nothing;

  get diagnostics v_queued_recordings = row_count;

  return jsonb_build_object(
    'deleted_memories', v_deleted_memories,
    'deleted_insights', v_deleted_insights,
    'queued_recordings', v_queued_recordings,
    'cutoff_date', v_cutoff
  );
end;
$$ language plpgsql security definer;

-- Function to run cleanup for all accounts (called by cron)
create or replace function run_retention_cleanup()
returns jsonb as $$
declare
  v_account record;
  v_result jsonb;
  v_total_memories int := 0;
  v_total_insights int := 0;
  v_total_queued int := 0;
begin
  for v_account in
    select account_id from ultaura_account_privacy_settings
    where retention_period != 'indefinite'
  loop
    v_result := cleanup_account_retention(v_account.account_id);
    v_total_memories := v_total_memories + coalesce((v_result->>'deleted_memories')::int, 0);
    v_total_insights := v_total_insights + coalesce((v_result->>'deleted_insights')::int, 0);
    v_total_queued := v_total_queued + coalesce((v_result->>'queued_recordings')::int, 0);
  end loop;

  return jsonb_build_object(
    'total_deleted_memories', v_total_memories,
    'total_deleted_insights', v_total_insights,
    'total_recordings_queued', v_total_queued,
    'completed_at', now()
  );
end;
$$ language plpgsql security definer;

-- Schedule daily cleanup at 3 AM UTC (requires pg_cron extension)
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'retention-cleanup-daily',
  '0 3 * * *',
  $$select run_retention_cleanup()$$
);
