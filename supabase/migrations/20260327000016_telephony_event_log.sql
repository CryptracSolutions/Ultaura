-- Telephony event log: wire-level telemetry for Twilio webhooks
create table ultaura_telephony_event_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  account_id uuid,
  line_id uuid,
  call_session_id uuid,
  provider text not null default 'twilio',
  event_type text not null,
  provider_id text,
  payload jsonb,
  payload_redacted jsonb,
  severity text not null default 'info' check (severity in ('info', 'warn', 'error')),
  processed boolean not null default false
);

-- Indexes for timeline queries and lookups
create index idx_telephony_event_log_session on ultaura_telephony_event_log(call_session_id, created_at desc);
create index idx_telephony_event_log_line on ultaura_telephony_event_log(line_id, created_at desc);
create index idx_telephony_event_log_account on ultaura_telephony_event_log(account_id, created_at desc);
create index idx_telephony_event_log_provider_id on ultaura_telephony_event_log(provider_id);
create index idx_telephony_event_log_type on ultaura_telephony_event_log(event_type, created_at desc);

-- RLS: enabled, service role only
alter table ultaura_telephony_event_log enable row level security;

comment on table ultaura_telephony_event_log is 'Wire-level telemetry of Twilio webhook payloads for debugging and timeline';
