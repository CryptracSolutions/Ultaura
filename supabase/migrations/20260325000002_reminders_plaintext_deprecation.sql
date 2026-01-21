-- Deprecate plaintext reminder storage.
-- New writes should store only encrypted fields, and plaintext should be cleared once ciphertext exists.

alter table ultaura_reminders
  alter column message drop not null;

update ultaura_reminders
  set message = null
  where message_ciphertext is not null and message is not null;

alter table ultaura_reminders
  add constraint ultaura_reminders_no_plaintext_with_ciphertext
  check (message_ciphertext is null or message is null);

-- `ultaura_call_sessions.reminder_message` was an earlier denormalization attempt and is no longer used.
alter table ultaura_call_sessions
  drop column if exists reminder_message;

