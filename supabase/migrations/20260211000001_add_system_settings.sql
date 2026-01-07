-- System settings for global toggles (service role access only)

create table if not exists ultaura_system_settings (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

alter table ultaura_system_settings enable row level security;

insert into ultaura_system_settings (key, value)
values ('verification_disabled', '{"enabled": false, "reason": null, "disabled_at": null}'::jsonb)
on conflict (key) do nothing;

