-- Add consent audit action for recording re-enable requests.

alter type public.ultaura_consent_audit_action add value if not exists 'recording_reenable_requested';
