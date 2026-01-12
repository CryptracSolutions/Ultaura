-- Reduce advisory lock collisions for memory upsert

create or replace function upsert_ultaura_memory(
  p_account_id uuid,
  p_line_id uuid,
  p_type ultaura_memory_type,
  p_key text,
  p_value_ciphertext bytea,
  p_value_iv bytea,
  p_value_tag bytea,
  p_value_alg text,
  p_value_kid text,
  p_confidence numeric,
  p_source text,
  p_privacy_scope ultaura_privacy_scope,
  p_redaction_level text,
  p_memory_id uuid
)
returns table (
  memory_id uuid,
  action text,
  version int
)
language plpgsql
security definer
as $$
declare
  v_existing ultaura_memories%rowtype;
  v_new_version int := 1;
  v_action text := 'created';
begin
  perform pg_advisory_xact_lock(hashtext(p_line_id::text), hashtext(lower(p_key)));

  select * into v_existing
  from ultaura_memories
  where line_id = p_line_id
    and account_id = p_account_id
    and lower(key) = lower(p_key)
    and active = true
  for update;

  if found then
    update ultaura_memories
      set active = false,
          updated_at = now()
    where id = v_existing.id;

    v_new_version := v_existing.version + 1;
    v_action := 'updated';
  end if;

  insert into ultaura_memories (
    id,
    account_id,
    line_id,
    type,
    key,
    value_ciphertext,
    value_iv,
    value_tag,
    value_alg,
    value_kid,
    confidence,
    source,
    version,
    active,
    privacy_scope,
    redaction_level,
    updated_at
  ) values (
    p_memory_id,
    p_account_id,
    p_line_id,
    p_type,
    p_key,
    p_value_ciphertext,
    p_value_iv,
    p_value_tag,
    p_value_alg,
    p_value_kid,
    p_confidence,
    p_source,
    v_new_version,
    true,
    p_privacy_scope,
    p_redaction_level,
    now()
  );

  memory_id := p_memory_id;
  action := v_action;
  version := v_new_version;
  return next;
end;
$$;
