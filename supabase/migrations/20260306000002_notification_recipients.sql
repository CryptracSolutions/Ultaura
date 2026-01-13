-- Notification recipients for family sharing

create table if not exists ultaura_notification_recipients (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  name text not null,
  email text not null,
  phone_e164 text,
  relationship text,
  is_trusted_contact boolean not null default false,
  trusted_contact_id uuid references ultaura_trusted_contacts(id) on delete set null,
  confirmation_token_hash text unique,
  confirmation_token_expires_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unique_account_email unique (account_id, email)
);

comment on column ultaura_notification_recipients.relationship is
  'Optional relationship context (e.g., daughter, neighbor, caregiver).';

create index if not exists idx_notification_recipients_account
  on ultaura_notification_recipients(account_id);

create index if not exists idx_notification_recipients_token
  on ultaura_notification_recipients(confirmation_token_hash)
  where confirmation_token_hash is not null;

alter table ultaura_notification_recipients enable row level security;

create policy "Users can view notification recipients for their accounts"
  on ultaura_notification_recipients for select
  using (can_access_ultaura_account(account_id));

create policy "Users can insert notification recipients for their accounts"
  on ultaura_notification_recipients for insert
  with check (can_access_ultaura_account(account_id));

create policy "Users can update notification recipients for their accounts"
  on ultaura_notification_recipients for update
  using (can_access_ultaura_account(account_id));

create policy "Users can delete notification recipients for their accounts"
  on ultaura_notification_recipients for delete
  using (can_access_ultaura_account(account_id));

create or replace function check_notification_recipient_limit()
returns trigger as $$
begin
  if (
    select count(*) from ultaura_notification_recipients
    where account_id = new.account_id
      and unsubscribed_at is null
  ) >= 5 then
    raise exception 'Maximum of 5 notification recipients per account';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger enforce_notification_recipient_limit
  before insert on ultaura_notification_recipients
  for each row execute function check_notification_recipient_limit();
