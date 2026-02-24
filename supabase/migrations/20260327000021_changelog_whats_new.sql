-- Product changelog entries and per-user dashboard dismissal state.

create table if not exists public.ultaura_changelog_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  category text not null,
  published boolean not null default false,
  published_at timestamptz,
  publish_batch_id uuid,
  email_sent boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ultaura_changelog_entries_title_nonempty
    check (char_length(btrim(title)) > 0),
  constraint ultaura_changelog_entries_description_nonempty
    check (char_length(btrim(description)) > 0),
  constraint ultaura_changelog_entries_category_check
    check (category in ('new_feature', 'improvement', 'fix', 'announcement')),
  constraint ultaura_changelog_entries_publish_fields_match
    check (
      (published = false and published_at is null and publish_batch_id is null)
      or (published = true and published_at is not null and publish_batch_id is not null)
    )
);

create index if not exists idx_changelog_entries_published_recent
  on public.ultaura_changelog_entries (published_at desc, sort_order asc, created_at desc)
  where published = true;

create index if not exists idx_changelog_entries_drafts
  on public.ultaura_changelog_entries (created_at desc)
  where published = false;

create index if not exists idx_changelog_entries_publish_batch
  on public.ultaura_changelog_entries (publish_batch_id)
  where publish_batch_id is not null;

alter table public.ultaura_changelog_entries enable row level security;

create policy "Authenticated users can view published changelog entries"
  on public.ultaura_changelog_entries for select to authenticated
  using (published = true);

comment on table public.ultaura_changelog_entries is
  'Product changelog entries shown in the dashboard What''s New experience and changelog emails.';

create table if not exists public.ultaura_changelog_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  last_seen_entry_id uuid references public.ultaura_changelog_entries(id) on delete set null,
  last_seen_published_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ultaura_changelog_dismissals_user_id_unique unique (user_id)
);

alter table public.ultaura_changelog_dismissals enable row level security;

create policy "Users can view their own changelog dismissals"
  on public.ultaura_changelog_dismissals for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own changelog dismissals"
  on public.ultaura_changelog_dismissals for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own changelog dismissals"
  on public.ultaura_changelog_dismissals for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.ultaura_changelog_dismissals is
  'Per-user last-seen marker for dashboard What''s New changelog announcements.';
