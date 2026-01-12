-- Memory enhancements: new types, decay fields, functions

alter type ultaura_memory_type add value if not exists 'relationship';
alter type ultaura_memory_type add value if not exists 'temporal';
alter type ultaura_memory_type add value if not exists 'routine';

alter table ultaura_memories
  add column if not exists last_accessed_at timestamptz,
  add column if not exists access_count integer not null default 0,
  add column if not exists pinned boolean not null default false,
  add column if not exists pinned_reason text,
  add column if not exists excluded_category ultaura_exclusion_category,
  add column if not exists embedding_pending boolean not null default false,
  add column if not exists expected_end_date timestamptz,
  add column if not exists expiry_pending boolean not null default false;

create index if not exists idx_memories_decay
  on ultaura_memories (line_id, active, confidence, last_accessed_at)
  where active = true;

create index if not exists idx_memories_pinned
  on ultaura_memories (line_id, pinned)
  where pinned = true and active = true;

create index if not exists idx_memories_excluded
  on ultaura_memories (line_id, excluded_category)
  where excluded_category is not null and active = true;

create index if not exists idx_memories_embedding_pending
  on ultaura_memories (embedding_pending)
  where embedding_pending = true and active = true;

create index if not exists idx_memories_expiry_pending
  on ultaura_memories (expiry_pending, expected_end_date)
  where expiry_pending = true and active = true;

-- Semantic search function with configurable confidence threshold
create or replace function match_memories_semantic(
  p_line_id uuid,
  p_query_embedding vector(1536),
  p_match_count int default 5,
  p_similarity_threshold float default 0.7,
  p_min_confidence float default 0.5
)
returns table (
  memory_id uuid,
  similarity float,
  memory_key text,
  memory_type ultaura_memory_type,
  searchable_text text
)
language plpgsql
security definer
as $$
begin
  return query
  select
    m.id as memory_id,
    1 - (e.embedding <=> p_query_embedding) as similarity,
    m.key as memory_key,
    m.type as memory_type,
    e.searchable_text
  from ultaura_memory_embeddings e
  join ultaura_memories m on m.id = e.memory_id
  where e.line_id = p_line_id
    and m.active = true
    and m.confidence >= p_min_confidence
    and (1 - (e.embedding <=> p_query_embedding)) >= p_similarity_threshold
  order by e.embedding <=> p_query_embedding
  limit p_match_count;
end;
$$;

create or replace function mark_memory_accessed(
  p_memory_id uuid
)
returns void
language plpgsql
security definer
as $$
begin
  update ultaura_memories
  set
    last_accessed_at = now(),
    access_count = access_count + 1,
    confidence = least(1.0, coalesce(confidence, 1.0) + 0.1)
  where id = p_memory_id and active = true;
end;
$$;

create or replace function pin_memory(
  p_memory_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
as $$
begin
  update ultaura_memories
  set
    pinned = true,
    pinned_reason = p_reason,
    confidence = 1.0,
    updated_at = now()
  where id = p_memory_id and active = true;
end;
$$;

create or replace function categorize_memory_topic(
  p_key text,
  p_value text,
  p_type ultaura_memory_type
)
returns ultaura_exclusion_category
language plpgsql
immutable
as $$
declare
  v_combined text;
begin
  v_combined := lower(coalesce(p_key, '') || ' ' || coalesce(p_value, ''));

  if v_combined ~ '(medication|medicine|doctor|hospital|surgery|diagnosis|symptom|pain|prescription|illness|disease|treatment|therapy|medical|nurse|clinic|pharmacy|pill|dose|appointment|checkup|blood pressure|diabetes|arthritis|heart|cancer)' then
    return 'health_medical';
  end if;

  if v_combined ~ '(son|daughter|wife|husband|spouse|grandchild|grandson|granddaughter|family|brother|sister|mother|father|parent|friend|neighbor|caregiver|nephew|niece|aunt|uncle|cousin|in-law|ex-|divorce|marriage|relationship)' then
    return 'family_relationships';
  end if;

  if v_combined ~ '(money|bank|account|bill|payment|insurance|pension|savings|debt|loan|mortgage|income|expense|retire|social security|medicare|medicaid|tax|budget|afford|cost|price|dollar|cent|\$)' then
    return 'finances';
  end if;

  if v_combined ~ '(address|street|avenue|road|apartment|apt|house|home|live|living|location|neighborhood|city|town|state|zip|floor|building|complex|community|facility|residence|move|moved)' then
    return 'location_address';
  end if;

  return null;
end;
$$;

create or replace function calculate_memory_decay(
  p_line_id uuid,
  p_decay_rate numeric default 0.20,
  p_threshold numeric default 0.5
)
returns table (
  memory_id uuid,
  old_confidence numeric,
  new_confidence numeric,
  should_exclude boolean
)
language plpgsql
security definer
as $$
begin
  return query
  with decay_calc as (
    select
      m.id,
      m.confidence as old_conf,
      greatest(
        0,
        coalesce(m.confidence, 1.0) - (
          p_decay_rate *
          extract(epoch from (now() - coalesce(m.last_accessed_at, m.created_at))) /
          (30 * 24 * 60 * 60)
        )
      ) as new_conf
    from ultaura_memories m
    where m.line_id = p_line_id
      and m.active = true
      and m.pinned = false
      and m.confidence is not null
  )
  select
    dc.id as memory_id,
    dc.old_conf as old_confidence,
    dc.new_conf::numeric as new_confidence,
    dc.new_conf < p_threshold as should_exclude
  from decay_calc dc
  where dc.new_conf < dc.old_conf;
end;
$$;

create or replace function apply_memory_decay(
  p_line_id uuid,
  p_decay_rate numeric default 0.20,
  p_threshold numeric default 0.5
)
returns integer
language plpgsql
security definer
as $$
declare
  v_updated_count integer := 0;
begin
  with decay_results as (
    select memory_id, new_confidence, should_exclude
    from calculate_memory_decay(p_line_id, p_decay_rate, p_threshold)
  )
  update ultaura_memories m
  set
    confidence = dr.new_confidence,
    updated_at = now()
  from decay_results dr
  where m.id = dr.memory_id;

  get diagnostics v_updated_count = row_count;

  insert into ultaura_memory_deactivation_log (
    memory_id, memory_key, line_id, account_id, reason, confidence_at_deactivation
  )
  select
    m.id, m.key, m.line_id, m.account_id, 'decay', m.confidence
  from ultaura_memories m
  where m.line_id = p_line_id
    and m.active = true
    and m.confidence < p_threshold
    and m.pinned = false
    and not exists (
      select 1 from ultaura_memory_deactivation_log l
      where l.memory_id = m.id and l.reason = 'decay' and l.restored_at is null
    );

  return v_updated_count;
end;
$$;

-- Scheduler lease entries for memory jobs
insert into ultaura_scheduler_leases (id)
values ('decay-job'), ('embeddings')
on conflict (id) do nothing;
