-- Voice consent per line

create type ultaura_voice_consent_status as enum ('pending', 'granted', 'denied');

create table ultaura_line_voice_consent (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Memory consent (required for personalization)
  memory_consent ultaura_voice_consent_status not null default 'pending',
  memory_consent_at timestamptz,
  memory_consent_call_session_id uuid references ultaura_call_sessions(id) on delete set null,
  last_consent_prompt_at timestamptz,

  unique(line_id)
);

create index idx_voice_consent_line on ultaura_line_voice_consent(line_id);
create index idx_voice_consent_account on ultaura_line_voice_consent(account_id);

alter table ultaura_line_voice_consent enable row level security;

create policy "Users can view voice consent for their accounts"
  on ultaura_line_voice_consent for select
  using (can_access_ultaura_account(account_id));

-- Auto-create row for new lines
create or replace function create_voice_consent_for_line()
returns trigger as $$
begin
  insert into ultaura_line_voice_consent (line_id, account_id)
  values (new.id, new.account_id);
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_create_voice_consent
after insert on ultaura_lines
for each row execute function create_voice_consent_for_line();

-- Backfill existing lines (if any)
insert into ultaura_line_voice_consent (line_id, account_id)
select id, account_id from ultaura_lines
on conflict (line_id) do nothing;
