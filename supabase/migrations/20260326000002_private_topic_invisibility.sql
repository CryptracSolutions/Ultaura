-- Restrict private topic codes to service role access.

revoke select (private_topic_codes) on table public.ultaura_insight_privacy from anon, authenticated;
grant select (private_topic_codes) on table public.ultaura_insight_privacy to service_role;
