-- Adds consent fields and audit actions for senior privacy hardening.

alter table public.ultaura_line_voice_consent
  add column if not exists recording_reenable_decline_count integer not null default 0,
  add column if not exists recording_reenable_blocked_at timestamptz null,
  add column if not exists insights_reprompt_requested_at timestamptz null;

alter type public.ultaura_consent_audit_action add value if not exists 'insights_enabled_changed';
alter type public.ultaura_consent_audit_action add value if not exists 'pause_mode_changed';
alter type public.ultaura_consent_audit_action add value if not exists 'insights_reprompt_requested';
