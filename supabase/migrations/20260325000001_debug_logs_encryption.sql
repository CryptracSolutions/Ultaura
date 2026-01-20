alter table ultaura_debug_logs
  add column if not exists payload_ciphertext bytea,
  add column if not exists payload_iv bytea,
  add column if not exists payload_tag bytea,
  add column if not exists payload_alg text default 'aes-256-gcm',
  add column if not exists payload_kid text default 'kek_v1',
  add column if not exists payload_summary jsonb;
