-- Ensure service_role can update senior-controlled insight privacy fields.
--
-- NOTE: Do not edit previously-applied migrations. If additional grants are required,
-- add them in a new migration like this one.

grant update (private_topic_codes, insights_enabled) on table public.ultaura_insight_privacy to service_role;
