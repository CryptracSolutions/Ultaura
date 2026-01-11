-- Consent audit log

create type ultaura_consent_audit_action as enum (
  'granted',
  'revoked',
  'updated',
  'voice_consent_given',
  'voice_consent_denied',
  'retention_changed',
  'recording_toggled',
  'summarization_toggled',
  'vendor_acknowledged',
  'data_export_requested',
  'data_deletion_requested'
);

create table ultaura_consent_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- Who
  account_id uuid not null references ultaura_accounts(id) on delete cascade,
  line_id uuid references ultaura_lines(id) on delete set null,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('payer', 'line_voice', 'system')),

  -- What
  action ultaura_consent_audit_action not null,
  consent_type text,
  old_value jsonb,
  new_value jsonb,

  -- Where
  ip_address inet,
  user_agent text,
  call_session_id uuid references ultaura_call_sessions(id) on delete set null,

  -- Context
  metadata jsonb
);

create index idx_audit_log_account_created on ultaura_consent_audit_log(account_id, created_at desc);
create index idx_audit_log_action on ultaura_consent_audit_log(action, created_at desc);
create index idx_audit_log_line on ultaura_consent_audit_log(line_id, created_at desc) where line_id is not null;

alter table ultaura_consent_audit_log enable row level security;

create policy "Users can view audit logs for their accounts"
  on ultaura_consent_audit_log for select
  using (can_access_ultaura_account(account_id));

-- No insert/update/delete policies for users - service role only for immutability
