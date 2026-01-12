-- Memory embeddings table for semantic search

create extension if not exists vector with schema extensions;

create table if not exists ultaura_memory_embeddings (
  id uuid primary key default gen_random_uuid(),
  memory_id uuid not null references ultaura_memories(id) on delete cascade,
  line_id uuid not null references ultaura_lines(id) on delete cascade,
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  embedding vector(1536) not null,
  embedding_model text not null default 'text-embedding-3-small',
  embedding_created_at timestamptz not null default now(),
  searchable_text text not null,
  created_at timestamptz not null default now(),
  unique (memory_id)
);

create index if not exists idx_memory_embeddings_vector
  on ultaura_memory_embeddings
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists idx_memory_embeddings_line
  on ultaura_memory_embeddings(line_id);

create index if not exists idx_memory_embeddings_account
  on ultaura_memory_embeddings(account_id);

alter table ultaura_memory_embeddings enable row level security;
-- Service role only access (no user policies)
