-- Memory hard deletion support and deactivated retention cleanup

alter type ultaura_consent_audit_action add value if not exists 'memory_hard_deleted';

create or replace function delete_ultaura_memories_for_key(
  p_account_id uuid,
  p_line_id uuid,
  p_key text
)
returns int
language plpgsql
security definer
as $$
declare
  v_deleted int := 0;
begin
  with deleted as (
    delete from ultaura_memories
    where account_id = p_account_id
      and line_id = p_line_id
      and lower(key) = lower(p_key)
    returning id
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

create or replace function cleanup_account_retention(p_account_id uuid)
returns jsonb as $$
declare
  v_cutoff timestamptz;
  v_deleted_memories int := 0;
  v_deleted_deactivated_memories int := 0;
  v_deleted_deactivated_lines jsonb := '[]'::jsonb;
  v_deleted_insights int := 0;
  v_queued_recordings int := 0;
begin
  v_cutoff := get_retention_cutoff(p_account_id);

  -- Hard delete deactivated memories older than 30 days
  with deleted as (
    delete from ultaura_memories
    where account_id = p_account_id
      and active = false
      and updated_at < now() - interval '30 days'
    returning line_id
  ),
  counts as (
    select line_id, count(*) as count
    from deleted
    group by line_id
  )
  select
    coalesce(sum(count), 0),
    coalesce(
      jsonb_agg(jsonb_build_object('line_id', line_id, 'count', count)),
      '[]'::jsonb
    )
  into v_deleted_deactivated_memories, v_deleted_deactivated_lines
  from counts;

  if v_deleted_deactivated_memories > 0 then
    insert into ultaura_consent_audit_log (
      account_id,
      actor_type,
      action,
      consent_type,
      old_value,
      metadata
    ) values (
      p_account_id,
      'system',
      'memory_hard_deleted',
      'data_retention',
      jsonb_build_object('count', v_deleted_deactivated_memories),
      jsonb_build_object('trigger', 'retention_cleanup', 'lines', v_deleted_deactivated_lines)
    );
  end if;

  if v_cutoff is null then
    return jsonb_build_object(
      'skipped', true,
      'reason', 'indefinite_retention',
      'deleted_deactivated_memories', v_deleted_deactivated_memories
    );
  end if;

  -- Hard delete active memories older than cutoff
  with deleted as (
    delete from ultaura_memories
    where account_id = p_account_id
      and active = true
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
    'deleted_deactivated_memories', v_deleted_deactivated_memories,
    'deleted_insights', v_deleted_insights,
    'queued_recordings', v_queued_recordings,
    'cutoff_date', v_cutoff
  );
end;
$$ language plpgsql security definer;
