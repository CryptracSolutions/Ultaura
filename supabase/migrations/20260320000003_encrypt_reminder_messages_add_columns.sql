alter table ultaura_reminders
  add column if not exists message_ciphertext bytea,
  add column if not exists message_iv bytea,
  add column if not exists message_tag bytea,
  add column if not exists message_alg text default 'AES-256-GCM',
  add column if not exists message_kid text default 'kek_v1';

comment on column ultaura_reminders.message_ciphertext is 'AES-256-GCM encrypted reminder message';
comment on column ultaura_reminders.message_iv is 'IV for reminder message encryption';
comment on column ultaura_reminders.message_tag is 'GCM tag for reminder message encryption';
comment on column ultaura_reminders.message_alg is 'Encryption algorithm label';
comment on column ultaura_reminders.message_kid is 'Key id label';
