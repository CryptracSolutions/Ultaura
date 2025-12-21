create extension vector with schema extensions;

-- Create a table to store your documents
create table documents (
  id bigserial primary key,
  content text,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now()
);

alter table documents enable row level security;

-- Create a function to search for documents
create or replace function match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  embedding jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    (embedding::text)::jsonb as embedding,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

create index on documents using ivfflat (embedding vector_cosine_ops)
with
  (lists = 100);