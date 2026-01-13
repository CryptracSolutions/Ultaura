-- Workflow fit account fields

alter table ultaura_accounts
  add column if not exists user_type text not null default 'family_managed'
    check (user_type in ('self', 'family_managed'));

alter table ultaura_accounts
  add column if not exists sharing_enabled boolean not null default true;

alter table ultaura_accounts
  add column if not exists sharing_enabled_at timestamptz;

comment on column ultaura_accounts.user_type is
  'Workflow type: self (senior using for themselves) or family_managed (caregiver managing for loved one)';

comment on column ultaura_accounts.sharing_enabled is
  'Whether data sharing is enabled. Self users default to false, family_managed defaults to true';

comment on column ultaura_accounts.sharing_enabled_at is
  'Timestamp when sharing was enabled. Data before this timestamp is not shared';

-- Backfill existing rows to preserve previous behavior
update ultaura_accounts
set user_type = 'family_managed',
    sharing_enabled = true,
    sharing_enabled_at = null
where user_type is null;
