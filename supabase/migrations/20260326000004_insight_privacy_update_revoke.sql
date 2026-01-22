-- Prevent authenticated users from updating senior-controlled insight privacy fields.

revoke update (private_topic_codes, insights_enabled) on table public.ultaura_insight_privacy from anon, authenticated;
