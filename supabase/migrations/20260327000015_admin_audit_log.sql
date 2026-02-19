-- Admin audit log: append-only table for tracking all admin actions
create table ultaura_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_user_id uuid not null,
  admin_email text not null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb,
  request_id text,
  ip text,
  user_agent text
);

-- Indexes for common queries
create index idx_admin_audit_log_created on ultaura_admin_audit_log(created_at desc);
create index idx_admin_audit_log_admin on ultaura_admin_audit_log(admin_user_id, created_at desc);
create index idx_admin_audit_log_action on ultaura_admin_audit_log(action, created_at desc);
create index idx_admin_audit_log_target on ultaura_admin_audit_log(target_type, target_id, created_at desc);

-- RLS: enabled, service role only (no user reads/writes)
alter table ultaura_admin_audit_log enable row level security;

comment on table ultaura_admin_audit_log is 'Append-only log of all admin actions for audit trail';
