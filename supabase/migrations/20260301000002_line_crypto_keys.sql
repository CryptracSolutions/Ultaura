-- Per-line crypto keys for memory encryption

create table if not exists ultaura_line_crypto_keys (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references ultaura_lines(id) on delete cascade unique,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  dek_wrapped bytea not null,
  dek_wrap_iv bytea not null,
  dek_wrap_tag bytea not null,
  dek_kid text not null default 'kek_v1',
  dek_alg text not null default 'AES-256-GCM',
  rotated_at timestamptz
);

create unique index if not exists idx_line_crypto_keys_line
  on ultaura_line_crypto_keys(line_id);

alter table ultaura_line_crypto_keys enable row level security;
-- Service role only access (no user policies)
