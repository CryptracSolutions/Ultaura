-- Separate unsubscribe token storage from confirmation tokens for notification recipients

alter table ultaura_notification_recipients
  add column if not exists unsubscribe_token_hash text,
  add column if not exists unsubscribe_token_expires_at timestamptz;

create unique index if not exists uq_notification_recipients_unsubscribe_token_hash
  on ultaura_notification_recipients(unsubscribe_token_hash)
  where unsubscribe_token_hash is not null;

create index if not exists idx_notification_recipients_unsubscribe_token_expires
  on ultaura_notification_recipients(unsubscribe_token_expires_at)
  where unsubscribe_token_expires_at is not null;
