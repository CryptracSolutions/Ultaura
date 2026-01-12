-- Topic exclusions for senior-controlled memory categories

create type ultaura_exclusion_category as enum (
  'health_medical',
  'family_relationships',
  'finances',
  'location_address'
);

create table if not exists ultaura_topic_exclusions (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category ultaura_exclusion_category not null,
  excluded boolean not null default false,
  excluded_at timestamptz,
  excluded_call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  reincluded_at timestamptz,
  reincluded_call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  unique (line_id, category)
);

create index if not exists idx_topic_exclusions_line
  on ultaura_topic_exclusions(line_id);

create index if not exists idx_topic_exclusions_excluded
  on ultaura_topic_exclusions(line_id, excluded)
  where excluded = true;

alter table ultaura_topic_exclusions enable row level security;

create policy "Users can view topic exclusions for their accounts"
  on ultaura_topic_exclusions for select
  using (can_access_ultaura_account(account_id));

create or replace function create_topic_exclusions_for_line()
returns trigger as $$
begin
  insert into ultaura_topic_exclusions (line_id, account_id, category, excluded)
  values
    (new.id, new.account_id, 'health_medical', false),
    (new.id, new.account_id, 'family_relationships', false),
    (new.id, new.account_id, 'finances', false),
    (new.id, new.account_id, 'location_address', false)
  on conflict (line_id, category) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_create_topic_exclusions
  after insert on ultaura_lines
  for each row execute function create_topic_exclusions_for_line();

-- Backfill exclusions for existing lines
insert into ultaura_topic_exclusions (line_id, account_id, category, excluded)
select l.id, l.account_id, c.category, false
from ultaura_lines l
cross join (values
  ('health_medical'::ultaura_exclusion_category),
  ('family_relationships'::ultaura_exclusion_category),
  ('finances'::ultaura_exclusion_category),
  ('location_address'::ultaura_exclusion_category)
) as c(category)
on conflict (line_id, category) do nothing;
