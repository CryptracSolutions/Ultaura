alter table public.ultaura_reminders
  drop constraint if exists chk_reminder_delivery_method;

alter table public.ultaura_reminders
  add constraint chk_reminder_delivery_method
  check (delivery_method in ('outbound_call', 'sms')) not valid;

alter table public.ultaura_reminders
  validate constraint chk_reminder_delivery_method;
