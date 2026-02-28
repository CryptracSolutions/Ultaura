-- Enforce notification recipient limit during reactivation updates.

create or replace function check_notification_recipient_limit_on_reactivate()
returns trigger as $$
begin
  if old.unsubscribed_at is not null and new.unsubscribed_at is null then
    if (
      select count(*) from ultaura_notification_recipients
      where account_id = new.account_id
        and unsubscribed_at is null
        and id <> new.id
    ) >= 5 then
      raise exception 'Maximum of 5 notification recipients per account';
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_notification_recipient_limit_on_reactivate
  on ultaura_notification_recipients;

create trigger enforce_notification_recipient_limit_on_reactivate
  before update of unsubscribed_at on ultaura_notification_recipients
  for each row
  when (old.unsubscribed_at is not null and new.unsubscribed_at is null)
  execute function check_notification_recipient_limit_on_reactivate();
