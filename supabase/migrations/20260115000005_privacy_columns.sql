-- Privacy-related columns and indexes

-- Track recording deletions on call sessions
alter table ultaura_call_sessions
  add column if not exists recording_deleted_at timestamptz,
  add column if not exists recording_deletion_reason text check (
    recording_deletion_reason in ('retention_policy', 'user_request', 'account_deletion')
  );

-- Indexes for retention cleanup
create index if not exists idx_memories_created_active
  on ultaura_memories(created_at, active) where active = true;
create index if not exists idx_call_sessions_created
  on ultaura_call_sessions(created_at);
create index if not exists idx_call_insights_created
  on ultaura_call_insights(created_at);
