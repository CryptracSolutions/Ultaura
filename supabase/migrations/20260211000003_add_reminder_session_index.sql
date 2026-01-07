-- Index for per-session reminder limits

create index if not exists idx_ultaura_reminders_session
  on ultaura_reminders(created_by_call_session_id)
  where created_by_call_session_id is not null;

