alter table ultaura_reminders
  add column if not exists search_tokens text[] default '{}';

comment on column ultaura_reminders.search_tokens is 'Hashed search tokens for reminder search (HMAC-SHA256).';

create index if not exists idx_ultaura_reminders_search_tokens
  on ultaura_reminders using gin (search_tokens);
