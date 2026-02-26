alter table public.ultaura_trusted_contacts
add column if not exists user_id uuid references auth.users(id) on delete set null;

create unique index if not exists idx_ultaura_trusted_contacts_user_line_unique
  on public.ultaura_trusted_contacts (user_id, line_id)
  where user_id is not null;
