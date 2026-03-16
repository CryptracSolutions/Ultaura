-- =============================================================================
-- ULTAURA COMPREHENSIVE SEED FILE
-- Generated: 2026-02-19
-- 1 account (Johnson Family), 4 lines, ~500+ call sessions (36 recent + ~470 historical), all 71 tables
-- =============================================================================

BEGIN;

-- Disable ALL triggers (RLS bypass + FK deferred cascade ordering)
SET session_replication_role = 'replica';

-- =============================================================================
-- SECTION 0: TRUNCATE all user-seeded tables
-- NOTE: Do NOT truncate ultaura_plans, ultaura_scheduler_leases,
--       ultaura_system_settings — those contain migration-seeded data.
-- =============================================================================

TRUNCATE TABLE
  -- Newsletter (no FK deps on core tables)
  ultaura_newsletter_topic_subscriptions,
  ultaura_newsletter_webhook_events,
  ultaura_newsletter_rate_limits,
  ultaura_newsletter_subscribers,

  -- Ops & debug
  ultaura_admin_audit_log,
  ultaura_onboarding_state,
  ultaura_debug_logs,
  ultaura_telephony_event_log,
  ultaura_rate_limit_events,
  ultaura_pending_recording_deletions,
  ultaura_sms_opt_outs,

  -- Non-core public tables
  documents,
  feedback_submissions,

  -- Personalization / derived
  ultaura_persona_adaptations,
  ultaura_daily_rhythms,
  ultaura_content_preferences,
  ultaura_accessibility_settings,
  ultaura_emotional_patterns,
  ultaura_life_chapters,
  ultaura_story_arcs,
  ultaura_segment_engagement,
  ultaura_call_previews,

  -- Insights & baselines
  ultaura_cognitive_flags,
  ultaura_cognitive_observations,
  ultaura_line_baselines,
  ultaura_call_insights,
  ultaura_mood_snapshots,
  ultaura_health_mentions,
  ultaura_weekly_summaries,

  -- Notifications & wellness
  ultaura_notification_preferences,
  ultaura_notification_recipients,
  ultaura_wellness_alerts,

  -- Safety
  ultaura_safety_events,

  -- Privacy & consent
  ultaura_consent_audit_log,
  ultaura_consents,
  ultaura_opt_outs,
  ultaura_insight_privacy,
  ultaura_account_privacy_settings,
  ultaura_line_voice_consent,
  ultaura_topic_exclusions,
  ultaura_data_export_requests,

  -- Events & scheduling
  ultaura_reminder_events,
  ultaura_schedule_events,
  ultaura_call_events,
  ultaura_schedule_exceptions,
  ultaura_grief_interactions,

  -- Ledger & usage
  ultaura_minute_ledger,
  ultaura_trial_daily_cap_reservations,

  -- Core call & schedule
  ultaura_call_sessions,
  ultaura_reminders,
  ultaura_schedules,

  -- Relationships & contacts
  ultaura_relationships,
  ultaura_trusted_contacts,
  ultaura_milestones,

  -- Memories
  ultaura_memory_deactivation_log,
  ultaura_memory_embeddings,
  ultaura_memories,

  -- Crypto keys
  ultaura_line_crypto_keys,
  ultaura_account_crypto_keys,

  -- Lines & verifications
  ultaura_phone_verifications,
  ultaura_lines,

  -- Subscriptions & accounts
  ultaura_subscriptions,
  ultaura_accounts

CASCADE;

-- Truncate public/auth tables
TRUNCATE TABLE
  public.organizations_subscriptions,
  public.subscriptions,
  public.memberships
CASCADE;

DELETE FROM public.users
WHERE id IN (
  'aaaaaaaa-0000-4000-a000-000000000001'
);

DELETE FROM auth.users WHERE email LIKE '%@ultaura-seed.test';
DELETE FROM auth.identities WHERE provider_id LIKE '%@ultaura-seed.test';

DELETE FROM public.organizations WHERE name = 'Johnson Family';

-- =============================================================================
-- UUID REFERENCE GUIDE
-- =============================================================================
-- Users:
--   payer@ultaura-seed.test  → aaaaaaaa-0000-4000-a000-000000000001
--
-- Organization: id=1 (Johnson Family)
--
-- Account:
--   bbbbbbbb-0000-4000-a000-000000000001  (Johnson Family, family plan)
--
-- Lines:
--   cccccccc-0000-4000-a000-000000000001  Margaret Johnson  (Eve,  ET)
--   cccccccc-0000-4000-a000-000000000002  Robert Chen       (Leo,  CT)
--   cccccccc-0000-4000-a000-000000000003  Eleanor Martinez  (Ara,  MT)
--   cccccccc-0000-4000-a000-000000000004  James Wilson      (Sal,  PT)
--
-- Schedules: dddddddd-0000-4000-a000-000000000001 through ...007
-- Trusted Contacts: 11111111-0000-4000-a000-000000000001 through ...009
-- Call Sessions: ffffffff-0000-4000-a000-000000000001 through ...036
-- Reminders: eeeeeeee-0000-4000-a000-000000000001 through ...012
-- Mood Snapshots: aabbccdd-0000-4000-a000-000000000001 through ...028
-- Call Insights: 77777777-0000-4000-a000-000000000001 through ...028
-- Minute Ledger: aabbccee-0000-4000-a000-000000000001 through ...028
--
-- Historical data (Section 37B) uses md5('hist-<table>-' || line_id || '-' || date)::uuid
-- for deterministic UUID generation (~470 sessions across 6 months).
-- =============================================================================

-- =============================================================================
-- SECTION 1: AUTH USERS
-- =============================================================================

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) VALUES
(
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-0000-4000-a000-000000000001',
  'authenticated', 'authenticated',
  'payer@ultaura-seed.test',
  crypt('testingpassword', gen_salt('bf')),
  NOW() - INTERVAL '30 days',
  '{"provider": "email", "providers": ["email"], "role": "super-admin"}',
  '{}',
  NOW() - INTERVAL '30 days', NOW(), '', '', '', ''
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 2: AUTH IDENTITIES
-- =============================================================================

INSERT INTO auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) VALUES
(
  'aaaaaaaa-0000-4000-a000-000000000001',
  'aaaaaaaa-0000-4000-a000-000000000001',
  'payer@ultaura-seed.test',
  '{"sub": "aaaaaaaa-0000-4000-a000-000000000001", "email": "payer@ultaura-seed.test"}',
  'email', NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 days', NOW()
)
ON CONFLICT (provider_id, provider) DO NOTHING;

-- =============================================================================
-- SECTION 3: PUBLIC USERS, ORG, MEMBERSHIPS, STRIPE SUBSCRIPTIONS
-- =============================================================================

INSERT INTO public.users (id, onboarded, created_at) VALUES
('aaaaaaaa-0000-4000-a000-000000000001', true, NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations (id, name, created_at)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Johnson Family', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Sync the identity sequence past any seed-inserted ids so test helpers
-- (which rely on auto-generated ids) never collide with seed data.
SELECT setval(
  pg_get_serial_sequence('organizations', 'id'),
  COALESCE((SELECT MAX(id) FROM organizations), 1)
);

-- payer = role 2 (owner)
INSERT INTO public.memberships (user_id, organization_id, role, created_at) VALUES
('aaaaaaaa-0000-4000-a000-000000000001', 1, 2, NOW() - INTERVAL '30 days')
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Stripe subscription
INSERT INTO public.subscriptions (
  id, price_id, status, cancel_at_period_end,
  interval, interval_count,
  period_starts_at, period_ends_at,
  created_at
) VALUES (
  'sub_seed_family_monthly',
  'price_family_monthly',
  'active',
  false,
  'month', 1,
  NOW() - INTERVAL '15 days',
  NOW() + INTERVAL '15 days',
  NOW() - INTERVAL '30 days'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organizations_subscriptions (
  organization_id, subscription_id, customer_id
) VALUES (
  1,
  'sub_seed_family_monthly',
  'cus_seed_johnson_family'
)
ON CONFLICT (organization_id) DO NOTHING;

-- =============================================================================
-- SECTION 4: ULTAURA ACCOUNT
-- =============================================================================

INSERT INTO ultaura_accounts (
  id, organization_id, name, billing_email, status, plan_id,
  minutes_included, minutes_used, cycle_start, cycle_end,
  user_type, created_by_user_id
) VALUES (
  'bbbbbbbb-0000-4000-a000-000000000001',
  1,
  'Johnson Family',
  'payer@ultaura-seed.test',
  'active',
  'family',
  1200,
  0,
  NOW() - INTERVAL '15 days',
  NOW() + INTERVAL '15 days',
  'family_managed',
  'aaaaaaaa-0000-4000-a000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Account crypto key (placeholder DEK)
INSERT INTO ultaura_account_crypto_keys (
  account_id, dek_wrapped, dek_wrap_iv, dek_wrap_tag
) VALUES (
  'bbbbbbbb-0000-4000-a000-000000000001',
  convert_to('placeholder-account-dek-wrapped', 'UTF8'),
  '\x000000000000000000000000'::bytea,
  '\x00000000000000000000000000000000'::bytea
)
ON CONFLICT (account_id) DO NOTHING;

-- Account privacy settings (explicit: trigger is disabled)
INSERT INTO ultaura_account_privacy_settings (
  account_id, recording_enabled, ai_summarization_enabled, retention_period
) VALUES (
  'bbbbbbbb-0000-4000-a000-000000000001',
  false,
  true,
  '90_days'
)
ON CONFLICT (account_id) DO NOTHING;

-- =============================================================================
-- SECTION 5: ULTAURA SUBSCRIPTION
-- =============================================================================

INSERT INTO ultaura_subscriptions (
  account_id, stripe_customer_id, stripe_subscription_id,
  plan_id, billing_interval, status,
  current_period_start, current_period_end, cancel_at_period_end
) VALUES (
  'bbbbbbbb-0000-4000-a000-000000000001',
  'cus_seed_johnson_family',
  'sub_seed_family_monthly',
  'family',
  'month',
  'active',
  NOW() - INTERVAL '15 days',
  NOW() + INTERVAL '15 days',
  false
)
ON CONFLICT (stripe_subscription_id) DO NOTHING;

-- =============================================================================
-- SECTION 6: LINES (4 personas)
-- =============================================================================

-- Line 1: Margaret Johnson — 82 y/o, Charleston-born, gardening/music, Eve voice
INSERT INTO ultaura_lines (
  id, account_id, display_name, phone_e164, phone_verified_at, status,
  timezone, quiet_hours_start, quiet_hours_end,
  do_not_call, inbound_allowed,
  last_successful_call_at, next_scheduled_call_at,
  seed_interests, seed_avoid_topics,
  allow_voice_reminder_control, voicemail_behavior,
  consecutive_missed_calls, last_answered_call_at, missed_alert_sent_at,
  last_weekly_summary_at, short_id, vacation_ranges, allow_voice_schedule_control,
  birth_year, formative_decade, hometown, current_location,
  optimal_call_time, optimal_call_time_source, optimal_call_days,
  interruption_tolerance, filler_word_patience, silence_tolerance_ms,
  crosstalk_recovery_mode, preferred_language_bcp47, preferred_language_iso,
  preferred_grok_voice
) VALUES (
  'cccccccc-0000-4000-a000-000000000001',
  'bbbbbbbb-0000-4000-a000-000000000001',
  'Margaret Johnson',
  '+15551000001',
  NOW() - INTERVAL '30 days',
  'active',
  'America/New_York',
  '21:00', '08:00',
  false, true,
  NOW() - INTERVAL '18 hours',
  NOW() + INTERVAL '15 hours',
  ARRAY['gardening', 'classical music', 'baking', 'bird watching', 'crossword puzzles', 'history'],
  ARRAY['politics', 'violent news'],
  true, 'brief',
  0, NOW() - INTERVAL '18 hours', NULL,
  NOW() - INTERVAL '3 days',
  'margaret',
  '[]'::jsonb, true,
  1944, 1960, 'Charleston, SC', 'Savannah, GA',
  '09:30', 'ai_learned', ARRAY[1,2,3,4,5],
  'normal', 'high', 2500,
  'patient',
  'en-US', 'en',
  'Eve'
)
ON CONFLICT (id) DO NOTHING;

-- Line 2: Robert Chen — 78 y/o, San Francisco-born, jazz/woodworking, Leo voice
INSERT INTO ultaura_lines (
  id, account_id, display_name, phone_e164, phone_verified_at, status,
  timezone, quiet_hours_start, quiet_hours_end,
  do_not_call, inbound_allowed,
  last_successful_call_at, next_scheduled_call_at,
  seed_interests, seed_avoid_topics,
  allow_voice_reminder_control, voicemail_behavior,
  consecutive_missed_calls, last_answered_call_at, missed_alert_sent_at,
  last_weekly_summary_at, short_id, vacation_ranges, allow_voice_schedule_control,
  birth_year, formative_decade, hometown, current_location,
  optimal_call_time, optimal_call_time_source, optimal_call_days,
  interruption_tolerance, filler_word_patience, silence_tolerance_ms,
  crosstalk_recovery_mode, preferred_language_bcp47, preferred_language_iso,
  preferred_grok_voice
) VALUES (
  'cccccccc-0000-4000-a000-000000000002',
  'bbbbbbbb-0000-4000-a000-000000000001',
  'Robert Chen',
  '+15551000002',
  NOW() - INTERVAL '30 days',
  'active',
  'America/Chicago',
  '22:00', '07:00',
  false, true,
  NOW() - INTERVAL '1 day 2 hours',
  NOW() + INTERVAL '22 hours',
  ARRAY['jazz', 'woodworking', 'baseball', 'cooking', 'documentary films', 'gardening'],
  ARRAY['financial news', 'crime stories'],
  true, 'brief',
  0, NOW() - INTERVAL '1 day 2 hours', NULL,
  NOW() - INTERVAL '4 days',
  'robert01',
  '[]'::jsonb, true,
  1948, 1960, 'San Francisco, CA', 'Chicago, IL',
  '10:00', 'family_set', ARRAY[1,2,3,4,5,6,0],
  'normal', 'normal', 2000,
  'patient',
  'en-US', 'en',
  'Leo'
)
ON CONFLICT (id) DO NOTHING;

-- Line 3: Eleanor Martinez — 85 y/o, Santa Fe-born, poetry/painting, Ara voice
INSERT INTO ultaura_lines (
  id, account_id, display_name, phone_e164, phone_verified_at, status,
  timezone, quiet_hours_start, quiet_hours_end,
  do_not_call, inbound_allowed,
  last_successful_call_at, next_scheduled_call_at,
  seed_interests, seed_avoid_topics,
  allow_voice_reminder_control, voicemail_behavior,
  consecutive_missed_calls, last_answered_call_at, missed_alert_sent_at,
  last_weekly_summary_at, short_id, vacation_ranges, allow_voice_schedule_control,
  birth_year, formative_decade, hometown, current_location,
  optimal_call_time, optimal_call_time_source, optimal_call_days,
  interruption_tolerance, filler_word_patience, silence_tolerance_ms,
  crosstalk_recovery_mode, preferred_language_bcp47, preferred_language_iso,
  preferred_grok_voice
) VALUES (
  'cccccccc-0000-4000-a000-000000000003',
  'bbbbbbbb-0000-4000-a000-000000000001',
  'Eleanor Martinez',
  '+15551000003',
  NOW() - INTERVAL '30 days',
  'active',
  'America/Denver',
  '20:30', '08:30',
  false, true,
  NOW() - INTERVAL '1 day 5 hours',
  NOW() + INTERVAL '7 hours',
  ARRAY['poetry', 'watercolor painting', 'nature walks', 'knitting', 'public radio', 'Spanish literature'],
  ARRAY['finances', 'arguments', 'death'],
  false, 'none',
  1, NOW() - INTERVAL '1 day 5 hours', NOW() - INTERVAL '12 hours',
  NOW() - INTERVAL '5 days',
  'eleanor1',
  '[]'::jsonb, false,
  1941, 1950, 'Santa Fe, NM', 'Albuquerque, NM',
  '13:00', 'ai_learned', ARRAY[1,3,5],
  'low', 'high', 3000,
  'very_patient',
  'en-US', 'en',
  'Ara'
)
ON CONFLICT (id) DO NOTHING;

-- Line 4: James Wilson — 75 y/o, Portland-born, fishing/woodworking, Sal voice
INSERT INTO ultaura_lines (
  id, account_id, display_name, phone_e164, phone_verified_at, status,
  timezone, quiet_hours_start, quiet_hours_end,
  do_not_call, inbound_allowed,
  last_successful_call_at, next_scheduled_call_at,
  seed_interests, seed_avoid_topics,
  allow_voice_reminder_control, voicemail_behavior,
  consecutive_missed_calls, last_answered_call_at, missed_alert_sent_at,
  last_weekly_summary_at, short_id, vacation_ranges, allow_voice_schedule_control,
  birth_year, formative_decade, hometown, current_location,
  optimal_call_time, optimal_call_time_source, optimal_call_days,
  interruption_tolerance, filler_word_patience, silence_tolerance_ms,
  crosstalk_recovery_mode, preferred_language_bcp47, preferred_language_iso,
  preferred_grok_voice
) VALUES (
  'cccccccc-0000-4000-a000-000000000004',
  'bbbbbbbb-0000-4000-a000-000000000001',
  'James Wilson',
  '+15551000004',
  NOW() - INTERVAL '30 days',
  'active',
  'America/Los_Angeles',
  '21:00', '07:00',
  false, true,
  NOW() - INTERVAL '16 hours',
  NOW() + INTERVAL '16 hours',
  ARRAY['fishing', 'woodworking', 'college football', 'hiking', 'old westerns', 'model trains'],
  ARRAY['politics', 'medical news'],
  true, 'brief',
  0, NOW() - INTERVAL '16 hours', NULL,
  NOW() - INTERVAL '2 days',
  'jameswil',
  '[]'::jsonb, true,
  1951, 1960, 'Portland, OR', 'Portland, OR',
  '08:00', 'ai_learned', ARRAY[1,3,5],
  'high', 'normal', 1800,
  'immediate',
  'en-US', 'en',
  'Sal'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- Line-level crypto keys (placeholder DEKs)
-- =============================================================================

INSERT INTO ultaura_line_crypto_keys (line_id, account_id, dek_wrapped, dek_wrap_iv, dek_wrap_tag) VALUES
('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('placeholder-line-dek-margaret', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea),
('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('placeholder-line-dek-bob', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea),
('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('placeholder-line-dek-ellie', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea),
('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('placeholder-line-dek-jim', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea)
ON CONFLICT (line_id) DO NOTHING;

-- =============================================================================
-- Insight privacy (explicit: trigger is disabled)
-- =============================================================================

INSERT INTO ultaura_insight_privacy (line_id, insights_enabled) VALUES
('cccccccc-0000-4000-a000-000000000001', true),
('cccccccc-0000-4000-a000-000000000002', true),
('cccccccc-0000-4000-a000-000000000003', true),
('cccccccc-0000-4000-a000-000000000004', true)
ON CONFLICT (line_id) DO NOTHING;

-- =============================================================================
-- Line voice consent (explicit: trigger is disabled)
-- All 4 lines: memory granted, recording granted, sharing granted
-- Sharing tiers: Margaret=tier_1, Robert=tier_2, Eleanor=tier_3, James=tier_4
-- =============================================================================

INSERT INTO ultaura_line_voice_consent (
  line_id, account_id,
  memory_consent, memory_consent_at,
  recording_consent, recording_consent_at, recording_consent_call_session_id,
  sharing_consent, sharing_consent_at, sharing_consent_call_session_id, sharing_tier
) VALUES
('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'granted', NOW() - INTERVAL '29 days',
 'granted', NOW() - INTERVAL '28 days', 'ffffffff-0000-4000-a000-000000000001',
 'granted', NOW() - INTERVAL '28 days', 'ffffffff-0000-4000-a000-000000000001', 'tier_1'),
('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'granted', NOW() - INTERVAL '28 days',
 'granted', NOW() - INTERVAL '27 days', 'ffffffff-0000-4000-a000-000000000011',
 'granted', NOW() - INTERVAL '27 days', 'ffffffff-0000-4000-a000-000000000011', 'tier_2'),
('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'granted', NOW() - INTERVAL '27 days',
 'granted', NOW() - INTERVAL '26 days', 'ffffffff-0000-4000-a000-000000000020',
 'granted', NOW() - INTERVAL '26 days', 'ffffffff-0000-4000-a000-000000000020', 'tier_3'),
('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'granted', NOW() - INTERVAL '27 days',
 'granted', NOW() - INTERVAL '25 days', 'ffffffff-0000-4000-a000-000000000029',
 'granted', NOW() - INTERVAL '25 days', 'ffffffff-0000-4000-a000-000000000029', 'tier_4')
ON CONFLICT (line_id) DO NOTHING;

-- =============================================================================
-- Topic exclusions (explicit: trigger is disabled)
-- All false except Eleanor finances=true
-- =============================================================================

INSERT INTO ultaura_topic_exclusions (line_id, account_id, category, excluded, excluded_at) VALUES
-- Margaret
('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', 'health_medical',      false, NULL),
('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', 'family_relationships', false, NULL),
('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', 'finances',             false, NULL),
('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001', 'location_address',     false, NULL),
-- Bob
('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001', 'health_medical',       false, NULL),
('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001', 'family_relationships',  false, NULL),
('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001', 'finances',              false, NULL),
('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001', 'location_address',      false, NULL),
-- Eleanor (finances excluded)
('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001', 'health_medical',       false, NULL),
('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001', 'family_relationships',  false, NULL),
('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001', 'finances',              true,  NOW() - INTERVAL '20 days'),
('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001', 'location_address',      false, NULL),
-- James
('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001', 'health_medical',       false, NULL),
('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001', 'family_relationships',  false, NULL),
('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001', 'finances',              false, NULL),
('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001', 'location_address',      false, NULL)
ON CONFLICT (line_id, category) DO NOTHING;

-- =============================================================================
-- Phone verifications (all approved)
-- =============================================================================

INSERT INTO ultaura_phone_verifications (
  line_id, expires_at, channel, status, twilio_verification_sid
) VALUES
('cccccccc-0000-4000-a000-000000000001', NOW() + INTERVAL '1 year', 'sms', 'approved', 'VE_seed_margaret'),
('cccccccc-0000-4000-a000-000000000002', NOW() + INTERVAL '1 year', 'sms', 'approved', 'VE_seed_bob'),
('cccccccc-0000-4000-a000-000000000003', NOW() + INTERVAL '1 year', 'sms', 'approved', 'VE_seed_ellie'),
('cccccccc-0000-4000-a000-000000000004', NOW() + INTERVAL '1 year', 'sms', 'approved', 'VE_seed_jim');

-- =============================================================================
-- SECTION 7: SCHEDULES (7 total, rrule column DROPPED)
-- =============================================================================
-- Schedule UUIDs: dddddddd-0000-4000-a000-00000000000{1-7}
-- Margaret: weekday 9:30 ET (01), weekend 14:00 ET (02)
-- Bob: daily 10:00 CT (03), disabled Thu-only (04)
-- Ellie: weekday 13:00 MT (05)
-- Jim: MWF 8:00 PT (06), TuTh 17:00 PT (07)
-- =============================================================================

INSERT INTO ultaura_schedules (
  id, account_id, line_id, enabled, timezone, days_of_week, time_of_day,
  next_run_at, last_run_at, last_result, is_one_time, retry_count
) VALUES
-- Margaret weekday mornings
('dddddddd-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 true, 'America/New_York', ARRAY[1,2,3,4,5], '09:30',
 (NOW() + INTERVAL '15 hours')::timestamptz,
 (NOW() - INTERVAL '18 hours')::timestamptz,
 'success', false, 0),
-- Margaret weekend afternoons
('dddddddd-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 true, 'America/New_York', ARRAY[6,0], '14:00',
 (NOW() + INTERVAL '2 days')::timestamptz,
 (NOW() - INTERVAL '1 day')::timestamptz,
 'success', false, 0),
-- Bob daily mornings
('dddddddd-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 true, 'America/Chicago', ARRAY[1,2,3,4,5,6,0], '10:00',
 (NOW() + INTERVAL '22 hours')::timestamptz,
 (NOW() - INTERVAL '1 day 2 hours')::timestamptz,
 'success', false, 0),
-- Bob Thursday only (disabled)
('dddddddd-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 false, 'America/Chicago', ARRAY[4], '18:00',
 NULL,
 (NOW() - INTERVAL '4 days')::timestamptz,
 'success', false, 0),
-- Ellie weekday afternoons
('dddddddd-0000-4000-a000-000000000005',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 true, 'America/Denver', ARRAY[1,2,3,4,5], '13:00',
 (NOW() + INTERVAL '7 hours')::timestamptz,
 (NOW() - INTERVAL '1 day 5 hours')::timestamptz,
 'missed', false, 0),
-- Jim MWF mornings
('dddddddd-0000-4000-a000-000000000006',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 true, 'America/Los_Angeles', ARRAY[1,3,5], '08:00',
 (NOW() + INTERVAL '16 hours')::timestamptz,
 (NOW() - INTERVAL '16 hours')::timestamptz,
 'success', false, 0),
-- Jim TuTh evenings
('dddddddd-0000-4000-a000-000000000007',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 true, 'America/Los_Angeles', ARRAY[2,4], '17:00',
 (NOW() + INTERVAL '1 day 9 hours')::timestamptz,
 (NOW() - INTERVAL '2 days 10 hours')::timestamptz,
 'success', false, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 8: TRUSTED CONTACTS (9 total)
-- =============================================================================
-- UUIDs: 11111111-0000-4000-a000-00000000000{1-9}

INSERT INTO ultaura_trusted_contacts (
  id, account_id, line_id, name, relationship, phone_e164, notify_on, enabled
) VALUES
-- Margaret
('11111111-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'Susan Chen', 'Daughter', '+15555550301',
 ARRAY['safety_event', 'missed_calls', 'wellness_alert'], true),
('11111111-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'Robert Miller', 'Neighbor', '+15555550302',
 ARRAY['safety_event'], true),
-- Bob
('11111111-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'Linda Chen', 'Wife', '+15555550303',
 ARRAY['safety_event', 'missed_calls', 'wellness_alert'], true),
('11111111-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'David Chen', 'Son', '+15555550304',
 ARRAY['safety_event', 'wellness_alert'], true),
('11111111-0000-4000-a000-000000000005', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'Dr. Sarah Kim', 'Doctor', '+15555550305',
 ARRAY['safety_event'], false),
-- Eleanor
('11111111-0000-4000-a000-000000000006', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'Maria Rodriguez', 'Daughter', '+15555550306',
 ARRAY['safety_event', 'missed_calls', 'wellness_alert'], true),
('11111111-0000-4000-a000-000000000007', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'Carlos Martinez', 'Son', '+15555550307',
 ARRAY['safety_event'], true),
-- James
('11111111-0000-4000-a000-000000000008', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'Patricia Wilson', 'Wife', '+15555550308',
 ARRAY['safety_event', 'missed_calls', 'wellness_alert'], true),
('11111111-0000-4000-a000-000000000009', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'Tom Wilson', 'Son', '+15555550309',
 ARRAY['safety_event', 'wellness_alert'], true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 9: CALL SESSIONS (36 total)
-- UUIDs: ffffffff-0000-4000-a000-000000000001 through ...036
--
-- Margaret (01-10): 8 human/completed, 1 machine_start, 1 no_answer
-- Bob (11-19): 7 human/completed, 1 machine_start, 1 busy
-- Eleanor (20-28): 7 human/completed, 1 no_answer, 1 failed
-- James (29-36): 6 human/completed, 1 machine_start, 1 no_answer
--
-- Completed/human calls: 01-08 (Margaret), 11-17 (Bob), 20-26 (Ellie), 29-34 (Jim)
-- = 28 total for mood_snapshots, call_insights, ledger
-- =============================================================================

INSERT INTO ultaura_call_sessions (
  id, account_id, line_id, direction, status,
  started_at, connected_at, ended_at, seconds_connected,
  twilio_call_sid, twilio_from, twilio_to,
  end_reason, language_detected, tool_invocations,
  answered_by, is_test_call, is_reminder_call, is_preview_mode
) VALUES

-- ────── MARGARET (cccccccc-0000-4000-a000-000000000001) ──────
-- 01 — day -14 (human, 18 min)
('ffffffff-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '14 days 14 hours 1 minute',
 NOW() - INTERVAL '14 days 14 hours',
 NOW() - INTERVAL '14 days 13 hours 42 minutes',
 1080, 'CA_seed_0001', '+18005551234', '+15551000001',
 'hangup', 'en', 12, 'human', false, false, false),

-- 02 — day -12 (human, 22 min)
('ffffffff-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '12 days 14 hours 1 minute',
 NOW() - INTERVAL '12 days 14 hours',
 NOW() - INTERVAL '12 days 13 hours 38 minutes',
 1320, 'CA_seed_0002', '+18005551234', '+15551000001',
 'hangup', 'en', 15, 'human', false, false, false),

-- 03 — day -10 (human, 15 min)
('ffffffff-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '10 days 14 hours 1 minute',
 NOW() - INTERVAL '10 days 14 hours',
 NOW() - INTERVAL '10 days 13 hours 45 minutes',
 900, 'CA_seed_0003', '+18005551234', '+15551000001',
 'hangup', 'en', 8, 'human', false, false, false),

-- 04 — day -9 (machine)
('ffffffff-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '9 days 14 hours',
 NOW() - INTERVAL '9 days 13 hours 59 minutes',
 NOW() - INTERVAL '9 days 13 hours 59 minutes',
 30, 'CA_seed_0004', '+18005551234', '+15551000001',
 'hangup', NULL, 0, 'machine_start', false, false, false),

-- 05 — day -8 (human, 25 min)
('ffffffff-0000-4000-a000-000000000005',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '8 days 14 hours 1 minute',
 NOW() - INTERVAL '8 days 14 hours',
 NOW() - INTERVAL '8 days 13 hours 35 minutes',
 1500, 'CA_seed_0005', '+18005551234', '+15551000001',
 'hangup', 'en', 18, 'human', false, false, false),

-- 06 — day -6 (no_answer)
('ffffffff-0000-4000-a000-000000000006',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '6 days 14 hours',
 NULL, NULL,
 NULL, 'CA_seed_0006', '+18005551234', '+15551000001',
 'no_answer', NULL, 0, NULL, false, false, false),

-- 07 — day -5 (human, 20 min)
('ffffffff-0000-4000-a000-000000000007',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '5 days 14 hours 1 minute',
 NOW() - INTERVAL '5 days 14 hours',
 NOW() - INTERVAL '5 days 13 hours 40 minutes',
 1200, 'CA_seed_0007', '+18005551234', '+15551000001',
 'hangup', 'en', 14, 'human', false, false, false),

-- 08 — day -3 (human, 12 min)
('ffffffff-0000-4000-a000-000000000008',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '3 days 14 hours 1 minute',
 NOW() - INTERVAL '3 days 14 hours',
 NOW() - INTERVAL '3 days 13 hours 48 minutes',
 720, 'CA_seed_0008', '+18005551234', '+15551000001',
 'hangup', 'en', 9, 'human', false, false, false),

-- 09 — day -2 (human, 19 min)
('ffffffff-0000-4000-a000-000000000009',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '2 days 14 hours 1 minute',
 NOW() - INTERVAL '2 days 14 hours',
 NOW() - INTERVAL '2 days 13 hours 41 minutes',
 1140, 'CA_seed_0009', '+18005551234', '+15551000001',
 'hangup', 'en', 16, 'human', false, false, false),

-- 10 — day 0 / today (human, 3 min — brief call)
('ffffffff-0000-4000-a000-000000000010',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'outbound', 'completed',
 NOW() - INTERVAL '18 hours 1 minute',
 NOW() - INTERVAL '18 hours',
 NOW() - INTERVAL '17 hours 57 minutes',
 180, 'CA_seed_0010', '+18005551234', '+15551000001',
 'hangup', 'en', 5, 'human', false, false, false),

-- ────── BOB (cccccccc-0000-4000-a000-000000000002) ──────
-- 11 — day -13 (human, 21 min)
('ffffffff-0000-4000-a000-000000000011',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '13 days 15 hours 1 minute',
 NOW() - INTERVAL '13 days 15 hours',
 NOW() - INTERVAL '13 days 14 hours 39 minutes',
 1260, 'CA_seed_0011', '+18005551234', '+15551000002',
 'hangup', 'en', 11, 'human', false, false, false),

-- 12 — day -11 (human, 17 min)
('ffffffff-0000-4000-a000-000000000012',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '11 days 15 hours 1 minute',
 NOW() - INTERVAL '11 days 15 hours',
 NOW() - INTERVAL '11 days 14 hours 43 minutes',
 1020, 'CA_seed_0012', '+18005551234', '+15551000002',
 'hangup', 'en', 10, 'human', false, false, false),

-- 13 — day -9 (machine)
('ffffffff-0000-4000-a000-000000000013',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '9 days 15 hours',
 NOW() - INTERVAL '9 days 14 hours 59 minutes',
 NOW() - INTERVAL '9 days 14 hours 59 minutes',
 30, 'CA_seed_0013', '+18005551234', '+15551000002',
 'hangup', NULL, 0, 'machine_start', false, false, false),

-- 14 — day -8 (human, 14 min)
('ffffffff-0000-4000-a000-000000000014',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '8 days 15 hours 1 minute',
 NOW() - INTERVAL '8 days 15 hours',
 NOW() - INTERVAL '8 days 14 hours 46 minutes',
 840, 'CA_seed_0014', '+18005551234', '+15551000002',
 'hangup', 'en', 8, 'human', false, false, false),

-- 15 — day -6 (human, 24 min)
('ffffffff-0000-4000-a000-000000000015',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '6 days 15 hours 1 minute',
 NOW() - INTERVAL '6 days 15 hours',
 NOW() - INTERVAL '6 days 14 hours 36 minutes',
 1440, 'CA_seed_0015', '+18005551234', '+15551000002',
 'hangup', 'en', 13, 'human', false, false, false),

-- 16 — day -5 (busy)
('ffffffff-0000-4000-a000-000000000016',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '5 days 15 hours',
 NULL, NULL,
 NULL, 'CA_seed_0016', '+18005551234', '+15551000002',
 'busy', NULL, 0, NULL, false, false, false),

-- 17 — day -4 (human, 16 min)
('ffffffff-0000-4000-a000-000000000017',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '4 days 15 hours 1 minute',
 NOW() - INTERVAL '4 days 15 hours',
 NOW() - INTERVAL '4 days 14 hours 44 minutes',
 960, 'CA_seed_0017', '+18005551234', '+15551000002',
 'hangup', 'en', 9, 'human', false, false, false),

-- 18 — day -2 (human, 11 min)
('ffffffff-0000-4000-a000-000000000018',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '2 days 15 hours 1 minute',
 NOW() - INTERVAL '2 days 15 hours',
 NOW() - INTERVAL '2 days 14 hours 49 minutes',
 660, 'CA_seed_0018', '+18005551234', '+15551000002',
 'hangup', 'en', 7, 'human', false, false, false),

-- 19 — day -1 (human, 20 min)
('ffffffff-0000-4000-a000-000000000019',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'outbound', 'completed',
 NOW() - INTERVAL '1 day 2 hours 1 minute',
 NOW() - INTERVAL '1 day 2 hours',
 NOW() - INTERVAL '1 day 1 hour 40 minutes',
 1200, 'CA_seed_0019', '+18005551234', '+15551000002',
 'hangup', 'en', 11, 'human', false, false, false),

-- ────── ELEANOR (cccccccc-0000-4000-a000-000000000003) ──────
-- 20 — day -14 (human, 13 min)
('ffffffff-0000-4000-a000-000000000020',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '14 days 18 hours 1 minute',
 NOW() - INTERVAL '14 days 18 hours',
 NOW() - INTERVAL '14 days 17 hours 47 minutes',
 780, 'CA_seed_0020', '+18005551234', '+15551000003',
 'hangup', 'en', 7, 'human', false, false, false),

-- 21 — day -12 (human, 9 min)
('ffffffff-0000-4000-a000-000000000021',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '12 days 18 hours 1 minute',
 NOW() - INTERVAL '12 days 18 hours',
 NOW() - INTERVAL '12 days 17 hours 51 minutes',
 540, 'CA_seed_0021', '+18005551234', '+15551000003',
 'hangup', 'en', 5, 'human', false, false, false),

-- 22 — day -11 (no_answer)
('ffffffff-0000-4000-a000-000000000022',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '11 days 18 hours',
 NULL, NULL,
 NULL, 'CA_seed_0022', '+18005551234', '+15551000003',
 'no_answer', NULL, 0, NULL, false, false, false),

-- 23 — day -10 (human, 15 min)
('ffffffff-0000-4000-a000-000000000023',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '10 days 18 hours 1 minute',
 NOW() - INTERVAL '10 days 18 hours',
 NOW() - INTERVAL '10 days 17 hours 45 minutes',
 900, 'CA_seed_0023', '+18005551234', '+15551000003',
 'hangup', 'en', 9, 'human', false, false, false),

-- 24 — day -8 (human, 7 min)
('ffffffff-0000-4000-a000-000000000024',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '8 days 18 hours 1 minute',
 NOW() - INTERVAL '8 days 18 hours',
 NOW() - INTERVAL '8 days 17 hours 53 minutes',
 420, 'CA_seed_0024', '+18005551234', '+15551000003',
 'hangup', 'en', 4, 'human', false, false, false),

-- 25 — day -7 (failed)
('ffffffff-0000-4000-a000-000000000025',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'failed',
 NOW() - INTERVAL '7 days 18 hours',
 NULL, NULL,
 NULL, 'CA_seed_0025', '+18005551234', '+15551000003',
 'error', NULL, 0, NULL, false, false, false),

-- 26 — day -5 (human, 18 min)
('ffffffff-0000-4000-a000-000000000026',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '5 days 18 hours 1 minute',
 NOW() - INTERVAL '5 days 18 hours',
 NOW() - INTERVAL '5 days 17 hours 42 minutes',
 1080, 'CA_seed_0026', '+18005551234', '+15551000003',
 'hangup', 'en', 10, 'human', false, false, false),

-- 27 — day -3 (human, 11 min)
('ffffffff-0000-4000-a000-000000000027',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '3 days 18 hours 1 minute',
 NOW() - INTERVAL '3 days 18 hours',
 NOW() - INTERVAL '3 days 17 hours 49 minutes',
 660, 'CA_seed_0027', '+18005551234', '+15551000003',
 'hangup', 'en', 6, 'human', false, false, false),

-- 28 — day -1 (human, 14 min)
('ffffffff-0000-4000-a000-000000000028',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'outbound', 'completed',
 NOW() - INTERVAL '1 day 5 hours 1 minute',
 NOW() - INTERVAL '1 day 5 hours',
 NOW() - INTERVAL '1 day 4 hours 46 minutes',
 840, 'CA_seed_0028', '+18005551234', '+15551000003',
 'hangup', 'en', 8, 'human', false, false, false),

-- ────── JAMES (cccccccc-0000-4000-a000-000000000004) ──────
-- 29 — day -13 (human, 15 min)
('ffffffff-0000-4000-a000-000000000029',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '13 days 11 hours 1 minute',
 NOW() - INTERVAL '13 days 11 hours',
 NOW() - INTERVAL '13 days 10 hours 45 minutes',
 900, 'CA_seed_0029', '+18005551234', '+15551000004',
 'hangup', 'en', 8, 'human', false, false, false),

-- 30 — day -11 (human, 22 min)
('ffffffff-0000-4000-a000-000000000030',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '11 days 11 hours 1 minute',
 NOW() - INTERVAL '11 days 11 hours',
 NOW() - INTERVAL '11 days 10 hours 38 minutes',
 1320, 'CA_seed_0030', '+18005551234', '+15551000004',
 'hangup', 'en', 13, 'human', false, false, false),

-- 31 — day -9 (machine)
('ffffffff-0000-4000-a000-000000000031',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '9 days 11 hours',
 NOW() - INTERVAL '9 days 10 hours 59 minutes',
 NOW() - INTERVAL '9 days 10 hours 59 minutes',
 30, 'CA_seed_0031', '+18005551234', '+15551000004',
 'hangup', NULL, 0, 'machine_start', false, false, false),

-- 32 — day -8 (human, 18 min)
('ffffffff-0000-4000-a000-000000000032',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '8 days 11 hours 1 minute',
 NOW() - INTERVAL '8 days 11 hours',
 NOW() - INTERVAL '8 days 10 hours 42 minutes',
 1080, 'CA_seed_0032', '+18005551234', '+15551000004',
 'hangup', 'en', 11, 'human', false, false, false),

-- 33 — day -6 (no_answer)
('ffffffff-0000-4000-a000-000000000033',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '6 days 11 hours',
 NULL, NULL,
 NULL, 'CA_seed_0033', '+18005551234', '+15551000004',
 'no_answer', NULL, 0, NULL, false, false, false),

-- 34 — day -5 (human, 25 min)
('ffffffff-0000-4000-a000-000000000034',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '5 days 11 hours 1 minute',
 NOW() - INTERVAL '5 days 11 hours',
 NOW() - INTERVAL '5 days 10 hours 35 minutes',
 1500, 'CA_seed_0034', '+18005551234', '+15551000004',
 'hangup', 'en', 15, 'human', false, false, false),

-- 35 — day -3 (human, 12 min)
('ffffffff-0000-4000-a000-000000000035',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '3 days 11 hours 1 minute',
 NOW() - INTERVAL '3 days 11 hours',
 NOW() - INTERVAL '3 days 10 hours 48 minutes',
 720, 'CA_seed_0035', '+18005551234', '+15551000004',
 'hangup', 'en', 7, 'human', false, false, false),

-- 36 — day 0 / today (human, 16 min)
('ffffffff-0000-4000-a000-000000000036',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'outbound', 'completed',
 NOW() - INTERVAL '16 hours 1 minute',
 NOW() - INTERVAL '16 hours',
 NOW() - INTERVAL '15 hours 44 minutes',
 960, 'CA_seed_0036', '+18005551234', '+15551000004',
 'hangup', 'en', 10, 'human', false, false, false)

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 10: REMINDERS (12 total)
-- UUIDs: eeeeeeee-0000-4000-a000-000000000001 through ...012
-- Using plaintext message column (message_ciphertext=NULL per constraint)
-- =============================================================================

INSERT INTO ultaura_reminders (
  id, account_id, line_id, due_at, timezone,
  message, message_ciphertext, message_iv, message_tag,
  delivery_method, status, privacy_scope,
  is_recurring, rrule, time_of_day, days_of_week, occurrence_count,
  created_by_call_session_id
) VALUES

-- Margaret (01-03)
('eeeeeeee-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 NOW() + INTERVAL '1 day 8 hours', 'America/New_York',
 'Time to take your morning medications — blood pressure pill and vitamin D',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 true, 'FREQ=DAILY', '08:00', ARRAY[1,2,3,4,5,6,0], 14,
 'ffffffff-0000-4000-a000-000000000002'),

('eeeeeeee-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 NOW() + INTERVAL '4 days 14 hours', 'America/New_York',
 'Doctor appointment with Dr. Reynolds at 2:00 PM — remember to bring your medication list',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'shareable_with_payer',
 false, NULL, NULL, NULL, 0,
 'ffffffff-0000-4000-a000-000000000007'),

('eeeeeeee-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 NOW() + INTERVAL '3 days 9 hours', 'America/New_York',
 'Garden club meeting at the community center at 10 AM — Helen said she would give you a ride',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 true, 'FREQ=WEEKLY;BYDAY=WE', '09:00', ARRAY[3], 6,
 'ffffffff-0000-4000-a000-000000000009'),

-- Bob (04-06)
('eeeeeeee-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 NOW() + INTERVAL '12 hours', 'America/Chicago',
 'Morning walk reminder — the weather looks good today, a great day for your neighborhood loop',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 true, 'FREQ=DAILY', '07:30', ARRAY[1,2,3,4,5], 10,
 NULL),

('eeeeeeee-0000-4000-a000-000000000005',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 NOW() + INTERVAL '6 days 9 hours', 'America/Chicago',
 'Woodworking club meets this Saturday at the community workshop — bring your safety glasses',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'shareable_with_payer',
 true, 'FREQ=WEEKLY;BYDAY=SA', '09:00', ARRAY[6], 3,
 'ffffffff-0000-4000-a000-000000000019'),

('eeeeeeee-0000-4000-a000-000000000006',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 NOW() + INTERVAL '2 days 11 hours', 'America/Chicago',
 'Linda''s birthday dinner is this Friday evening — she said she would love your special recipe',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 false, NULL, NULL, NULL, 0,
 'ffffffff-0000-4000-a000-000000000015'),

-- Eleanor (07-09)
('eeeeeeee-0000-4000-a000-000000000007',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 NOW() + INTERVAL '1 day 9 hours', 'America/Denver',
 'Time for your eye drops — three drops in the left eye, two in the right',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 true, 'FREQ=DAILY', '09:00', ARRAY[1,2,3,4,5,6,0], 8,
 NULL),

('eeeeeeee-0000-4000-a000-000000000008',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 NOW() + INTERVAL '5 days 10 hours', 'America/Denver',
 'Poetry reading group at the library this Thursday afternoon — Maria said she will drive you',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'shareable_with_payer',
 true, 'FREQ=WEEKLY;BYDAY=TH', '10:00', ARRAY[4], 4,
 'ffffffff-0000-4000-a000-000000000026'),

('eeeeeeee-0000-4000-a000-000000000009',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 NOW() + INTERVAL '7 days', 'America/Denver',
 'Annual physical exam with Dr. Vasquez next Monday — please don''t eat breakfast beforehand',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 false, NULL, NULL, NULL, 0,
 NULL),

-- James (10-12)
('eeeeeeee-0000-4000-a000-000000000010',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 NOW() + INTERVAL '16 hours', 'America/Los_Angeles',
 'Blood pressure medication reminder — take with a full glass of water after breakfast',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 true, 'FREQ=DAILY', '08:30', ARRAY[1,2,3,4,5,6,0], 21,
 NULL),

('eeeeeeee-0000-4000-a000-000000000011',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 NOW() + INTERVAL '4 days 8 hours', 'America/Los_Angeles',
 'Fishing trip this weekend with Tom and the guys — don''t forget the tide chart and your lucky lure',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'line_only',
 false, NULL, NULL, NULL, 0,
 'ffffffff-0000-4000-a000-000000000034'),

('eeeeeeee-0000-4000-a000-000000000012',
 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 NOW() + INTERVAL '2 days 17 hours', 'America/Los_Angeles',
 'Model train club meeting Tuesday evening — bring the O-gauge locomotive you''ve been working on',
 NULL, NULL, NULL,
 'outbound_call', 'scheduled', 'shareable_with_payer',
 true, 'FREQ=WEEKLY;BYDAY=TU', '17:00', ARRAY[2], 5,
 'ffffffff-0000-4000-a000-000000000036')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- SECTION 11: MOOD SNAPSHOTS (28 total — one per completed/human call)
-- UUIDs: aabbccdd-0000-4000-a000-000000000001 through ...028
-- Sessions map: Margaret 01-03,05,07-10 (8); Bob 11-12,14-15,17-19 (7);
--               Ellie 20-21,23-24,26-28 (7); Jim 29-30,32,34-36 (6) = 28
-- =============================================================================

INSERT INTO ultaura_mood_snapshots (
  id, call_session_id, line_id, account_id,
  mood_start, mood_mid, mood_end,
  mood_start_at, mood_mid_at, mood_end_at,
  mood_trajectory, techniques_used, technique_effectiveness, energy_level
) VALUES

-- Margaret call 01 (day -14)
('aabbccdd-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '14 days 14 hours', NOW() - INTERVAL '14 days 13 hours 50 minutes', NOW() - INTERVAL '14 days 13 hours 42 minutes',
 'improved', ARRAY['reminiscence','humor'], '{"reminiscence":"effective","humor":"effective"}'::jsonb, 'normal'),

-- Margaret call 02 (day -12)
('aabbccdd-0000-4000-a000-000000000002',
 'ffffffff-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '12 days 14 hours', NOW() - INTERVAL '12 days 13 hours 50 minutes', NOW() - INTERVAL '12 days 13 hours 38 minutes',
 'stable', ARRAY['storytelling'], '{"storytelling":"effective"}'::jsonb, 'high'),

-- Margaret call 03 (day -10)
('aabbccdd-0000-4000-a000-000000000003',
 'ffffffff-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'low', 'neutral', 'neutral',
 NOW() - INTERVAL '10 days 14 hours', NOW() - INTERVAL '10 days 13 hours 52 minutes', NOW() - INTERVAL '10 days 13 hours 45 minutes',
 'improved', ARRAY['active_listening','validation'], '{"active_listening":"effective","validation":"somewhat_effective"}'::jsonb, 'low'),

-- Margaret call 05 (day -8)
('aabbccdd-0000-4000-a000-000000000004',
 'ffffffff-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '8 days 14 hours', NOW() - INTERVAL '8 days 13 hours 47 minutes', NOW() - INTERVAL '8 days 13 hours 35 minutes',
 'stable', ARRAY['trivia','humor','reminiscence'], '{"trivia":"effective","humor":"effective","reminiscence":"effective"}'::jsonb, 'high'),

-- Margaret call 07 (day -5)
('aabbccdd-0000-4000-a000-000000000005',
 'ffffffff-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'neutral', 'positive',
 NOW() - INTERVAL '5 days 14 hours', NOW() - INTERVAL '5 days 13 hours 50 minutes', NOW() - INTERVAL '5 days 13 hours 40 minutes',
 'improved', ARRAY['reminiscence','gratitude'], '{"reminiscence":"effective","gratitude":"effective"}'::jsonb, 'normal'),

-- Margaret call 08 (day -3)
('aabbccdd-0000-4000-a000-000000000006',
 'ffffffff-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'sad', 'low', 'neutral',
 NOW() - INTERVAL '3 days 14 hours', NOW() - INTERVAL '3 days 13 hours 54 minutes', NOW() - INTERVAL '3 days 13 hours 48 minutes',
 'improved', ARRAY['active_listening','validation','gentle_redirect'], '{"active_listening":"effective","validation":"effective","gentle_redirect":"somewhat_effective"}'::jsonb, 'low'),

-- Margaret call 09 (day -2)
('aabbccdd-0000-4000-a000-000000000007',
 'ffffffff-0000-4000-a000-000000000009',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '2 days 14 hours', NOW() - INTERVAL '2 days 13 hours 50 minutes', NOW() - INTERVAL '2 days 13 hours 41 minutes',
 'improved', ARRAY['humor','trivia','storytelling'], '{"humor":"effective","trivia":"effective","storytelling":"effective"}'::jsonb, 'normal'),

-- Margaret call 10 (today)
('aabbccdd-0000-4000-a000-000000000008',
 'ffffffff-0000-4000-a000-000000000010',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '18 hours', NOW() - INTERVAL '17 hours 58 minutes', NOW() - INTERVAL '17 hours 57 minutes',
 'stable', ARRAY['humor'], '{"humor":"effective"}'::jsonb, 'high'),

-- Bob call 11 (day -13)
('aabbccdd-0000-4000-a000-000000000009',
 'ffffffff-0000-4000-a000-000000000011',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '13 days 15 hours', NOW() - INTERVAL '13 days 14 hours 49 minutes', NOW() - INTERVAL '13 days 14 hours 39 minutes',
 'improved', ARRAY['storytelling','humor'], '{"storytelling":"effective","humor":"effective"}'::jsonb, 'normal'),

-- Bob call 12 (day -11)
('aabbccdd-0000-4000-a000-000000000010',
 'ffffffff-0000-4000-a000-000000000012',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '11 days 15 hours', NOW() - INTERVAL '11 days 14 hours 51 minutes', NOW() - INTERVAL '11 days 14 hours 43 minutes',
 'stable', ARRAY['trivia','reminiscence'], '{"trivia":"effective","reminiscence":"effective"}'::jsonb, 'high'),

-- Bob call 14 (day -8)
('aabbccdd-0000-4000-a000-000000000011',
 'ffffffff-0000-4000-a000-000000000014',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'neutral', 'positive',
 NOW() - INTERVAL '8 days 15 hours', NOW() - INTERVAL '8 days 14 hours 53 minutes', NOW() - INTERVAL '8 days 14 hours 46 minutes',
 'improved', ARRAY['active_listening','humor'], '{"active_listening":"effective","humor":"effective"}'::jsonb, 'normal'),

-- Bob call 15 (day -6)
('aabbccdd-0000-4000-a000-000000000012',
 'ffffffff-0000-4000-a000-000000000015',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '6 days 15 hours', NOW() - INTERVAL '6 days 14 hours 48 minutes', NOW() - INTERVAL '6 days 14 hours 36 minutes',
 'stable', ARRAY['trivia','humor','storytelling'], '{"trivia":"effective","humor":"effective","storytelling":"effective"}'::jsonb, 'high'),

-- Bob call 17 (day -4)
('aabbccdd-0000-4000-a000-000000000013',
 'ffffffff-0000-4000-a000-000000000017',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '4 days 15 hours', NOW() - INTERVAL '4 days 14 hours 52 minutes', NOW() - INTERVAL '4 days 14 hours 44 minutes',
 'improved', ARRAY['reminiscence'], '{"reminiscence":"effective"}'::jsonb, 'normal'),

-- Bob call 18 (day -2)
('aabbccdd-0000-4000-a000-000000000014',
 'ffffffff-0000-4000-a000-000000000018',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '2 days 15 hours', NOW() - INTERVAL '2 days 14 hours 54 minutes', NOW() - INTERVAL '2 days 14 hours 49 minutes',
 'stable', ARRAY['humor','trivia'], '{"humor":"effective","trivia":"effective"}'::jsonb, 'high'),

-- Bob call 19 (day -1)
('aabbccdd-0000-4000-a000-000000000015',
 'ffffffff-0000-4000-a000-000000000019',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '1 day 2 hours', NOW() - INTERVAL '1 day 1 hour 50 minutes', NOW() - INTERVAL '1 day 1 hour 40 minutes',
 'improved', ARRAY['storytelling','humor'], '{"storytelling":"effective","humor":"effective"}'::jsonb, 'normal'),

-- Ellie call 20 (day -14)
('aabbccdd-0000-4000-a000-000000000016',
 'ffffffff-0000-4000-a000-000000000020',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'low', 'neutral', 'neutral',
 NOW() - INTERVAL '14 days 18 hours', NOW() - INTERVAL '14 days 17 hours 53 minutes', NOW() - INTERVAL '14 days 17 hours 47 minutes',
 'improved', ARRAY['active_listening','validation'], '{"active_listening":"effective","validation":"effective"}'::jsonb, 'low'),

-- Ellie call 21 (day -12)
('aabbccdd-0000-4000-a000-000000000017',
 'ffffffff-0000-4000-a000-000000000021',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'neutral', 'positive',
 NOW() - INTERVAL '12 days 18 hours', NOW() - INTERVAL '12 days 17 hours 55 minutes', NOW() - INTERVAL '12 days 17 hours 51 minutes',
 'improved', ARRAY['gentle_redirect','humor'], '{"gentle_redirect":"somewhat_effective","humor":"effective"}'::jsonb, 'low'),

-- Ellie call 23 (day -10)
('aabbccdd-0000-4000-a000-000000000018',
 'ffffffff-0000-4000-a000-000000000023',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'anxious', 'neutral', 'neutral',
 NOW() - INTERVAL '10 days 18 hours', NOW() - INTERVAL '10 days 17 hours 52 minutes', NOW() - INTERVAL '10 days 17 hours 45 minutes',
 'improved', ARRAY['active_listening','validation','grounding'], '{"active_listening":"effective","validation":"effective","grounding":"somewhat_effective"}'::jsonb, 'low'),

-- Ellie call 24 (day -8)
('aabbccdd-0000-4000-a000-000000000019',
 'ffffffff-0000-4000-a000-000000000024',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '8 days 18 hours', NOW() - INTERVAL '8 days 17 hours 56 minutes', NOW() - INTERVAL '8 days 17 hours 53 minutes',
 'improved', ARRAY['poetry_sharing','storytelling'], '{"poetry_sharing":"effective","storytelling":"effective"}'::jsonb, 'normal'),

-- Ellie call 26 (day -5)
('aabbccdd-0000-4000-a000-000000000020',
 'ffffffff-0000-4000-a000-000000000026',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '5 days 18 hours', NOW() - INTERVAL '5 days 17 hours 51 minutes', NOW() - INTERVAL '5 days 17 hours 42 minutes',
 'improved', ARRAY['reminiscence','active_listening'], '{"reminiscence":"effective","active_listening":"effective"}'::jsonb, 'normal'),

-- Ellie call 27 (day -3)
('aabbccdd-0000-4000-a000-000000000021',
 'ffffffff-0000-4000-a000-000000000027',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'low', 'neutral', 'neutral',
 NOW() - INTERVAL '3 days 18 hours', NOW() - INTERVAL '3 days 17 hours 54 minutes', NOW() - INTERVAL '3 days 17 hours 49 minutes',
 'stable', ARRAY['validation','active_listening'], '{"validation":"effective","active_listening":"effective"}'::jsonb, 'low'),

-- Ellie call 28 (day -1)
('aabbccdd-0000-4000-a000-000000000022',
 'ffffffff-0000-4000-a000-000000000028',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '1 day 5 hours', NOW() - INTERVAL '1 day 4 hours 53 minutes', NOW() - INTERVAL '1 day 4 hours 46 minutes',
 'improved', ARRAY['poetry_sharing','humor'], '{"poetry_sharing":"effective","humor":"effective"}'::jsonb, 'normal'),

-- Jim call 29 (day -13)
('aabbccdd-0000-4000-a000-000000000023',
 'ffffffff-0000-4000-a000-000000000029',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '13 days 11 hours', NOW() - INTERVAL '13 days 10 hours 52 minutes', NOW() - INTERVAL '13 days 10 hours 45 minutes',
 'stable', ARRAY['trivia','storytelling'], '{"trivia":"effective","storytelling":"effective"}'::jsonb, 'high'),

-- Jim call 30 (day -11)
('aabbccdd-0000-4000-a000-000000000024',
 'ffffffff-0000-4000-a000-000000000030',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '11 days 11 hours', NOW() - INTERVAL '11 days 10 hours 49 minutes', NOW() - INTERVAL '11 days 10 hours 38 minutes',
 'stable', ARRAY['humor','trivia','reminiscence'], '{"humor":"effective","trivia":"effective","reminiscence":"effective"}'::jsonb, 'high'),

-- Jim call 32 (day -8)
('aabbccdd-0000-4000-a000-000000000025',
 'ffffffff-0000-4000-a000-000000000032',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '8 days 11 hours', NOW() - INTERVAL '8 days 10 hours 51 minutes', NOW() - INTERVAL '8 days 10 hours 42 minutes',
 'stable', ARRAY['storytelling','humor'], '{"storytelling":"effective","humor":"effective"}'::jsonb, 'high'),

-- Jim call 34 (day -5)
('aabbccdd-0000-4000-a000-000000000026',
 'ffffffff-0000-4000-a000-000000000034',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '5 days 11 hours', NOW() - INTERVAL '5 days 10 hours 47 minutes', NOW() - INTERVAL '5 days 10 hours 35 minutes',
 'stable', ARRAY['trivia','humor','reminiscence'], '{"trivia":"effective","humor":"effective","reminiscence":"effective"}'::jsonb, 'high'),

-- Jim call 35 (day -3)
('aabbccdd-0000-4000-a000-000000000027',
 'ffffffff-0000-4000-a000-000000000035',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'neutral', 'positive', 'positive',
 NOW() - INTERVAL '3 days 11 hours', NOW() - INTERVAL '3 days 10 hours 54 minutes', NOW() - INTERVAL '3 days 10 hours 48 minutes',
 'improved', ARRAY['humor','storytelling'], '{"humor":"effective","storytelling":"effective"}'::jsonb, 'normal'),

-- Jim call 36 (today)
('aabbccdd-0000-4000-a000-000000000028',
 'ffffffff-0000-4000-a000-000000000036',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'positive', 'positive', 'positive',
 NOW() - INTERVAL '16 hours', NOW() - INTERVAL '15 hours 52 minutes', NOW() - INTERVAL '15 hours 44 minutes',
 'stable', ARRAY['trivia','humor'], '{"trivia":"effective","humor":"effective"}'::jsonb, 'high')

ON CONFLICT (call_session_id) DO NOTHING;

-- =============================================================================
-- SECTION 12: CALL EVENTS (state_change chain for ~10 calls)
-- =============================================================================

INSERT INTO ultaura_call_events (call_session_id, created_at, type, payload) VALUES
-- Margaret 01
('ffffffff-0000-4000-a000-000000000001', NOW() - INTERVAL '14 days 14 hours 2 minutes', 'state_change', '{"from":"created","to":"ringing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000001', NOW() - INTERVAL '14 days 14 hours 1 minute', 'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb),
('ffffffff-0000-4000-a000-000000000001', NOW() - INTERVAL '14 days 13 hours 42 minutes', 'state_change', '{"from":"in_progress","to":"completed"}'::jsonb),

-- Margaret 05 (safety tier)
('ffffffff-0000-4000-a000-000000000005', NOW() - INTERVAL '8 days 14 hours 2 minutes', 'state_change', '{"from":"created","to":"ringing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000005', NOW() - INTERVAL '8 days 14 hours 1 minute', 'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb),
('ffffffff-0000-4000-a000-000000000005', NOW() - INTERVAL '8 days 13 hours 35 minutes', 'state_change', '{"from":"in_progress","to":"completed"}'::jsonb),

-- Margaret 08 (tool_call + safety)
('ffffffff-0000-4000-a000-000000000008', NOW() - INTERVAL '3 days 14 hours 2 minutes', 'state_change', '{"from":"created","to":"ringing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000008', NOW() - INTERVAL '3 days 14 hours 1 minute', 'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb),
('ffffffff-0000-4000-a000-000000000008', NOW() - INTERVAL '3 days 13 hours 55 minutes', 'tool_call', '{"tool":"log_safety_event","tier":"low","category":"ISOLATION_DISTRESS"}'::jsonb),
('ffffffff-0000-4000-a000-000000000008', NOW() - INTERVAL '3 days 13 hours 48 minutes', 'state_change', '{"from":"in_progress","to":"completed"}'::jsonb),

-- Bob 15 (tool_call)
('ffffffff-0000-4000-a000-000000000015', NOW() - INTERVAL '6 days 15 hours 2 minutes', 'state_change', '{"from":"created","to":"ringing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000015', NOW() - INTERVAL '6 days 15 hours 1 minute', 'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb),
('ffffffff-0000-4000-a000-000000000015', NOW() - INTERVAL '6 days 14 hours 50 minutes', 'tool_call', '{"tool":"set_reminder","reminder_type":"appointment"}'::jsonb),
('ffffffff-0000-4000-a000-000000000015', NOW() - INTERVAL '6 days 14 hours 36 minutes', 'state_change', '{"from":"in_progress","to":"completed"}'::jsonb),

-- Ellie 23 (safety tier)
('ffffffff-0000-4000-a000-000000000023', NOW() - INTERVAL '10 days 18 hours 2 minutes', 'state_change', '{"from":"created","to":"ringing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000023', NOW() - INTERVAL '10 days 18 hours 1 minute', 'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb),
('ffffffff-0000-4000-a000-000000000023', NOW() - INTERVAL '10 days 17 hours 52 minutes', 'safety_tier', '{"tier":"low","signal":"expressed_anxiety","handled":true}'::jsonb),
('ffffffff-0000-4000-a000-000000000023', NOW() - INTERVAL '10 days 17 hours 45 minutes', 'state_change', '{"from":"in_progress","to":"completed"}'::jsonb),

-- Jim 34 (tool_call)
('ffffffff-0000-4000-a000-000000000034', NOW() - INTERVAL '5 days 11 hours 2 minutes', 'state_change', '{"from":"created","to":"ringing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000034', NOW() - INTERVAL '5 days 11 hours 1 minute', 'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb),
('ffffffff-0000-4000-a000-000000000034', NOW() - INTERVAL '5 days 10 hours 48 minutes', 'tool_call', '{"tool":"set_reminder","reminder_type":"outing"}'::jsonb),
('ffffffff-0000-4000-a000-000000000034', NOW() - INTERVAL '5 days 10 hours 35 minutes', 'state_change', '{"from":"in_progress","to":"completed"}'::jsonb);

-- =============================================================================
-- SECTION 13: CALL INSIGHTS (28 total, encrypted placeholders)
-- UUIDs: 77777777-0000-4000-a000-000000000001 through ...028
-- Mapping: insights 01-08 = Margaret (calls 01-03,05,07-10)
--          insights 09-15 = Bob (calls 11-12,14-15,17-19)
--          insights 16-22 = Ellie (calls 20-21,23-24,26-28)
--          insights 23-28 = Jim (calls 29-30,32,34-36)
-- =============================================================================

INSERT INTO ultaura_call_insights (
  id, call_session_id, line_id, account_id,
  insights_ciphertext, insights_iv, insights_tag,
  extraction_method, duration_seconds, has_concerns, needs_follow_up, has_baseline
) VALUES

-- Margaret 01
('77777777-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 1","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1080, false, false, false),

('77777777-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 2","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1320, false, false, false),

('77777777-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 3","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 900, false, true, false),

('77777777-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 5","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1500, false, false, true),

('77777777-0000-4000-a000-000000000005', 'ffffffff-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 7","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1200, false, false, true),

('77777777-0000-4000-a000-000000000006', 'ffffffff-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 8","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 720, true, true, true),

('77777777-0000-4000-a000-000000000007', 'ffffffff-0000-4000-a000-000000000009',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 9","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1140, false, false, true),

('77777777-0000-4000-a000-000000000008', 'ffffffff-0000-4000-a000-000000000010',
 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Margaret call 10","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'post_call_fallback', 180, false, false, true),

-- Bob 09-15
('77777777-0000-4000-a000-000000000009', 'ffffffff-0000-4000-a000-000000000011',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 11","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1260, false, false, false),

('77777777-0000-4000-a000-000000000010', 'ffffffff-0000-4000-a000-000000000012',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 12","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1020, false, false, true),

('77777777-0000-4000-a000-000000000011', 'ffffffff-0000-4000-a000-000000000014',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 14","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 840, false, false, true),

('77777777-0000-4000-a000-000000000012', 'ffffffff-0000-4000-a000-000000000015',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 15","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1440, false, true, true),

('77777777-0000-4000-a000-000000000013', 'ffffffff-0000-4000-a000-000000000017',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 17","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 960, false, false, true),

('77777777-0000-4000-a000-000000000014', 'ffffffff-0000-4000-a000-000000000018',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 18","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 660, false, false, true),

('77777777-0000-4000-a000-000000000015', 'ffffffff-0000-4000-a000-000000000019',
 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Bob call 19","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'post_call_fallback', 1200, false, false, true),

-- Ellie 16-22
('77777777-0000-4000-a000-000000000016', 'ffffffff-0000-4000-a000-000000000020',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 20","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 780, false, true, false),

('77777777-0000-4000-a000-000000000017', 'ffffffff-0000-4000-a000-000000000021',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 21","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 540, false, false, false),

('77777777-0000-4000-a000-000000000018', 'ffffffff-0000-4000-a000-000000000023',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 23","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 900, true, true, true),

('77777777-0000-4000-a000-000000000019', 'ffffffff-0000-4000-a000-000000000024',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 24","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 420, false, false, true),

('77777777-0000-4000-a000-000000000020', 'ffffffff-0000-4000-a000-000000000026',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 26","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1080, false, false, true),

('77777777-0000-4000-a000-000000000021', 'ffffffff-0000-4000-a000-000000000027',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 27","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 660, true, true, true),

('77777777-0000-4000-a000-000000000022', 'ffffffff-0000-4000-a000-000000000028',
 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Seed placeholder - Ellie call 28","topics":[],"concerns":[]}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'post_call_fallback', 840, false, false, true),

-- Jim 23-28
('77777777-0000-4000-a000-000000000023', 'ffffffff-0000-4000-a000-000000000029',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Jim talked about fishing with his buddy Tom and mentioned his knee bothering him on the trail. He sounded upbeat but winced when describing the walk back.","mood_overall":"neutral","mood_intensity":5,"engagement_score":7,"social_need_level":3,"topics":[{"code":"activities","weight":0.6},{"code":"friends","weight":0.3}],"private_topics":[],"concerns":[{"code":"pain","severity":1,"confidence":0.7,"is_novel":true}],"needs_follow_up":false,"follow_up_reasons":[],"confidence_overall":0.82}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 900, true, false, false),

('77777777-0000-4000-a000-000000000024', 'ffffffff-0000-4000-a000-000000000030',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Jim was in good spirits, excited about the Ducks game this weekend. Briefly mentioned not sleeping well but brushed it off as staying up too late watching old westerns.","mood_overall":"positive","mood_intensity":7,"engagement_score":8,"social_need_level":2,"topics":[{"code":"entertainment","weight":0.5},{"code":"daily_life","weight":0.3}],"private_topics":[],"concerns":[{"code":"sleep","severity":1,"confidence":0.5,"is_novel":true}],"needs_follow_up":false,"follow_up_reasons":[],"confidence_overall":0.78}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1320, true, false, true),

('77777777-0000-4000-a000-000000000025', 'ffffffff-0000-4000-a000-000000000032',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Jim reported waking at 4am for several nights running and feeling exhausted. He snapped at his neighbor over a parking issue and felt bad about it. Knee pain is now affecting daily walks.","mood_overall":"low","mood_intensity":3,"engagement_score":5,"social_need_level":5,"topics":[{"code":"daily_life","weight":0.4},{"code":"feelings","weight":0.4}],"private_topics":[],"concerns":[{"code":"sleep","severity":2,"confidence":0.8,"is_novel":false},{"code":"pain","severity":2,"confidence":0.75,"is_novel":false},{"code":"fatigue","severity":2,"confidence":0.7,"is_novel":true}],"needs_follow_up":true,"follow_up_reasons":["sleep","pain"],"confidence_overall":0.85}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1080, true, true, true),

('77777777-0000-4000-a000-000000000026', 'ffffffff-0000-4000-a000-000000000034',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Jim expressed anxiety about his upcoming knee surgery consultation. He has not told his son yet because he does not want to worry him. Sleep is still disrupted.","mood_overall":"low","mood_intensity":3,"engagement_score":4,"social_need_level":6,"topics":[{"code":"feelings","weight":0.5},{"code":"family","weight":0.3}],"private_topics":[],"concerns":[{"code":"anxiety","severity":2,"confidence":0.8,"is_novel":true},{"code":"sleep","severity":2,"confidence":0.7,"is_novel":false},{"code":"pain","severity":2,"confidence":0.65,"is_novel":false}],"needs_follow_up":true,"follow_up_reasons":["anxiety","sleep"],"confidence_overall":0.83}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 1500, true, true, true),

('77777777-0000-4000-a000-000000000027', 'ffffffff-0000-4000-a000-000000000035',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Jim said his knee pain has gotten worse — he had to stop his daily walk after two blocks. He still has not called the doctor. Sounded tired and a bit down.","mood_overall":"low","mood_intensity":2,"engagement_score":4,"social_need_level":5,"topics":[{"code":"daily_life","weight":0.5},{"code":"feelings","weight":0.3}],"private_topics":[],"concerns":[{"code":"pain","severity":3,"confidence":0.9,"is_novel":false},{"code":"fatigue","severity":2,"confidence":0.7,"is_novel":false},{"code":"sleep","severity":2,"confidence":0.6,"is_novel":false}],"needs_follow_up":true,"follow_up_reasons":["pain"],"confidence_overall":0.88}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'post_call_fallback', 720, true, true, true),

('77777777-0000-4000-a000-000000000028', 'ffffffff-0000-4000-a000-000000000036',
 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('{"summary":"Jim finally called the doctor and has his consultation scheduled for next Tuesday. He sounded relieved. Sleep is improving — slept through until 5:30am. Talked about his model trains.","mood_overall":"neutral","mood_intensity":5,"engagement_score":7,"social_need_level":3,"topics":[{"code":"activities","weight":0.4},{"code":"daily_life","weight":0.3},{"code":"feelings","weight":0.2}],"private_topics":[],"concerns":[{"code":"pain","severity":2,"confidence":0.7,"is_novel":false},{"code":"anxiety","severity":1,"confidence":0.5,"is_novel":false}],"needs_follow_up":false,"follow_up_reasons":[],"confidence_overall":0.8}', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'tool_call', 960, true, false, true)

ON CONFLICT (call_session_id) DO NOTHING;

-- =============================================================================
-- SECTION 14: MINUTE LEDGER (28 entries — one per completed/human call)
-- UUIDs: aabbccee-0000-4000-a000-000000000001 through ...028
-- billable_minutes = CEIL(seconds_connected / 60)
-- =============================================================================

INSERT INTO ultaura_minute_ledger (
  id, account_id, line_id, call_session_id,
  cycle_start, cycle_end,
  seconds_connected, billable_minutes,
  direction, billable_type, idempotency_key
) VALUES

-- Margaret (01,02,03,05,07,08,09,10) — 8 entries
('aabbccee-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000001',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1080, 18, 'outbound', 'included', 'seed_ledger_0001'),

('aabbccee-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000002',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1320, 22, 'outbound', 'included', 'seed_ledger_0002'),

('aabbccee-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000003',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 900, 15, 'outbound', 'included', 'seed_ledger_0003'),

('aabbccee-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000005',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1500, 25, 'outbound', 'included', 'seed_ledger_0004'),

('aabbccee-0000-4000-a000-000000000005', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000007',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1200, 20, 'outbound', 'included', 'seed_ledger_0005'),

('aabbccee-0000-4000-a000-000000000006', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000008',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 720, 12, 'outbound', 'included', 'seed_ledger_0006'),

('aabbccee-0000-4000-a000-000000000007', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000009',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1140, 19, 'outbound', 'included', 'seed_ledger_0007'),

('aabbccee-0000-4000-a000-000000000008', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000010',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 180, 3, 'outbound', 'included', 'seed_ledger_0008'),

-- Bob (11,12,14,15,17,18,19) — 7 entries
('aabbccee-0000-4000-a000-000000000009', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000011',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1260, 21, 'outbound', 'included', 'seed_ledger_0009'),

('aabbccee-0000-4000-a000-000000000010', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000012',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1020, 17, 'outbound', 'included', 'seed_ledger_0010'),

('aabbccee-0000-4000-a000-000000000011', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000014',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 840, 14, 'outbound', 'included', 'seed_ledger_0011'),

('aabbccee-0000-4000-a000-000000000012', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000015',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1440, 24, 'outbound', 'included', 'seed_ledger_0012'),

('aabbccee-0000-4000-a000-000000000013', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000017',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 960, 16, 'outbound', 'included', 'seed_ledger_0013'),

('aabbccee-0000-4000-a000-000000000014', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000018',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 660, 11, 'outbound', 'included', 'seed_ledger_0014'),

('aabbccee-0000-4000-a000-000000000015', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002', 'ffffffff-0000-4000-a000-000000000019',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1200, 20, 'outbound', 'included', 'seed_ledger_0015'),

-- Ellie (20,21,23,24,26,27,28) — 7 entries
('aabbccee-0000-4000-a000-000000000016', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000020',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 780, 13, 'outbound', 'included', 'seed_ledger_0016'),

('aabbccee-0000-4000-a000-000000000017', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000021',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 540, 9, 'outbound', 'included', 'seed_ledger_0017'),

('aabbccee-0000-4000-a000-000000000018', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000023',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 900, 15, 'outbound', 'included', 'seed_ledger_0018'),

('aabbccee-0000-4000-a000-000000000019', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000024',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 420, 7, 'outbound', 'included', 'seed_ledger_0019'),

('aabbccee-0000-4000-a000-000000000020', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000026',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1080, 18, 'outbound', 'included', 'seed_ledger_0020'),

('aabbccee-0000-4000-a000-000000000021', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000027',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 660, 11, 'outbound', 'included', 'seed_ledger_0021'),

('aabbccee-0000-4000-a000-000000000022', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003', 'ffffffff-0000-4000-a000-000000000028',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 840, 14, 'outbound', 'included', 'seed_ledger_0022'),

-- Jim (29,30,32,34,35,36) — 6 entries
('aabbccee-0000-4000-a000-000000000023', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000029',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 900, 15, 'outbound', 'included', 'seed_ledger_0023'),

('aabbccee-0000-4000-a000-000000000024', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000030',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1320, 22, 'outbound', 'included', 'seed_ledger_0024'),

('aabbccee-0000-4000-a000-000000000025', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000032',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1080, 18, 'outbound', 'included', 'seed_ledger_0025'),

('aabbccee-0000-4000-a000-000000000026', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000034',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 1500, 25, 'outbound', 'included', 'seed_ledger_0026'),

('aabbccee-0000-4000-a000-000000000027', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000035',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 720, 12, 'outbound', 'included', 'seed_ledger_0027'),

('aabbccee-0000-4000-a000-000000000028', 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004', 'ffffffff-0000-4000-a000-000000000036',
 NOW() - INTERVAL '15 days', NOW() + INTERVAL '15 days', 960, 16, 'outbound', 'included', 'seed_ledger_0028')

ON CONFLICT (idempotency_key) DO NOTHING;

-- =============================================================================
-- SECTIONS 15-39: Memories, Relationships, Safety, Consent, Ops, Validation
-- =============================================================================

-- ============================================================
-- SECTION 15: MEMORIES (12 total, 3 per line)
-- ============================================================
INSERT INTO ultaura_memories (
  id, account_id, line_id, type, key,
  value_ciphertext, value_iv, value_tag,
  value_alg, value_kid,
  confidence, source, version, active, privacy_scope,
  created_in_call_session_id
) VALUES

-- Margaret (line 1): garden, Harold, tea
('22222222-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'preference', 'gardening_interests',
 convert_to('Loves roses especially hybrid teas; grows tomatoes and herbs; prefers morning watering sessions', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.92, 'conversation', 1, true, 'line_only',
 'ffffffff-0000-4000-a000-000000000002'),

('22222222-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'relationship', 'husband_harold',
 convert_to('Husband Harold passed November 2021 after 52 years married; she mentions him often with love and occasional grief', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.98, 'conversation', 1, true, 'line_only',
 'ffffffff-0000-4000-a000-000000000003'),

('22222222-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'preference', 'favorite_tea',
 convert_to('Drinks Earl Grey every morning; takes it with a small splash of milk and no sugar; started the habit in her 30s', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.88, 'conversation', 1, true, 'line_only',
 'ffffffff-0000-4000-a000-000000000001'),

-- Bob (line 2): engineering, hearing, wife Linda
('22222222-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'history', 'boeing_career',
 convert_to('Worked as a structural engineer at Boeing for 34 years; specialized in commercial aircraft fuselage design; very proud of the 747 program', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.95, 'conversation', 1, true, 'line_only',
 'ffffffff-0000-4000-a000-000000000012'),

('22222222-0000-4000-a000-000000000005',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'context', 'hearing_challenges',
 convert_to('Wears hearing aids in both ears; background noise is difficult; prefers slower speech and clear enunciation; gets frustrated if asked to repeat himself', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.97, 'onboarding', 1, true, 'line_only',
 NULL),

('22222222-0000-4000-a000-000000000006',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'relationship', 'wife_linda',
 convert_to('Wife Linda, married 46 years; she handles most scheduling and finances; Bob says she keeps him organized; they walk together each morning', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.93, 'conversation', 1, true, 'shareable_with_payer',
 'ffffffff-0000-4000-a000-000000000011'),

-- Ellie (line 3): anxiety, painting, church
('22222222-0000-4000-a000-000000000007',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'wellbeing', 'anxiety_loneliness',
 convert_to('Reports feeling lonely most evenings; anxiety spikes on Sundays when family does not call; has mentioned feeling like a burden to her children', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.91, 'conversation', 1, true, 'line_only',
 'ffffffff-0000-4000-a000-000000000022'),

('22222222-0000-4000-a000-000000000008',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'preference', 'painting_hobby',
 convert_to('Watercolor painter for 20 years; loves landscapes and flowers; paints in her sunroom on Tuesday and Thursday mornings; sells pieces at church bazaars', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.89, 'conversation', 1, true, 'shareable_with_payer',
 'ffffffff-0000-4000-a000-000000000021'),

('22222222-0000-4000-a000-000000000009',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'context', 'church_community',
 convert_to('Active member of St. Francis Catholic Church; attends Sunday mass and Wednesday evening fellowship; the community is her primary social anchor since moving to Denver', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.94, 'conversation', 1, true, 'line_only',
 'ffffffff-0000-4000-a000-000000000020'),

-- Jim (line 4): golf, travel, healthy lifestyle
('22222222-0000-4000-a000-000000000010',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'preference', 'golf_schedule',
 convert_to('Plays golf three times a week at Rancho Park; Tuesday and Thursday mornings with his regular foursome, Saturday afternoons with son Tom; handicap is 12', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.90, 'conversation', 1, true, 'shareable_with_payer',
 'ffffffff-0000-4000-a000-000000000030'),

('22222222-0000-4000-a000-000000000011',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'follow_up', 'travel_plans',
 convert_to('Planning a trip to Scotland next September with Patricia; wants to play golf at St. Andrews; mentioned checking on travel insurance for seniors', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.85, 'conversation', 1, true, 'shareable_with_payer',
 'ffffffff-0000-4000-a000-000000000031'),

('22222222-0000-4000-a000-000000000012',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'fact', 'healthy_lifestyle',
 convert_to('Does not drink alcohol or smoke; takes a daily multi-vitamin and fish oil; walks 2 miles every morning before golf; blood pressure is well-controlled', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'AES-256-GCM', 'kek_v1',
 0.87, 'onboarding', 1, true, 'line_only',
 NULL)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 16: MEMORY EMBEDDINGS (12 total, one per memory)
-- ============================================================
INSERT INTO ultaura_memory_embeddings (
  id, memory_id, line_id, account_id,
  embedding, embedding_model, searchable_text
) VALUES

('22222222-0000-4000-b000-000000000001',
 '22222222-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Loves roses especially hybrid teas; grows tomatoes and herbs; prefers morning watering sessions'),

('22222222-0000-4000-b000-000000000002',
 '22222222-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Husband Harold passed November 2021 after 52 years married; she mentions him often with love and occasional grief'),

('22222222-0000-4000-b000-000000000003',
 '22222222-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Drinks Earl Grey every morning; takes it with a small splash of milk and no sugar; started the habit in her 30s'),

('22222222-0000-4000-b000-000000000004',
 '22222222-0000-4000-a000-000000000004',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Worked as a structural engineer at Boeing for 34 years; specialized in commercial aircraft fuselage design; very proud of the 747 program'),

('22222222-0000-4000-b000-000000000005',
 '22222222-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Wears hearing aids in both ears; background noise is difficult; prefers slower speech and clear enunciation'),

('22222222-0000-4000-b000-000000000006',
 '22222222-0000-4000-a000-000000000006',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Wife Linda, married 46 years; she handles most scheduling and finances; they walk together each morning'),

('22222222-0000-4000-b000-000000000007',
 '22222222-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Reports feeling lonely most evenings; anxiety spikes on Sundays when family does not call; has mentioned feeling like a burden'),

('22222222-0000-4000-b000-000000000008',
 '22222222-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Watercolor painter for 20 years; loves landscapes and flowers; paints in her sunroom on Tuesday and Thursday mornings'),

('22222222-0000-4000-b000-000000000009',
 '22222222-0000-4000-a000-000000000009',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Active member of St. Francis Catholic Church; attends Sunday mass and Wednesday evening fellowship; primary social anchor'),

('22222222-0000-4000-b000-000000000010',
 '22222222-0000-4000-a000-000000000010',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Plays golf three times a week at Rancho Park; Tuesday and Thursday mornings with his regular foursome; handicap is 12'),

('22222222-0000-4000-b000-000000000011',
 '22222222-0000-4000-a000-000000000011',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Planning a trip to Scotland next September with Patricia; wants to play golf at St. Andrews; mentioned checking on travel insurance'),

('22222222-0000-4000-b000-000000000012',
 '22222222-0000-4000-a000-000000000012',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 array_fill(0::float4, ARRAY[1536])::vector,
 'text-embedding-3-small',
 'Does not drink alcohol or smoke; takes a daily multi-vitamin and fish oil; walks 2 miles every morning before golf')

ON CONFLICT (memory_id) DO NOTHING;

-- ============================================================
-- SECTION 18: RELATIONSHIPS (14 total)
-- ============================================================
INSERT INTO ultaura_relationships (
  id, line_id, account_id, name, nickname, relation_type, relation_role,
  contact_frequency, last_contact_mentioned, typical_contact_method,
  sentiment, emotional_significance, location, distance_category,
  shared_activities, conversation_topics, times_mentioned, last_mentioned_at,
  recent_topics, is_deceased, passed_at, death_mentioned_at, grief_sensitivity,
  privacy_scope
) VALUES

-- Margaret (5 relationships)
('33333333-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Harold Johnson', 'Harry', 'spouse', 'husband',
 NULL, NULL, NULL,
 'positive', 'high', 'Savannah, Georgia', 'local',
 ARRAY['dancing', 'traveling', 'gardening'],
 ARRAY['marriage', 'travel memories', 'retirement'],
 28, NOW() - INTERVAL '2 days',
 ARRAY['trip to Italy', 'his favorite roses in the garden'],
 true, '2021-11-15'::timestamptz, NOW() - INTERVAL '2 days', 'high', 'line_only'),

('33333333-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Susan Johnson', NULL, 'child', 'daughter',
 'weekly', NOW() - INTERVAL '3 days', 'phone',
 'positive', 'high', 'Atlanta, Georgia', 'regional',
 ARRAY['cooking together', 'shopping', 'church visits'],
 ARRAY['grandchildren', 'family events', 'Margarets health'],
 42, NOW() - INTERVAL '6 hours',
 ARRAY['Thanksgiving plans', 'Emmas school play'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Emma Johnson', 'Emmy', 'grandchild', 'granddaughter',
 'weekly', NOW() - INTERVAL '5 days', 'video call',
 'positive', 'high', 'Atlanta, Georgia', 'regional',
 ARRAY['baking cookies', 'reading together', 'piano recitals'],
 ARRAY['school', 'piano', 'friends'],
 29, NOW() - INTERVAL '2 days',
 ARRAY['school play rehearsal', 'learning a new piano piece'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000004',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Helen Martinez', NULL, 'friend', 'close friend',
 'weekly', NOW() - INTERVAL '4 days', 'in person',
 'positive', 'high', 'Savannah, Georgia', 'local',
 ARRAY['garden club', 'walking', 'church choir'],
 ARRAY['gardening tips', 'church', 'neighborhood news'],
 18, NOW() - INTERVAL '4 days',
 ARRAY['new rose variety from the nursery', 'church fundraiser bake sale'],
 false, NULL, NULL, NULL, 'line_only'),

('33333333-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Dr. Reynolds', NULL, 'professional', 'primary care doctor',
 'monthly', NOW() - INTERVAL '25 days', 'in person',
 'positive', 'medium', 'Savannah, Georgia', 'local',
 NULL,
 ARRAY['blood pressure', 'medications', 'checkups'],
 6, NOW() - INTERVAL '5 days',
 ARRAY['upcoming appointment', 'knee pain question'],
 false, NULL, NULL, NULL, 'line_only'),

-- Bob (3 relationships)
('33333333-0000-4000-a000-000000000006',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Linda Chen', NULL, 'spouse', 'wife',
 'daily', NOW() - INTERVAL '1 day', 'in person',
 'positive', 'high', 'Chicago, Illinois', 'local',
 ARRAY['morning walks', 'cooking', 'bridge club', 'travel'],
 ARRAY['daily routines', 'family updates', 'health'],
 35, NOW() - INTERVAL '1 day',
 ARRAY['planning spring garden', 'Davids upcoming visit'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'David Chen', NULL, 'child', 'son',
 'monthly', NOW() - INTERVAL '18 days', 'phone',
 'positive', 'high', 'Seattle, Washington', 'distant',
 ARRAY['baseball', 'engineering talk', 'video games'],
 ARRAY['career', 'grandchildren', 'Seattle life'],
 14, NOW() - INTERVAL '18 days',
 ARRAY['new job promotion', 'planning holiday visit'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Dr. Sarah Kim', NULL, 'professional', 'primary care doctor',
 'monthly', NOW() - INTERVAL '20 days', 'in person',
 'positive', 'medium', 'Chicago, Illinois', 'local',
 NULL,
 ARRAY['hearing aids', 'blood pressure', 'medications'],
 8, NOW() - INTERVAL '20 days',
 ARRAY['new hearing aid adjustment', 'annual physical'],
 false, NULL, NULL, NULL, 'line_only'),

-- Ellie (3 relationships)
('33333333-0000-4000-a000-000000000009',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Maria Garcia', NULL, 'child', 'daughter',
 'weekly', NOW() - INTERVAL '6 days', 'phone',
 'positive', 'high', 'Albuquerque, New Mexico', 'regional',
 ARRAY['cooking', 'family gatherings'],
 ARRAY['grandchildren', 'health', 'church'],
 22, NOW() - INTERVAL '6 days',
 ARRAY['upcoming grandchild birthday', 'Marias work stress'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000010',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Carlos Martinez', NULL, 'child', 'son',
 'monthly', NOW() - INTERVAL '22 days', 'phone',
 'neutral', 'medium', 'Phoenix, Arizona', 'regional',
 ARRAY['occasional holiday visits'],
 ARRAY['family updates', 'work'],
 9, NOW() - INTERVAL '22 days',
 ARRAY['missed birthday call', 'plans for Christmas'],
 false, NULL, NULL, NULL, 'line_only'),

('33333333-0000-4000-a000-000000000011',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Father Miguel', NULL, 'professional', 'clergy',
 'weekly', NOW() - INTERVAL '4 days', 'in person',
 'positive', 'high', 'Denver, Colorado', 'local',
 ARRAY['Sunday mass', 'Wednesday fellowship', 'church volunteer work'],
 ARRAY['faith', 'community', 'spiritual support'],
 16, NOW() - INTERVAL '4 days',
 ARRAY['church community outreach', 'spiritual reflection'],
 false, NULL, NULL, NULL, 'line_only'),

-- Jim (3 relationships)
('33333333-0000-4000-a000-000000000012',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Patricia Wilson', NULL, 'spouse', 'wife',
 'daily', NOW() - INTERVAL '1 day', 'in person',
 'positive', 'high', 'Los Angeles, California', 'local',
 ARRAY['travel', 'golf spectating', 'dinner parties', 'hiking'],
 ARRAY['travel planning', 'family', 'retirement activities'],
 20, NOW() - INTERVAL '1 day',
 ARRAY['Scotland trip planning', 'garden renovation'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000013',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Tom Wilson', NULL, 'child', 'son',
 'weekly', NOW() - INTERVAL '7 days', 'in person',
 'positive', 'high', 'Los Angeles, California', 'local',
 ARRAY['golf', 'baseball', 'barbecues'],
 ARRAY['golf game', 'grandchildren', 'work projects'],
 25, NOW() - INTERVAL '7 days',
 ARRAY['Saturday golf round', 'Toms new home renovation'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),

('33333333-0000-4000-a000-000000000014',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'Mike Kowalski', NULL, 'friend', 'golf buddy',
 'weekly', NOW() - INTERVAL '2 days', 'in person',
 'positive', 'medium', 'Los Angeles, California', 'local',
 ARRAY['golf', 'post-round lunch'],
 ARRAY['golf scores', 'sports', 'retirement life'],
 12, NOW() - INTERVAL '2 days',
 ARRAY['best round of the year', 'upcoming tournament'],
 false, NULL, NULL, NULL, 'line_only')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 19: LIFE CHAPTERS (10 total)
-- ============================================================
INSERT INTO ultaura_life_chapters (
  id, line_id, account_id, chapter_type, title,
  era_start_year, era_end_year, location,
  narrative_ciphertext, narrative_iv, narrative_tag,
  narrative_alg, narrative_kid,
  key_people, emotional_tone, times_referenced, source
) VALUES

-- Margaret (3 chapters)
('88888888-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'childhood', 'Growing Up in Charleston',
 1944, 1965, 'Charleston, South Carolina',
 convert_to('Born in Charleston in 1944, one of four sisters. Father was a merchant sailor, mother taught school. Summers picking peaches on her grandparents farm in the Blue Ridge foothills.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Mother Ruth', 'Father Bill', 'Sisters Nancy and Carol'],
 'joyful', 3, 'conversation'),

('88888888-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'marriage', 'Life with Harold',
 1970, 2021, 'Savannah, Georgia',
 convert_to('Met Harold at a church social in 1969. Married June 21, 1970. Raised Susan together in Savannah. Harold retired from the postal service in 2005 and they traveled extensively.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Harold Johnson', 'Susan'],
 'bittersweet', 8, 'conversation'),

('88888888-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'retirement', 'The Garden Years',
 2007, NULL, 'Savannah, Georgia',
 convert_to('After 30 years teaching third grade, retired in 2007. Threw herself into the garden. Joined the Savannah Garden Club and the church choir. The garden has been her healing place since Harold passed.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Helen Martinez', 'Garden Club members'],
 'neutral', 5, 'conversation'),

-- Bob (2 chapters)
('88888888-0000-4000-a000-000000000004',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'career', 'Engineering Career at Boeing',
 1970, 2004, 'Seattle, Washington',
 convert_to('Hired at Boeing straight out of University of Illinois in 1970. Worked on the 747, 757, and 767 programs. Proud of safety record on commercial aircraft fuselage joints he designed.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Engineering team colleagues', 'Mentor Frank Rossi'],
 'proud', 6, 'conversation'),

('88888888-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'parenting', 'Raising David in Chicago',
 1980, 2002, 'Chicago, Illinois',
 convert_to('Moved to Chicago after retiring from Boeing. David grew up on the North Shore. Bob coached his Little League team for 8 years. David got into engineering like his dad.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['David Chen', 'Linda Chen'],
 'joyful', 4, 'conversation'),

-- Ellie (3 chapters)
('88888888-0000-4000-a000-000000000006',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'career', 'Teaching in Albuquerque',
 1963, 1998, 'Albuquerque, New Mexico',
 convert_to('Taught fourth grade at Jefferson Elementary in Albuquerque for 35 years. The classroom was her joy. Many former students still write to her at Christmas.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Students over the years', 'Principal Donna Reyes'],
 'proud', 5, 'conversation'),

('88888888-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'loss', 'Moving On After Roberto',
 2008, 2015, 'Albuquerque, New Mexico',
 convert_to('Husband Roberto passed from heart failure in 2008. Moved to Denver in 2015 to be closer to Maria and her grandchildren. The move was hard but necessary.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Roberto Martinez', 'Maria', 'Carlos'],
 'difficult', 7, 'conversation'),

('88888888-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'other', 'Building a New Life in Denver',
 2015, NULL, 'Denver, Colorado',
 convert_to('Found St. Francis Church within the first month in Denver. Started painting seriously after a watercolor class at the senior center. The church fellowship has become her family away from family.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Father Miguel', 'Church fellowship members'],
 'bittersweet', 4, 'conversation'),

-- Jim (2 chapters)
('88888888-0000-4000-a000-000000000009',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'military', 'Navy Service',
 1969, 1973, 'Various bases including Pearl Harbor',
 convert_to('Served four years in the US Navy as an electronics technician. Stationed at Pearl Harbor for two years. Credits military service with teaching him discipline and leadership.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Buddy Sergeant Torres', 'Commanding Officer Lt. McMahon'],
 'proud', 3, 'conversation'),

('88888888-0000-4000-a000-000000000010',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'retirement', 'Active Retirement Adventures',
 2016, NULL, 'Los Angeles, California',
 convert_to('Retired from his electronics distribution company in 2016 after building it for 30 years. Now focuses on golf, travel with Patricia, and mentoring young entrepreneurs. Best years of his life.', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 ARRAY['Patricia Wilson', 'Tom Wilson', 'Mike Kowalski'],
 'joyful', 2, 'conversation')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 20: MILESTONES (10 total)
-- ============================================================
INSERT INTO ultaura_milestones (
  id, line_id, account_id, milestone_type, title, description,
  date_month, date_day, date_year, is_recurring,
  related_relationship_id, related_person_name,
  notify_days_before, notify_on_day,
  last_celebrated_at, times_celebrated, source, privacy_scope
) VALUES

-- Margaret (3 milestones)
('44444444-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'birthday', 'Margaret''s Birthday', 'Margaret was born March 15, 1944 in Charleston, South Carolina',
 3, 15, 1944, true,
 NULL, NULL,
 3, true,
 NOW() - INTERVAL '340 days', 1, 'family_input', 'shareable_with_payer'),

('44444444-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'memorial', 'Harold''s Passing Anniversary', 'Harold passed away on October 2, 2021 after 51 years of marriage',
 10, 2, 2021, true,
 '33333333-0000-4000-a000-000000000001', 'Harold',
 7, true,
 NOW() - INTERVAL '135 days', 1, 'conversation', 'line_only'),

('44444444-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'birthday', 'Emma''s Birthday', 'Granddaughter Emma turns 12 this year',
 3, 8, 2014, true,
 '33333333-0000-4000-a000-000000000003', 'Emma',
 2, true,
 NOW() - INTERVAL '348 days', 1, 'conversation', 'shareable_with_payer'),

-- Bob (2 milestones)
('44444444-0000-4000-a000-000000000004',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'birthday', 'Bob''s Birthday', 'Robert Chen was born July 22, 1947',
 7, 22, 1947, true,
 NULL, NULL,
 3, true,
 NOW() - INTERVAL '212 days', 1, 'family_input', 'shareable_with_payer'),

('44444444-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'anniversary', 'Wedding Anniversary with Linda', 'Bob and Linda married June 10, 1978 - 47 years together',
 6, 10, 1978, true,
 '33333333-0000-4000-a000-000000000006', 'Linda',
 5, true,
 NOW() - INTERVAL '254 days', 1, 'conversation', 'shareable_with_payer'),

-- Ellie (3 milestones)
('44444444-0000-4000-a000-000000000006',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'birthday', 'Ellie''s Birthday', 'Eleanor Martinez was born January 8, 1941',
 1, 8, 1941, true,
 NULL, NULL,
 3, true,
 NOW() - INTERVAL '42 days', 1, 'family_input', 'shareable_with_payer'),

('44444444-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'birthday', 'Maria''s Birthday', 'Daughter Maria''s birthday',
 5, 14, 1965, true,
 '33333333-0000-4000-a000-000000000009', 'Maria',
 2, true,
 NOW() - INTERVAL '281 days', 1, 'conversation', 'shareable_with_payer'),

('44444444-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'custom', 'Church Founding Day', 'Anniversary of St. Francis Church founding - Ellie has attended for 10 years',
 9, 23, 1952, true,
 NULL, 'St. Francis Parish',
 1, true,
 NOW() - INTERVAL '149 days', 1, 'conversation', 'line_only'),

-- Jim (2 milestones)
('44444444-0000-4000-a000-000000000009',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'birthday', 'Jim''s Birthday', 'James Wilson was born November 3, 1951',
 11, 3, 1951, true,
 NULL, NULL,
 3, true,
 NOW() - INTERVAL '108 days', 1, 'family_input', 'shareable_with_payer'),

('44444444-0000-4000-a000-000000000010',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'achievement', 'Retirement Anniversary', 'Jim retired from Wilson Electronics Distribution in 2016 after 30 years',
 7, 15, 2016, true,
 NULL, NULL,
 1, true,
 NOW() - INTERVAL '219 days', 1, 'conversation', 'shareable_with_payer')

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 21: EMOTIONAL PATTERNS (4 total, one per line)
-- ============================================================
INSERT INTO ultaura_emotional_patterns (
  id, line_id,
  dominant_mood, mood_variability, best_time_of_day, worst_time_of_day,
  positive_triggers, negative_triggers, effective_techniques, ineffective_techniques
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001',
 'positive', 'moderate', 'morning', 'evening',
 ARRAY['grandchildren stories', 'gardening talk', 'music reminiscence', 'trivia games', 'baking'],
 ARRAY['loneliness', 'health concerns', 'missing Harold', 'rainy weather'],
 ARRAY['reminiscence', 'humor', 'trivia', 'storytelling', 'active_listening'],
 ARRAY['rushed conversation', 'overly direct questions about feelings']),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002',
 'neutral', 'stable', 'morning', 'afternoon',
 ARRAY['engineering discussion', 'baseball talk', 'family updates', 'problem solving'],
 ARRAY['background noise', 'fast talking', 'being asked to repeat', 'news about conflict'],
 ARRAY['active_listening', 'storytelling', 'trivia', 'validation'],
 ARRAY['rapid topic changes', 'overly loud or fast speech', 'emotional probing']),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003',
 'low', 'high', 'afternoon', 'evening',
 ARRAY['painting discussion', 'church community', 'grandchildren visits', 'positive memories from teaching'],
 ARRAY['being alone', 'Sunday evenings', 'Carlos not calling', 'news about illness'],
 ARRAY['active_listening', 'validation', 'gentle_redirect', 'reminiscence', 'humor'],
 ARRAY['dismissing her feelings', 'rushing to solutions', 'mentioning being a burden']),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004',
 'positive', 'stable', 'morning', 'evening',
 ARRAY['golf stories', 'travel plans', 'sports news', 'family activities'],
 ARRAY['bad weather canceling golf', 'health limitations', 'technology frustration'],
 ARRAY['humor', 'trivia', 'storytelling', 'active_listening'],
 ARRAY['dwelling on health topics', 'overly serious tone'])

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 22: COGNITIVE FLAGS (4 total, one per line)
-- ============================================================
INSERT INTO ultaura_cognitive_flags (
  id, line_id, concern_level,
  confusion_count_14d, repetition_count_14d, orientation_count_14d,
  consecutive_calls_with_concern, last_concern_at, flagged_at
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001',
 'monitoring', 2, 3, 0, 1,
 NOW() - INTERVAL '2 days', NULL),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002',
 'none', 0, 0, 1, 0, NULL, NULL),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003',
 'flagged', 5, 4, 2, 3,
 NOW() - INTERVAL '1 day',
 NOW() - INTERVAL '3 days'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004',
 'none', 0, 0, 0, 0, NULL, NULL)

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 23: LINE BASELINES (4 total, PK = line_id)
-- ============================================================
INSERT INTO ultaura_line_baselines (
  line_id, avg_engagement, avg_duration_seconds, calls_per_week,
  answer_rate, mood_distribution, recent_concern_codes, baseline_call_count
) VALUES

('cccccccc-0000-4000-a000-000000000001',
 4.2, 1100, 3.5, 0.875,
 '{"positive": 0.57, "neutral": 0.29, "low": 0.14}'::jsonb,
 ARRAY['ISOLATION_DISTRESS'], 8),

('cccccccc-0000-4000-a000-000000000002',
 3.8, 950, 3.0, 0.889,
 '{"positive": 0.43, "neutral": 0.43, "low": 0.14}'::jsonb,
 ARRAY['PHYSICAL_DANGER'], 7),

('cccccccc-0000-4000-a000-000000000003',
 3.1, 820, 2.8, 0.778,
 '{"positive": 0.22, "neutral": 0.33, "low": 0.45}'::jsonb,
 ARRAY['HOPELESSNESS', 'ISOLATION_DISTRESS'], 9),

('cccccccc-0000-4000-a000-000000000004',
 4.7, 1250, 4.0, 0.833,
 '{"positive": 0.67, "neutral": 0.25, "low": 0.08}'::jsonb,
 ARRAY[]::text[], 6)

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 24: CONTENT PREFERENCES (4 total)
-- ============================================================
INSERT INTO ultaura_content_preferences (
  id, line_id,
  trivia_preference, story_preference, memory_lane_preference, brain_games_preference,
  favorite_trivia_domains, avoided_trivia_domains, trivia_difficulty,
  favorite_story_genres, avoided_story_themes, preferred_story_length,
  favorite_eras, favorite_memory_topics, best_segment_time_of_call
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001',
 4, 5, 5, 3,
 ARRAY['history', 'nature', 'literature', 'cooking'],
 ARRAY['sports', 'technology', 'current_events'],
 'medium',
 ARRAY['romance', 'historical_fiction'],
 ARRAY['horror', 'violence'],
 'medium',
 ARRAY['1940s', '1950s', '1960s', '1970s'],
 ARRAY['Harold', 'gardening', 'teaching', 'Charleston'],
 'middle'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002',
 5, 3, 4, 5,
 ARRAY['science', 'engineering', 'history', 'geography'],
 ARRAY['celebrity', 'pop_culture'],
 'hard',
 ARRAY['historical_fiction', 'mystery'],
 ARRAY['romance', 'fantasy'],
 'short',
 ARRAY['1960s', '1970s', '1980s'],
 ARRAY['Boeing', 'Chicago', 'baseball', 'family'],
 'early'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003',
 3, 4, 5, 2,
 ARRAY['art', 'history', 'religion', 'cooking'],
 ARRAY['sports', 'technology', 'politics'],
 'easy',
 ARRAY['romance', 'inspirational'],
 ARRAY['horror', 'crime', 'violence'],
 'medium',
 ARRAY['1950s', '1960s', '1970s'],
 ARRAY['teaching', 'painting', 'church', 'Roberto'],
 'middle'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004',
 5, 3, 3, 4,
 ARRAY['sports', 'geography', 'history', 'science'],
 ARRAY['arts', 'cooking', 'celebrity'],
 'hard',
 ARRAY['adventure', 'historical_fiction'],
 ARRAY['romance'],
 'short',
 ARRAY['1960s', '1970s', '1980s', '1990s'],
 ARRAY['Navy service', 'business', 'golf', 'travel'],
 'early')

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 25A: DAILY RHYTHMS (4 total)
-- ============================================================
INSERT INTO ultaura_daily_rhythms (
  id, line_id,
  morning_energy, afternoon_energy, evening_energy,
  morning_routine_summary, afternoon_routine_summary, evening_routine_summary,
  best_engagement_time, worst_engagement_time,
  best_days_of_week, avoid_days_of_week
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001',
 'high', 'moderate', 'low',
 'Tea and garden time, church on Sundays',
 'Crossword puzzles, light reading, sometimes a walk with Helen',
 'Television, misses Harold most in evenings',
 '10:00', '19:00',
 ARRAY[1,2,3,4,5], ARRAY[0]),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002',
 'high', 'low', 'moderate',
 'Morning walk with Linda, breakfast, newspaper',
 'Naps after lunch, slower pace due to hearing fatigue',
 'Baseball on TV, Linda makes dinner, better energy returns',
 '09:30', '13:00',
 ARRAY[1,2,3,4,5], ARRAY[0,6]),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003',
 'low', 'high', 'low',
 'Slow mornings, anxiety peaks before noon',
 'Painting in the sunroom, best mood of the day, church on Wednesdays',
 'Very hard for Ellie, loneliness is worst at night',
 '14:00', '20:00',
 ARRAY[2,4], ARRAY[0,6]),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004',
 'high', 'moderate', 'moderate',
 'Walk, coffee, golf on golf days',
 'Post-golf lunch or business reading, errands with Patricia',
 'Dinner with Patricia, sports on TV, reads before sleep',
 '09:00', NULL,
 ARRAY[2,4,6], ARRAY[]::int[])

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 25B: PERSONA ADAPTATIONS (4 total)
-- ============================================================
INSERT INTO ultaura_persona_adaptations (
  id, line_id,
  formality_level, humor_level, directness_level,
  vocabulary_complexity, regional_expressions, preferred_phrases, avoided_phrases,
  prefers_short_exchanges, prefers_stories, asks_many_questions,
  typical_energy, morning_energy, afternoon_energy, evening_energy,
  calls_analyzed, confidence_score
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001',
 'warm', 'light', 'gentle',
 'standard', ARRAY['honey', 'bless your heart'],
 ARRAY['Tell me more about that', 'That reminds me'],
 ARRAY['you need to', 'you should have'],
 false, true, true,
 'moderate', 'high', 'moderate', 'low',
 8, 0.82),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002',
 'formal', 'light', 'very_direct',
 'sophisticated', ARRAY[]::text[],
 ARRAY['Interesting point', 'Let me think about that'],
 ARRAY['umm', 'like I said', 'anyway'],
 true, false, false,
 'moderate', 'high', 'low', 'moderate',
 7, 0.78),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003',
 'warm', 'light', 'gentle',
 'simple', ARRAY['mija', 'mi vida'],
 ARRAY['I understand', 'That must be hard'],
 ARRAY['you are fine', 'stop worrying'],
 false, true, true,
 'variable', 'low', 'high', 'low',
 9, 0.74),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004',
 'casual', 'moderate', 'balanced',
 'standard', ARRAY[]::text[],
 ARRAY['Good point', 'Absolutely'],
 ARRAY['as I was saying', 'whatever'],
 true, false, false,
 'high', 'high', 'moderate', 'moderate',
 6, 0.85)

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 25C: ACCESSIBILITY SETTINGS (4 total)
-- ============================================================
INSERT INTO ultaura_accessibility_settings (
  id, line_id,
  hearing_mode, speech_rate, pause_between_sentences, repeat_key_info,
  cognitive_mode, simplified_language, shorter_responses,
  provide_call_recap, remind_of_previous_topics, context_window_calls,
  hearing_mode_source, cognitive_mode_source
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001',
 'enhanced_clarity', 0.90, true, true,
 'supportive', false, false,
 true, true, 8,
 'family', 'ai_detected'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002',
 'slow_pace', 0.80, true, true,
 'normal', false, true,
 true, false, 10,
 'family', 'default'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003',
 'normal', 1.00, false, true,
 'high_support', true, true,
 true, true, 12,
 'default', 'ai_detected'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004',
 'normal', 1.00, false, false,
 'normal', false, false,
 false, false, 5,
 'default', 'default')

ON CONFLICT (line_id) DO NOTHING;

-- ============================================================
-- SECTION 25D: SAFETY EVENTS (8 total)
-- ============================================================
INSERT INTO ultaura_safety_events (
  id, account_id, line_id, call_session_id,
  tier, signals, action_taken, category, confidence
) VALUES

-- Ellie HIGH: hopelessness expression
('66666666-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'ffffffff-0000-4000-a000-000000000022',
 'high',
 '{"keywords_detected": ["nobody would care if I were gone", "burden"], "context": "Ellie expressed that her children would be better off without worrying about her, and that nobody would notice if she disappeared", "response": "Gently redirected, provided 988 warmline information, and notified trusted contact"}'::jsonb,
 'suggested_988', 'HOPELESSNESS', 0.92),

-- Bob MEDIUM: fall risk
('66666666-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'ffffffff-0000-4000-a000-000000000013',
 'medium',
 '{"keywords_detected": ["dizzy when I stand up", "grabbed the wall"], "context": "Bob mentioned feeling lightheaded when rising from his chair, has happened three times this week", "response": "Encouraged Bob to discuss with Dr. Kim, notified Linda via trusted contact"}'::jsonb,
 'notified_contact', 'PHYSICAL_DANGER', 0.68),

-- Margaret LOW: isolation
('66666666-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000003',
 'low',
 '{"keywords_detected": ["nobody visits", "lonely"], "context": "Margaret expressed feeling isolated after church was canceled due to weather, mentioned not seeing Susan in three weeks"}'::jsonb,
 'none', 'ISOLATION_DISTRESS', 0.35),

-- Ellie LOW: anxiety spike
('66666666-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'ffffffff-0000-4000-a000-000000000024',
 'low',
 '{"keywords_detected": ["anxious", "cannot sleep", "worried"], "context": "Ellie mentioned three nights of poor sleep due to anxiety about an upcoming medical appointment"}'::jsonb,
 'none', 'ISOLATION_DISTRESS', 0.42),

-- Jim LOW: general concern
('66666666-0000-4000-a000-000000000005',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'ffffffff-0000-4000-a000-000000000030',
 'low',
 '{"keywords_detected": ["knee hurting"], "context": "Jim briefly mentioned his knee has been bothering him on the golf course; he minimized it but it has impacted play"}'::jsonb,
 'none', 'GENERAL_CONCERN', 0.22),

-- Jim MEDIUM: sleep disturbance and irritability
('66666666-0000-4000-a000-000000000006',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'ffffffff-0000-4000-a000-000000000032',
 'medium',
 '{"keywords_detected": ["cannot sleep", "so tired", "snapping at people"], "context": "Jim reported waking at 4am for the past week, feeling exhausted during the day, and losing patience with his neighbor over a minor issue", "response": "Encouraged Jim to mention sleep changes to his doctor; notified trusted contact"}'::jsonb,
 'notified_contact', 'ISOLATION_DISTRESS', 0.61),

-- Jim LOW: anxiety about upcoming appointment
('66666666-0000-4000-a000-000000000007',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'ffffffff-0000-4000-a000-000000000034',
 'low',
 '{"keywords_detected": ["worried", "nervous"], "context": "Jim expressed nervousness about an upcoming knee surgery consultation; mentioned avoiding calling his son about it"}'::jsonb,
 'none', 'GENERAL_CONCERN', 0.38),

-- Jim MEDIUM: pain escalation
('66666666-0000-4000-a000-000000000008',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000004',
 'ffffffff-0000-4000-a000-000000000035',
 'medium',
 '{"keywords_detected": ["hurts to walk", "had to stop"], "context": "Jim said his knee pain has worsened to the point where he had to stop his daily walk after two blocks; he has not yet called the doctor despite saying he would", "response": "Strongly encouraged scheduling appointment; notified trusted contact about pain escalation"}'::jsonb,
 'notified_contact', 'PHYSICAL_DANGER', 0.72)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 25E: HEALTH MENTIONS (8 total, encrypted)
-- ============================================================
INSERT INTO ultaura_health_mentions (
  id, call_session_id, line_id, account_id,
  mention_ciphertext, mention_iv, mention_tag, mention_alg, mention_kid,
  category, severity, triggers_alert
) VALUES

-- Margaret (3)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Left knee pain when walking to garden; plans to ask Dr. Reynolds', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'pain', 'mild', false),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Takes blood pressure medication daily; missed two doses last week when routine was disrupted', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'medication', 'mild', false),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Sleeping poorly this week; wakes at 3am and cannot fall back asleep; has been this way since Harold passed', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'sleep', 'mild', false),

-- Bob (2)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000013',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Dizzy spells when standing up from chair; has occurred three times this week; concerned about fall risk', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'symptom', 'moderate', true),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000015',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Annual physical scheduled next month with Dr. Kim; wants to discuss hearing aid adjustment', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'appointment', 'mild', false),

-- Ellie (2)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000021',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Arthritis in both hands making painting difficult; grip is weaker than last year; avoids mentioning it to children', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'pain', 'mild', false),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000024',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Three nights of poor sleep due to anxiety before medical appointment; relies on chamomile tea to calm down', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'sleep', 'mild', false),

-- Jim (1)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000030',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 convert_to('Right knee bothering him on golf course; affecting his swing; says it comes and goes and he is not worried', 'UTF8'),
 '\x000000000000000000000000'::bytea,
 '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 'pain', 'mild', false)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 25F: COGNITIVE OBSERVATIONS (6 total)
-- ============================================================
INSERT INTO ultaura_cognitive_observations (
  id, call_session_id, line_id, observation_type, severity,
  context, response_given, is_novel, similar_observation_count
) VALUES

-- Margaret (2)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000004',
 'cccccccc-0000-4000-a000-000000000001',
 'repetition', 'mild',
 'Margaret told the story about Harold''s surprise 50th birthday party twice in the same call, twenty minutes apart',
 'Gently acknowledged the story both times, did not draw attention to the repetition',
 true, 1),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000001',
 'word_finding', 'mild',
 'Margaret paused several times trying to recall Dr. Reynolds'' name, eventually used "my doctor"',
 'Provided the name naturally in conversational context as if referencing a previous mention',
 false, 2),

-- Bob (1)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000012',
 'cccccccc-0000-4000-a000-000000000002',
 'orientation', 'mild',
 'Bob briefly confused whether it was Tuesday or Thursday; corrected himself immediately and laughed it off',
 'Confirmed the day matter-of-factly without making it a moment',
 true, 1),

-- Ellie (3)
(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000021',
 'cccccccc-0000-4000-a000-000000000003',
 'confusion', 'moderate',
 'Ellie asked twice what season it was during the call; seemed genuinely uncertain and slightly distressed',
 'Gently oriented to the season and noted how nice the weather has been lately',
 true, 1),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000023',
 'cccccccc-0000-4000-a000-000000000003',
 'repetition', 'moderate',
 'Ellie mentioned her painting class cancellation three times; each time treated as new information',
 'Each time validated her disappointment with fresh empathy, did not note the repetition',
 false, 3),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000025',
 'cccccccc-0000-4000-a000-000000000003',
 'memory_lapse', 'mild',
 'Ellie could not remember the name of a church friend she has known for 10 years; described her by appearance',
 'Used the description to identify her friend and mentioned her name naturally in conversation',
 false, 2)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 25G: WELLNESS ALERTS (8 total)
-- ============================================================
INSERT INTO ultaura_wellness_alerts (
  id, line_id, account_id, alert_type, severity, title, summary,
  source_call_session_id, delivery_method, delivered_at, acknowledged_at
) VALUES

-- Ellie urgent (2)
('55555555-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'mood_drop', 'urgent',
 'Urgent: Eleanor Expressed Hopelessness',
 'During today''s call, Eleanor said "nobody would care if I were gone" and described herself as a burden to her children. The AI provided the 988 Lifeline number and a trusted contact was notified. Eleanor was calm by the end of the call but this requires immediate follow-up.',
 'ffffffff-0000-4000-a000-000000000022',
 'email', NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days 22 hours'),

('55555555-0000-4000-a000-000000000002',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cognitive_concern', 'urgent',
 'Cognitive Flags Elevated: Eleanor',
 'Three consecutive calls have shown moderate cognitive observations including repeated confusion about the season and repeating topics as if new. A clinical review may be warranted. Flagged level elevated to "flagged" from "monitoring".',
 'ffffffff-0000-4000-a000-000000000025',
 'email', NOW() - INTERVAL '3 days', NULL),

-- Ellie warning (1)
('55555555-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'missed_calls', 'warning',
 'Eleanor Missed Two Consecutive Calls',
 'Eleanor did not answer the scheduled call on Thursday or Friday this week. A brief voicemail was left both times. This is unusual for her. Recommend reaching out directly.',
 'ffffffff-0000-4000-a000-000000000027',
 'email', NOW() - INTERVAL '6 days', NOW() - INTERVAL '5 days 20 hours'),

-- Margaret warnings (2)
('55555555-0000-4000-a000-000000000004',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'mood_drop', 'warning',
 'Mood Decline Detected: Margaret',
 'Margaret seemed notably sad during today''s call. She mentioned missing Harold and feeling lonely in the evenings. She brightened when talking about Emma but returned to a low mood when the conversation ended.',
 'ffffffff-0000-4000-a000-000000000007',
 'email', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 20 hours'),

('55555555-0000-4000-a000-000000000005',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'health_mention', 'info',
 'Health Mention: Margaret''s Knee Pain',
 'Margaret mentioned her left knee has been bothering her more than usual this week, especially when walking to the garden. She plans to ask Dr. Reynolds at her upcoming appointment.',
 'ffffffff-0000-4000-a000-000000000003',
 'dashboard_only', NULL, NULL),

-- Bob info (1)
('55555555-0000-4000-a000-000000000006',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'health_mention', 'warning',
 'Health Alert: Bob Experiencing Dizziness',
 'Bob mentioned feeling dizzy when standing up, which has happened three times this week. This can indicate orthostatic hypotension and carries fall risk. Trusted contact Linda has been notified. Recommend discussing with Dr. Kim.',
 'ffffffff-0000-4000-a000-000000000013',
 'email', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days 3 hours'),

-- Margaret info missed call (1)
('55555555-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'missed_calls', 'info',
 'Missed Call: Margaret',
 'Margaret did not answer the scheduled morning call. A brief voicemail was left. She answered normally the following day and explained she had been at a garden club event.',
 'ffffffff-0000-4000-a000-000000000009',
 'email', NOW() - INTERVAL '12 days', NOW() - INTERVAL '11 days 22 hours'),

-- Jim info (1)
('55555555-0000-4000-a000-000000000008',
 'cccccccc-0000-4000-a000-000000000004',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'health_mention', 'info',
 'Health Mention: Jim''s Knee',
 'Jim briefly mentioned right knee pain during his golf game. He minimized it but it has been affecting his swing for about two weeks. Worth monitoring.',
 'ffffffff-0000-4000-a000-000000000030',
 'dashboard_only', NULL, NULL)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- SECTION 26: CONSENTS (24 total: 6 types × 4 lines)
-- ============================================================
INSERT INTO ultaura_consents (
  id, account_id, line_id, type, granted, granted_by, evidence, revoked_at
) VALUES

-- Margaret (6 consents)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'outbound_calls', true, 'payer_ack', '{"timestamp": "2026-01-15T10:00:00Z", "ip": "192.168.1.1"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'trusted_contact_notify', true, 'payer_ack', '{"timestamp": "2026-01-15T10:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'sms_to_payer', true, 'payer_ack', '{"timestamp": "2026-01-15T10:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'data_retention', true, 'payer_ack', '{"timestamp": "2026-01-15T10:02:00Z", "retention_period": "2_years"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'audio_processing', true, 'payer_ack', '{"timestamp": "2026-01-15T10:02:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'recording', true, 'line_voice', '{"timestamp": "2026-01-20T10:15:00Z", "call_session": "ffffffff-0000-4000-a000-000000000001"}'::jsonb, NULL),

-- Bob (6 consents)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002', 'outbound_calls', true, 'payer_ack', '{"timestamp": "2026-01-16T09:00:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002', 'trusted_contact_notify', true, 'payer_ack', '{"timestamp": "2026-01-16T09:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002', 'sms_to_payer', true, 'payer_ack', '{"timestamp": "2026-01-16T09:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002', 'data_retention', true, 'payer_ack', '{"timestamp": "2026-01-16T09:02:00Z", "retention_period": "1_year"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002', 'audio_processing', true, 'payer_ack', '{"timestamp": "2026-01-16T09:02:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002', 'recording', true, 'line_voice', '{"timestamp": "2026-01-21T09:10:00Z"}'::jsonb, NULL),

-- Ellie (6 consents)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003', 'outbound_calls', true, 'payer_ack', '{"timestamp": "2026-01-17T14:00:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003', 'trusted_contact_notify', true, 'payer_ack', '{"timestamp": "2026-01-17T14:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003', 'sms_to_payer', true, 'payer_ack', '{"timestamp": "2026-01-17T14:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003', 'data_retention', true, 'payer_ack', '{"timestamp": "2026-01-17T14:02:00Z", "retention_period": "indefinite"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003', 'audio_processing', true, 'payer_ack', '{"timestamp": "2026-01-17T14:02:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003', 'recording', true, 'payer_ack', '{"timestamp": "2026-01-17T14:03:00Z"}'::jsonb, NULL),

-- Jim (6 consents)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004', 'outbound_calls', true, 'payer_ack', '{"timestamp": "2026-01-18T08:00:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004', 'trusted_contact_notify', true, 'payer_ack', '{"timestamp": "2026-01-18T08:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004', 'sms_to_payer', true, 'payer_ack', '{"timestamp": "2026-01-18T08:01:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004', 'data_retention', true, 'payer_ack', '{"timestamp": "2026-01-18T08:02:00Z", "retention_period": "1_year"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004', 'audio_processing', true, 'payer_ack', '{"timestamp": "2026-01-18T08:02:00Z"}'::jsonb, NULL),
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004', 'recording', true, 'payer_ack', '{"timestamp": "2026-01-18T08:03:00Z"}'::jsonb, NULL)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 26B: OPT-OUTS (2 total)
-- ============================================================
INSERT INTO ultaura_opt_outs (
  id, account_id, line_id, channel, reason, source, call_session_id
) VALUES

-- Ellie briefly opted out of SMS, later re-consented (not revoked)
(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'sms', 'Did not understand the messages', 'voice',
 'ffffffff-0000-4000-a000-000000000020'),

-- Margaret opted out of inbound (dashboard example)
(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'outbound_calls', 'Vacation - manually disabled', 'dashboard',
 NULL)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 27: CONSENT AUDIT LOG (12 entries)
-- ============================================================
INSERT INTO ultaura_consent_audit_log (
  id, account_id, line_id, actor_user_id, actor_type,
  action, consent_type, old_value, new_value, metadata
) VALUES

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'granted', 'outbound_calls', NULL, '{"granted": true}'::jsonb, '{"source": "onboarding"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 NULL, 'line_voice',
 'voice_consent_given', 'recording', '{"granted": false}'::jsonb, '{"granted": true}'::jsonb,
 '{"call_session_id": "ffffffff-0000-4000-a000-000000000001"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'granted', 'outbound_calls', NULL, '{"granted": true}'::jsonb, '{"source": "onboarding"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 NULL, 'line_voice',
 'voice_consent_given', 'recording', '{"granted": false}'::jsonb, '{"granted": true}'::jsonb,
 '{"call_session_id": "ffffffff-0000-4000-a000-000000000011"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'granted', 'outbound_calls', NULL, '{"granted": true}'::jsonb, '{"source": "onboarding"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 NULL, 'system',
 'recording_toggled', 'recording', '{"enabled": false}'::jsonb, '{"enabled": true}'::jsonb,
 '{"reason": "payer_enabled_after_consent"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'granted', 'data_retention', NULL, '{"retention_period": "1_year"}'::jsonb, NULL),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'updated', 'data_retention', '{"retention_period": "1_year"}'::jsonb, '{"retention_period": "2_years"}'::jsonb, NULL),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'data_export_requested', NULL, NULL, NULL, '{"format": "json"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 NULL, 'system',
 'vendor_acknowledged', NULL, NULL, NULL, '{"vendor": "xai_grok", "acknowledged_at": "2026-01-15"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 'aaaaaaaa-0000-4000-a000-000000000001', 'payer',
 'retention_changed', 'data_retention', '{"period": "1_year"}'::jsonb, '{"period": "1_year"}'::jsonb, NULL),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 NULL, 'line_voice',
 'voice_consent_given', 'recording', '{"granted": false}'::jsonb, '{"granted": true}'::jsonb,
 '{"call_session_id": "ffffffff-0000-4000-a000-000000000029"}'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 28A: NOTIFICATION PREFERENCES (4 total)
-- ============================================================
INSERT INTO ultaura_notification_preferences (
  id, account_id, line_id,
  weekly_summary_enabled, weekly_summary_format, weekly_summary_day, weekly_summary_time,
  alert_missed_calls_enabled, alert_missed_calls_threshold,
  health_mention_alerts, mood_drop_alerts, cognitive_concern_alerts, alert_delivery_method
) VALUES

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 true, 'email', 'sunday', '18:00',
 true, 2, true, true, true, 'email'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000002',
 true, 'email', 'monday', '08:00',
 true, 3, true, false, true, 'email'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000003',
 true, 'both', 'sunday', '16:00',
 true, 1, true, true, true, 'email'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000004',
 false, 'email', 'friday', '17:00',
 false, 3, false, false, false, 'email')

ON CONFLICT (account_id, line_id) DO NOTHING;

-- ============================================================
-- SECTION 28B: NOTIFICATION RECIPIENTS (3 total)
-- ============================================================
INSERT INTO ultaura_notification_recipients (
  id, account_id, name, email, phone_e164, relationship,
  is_trusted_contact, confirmed_at
) VALUES

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'Sarah Payer', 'sarah.payer@example.com', '+15555550401',
 'Account Holder',
 false, NOW() - INTERVAL '30 days'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'Michael Payer', 'michael.payer@example.com', '+15555550402',
 'Co-caregiver',
 false, NOW() - INTERVAL '25 days'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'Emma Viewer', 'emma.viewer@example.com', NULL,
 'Extended family',
 false, NULL)

ON CONFLICT (account_id, email) DO NOTHING;

-- ============================================================
-- SECTION 28C: WEEKLY SUMMARIES (6 total: 2 weeks × 3 lines; Jim has 1)
-- ============================================================
INSERT INTO ultaura_weekly_summaries (
  id, line_id, account_id, week_start_date,
  summary_ciphertext, summary_iv, summary_tag, summary_alg, summary_kid,
  email_sent_at
) VALUES

-- Margaret week 1
(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 (DATE_TRUNC('week', NOW()) - INTERVAL '14 days')::date,
 convert_to('Margaret had a positive week overall. She shared stories about Harold and attended garden club. Mood declined slightly on Thursday but recovered. Two calls completed successfully.', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 NOW() - INTERVAL '7 days 2 hours'),

-- Margaret week 2
(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 (DATE_TRUNC('week', NOW()) - INTERVAL '7 days')::date,
 convert_to('Margaret missed one call this week but was in good spirits otherwise. She mentioned knee pain to Dr. Reynolds. Mood trends improved by week end. Three calls completed.', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 NOW() - INTERVAL '3 hours'),

-- Bob week 1
(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 (DATE_TRUNC('week', NOW()) - INTERVAL '14 days')::date,
 convert_to('Bob had a stable week. Enjoyed discussing the Boeing 737 Max news. Mentioned dizzy spells on Wednesday - Linda has been notified. Two calls completed without incident.', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 NOW() - INTERVAL '7 days 1 hour'),

-- Bob week 2
(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 (DATE_TRUNC('week', NOW()) - INTERVAL '7 days')::date,
 convert_to('Bob reported improved dizziness this week after discussing with Dr. Kim. Mood stable. Enjoyed trivia about aviation history. Three calls completed.', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 NOW() - INTERVAL '2 hours 30 minutes'),

-- Ellie week 1 (concerning week)
(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 (DATE_TRUNC('week', NOW()) - INTERVAL '14 days')::date,
 convert_to('Concerning week for Eleanor. One high-priority safety event logged. Two missed calls. Mood was predominantly low. Cognitive observations elevated. Urgent review recommended. 988 number provided during call.', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 NOW() - INTERVAL '7 days 30 minutes'),

-- Jim week 1 (only 1)
(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 (DATE_TRUNC('week', NOW()) - INTERVAL '7 days')::date,
 convert_to('Jim had an excellent week. Three golf rounds played. Excited about Scotland trip planning. Mood consistently positive. No concerns noted. All calls completed.', 'UTF8'),
 '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea,
 'aes-256-gcm', 'kek_v1',
 NOW() - INTERVAL '2 hours')

ON CONFLICT (line_id, week_start_date) DO NOTHING;

-- ============================================================
-- SECTION 29: STORY ARCS (5 total)
-- ============================================================
INSERT INTO ultaura_story_arcs (
  id, line_id, account_id, story_type, title, description,
  total_chapters, current_chapter, last_chapter_at, story_state, status
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'serial', 'The Rose Garden Chronicles',
 'A continuing story of Margaret''s imaginary rose garden competition with neighboring gardens',
 5, 3, NOW() - INTERVAL '4 days',
 '{"protagonist": "Margaret", "current_plot": "planning the spring planting"}'::jsonb, 'active'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'learning_journey', 'History of American Gardens',
 'Learning about famous American gardens and their stories, connecting to Margaret''s love of gardening',
 6, 2, NOW() - INTERVAL '9 days',
 '{"current_garden": "Monticello", "episodes_completed": ["Introduction", "Colonial gardens"]}'::jsonb, 'active'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'learning_journey', 'Aviation Pioneers',
 'Series exploring the history of aviation, connecting to Bob''s engineering career at Boeing',
 5, 4, NOW() - INTERVAL '6 days',
 '{"current_pioneer": "Kelly Johnson", "episodes_completed": ["Wright Brothers", "WWII aviation", "Jet Age", "Space Race"]}'::jsonb, 'active'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'serial', 'The Sunroom Painter',
 'A gentle fiction series about an artist who paints her memories, echoing Ellie''s love of watercolor',
 4, 1, NOW() - INTERVAL '11 days',
 '{"protagonist": "Elena", "setting": "sunny studio overlooking mountains"}'::jsonb, 'active'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'learning_journey', 'Great Golf Courses of the World',
 'Exploring legendary golf courses and their histories, connecting to Jim''s love of golf',
 6, 2, NOW() - INTERVAL '5 days',
 '{"current_course": "Augusta National", "episodes_completed": ["St. Andrews", "Augusta National intro"]}'::jsonb, 'active')

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 30: SEGMENT ENGAGEMENT (10 total)
-- ============================================================
INSERT INTO ultaura_segment_engagement (
  id, line_id, account_id, call_session_id,
  segment_type, segment_domain, duration_seconds, completed,
  engagement_signals, senior_response
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000002',
 'trivia', 'history', 180, true,
 '{"questions_answered": 5, "correct": 4, "enthusiasm": "high"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000004',
 'memory_lane', 'teaching_career', 240, true,
 '{"topics_explored": ["favorite students", "classroom traditions"], "emotion": "nostalgic_joy"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000008',
 'story', 'rose_garden_chronicles', 300, true,
 '{"chapter": 3, "engagement": "high", "laughed": true}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000012',
 'trivia', 'science_technology', 150, true,
 '{"questions_answered": 4, "correct": 4, "enthusiasm": "high"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000015',
 'learning', 'aviation_pioneers', 210, true,
 '{"episode": "Kelly Johnson Skunk Works", "engagement": "very_high"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000021',
 'memory_lane', 'teaching_memories', 200, false,
 '{"mood_interrupted": "low", "redirected_to_support": true}'::jsonb, 'declined'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000023',
 'story', 'sunroom_painter', 280, true,
 '{"chapter": 1, "engagement": "moderate", "emotional_connection": "high"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000030',
 'trivia', 'sports', 160, true,
 '{"questions_answered": 5, "correct": 5, "enthusiasm": "very_high"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000032',
 'learning', 'golf_courses', 220, true,
 '{"episode": "Augusta National", "engagement": "high"}'::jsonb, 'enjoyed'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000017',
 'trivia', 'geography', 120, false,
 '{"mood": "tired", "cut_short": true}'::jsonb, 'neutral')

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 31: CALL PREVIEWS (10 total)
-- ============================================================
INSERT INTO ultaura_call_previews (
  id, line_id, account_id,
  topic_type, topic_key, topic_display,
  source_memory_ids, segment_type,
  offered_at, selected_at, used_at, status, followed_through, follow_through_response
) VALUES

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'memory_follow_up', 'harold_travel_italy', 'Ask about the Italy trip with Harold',
 ARRAY['22222222-0000-4000-a000-000000000002'::uuid], NULL,
 NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 50 minutes', NOW() - INTERVAL '5 hours 45 minutes',
 'used', true, 'engaged'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'segment', 'trivia_history_1776', 'Colonial America Trivia',
 NULL, 'trivia',
 NOW() + INTERVAL '18 hours', NULL, NULL,
 'pending', NULL, NULL),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
 'free_form', 'garden_club_update', 'Check in on the garden club meeting',
 ARRAY['22222222-0000-4000-a000-000000000001'::uuid], NULL,
 NOW() - INTERVAL '4 days', NULL, NULL,
 'expired', false, NULL),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'memory_follow_up', 'boeing_747_memory', 'Ask about Bob''s favorite project at Boeing',
 ARRAY['22222222-0000-4000-a000-000000000004'::uuid], NULL,
 NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days', NOW() - INTERVAL '9 days',
 'used', true, 'engaged'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'segment', 'trivia_aviation', 'Aviation Engineering Trivia',
 NULL, 'trivia',
 NOW() + INTERVAL '15 hours', NULL, NULL,
 'pending', NULL, NULL),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000001',
 'web_search', 'new_boeing_model', 'Latest Boeing news update',
 NULL, NULL,
 NOW() - INTERVAL '2 days', NULL, NULL,
 'declined', false, 'declined'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'memory_follow_up', 'painting_class', 'Ask about the painting Ellie is working on',
 ARRAY['22222222-0000-4000-a000-000000000008'::uuid], NULL,
 NOW() + INTERVAL '20 hours', NULL, NULL,
 'pending', NULL, NULL),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000001',
 'segment', 'story_sunroom_painter', 'Continue the Sunroom Painter story',
 NULL, 'story',
 NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days 23 hours', NOW() - INTERVAL '7 days 22 hours',
 'used', true, 'engaged'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'memory_follow_up', 'scotland_trip_plans', 'Check on Scotland golf trip planning',
 ARRAY['22222222-0000-4000-a000-000000000011'::uuid], NULL,
 NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days',
 'used', true, 'engaged'),

(gen_random_uuid(), 'cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000001',
 'segment', 'trivia_sports_golf', 'Golf History Trivia',
 NULL, 'trivia',
 NOW() + INTERVAL '22 hours', NULL, NULL,
 'pending', NULL, NULL)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 32A: SCHEDULE EVENTS (10 total)
-- ============================================================
INSERT INTO ultaura_schedule_events (
  id, account_id, schedule_id, line_id,
  event_type, triggered_by, metadata
) VALUES

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'created', 'dashboard', '{"time_of_day": "10:00", "days_of_week": [1,2,3,4,5]}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'edited', 'dashboard', '{"change": "updated_time", "old_time": "09:00", "new_time": "10:00"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000002', 'cccccccc-0000-4000-a000-000000000001',
 'created', 'dashboard', '{"time_of_day": "14:00", "days_of_week": [0,6]}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000003', 'cccccccc-0000-4000-a000-000000000002',
 'created', 'dashboard', '{"time_of_day": "09:30", "days_of_week": [1,2,3,4,5]}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000004', 'cccccccc-0000-4000-a000-000000000002',
 'created', 'dashboard', '{"time_of_day": "19:00", "days_of_week": [6,0]}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000005', 'cccccccc-0000-4000-a000-000000000003',
 'created', 'dashboard', '{"time_of_day": "14:00", "days_of_week": [1,2,3,4,5]}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000005', 'cccccccc-0000-4000-a000-000000000003',
 'disabled', 'dashboard', '{"reason": "vacation_mode"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000005', 'cccccccc-0000-4000-a000-000000000003',
 'enabled', 'dashboard', '{"reason": "vacation_ended"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000006', 'cccccccc-0000-4000-a000-000000000004',
 'created', 'dashboard', '{"time_of_day": "09:00", "days_of_week": [1,2,3,4,5]}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000007', 'cccccccc-0000-4000-a000-000000000004',
 'created', 'voice', '{"time_of_day": "11:00", "days_of_week": [6], "requested_by": "voice"}'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 32B: SCHEDULE EXCEPTIONS (4 total)
-- ============================================================
INSERT INTO ultaura_schedule_exceptions (
  id, account_id, schedule_id, line_id,
  exception_date, exception_type, new_datetime, created_by
) VALUES

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 (NOW() - INTERVAL '5 days')::date, 'skip', NULL, 'dashboard'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000003', 'cccccccc-0000-4000-a000-000000000002',
 (NOW() + INTERVAL '3 days')::date, 'snooze',
 (NOW() + INTERVAL '3 days 2 hours')::timestamptz, 'voice'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000005', 'cccccccc-0000-4000-a000-000000000003',
 (NOW() - INTERVAL '12 days')::date, 'skip', NULL, 'dashboard'),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'dddddddd-0000-4000-a000-000000000006', 'cccccccc-0000-4000-a000-000000000004',
 (NOW() + INTERVAL '7 days')::date, 'reschedule',
 (NOW() + INTERVAL '7 days 4 hours')::timestamptz, 'dashboard')

ON CONFLICT (schedule_id, exception_date) DO NOTHING;

-- ============================================================
-- SECTION 32C: REMINDER EVENTS (16 total)
-- ============================================================
INSERT INTO ultaura_reminder_events (
  id, account_id, reminder_id, line_id,
  event_type, triggered_by, metadata
) VALUES

-- Margaret reminders (01-03)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'created', 'dashboard', '{"type": "medication", "recurring": true}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001',
 'delivered', 'system', '{"delivery_method": "outbound_call", "occurrence": 5}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000002', 'cccccccc-0000-4000-a000-000000000001',
 'created', 'dashboard', '{"type": "appointment", "recurring": false}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000003', 'cccccccc-0000-4000-a000-000000000001',
 'created', 'voice', '{"type": "social", "source": "conversation"}'::jsonb),

-- Bob reminders (04-06)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000004', 'cccccccc-0000-4000-a000-000000000002',
 'created', 'dashboard', '{"type": "medication"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000004', 'cccccccc-0000-4000-a000-000000000002',
 'delivered', 'system', '{"occurrence": 8}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000005', 'cccccccc-0000-4000-a000-000000000002',
 'created', 'dashboard', '{"type": "appointment"}'::jsonb),

-- Ellie reminders (07-09)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000007', 'cccccccc-0000-4000-a000-000000000003',
 'created', 'dashboard', '{"type": "medication"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000007', 'cccccccc-0000-4000-a000-000000000003',
 'snoozed', 'voice', '{"snooze_duration_minutes": 60, "reason": "not ready yet"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000007', 'cccccccc-0000-4000-a000-000000000003',
 'delivered', 'system', '{"occurrence": 3}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000008', 'cccccccc-0000-4000-a000-000000000003',
 'created', 'voice', '{"type": "church", "source": "conversation"}'::jsonb),

-- Jim reminders (10-12)
(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000010', 'cccccccc-0000-4000-a000-000000000004',
 'created', 'dashboard', '{"type": "golf_tee_time"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000010', 'cccccccc-0000-4000-a000-000000000004',
 'delivered', 'system', '{"occurrence": 6}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000011', 'cccccccc-0000-4000-a000-000000000004',
 'created', 'voice', '{"type": "travel_insurance", "source": "conversation"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000012', 'cccccccc-0000-4000-a000-000000000004',
 'created', 'dashboard', '{"type": "general"}'::jsonb),

(gen_random_uuid(), 'bbbbbbbb-0000-4000-a000-000000000001',
 'eeeeeeee-0000-4000-a000-000000000006', 'cccccccc-0000-4000-a000-000000000002',
 'created', 'voice', '{"type": "anniversary", "source": "conversation"}'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 33: GRIEF INTERACTIONS (3 total)
-- ============================================================
INSERT INTO ultaura_grief_interactions (
  id, call_session_id, line_id, relationship_id,
  interaction_type, emotional_tone, support_techniques_used, days_since_passing
) VALUES

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000007',
 'cccccccc-0000-4000-a000-000000000001',
 '33333333-0000-4000-a000-000000000001',
 'grief_expression', 'sad',
 ARRAY['active_listening', 'validation', 'gentle_redirect'], 827),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000003',
 'cccccccc-0000-4000-a000-000000000001',
 '33333333-0000-4000-a000-000000000001',
 'memory_sharing', 'nostalgic',
 ARRAY['reminiscence', 'validation'], 833),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000022',
 'cccccccc-0000-4000-a000-000000000003',
 NULL,
 'grief_expression', 'sad',
 ARRAY['active_listening', 'validation', 'crisis_resource_provided'], NULL)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 34A: MEMORY DEACTIVATION LOG (3 total)
-- ============================================================
INSERT INTO ultaura_memory_deactivation_log (
  id, memory_id, memory_key, line_id, account_id,
  reason, confidence_at_deactivation, metadata
) VALUES

(gen_random_uuid(),
 gen_random_uuid(),
 'old_garden_schedule',
 'cccccccc-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'decay', 0.15,
 '{"decay_rounds": 3, "last_referenced_days_ago": 90}'::jsonb),

(gen_random_uuid(),
 gen_random_uuid(),
 'medication_brand',
 'cccccccc-0000-4000-a000-000000000002',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'user_request', 0.82,
 '{"requested_by": "payer", "reason": "incorrect information"}'::jsonb),

(gen_random_uuid(),
 gen_random_uuid(),
 'past_address',
 'cccccccc-0000-4000-a000-000000000003',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'topic_exclusion', 0.45,
 '{"exclusion_topic": "past addresses", "applied_automatically": true}'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 34B: DATA EXPORT REQUESTS (1 total)
-- ============================================================
INSERT INTO ultaura_data_export_requests (
  id, account_id, requested_by, format,
  include_memories, include_call_metadata, include_reminders,
  status, processed_at, expires_at, download_url,
  visibility_scope, includes_health_profile, requested_scope_snapshot
) VALUES

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'aaaaaaaa-0000-4000-a000-000000000001',
 'json', true, true, true,
 'ready',
 NOW() - INTERVAL '2 days',
 NOW() + INTERVAL '5 days',
 'https://exports.example.com/seed-export-placeholder.json',
 'standard_account', false,
 '{"requestedFormat":"json","visibilityScope":"standard_account","healthInclusionMode":"automatic_when_present","includesHealthProfile":false,"includesDocumentFiles":false,"deliveredArtifactFormat":"requested_format_native"}'::jsonb)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 35: OPS & DEBUG TABLES
-- ============================================================

-- DEBUG LOGS (4 total)
INSERT INTO ultaura_debug_logs (
  id, call_session_id, account_id, event_type, tool_name, payload, metadata
) VALUES

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000001',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'tool_call', 'set_reminder',
 '{"tool": "set_reminder", "input": {"message": "garden club meeting"}, "result": "success"}'::jsonb,
 '{"duration_ms": 142}'::jsonb),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000022',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'safety_tier', 'safety_verifier',
 '{"tier": "high", "category": "HOPELESSNESS", "confidence": 0.92, "keywords": ["nobody would care"]}'::jsonb,
 '{"escalated": true, "action": "suggested_988"}'::jsonb),

(gen_random_uuid(),
 'ffffffff-0000-4000-a000-000000000013',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'tool_call', 'log_health_mention',
 '{"tool": "log_health_mention", "category": "symptom", "severity": "moderate"}'::jsonb,
 '{"alert_triggered": true}'::jsonb),

(gen_random_uuid(),
 NULL,
 'bbbbbbbb-0000-4000-a000-000000000001',
 'state_change', NULL,
 '{"event": "scheduler_lease_acquired", "lease_id": "schedules", "worker": "seed-worker"}'::jsonb,
 '{"timestamp": "2026-02-19T08:00:00Z"}'::jsonb)

ON CONFLICT DO NOTHING;

-- RATE LIMIT EVENTS (3 total)
INSERT INTO ultaura_rate_limit_events (
  id, event_type, action, ip_address, phone_number, account_id,
  limit_type, remaining, was_allowed
) VALUES

(gen_random_uuid(),
 'phone_verification', 'send_code', '192.168.1.100', '+15555550201',
 'bbbbbbbb-0000-4000-a000-000000000001',
 'per_phone', 4, true),

(gen_random_uuid(),
 'api_request', 'create_reminder', '192.168.1.100', NULL,
 'bbbbbbbb-0000-4000-a000-000000000001',
 'per_account', 98, true),

(gen_random_uuid(),
 'phone_verification', 'send_code', '10.0.0.50', '+19998887777',
 NULL,
 'per_ip', 0, false)

ON CONFLICT DO NOTHING;

-- TELEPHONY EVENT LOG (5 total)
-- NOTE: payload column was DROPPED; payload_ciphertext is TEXT (base64); payload_redacted is jsonb
INSERT INTO ultaura_telephony_event_log (
  id, account_id, line_id, call_session_id,
  provider, event_type, provider_id,
  payload_ciphertext, payload_redacted, severity, processed
) VALUES

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000001',
 'twilio', 'call.initiated', 'CA_seed_001',
 encode(convert_to('{"CallSid":"CA_seed_001","Direction":"outbound-api","CallStatus":"initiated"}', 'UTF8'), 'base64'),
 '{"CallSid": "CA_seed_001", "CallStatus": "initiated"}'::jsonb,
 'info', true),

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000001',
 'twilio', 'call.answered', 'CA_seed_001',
 encode(convert_to('{"CallSid":"CA_seed_001","CallStatus":"in-progress","AnsweredBy":"human"}', 'UTF8'), 'base64'),
 '{"CallSid": "CA_seed_001", "CallStatus": "in-progress", "AnsweredBy": "human"}'::jsonb,
 'info', true),

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'ffffffff-0000-4000-a000-000000000027',
 'twilio', 'call.no_answer', 'CA_seed_027',
 encode(convert_to('{"CallSid":"CA_seed_027","CallStatus":"no-answer"}', 'UTF8'), 'base64'),
 '{"CallSid": "CA_seed_027", "CallStatus": "no-answer"}'::jsonb,
 'warn', true),

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000002',
 'ffffffff-0000-4000-a000-000000000018',
 'twilio', 'call.machine_detected', 'CA_seed_018',
 encode(convert_to('{"CallSid":"CA_seed_018","AnsweredBy":"machine_end_beep","CallStatus":"completed"}', 'UTF8'), 'base64'),
 '{"CallSid": "CA_seed_018", "AnsweredBy": "machine_end_beep"}'::jsonb,
 'info', true),

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'cccccccc-0000-4000-a000-000000000003',
 'ffffffff-0000-4000-a000-000000000028',
 'twilio', 'call.failed', 'CA_seed_028',
 encode(convert_to('{"CallSid":"CA_seed_028","CallStatus":"failed","ErrorCode":"13227"}', 'UTF8'), 'base64'),
 '{"CallSid": "CA_seed_028", "CallStatus": "failed", "ErrorCode": "13227"}'::jsonb,
 'error', true)

ON CONFLICT DO NOTHING;

-- PENDING RECORDING DELETIONS (1 total)
INSERT INTO ultaura_pending_recording_deletions (
  id, account_id, call_session_id,
  recording_sid, reason, attempts
) VALUES

(gen_random_uuid(),
 'bbbbbbbb-0000-4000-a000-000000000001',
 'ffffffff-0000-4000-a000-000000000026',
 'RE_seed_026',
 'user_request',
 0)

ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 37: NEWSLETTER & NON-CORE
-- ============================================================

-- NEWSLETTER SUBSCRIBERS (3 total, email is citext)
INSERT INTO ultaura_newsletter_subscribers (
  id, email, first_name, source, status, confirmed_at
) VALUES

('aaaabbbb-0000-4000-c000-000000000001',
 'sarah.caregiver@example.com', 'Sarah',
 'website_signup', 'confirmed',
 NOW() - INTERVAL '30 days'),

('aaaabbbb-0000-4000-c000-000000000002',
 'john.family@example.com', 'John',
 'referral', 'pending',
 NULL),

('aaaabbbb-0000-4000-c000-000000000003',
 'elder.advocate@nonprofitcare.org', 'Maria',
 'partner_referral', 'unsubscribed',
 NOW() - INTERVAL '60 days')

ON CONFLICT (email) DO NOTHING;

-- NEWSLETTER TOPIC SUBSCRIPTIONS (6 total)
INSERT INTO ultaura_newsletter_topic_subscriptions (
  id, subscriber_id, topic_key, subscribed, subscribed_at
) VALUES

(gen_random_uuid(), 'aaaabbbb-0000-4000-c000-000000000001', 'blog_digest', true, NOW() - INTERVAL '30 days'),
(gen_random_uuid(), 'aaaabbbb-0000-4000-c000-000000000001', 'elder_care_tips', true, NOW() - INTERVAL '30 days'),
(gen_random_uuid(), 'aaaabbbb-0000-4000-c000-000000000001', 'product_updates', false, NOW() - INTERVAL '30 days'),

(gen_random_uuid(), 'aaaabbbb-0000-4000-c000-000000000002', 'blog_digest', true, NOW() - INTERVAL '15 days'),
(gen_random_uuid(), 'aaaabbbb-0000-4000-c000-000000000002', 'elder_care_tips', true, NOW() - INTERVAL '15 days'),
(gen_random_uuid(), 'aaaabbbb-0000-4000-c000-000000000002', 'product_updates', true, NOW() - INTERVAL '15 days')

ON CONFLICT (subscriber_id, topic_key) DO NOTHING;

-- NEWSLETTER WEBHOOK EVENTS (2 total, PK is svix_id text)
INSERT INTO ultaura_newsletter_webhook_events (
  svix_id, event_type, status, completed_at
) VALUES

('svix_seed_evt_001', 'subscriber.confirmed', 'processed', NOW() - INTERVAL '30 days'),
('svix_seed_evt_002', 'subscriber.unsubscribed', 'processed', NOW() - INTERVAL '5 days')

ON CONFLICT (svix_id) DO NOTHING;

-- NEWSLETTER RATE LIMITS (1 total, PK is composite ip + window_start)
INSERT INTO ultaura_newsletter_rate_limits (
  ip, window_start, request_count
) VALUES

('203.0.113.1', DATE_TRUNC('hour', NOW() - INTERVAL '2 hours'), 3)

ON CONFLICT (ip, window_start) DO NOTHING;

-- DOCUMENTS (2 total, id is bigserial)
INSERT INTO documents (content, metadata, embedding) VALUES

('Ultaura is an AI voice companion service designed to help seniors stay connected, informed, and engaged through regular phone conversations. Our AI companion Ara provides friendly check-in calls at scheduled times.',
 '{"type": "about", "source": "website", "section": "homepage"}'::jsonb,
 NULL),

('Ultaura offers four plans: Free Trial (20 minutes/day), Care ($19/month, 200 minutes), Comfort ($49/month, 600 minutes), and Family ($99/month, 1,200 minutes). All plans include overage billing at $0.15/minute except Free Trial.',
 '{"type": "pricing", "source": "website", "section": "pricing_page"}'::jsonb,
 NULL)

ON CONFLICT DO NOTHING;

-- FEEDBACK SUBMISSIONS (2 total, id is serial)
INSERT INTO feedback_submissions (type, text, screen_name, email) VALUES

('feedback', 'The voice companion is amazing! My mother loves talking with Ara every morning. She used to seem lonely but now has something to look forward to.',
 'dashboard/lines', 'happy.family@example.com'),

('bug', 'The schedule editor does not save when I click outside the time picker on mobile Safari. The save button appears but nothing happens.',
 'dashboard/lines/schedule', 'tech.user@example.com')

ON CONFLICT DO NOTHING;

-- ONBOARDING STATE (4 total, state_token must be UNIQUE)
INSERT INTO ultaura_onboarding_state (
  id, state_token, auth_user_id, state, expires_at
) VALUES

(gen_random_uuid(),
 'seed_token_payer_001',
 'aaaaaaaa-0000-4000-a000-000000000001',
 '{"step": "completed", "plan_selected": "family", "lines_configured": 4}'::jsonb,
 NOW() + INTERVAL '1 hour')

ON CONFLICT (state_token) DO NOTHING;

-- ADMIN AUDIT LOG (2 total)
INSERT INTO ultaura_admin_audit_log (
  id, admin_user_id, admin_email, action, target_type, target_id, metadata, ip
) VALUES

(gen_random_uuid(),
 'aaaaaaaa-0000-4000-a000-000000000001',
 'admin@ultaura.com',
 'account.plan_changed', 'account',
 'bbbbbbbb-0000-4000-a000-000000000001',
 '{"old_plan": "care", "new_plan": "family", "reason": "user_upgrade"}'::jsonb,
 '10.0.0.1'),

(gen_random_uuid(),
 'aaaaaaaa-0000-4000-a000-000000000001',
 'admin@ultaura.com',
 'safety_event.reviewed', 'safety_event',
 '66666666-0000-4000-a000-000000000001',
 '{"reviewer_note": "Family notified, follow-up call scheduled", "action": "escalated"}'::jsonb,
 '10.0.0.1')

ON CONFLICT DO NOTHING;

-- SMS OPT-OUTS (2 total)
INSERT INTO ultaura_sms_opt_outs (
  id, phone_e164, source, keyword
) VALUES

(gen_random_uuid(), '+19998887777', 'sms_keyword', 'STOP'),
(gen_random_uuid(), '+19997776666', 'dashboard', NULL)

ON CONFLICT (phone_e164) DO NOTHING;

-- ============================================================
-- SECTION 37B: HISTORICAL DATA GENERATION (6 months)
-- ============================================================
-- Generates ~5 months of historical call data before the existing
-- 14-day hand-crafted seed data. Uses generate_series() + a temp
-- table for compact, maintainable generation.
--
-- Historical UUIDs use md5('hist-<table>-' || line_id || '-' || date)::uuid
-- for deterministic, reproducible generation.
-- ============================================================

DO $hist$
BEGIN
  -- Step 1: Build temp staging table of all historical call slots
  CREATE TEMP TABLE _seed_hist AS
  WITH line_info AS (
    SELECT * FROM (VALUES
      ('cccccccc-0000-4000-a000-000000000001'::uuid, '+15551000001', 1),
      ('cccccccc-0000-4000-a000-000000000002'::uuid, '+15551000002', 2),
      ('cccccccc-0000-4000-a000-000000000003'::uuid, '+15551000003', 3),
      ('cccccccc-0000-4000-a000-000000000004'::uuid, '+15551000004', 4)
    ) AS t(line_id, phone, line_num)
  ),
  raw AS (
    SELECT
      li.line_id, li.phone, li.line_num,
      d.call_date,
      ROW_NUMBER() OVER (ORDER BY d.call_date, li.line_id) AS rn
    FROM generate_series(
      (NOW() - INTERVAL '180 days')::date,
      (NOW() - INTERVAL '15 days')::date,
      INTERVAL '1 day'
    ) AS d(call_date)
    CROSS JOIN line_info li
    WHERE EXTRACT(DOW FROM d.call_date) BETWEEN 1 AND 5
  )
  SELECT
    md5('hist-session-' || r.line_id || '-' || r.call_date::date::text)::uuid AS session_id,
    'bbbbbbbb-0000-4000-a000-000000000001'::uuid AS account_id,
    r.line_id,
    r.phone,
    r.call_date,
    r.rn::int AS rn,
    r.line_num,
    CASE (r.rn % 10)
      WHEN 8 THEN 'machine'
      WHEN 9 THEN 'no_answer'
      ELSE 'human'
    END AS call_type,
    (600 + ((r.rn * 137) % 1201))::int AS duration_secs,
    (3 + ((r.rn * 53) % 10))::int AS tool_invocs,
    (r.rn % 5 = 0) AS is_reminder,
    (ARRAY['positive','neutral','low','neutral','positive',
           'positive','neutral','low','positive','neutral'])[1 + (r.rn % 10)::int] AS mood_start,
    (ARRAY['positive','positive','neutral','positive','neutral',
           'positive','positive','neutral','positive','positive'])[1 + (r.rn % 10)::int] AS mood_end,
    (ARRAY['improved','stable','stable','improved','stable',
           'improved','stable','stable','improved','stable'])[1 + (r.rn % 10)::int] AS trajectory,
    (ARRAY['normal','low','normal','normal','high',
           'normal','low','normal','normal','high'])[1 + (r.rn % 10)::int] AS energy,
    r.call_date + INTERVAL '10 hours'
      + (r.line_num - 1) * INTERVAL '1 hour'
      + INTERVAL '1 minute' AS started_at
  FROM raw r;

  -- Step 2: Insert historical call sessions (~470)
  INSERT INTO ultaura_call_sessions (
    id, account_id, line_id, direction, status,
    started_at, connected_at, ended_at, seconds_connected,
    twilio_call_sid, twilio_from, twilio_to,
    end_reason, language_detected, tool_invocations,
    answered_by, is_test_call, is_reminder_call, is_preview_mode
  )
  SELECT
    h.session_id,
    h.account_id,
    h.line_id,
    'outbound'::ultaura_call_direction,
    'completed'::ultaura_call_status,
    h.started_at,
    CASE WHEN h.call_type != 'no_answer'
      THEN h.started_at + INTERVAL '12 seconds' ELSE NULL END,
    CASE
      WHEN h.call_type = 'human'  THEN h.started_at + INTERVAL '12 seconds' + h.duration_secs * INTERVAL '1 second'
      WHEN h.call_type = 'machine' THEN h.started_at + INTERVAL '42 seconds'
      ELSE NULL
    END,
    CASE
      WHEN h.call_type = 'human'  THEN h.duration_secs
      WHEN h.call_type = 'machine' THEN 30
      ELSE NULL
    END,
    'CA_seed_hist_' || LPAD(h.rn::text, 4, '0'),
    '+18005551234',
    h.phone,
    CASE WHEN h.call_type = 'no_answer' THEN 'no_answer'::ultaura_call_end_reason
      ELSE 'hangup'::ultaura_call_end_reason END,
    CASE WHEN h.call_type = 'human' THEN 'en' ELSE NULL END,
    CASE WHEN h.call_type = 'human' THEN h.tool_invocs ELSE 0 END,
    CASE h.call_type
      WHEN 'human'  THEN 'human'
      WHEN 'machine' THEN 'machine_start'
      ELSE NULL
    END,
    false,
    h.is_reminder,
    false
  FROM _seed_hist h
  ON CONFLICT (id) DO NOTHING;

  -- Step 3: Insert historical mood snapshots (human calls only, ~375)
  INSERT INTO ultaura_mood_snapshots (
    id, call_session_id, line_id, account_id,
    mood_start, mood_mid, mood_end,
    mood_start_at, mood_mid_at, mood_end_at,
    mood_trajectory, techniques_used, technique_effectiveness, energy_level
  )
  SELECT
    md5('hist-mood-' || h.line_id || '-' || h.call_date::date::text)::uuid,
    h.session_id,
    h.line_id,
    h.account_id,
    h.mood_start,
    'neutral',
    h.mood_end,
    h.started_at + INTERVAL '12 seconds',
    h.started_at + INTERVAL '12 seconds' + (h.duration_secs / 2) * INTERVAL '1 second',
    h.started_at + INTERVAL '12 seconds' + h.duration_secs * INTERVAL '1 second',
    h.trajectory,
    CASE (h.rn % 5)
      WHEN 0 THEN ARRAY['reminiscence','humor']
      WHEN 1 THEN ARRAY['storytelling','trivia']
      WHEN 2 THEN ARRAY['active_listening','validation']
      WHEN 3 THEN ARRAY['gentle_redirect','gratitude']
      ELSE        ARRAY['grounding','poetry_sharing']
    END,
    CASE (h.rn % 5)
      WHEN 0 THEN '{"reminiscence":"effective","humor":"effective"}'
      WHEN 1 THEN '{"storytelling":"effective","trivia":"somewhat_effective"}'
      WHEN 2 THEN '{"active_listening":"effective","validation":"effective"}'
      WHEN 3 THEN '{"gentle_redirect":"effective","gratitude":"somewhat_effective"}'
      ELSE        '{"grounding":"effective","poetry_sharing":"somewhat_effective"}'
    END::jsonb,
    h.energy
  FROM _seed_hist h
  WHERE h.call_type = 'human'
  ON CONFLICT (call_session_id) DO NOTHING;

  -- Step 4: Insert historical call insights with full CallInsights structure
  INSERT INTO ultaura_call_insights (
    id, call_session_id, line_id, account_id,
    insights_ciphertext, insights_iv, insights_tag,
    extraction_method, duration_seconds,
    has_concerns, needs_follow_up, has_baseline
  )
  SELECT
    md5('hist-insight-' || h.line_id || '-' || h.call_date::date::text)::uuid,
    h.session_id,
    h.line_id,
    h.account_id,
    convert_to(
      '{"mood_overall":"' || CASE WHEN h.rn % 5 = 0 THEN 'low' ELSE h.mood_end END
      || '","mood_intensity":' || CASE WHEN h.rn % 5 = 0 THEN (2 + (h.rn % 3))::text
           ELSE CASE h.mood_end WHEN 'positive' THEN (6 + (h.rn % 3))::text ELSE (4 + (h.rn % 3))::text END END
      || ',"engagement_score":' || (5 + (h.rn % 4))::text
      || ',"social_need_level":' || (2 + (h.rn % 4))::text
      || ',"topics":' || CASE (h.rn % 5)
          WHEN 0 THEN '[{"code":"family","weight":0.5},{"code":"daily_life","weight":0.3}]'
          WHEN 1 THEN '[{"code":"activities","weight":0.5},{"code":"friends","weight":0.3}]'
          WHEN 2 THEN '[{"code":"entertainment","weight":0.5},{"code":"memories","weight":0.3}]'
          WHEN 3 THEN '[{"code":"interests","weight":0.5},{"code":"plans","weight":0.3}]'
          ELSE '[{"code":"feelings","weight":0.5},{"code":"daily_life","weight":0.3}]'
        END
      || ',"private_topics":[]'
      || ',"concerns":' || CASE WHEN h.rn % 5 = 0 THEN
          CASE (h.rn % 35)
            WHEN 0 THEN '[{"code":"loneliness","severity":2,"confidence":0.7,"is_novel":true}]'
            WHEN 5 THEN '[{"code":"sadness","severity":1,"confidence":0.6,"is_novel":false}]'
            WHEN 10 THEN '[{"code":"sleep","severity":2,"confidence":0.75,"is_novel":true}]'
            WHEN 15 THEN '[{"code":"anxiety","severity":1,"confidence":0.65,"is_novel":true}]'
            WHEN 20 THEN '[{"code":"pain","severity":2,"confidence":0.8,"is_novel":false}]'
            WHEN 25 THEN '[{"code":"fatigue","severity":1,"confidence":0.7,"is_novel":true}]'
            ELSE '[{"code":"appetite","severity":1,"confidence":0.6,"is_novel":true}]'
          END
        ELSE '[]' END
      || ',"needs_follow_up":' || CASE WHEN h.rn % 5 = 0 THEN 'true' ELSE 'false' END
      || ',"follow_up_reasons":' || CASE WHEN h.rn % 5 = 0 THEN
          CASE (h.rn % 35)
            WHEN 0 THEN '["loneliness"]'
            WHEN 5 THEN '["sadness"]'
            WHEN 10 THEN '["sleep"]'
            WHEN 15 THEN '["anxiety"]'
            WHEN 20 THEN '["pain"]'
            WHEN 25 THEN '["fatigue"]'
            ELSE '["appetite"]'
          END
        ELSE '[]' END
      || ',"confidence_overall":' || ROUND((0.7 + (h.rn % 3) * 0.1)::numeric, 2)::text
      || '}',
      'UTF8'
    ),
    '\x000000000000000000000000'::bytea,
    '\x00000000000000000000000000000000'::bytea,
    'tool_call',
    h.duration_secs,
    (h.rn % 5 = 0),
    (h.rn % 5 = 0),
    true
  FROM _seed_hist h
  WHERE h.call_type = 'human'
  ON CONFLICT (call_session_id) DO NOTHING;

  -- Step 5: Insert historical minute ledger (human calls only, ~375)
  INSERT INTO ultaura_minute_ledger (
    id, account_id, line_id, call_session_id,
    cycle_start, cycle_end,
    seconds_connected, billable_minutes,
    direction, billable_type, idempotency_key
  )
  SELECT
    md5('hist-ledger-' || h.line_id || '-' || h.call_date::date::text)::uuid,
    h.account_id,
    h.line_id,
    h.session_id,
    date_trunc('month', h.call_date),
    date_trunc('month', h.call_date) + INTERVAL '1 month',
    h.duration_secs,
    CEIL(h.duration_secs::numeric / 60)::int,
    'outbound'::ultaura_call_direction,
    'included'::ultaura_billable_type,
    'seed_hist_ledger_' || h.rn
  FROM _seed_hist h
  WHERE h.call_type = 'human'
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- Step 6: Insert historical weekly summaries (~92)
  INSERT INTO ultaura_weekly_summaries (
    id, line_id, account_id, week_start_date,
    summary_ciphertext, summary_iv, summary_tag, summary_alg, summary_kid,
    email_sent_at
  )
  SELECT
    gen_random_uuid(),
    li.line_id,
    'bbbbbbbb-0000-4000-a000-000000000001'::uuid,
    w.week_start::date,
    convert_to('Weekly summary for week of ' || w.week_start::date || '. Calls completed as scheduled.', 'UTF8'),
    '\x000000000000000000000000'::bytea,
    '\x00000000000000000000000000000000'::bytea,
    'aes-256-gcm',
    'kek_v1',
    w.week_start + INTERVAL '7 days 2 hours'
  FROM generate_series(
    date_trunc('week', NOW() - INTERVAL '180 days'),
    date_trunc('week', NOW() - INTERVAL '21 days'),
    INTERVAL '1 week'
  ) AS w(week_start)
  CROSS JOIN (
    SELECT unnest(ARRAY[
      'cccccccc-0000-4000-a000-000000000001',
      'cccccccc-0000-4000-a000-000000000002',
      'cccccccc-0000-4000-a000-000000000003',
      'cccccccc-0000-4000-a000-000000000004'
    ]::uuid[]) AS line_id
  ) li
  ON CONFLICT (line_id, week_start_date) DO NOTHING;

  -- Step 7: Insert historical safety events (~15 sparse)
  INSERT INTO ultaura_safety_events (
    id, account_id, line_id, call_session_id,
    created_at, tier, signals, action_taken, category, confidence
  )
  SELECT
    gen_random_uuid(),
    h.account_id,
    h.line_id,
    h.session_id,
    h.started_at + INTERVAL '15 minutes',
    (ARRAY['low','low','medium','low','medium'])[1 + (h.rn % 5)]::ultaura_safety_tier,
    jsonb_build_object(
      'keywords_detected', jsonb_build_array('keyword_match'),
      'context', 'Historical safety observation from call on ' || h.call_date::date::text
    ),
    (ARRAY['none','none','notified_contact','none','notified_contact'])[1 + (h.rn % 5)],
    (ARRAY['GENERAL_CONCERN','ISOLATION_DISTRESS','GENERAL_CONCERN',
           'ISOLATION_DISTRESS','PHYSICAL_DANGER'])[1 + (h.rn % 5)]::ultaura_safety_category,
    (0.55 + (h.rn % 30) * 0.01)::numeric(3,2)
  FROM _seed_hist h
  WHERE h.call_type = 'human'
    AND h.rn % 25 = 7;

  -- Step 8: Insert historical wellness alerts (~16 sparse)
  INSERT INTO ultaura_wellness_alerts (
    id, line_id, account_id,
    alert_type, severity, title, summary,
    source_call_session_id, delivery_method, delivered_at, acknowledged_at
  )
  SELECT
    gen_random_uuid(),
    h.line_id,
    h.account_id,
    (ARRAY['health_mention','mood_drop','missed_calls','health_mention'])[1 + (h.rn % 4)],
    (ARRAY['info','warning','info','warning'])[1 + (h.rn % 4)],
    'Historical wellness observation',
    'Automated alert from call on ' || h.call_date::date::text,
    h.session_id,
    'email',
    h.started_at + INTERVAL '1 hour',
    CASE WHEN h.rn % 3 = 0 THEN h.started_at + INTERVAL '4 hours' ELSE NULL END
  FROM _seed_hist h
  WHERE h.call_type = 'human'
    AND h.rn % 23 = 11;

  -- Step 9: Insert historical call events (2 per connected session)
  INSERT INTO ultaura_call_events (call_session_id, created_at, type, payload)
  SELECT h.session_id, h.started_at,
    'state_change', '{"from":"created","to":"ringing"}'::jsonb
  FROM _seed_hist h WHERE h.call_type IN ('human', 'machine')
  UNION ALL
  SELECT h.session_id, h.started_at + INTERVAL '12 seconds',
    'state_change', '{"from":"ringing","to":"in_progress"}'::jsonb
  FROM _seed_hist h WHERE h.call_type IN ('human', 'machine');

  -- Step 10: Cleanup
  DROP TABLE _seed_hist;
END $hist$;

-- Update line baselines to reflect 6 months of history
UPDATE ultaura_line_baselines lb
SET baseline_call_count = sub.human_calls,
    calls_per_week = 4.0
FROM (
  SELECT cs.line_id, COUNT(*) AS human_calls
  FROM ultaura_call_sessions cs
  WHERE cs.answered_by = 'human'
  GROUP BY cs.line_id
) sub
WHERE sub.line_id = lb.line_id;

-- ============================================================
-- SECTION 37C: FIX created_at & ENRICH HAND-CRAFTED INSIGHTS
-- ============================================================
-- Seed INSERTs don't set created_at, so all rows default to now().
-- Dashboard SQL functions group/filter by created_at, causing all data
-- to appear in a single month. These UPDATEs backfill created_at from
-- the actual historical timestamps already present in each row.

UPDATE ultaura_call_sessions SET created_at = started_at
WHERE started_at IS NOT NULL;

UPDATE ultaura_mood_snapshots SET created_at = mood_start_at
WHERE mood_start_at IS NOT NULL;

UPDATE ultaura_call_insights ci
SET created_at = cs.started_at
FROM ultaura_call_sessions cs
WHERE cs.id = ci.call_session_id;

UPDATE ultaura_minute_ledger ml
SET created_at = cs.started_at
FROM ultaura_call_sessions cs
WHERE cs.id = ml.call_session_id;

UPDATE ultaura_wellness_alerts
SET created_at = COALESCE(delivered_at, created_at);

UPDATE ultaura_safety_events se
SET created_at = cs.started_at + INTERVAL '15 minutes'
FROM ultaura_call_sessions cs
WHERE cs.id = se.call_session_id;

-- Enrich Margaret/Bob/Ellie hand-crafted insights with full CallInsights fields
-- (Jim's insights 23-28 already have complete JSON from initial seed)
UPDATE ultaura_call_insights
SET insights_ciphertext = convert_to(
  (convert_from(insights_ciphertext, 'UTF8')::jsonb || jsonb_build_object(
    'mood_overall', CASE WHEN has_concerns THEN 'low' WHEN needs_follow_up THEN 'neutral' ELSE 'positive' END,
    'mood_intensity', CASE WHEN has_concerns THEN 3 WHEN needs_follow_up THEN 5 ELSE 7 END,
    'engagement_score', 6,
    'social_need_level', 3,
    'topics', CASE line_id
      WHEN 'cccccccc-0000-4000-a000-000000000001'::uuid THEN '[{"code":"family","weight":0.5},{"code":"daily_life","weight":0.3}]'::jsonb
      WHEN 'cccccccc-0000-4000-a000-000000000002'::uuid THEN '[{"code":"activities","weight":0.5},{"code":"friends","weight":0.3}]'::jsonb
      WHEN 'cccccccc-0000-4000-a000-000000000003'::uuid THEN '[{"code":"feelings","weight":0.5},{"code":"memories","weight":0.3}]'::jsonb
      ELSE '[{"code":"entertainment","weight":0.5},{"code":"interests","weight":0.3}]'::jsonb
    END,
    'private_topics', '[]'::jsonb,
    'concerns', '[]'::jsonb,
    'needs_follow_up', needs_follow_up,
    'follow_up_reasons', CASE WHEN needs_follow_up AND NOT has_concerns THEN '["wants_more_contact"]'::jsonb ELSE '[]'::jsonb END,
    'confidence_overall', 0.8
  ))::text,
  'UTF8'
)
WHERE id IN (
  '77777777-0000-4000-a000-000000000001', '77777777-0000-4000-a000-000000000002',
  '77777777-0000-4000-a000-000000000003', '77777777-0000-4000-a000-000000000004',
  '77777777-0000-4000-a000-000000000005', '77777777-0000-4000-a000-000000000006',
  '77777777-0000-4000-a000-000000000007', '77777777-0000-4000-a000-000000000008',
  '77777777-0000-4000-a000-000000000009', '77777777-0000-4000-a000-000000000010',
  '77777777-0000-4000-a000-000000000011', '77777777-0000-4000-a000-000000000012',
  '77777777-0000-4000-a000-000000000013', '77777777-0000-4000-a000-000000000014',
  '77777777-0000-4000-a000-000000000015', '77777777-0000-4000-a000-000000000016',
  '77777777-0000-4000-a000-000000000017', '77777777-0000-4000-a000-000000000018',
  '77777777-0000-4000-a000-000000000019', '77777777-0000-4000-a000-000000000020',
  '77777777-0000-4000-a000-000000000021', '77777777-0000-4000-a000-000000000022'
);

-- Add concerns to the 3 has_concerns=true rows (Margaret-08, Ellie-23, Ellie-27)
UPDATE ultaura_call_insights
SET insights_ciphertext = convert_to(
  (convert_from(insights_ciphertext, 'UTF8')::jsonb || jsonb_build_object(
    'concerns', CASE id
      WHEN '77777777-0000-4000-a000-000000000006'::uuid
        THEN '[{"code":"loneliness","severity":2,"confidence":0.7,"is_novel":true},{"code":"sadness","severity":2,"confidence":0.65,"is_novel":false}]'::jsonb
      WHEN '77777777-0000-4000-a000-000000000018'::uuid
        THEN '[{"code":"loneliness","severity":2,"confidence":0.75,"is_novel":true},{"code":"sadness","severity":2,"confidence":0.7,"is_novel":true}]'::jsonb
      WHEN '77777777-0000-4000-a000-000000000021'::uuid
        THEN '[{"code":"sadness","severity":2,"confidence":0.8,"is_novel":false},{"code":"anxiety","severity":2,"confidence":0.7,"is_novel":true}]'::jsonb
    END,
    'follow_up_reasons', CASE id
      WHEN '77777777-0000-4000-a000-000000000006'::uuid THEN '["loneliness","sadness"]'::jsonb
      WHEN '77777777-0000-4000-a000-000000000018'::uuid THEN '["loneliness","sadness"]'::jsonb
      WHEN '77777777-0000-4000-a000-000000000021'::uuid THEN '["sadness","anxiety"]'::jsonb
    END
  ))::text,
  'UTF8'
)
WHERE id IN (
  '77777777-0000-4000-a000-000000000006',
  '77777777-0000-4000-a000-000000000018',
  '77777777-0000-4000-a000-000000000021'
);

-- Reclassify excess included minutes as overage (Family plan = 1200 min/month)
-- After created_at backfill so PARTITION BY month works correctly.
-- Three steps using repeated CTE (temp tables don't survive Supabase batch execution):
-- 1. Reclassify entries fully past the cap
-- 2. Insert overage portion of boundary entries as new rows
-- 3. Shrink boundary entries to only their included portion
-- Steps 1+2 run first (read original data), then step 3 (safe because it only
-- touches the boundary row whose billable_type is still 'included').

-- Step 1: Entries fully past the cap → all their minutes are overage
WITH monthly_running AS (
  SELECT ml.id,
    ml.billable_minutes,
    SUM(ml.billable_minutes) OVER w AS running_total,
    COALESCE(SUM(ml.billable_minutes) OVER (
      PARTITION BY date_trunc('month', ml.created_at)
      ORDER BY ml.created_at, ml.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS prev_total
  FROM ultaura_minute_ledger ml
  WHERE ml.account_id = 'bbbbbbbb-0000-4000-a000-000000000001'
    AND ml.billable_type = 'included'
  WINDOW w AS (
    PARTITION BY date_trunc('month', ml.created_at)
    ORDER BY ml.created_at, ml.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )
)
UPDATE ultaura_minute_ledger ml
SET billable_type = 'overage'
FROM monthly_running r
WHERE r.id = ml.id AND r.prev_total >= 1200;

-- Step 2: Boundary entries (straddle the 1200 cap) → insert overage portion
-- CTE still reads only 'included' rows; boundary entry is still 'included'
-- (step 1 only changed rows where prev_total >= 1200)
WITH monthly_running AS (
  SELECT ml.id,
    ml.billable_minutes,
    ml.created_at,
    ml.call_session_id,
    ml.account_id,
    ml.line_id,
    ml.seconds_connected,
    ml.direction,
    SUM(ml.billable_minutes) OVER w AS running_total,
    COALESCE(SUM(ml.billable_minutes) OVER (
      PARTITION BY date_trunc('month', ml.created_at)
      ORDER BY ml.created_at, ml.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS prev_total
  FROM ultaura_minute_ledger ml
  WHERE ml.account_id = 'bbbbbbbb-0000-4000-a000-000000000001'
    AND ml.billable_type = 'included'
  WINDOW w AS (
    PARTITION BY date_trunc('month', ml.created_at)
    ORDER BY ml.created_at, ml.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )
)
INSERT INTO ultaura_minute_ledger (
  account_id, line_id, call_session_id, seconds_connected, billable_minutes,
  direction, billable_type, idempotency_key, created_at
)
SELECT account_id, line_id, call_session_id,
  (running_total - 1200) * 60,
  running_total - 1200,
  direction,
  'overage',
  'overage-split-' || id::text,
  created_at
FROM monthly_running
WHERE prev_total < 1200 AND running_total > 1200;

-- Step 3: Boundary entries → shrink to only included portion
-- Step 1 removed fully-past-cap rows from 'included', so the running totals
-- computed here reflect only the remaining 'included' rows (everything up to
-- and including the boundary entry). The boundary entry is still 'included'
-- and the running total still reaches the same value, so the split is correct.
WITH monthly_running AS (
  SELECT ml.id,
    ml.billable_minutes,
    SUM(ml.billable_minutes) OVER w AS running_total,
    COALESCE(SUM(ml.billable_minutes) OVER (
      PARTITION BY date_trunc('month', ml.created_at)
      ORDER BY ml.created_at, ml.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
    ), 0) AS prev_total
  FROM ultaura_minute_ledger ml
  WHERE ml.account_id = 'bbbbbbbb-0000-4000-a000-000000000001'
    AND ml.billable_type = 'included'
  WINDOW w AS (
    PARTITION BY date_trunc('month', ml.created_at)
    ORDER BY ml.created_at, ml.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )
)
UPDATE ultaura_minute_ledger ml
SET billable_minutes = 1200 - r.prev_total
FROM monthly_running r
WHERE r.id = ml.id AND r.prev_total < 1200 AND r.running_total > 1200;

-- ============================================================
-- SECTION 38: CROSS-REFERENCE UPDATES & FINALIZE
-- ============================================================

-- Update account minutes_used to match CURRENT CYCLE ledger total only
UPDATE ultaura_accounts
SET minutes_used = (
  SELECT COALESCE(SUM(billable_minutes), 0)
  FROM ultaura_minute_ledger
  WHERE account_id = 'bbbbbbbb-0000-4000-a000-000000000001'
    AND created_at >= (NOW() - INTERVAL '15 days')
)
WHERE id = 'bbbbbbbb-0000-4000-a000-000000000001';

-- Update scheduler leases to show reasonable active state
UPDATE ultaura_scheduler_leases
SET
  held_by = 'seed-worker',
  acquired_at = now() - INTERVAL '2 minutes',
  expires_at = now() + INTERVAL '5 minutes',
  heartbeat_at = now()
WHERE id IN ('schedules', 'reminders', 'weekly-summaries', 'recording-deletions', 'embeddings', 'decay-job', 'onboarding-maintenance');

-- Restore replication role after seed
SET session_replication_role = 'origin';

COMMIT;

-- ============================================================
-- SECTION 39: VALIDATION (runs outside the transaction)
-- ============================================================
DO $$
DECLARE
  v_auth_users int;
  v_public_users int;
  v_organizations int;
  v_memberships int;
  v_accounts int;
  v_lines int;
  v_schedules int;
  v_call_sessions int;
  v_reminders int;
  v_mood_snapshots int;
  v_call_insights int;
  v_minute_ledger int;
  v_memories int;
  v_memory_embeddings int;
  v_relationships int;
  v_milestones int;
  v_safety_events int;
  v_wellness_alerts int;
  v_trusted_contacts int;
  v_consents int;
  v_life_chapters int;
  v_cognitive_flags int;
  v_emotional_patterns int;
  v_weekly_summaries int;
  v_notification_prefs int;
BEGIN
  SELECT COUNT(*) INTO v_auth_users FROM auth.users;
  SELECT COUNT(*) INTO v_public_users FROM public.users;
  SELECT COUNT(*) INTO v_organizations FROM public.organizations;
  SELECT COUNT(*) INTO v_memberships FROM public.memberships;
  SELECT COUNT(*) INTO v_accounts FROM ultaura_accounts;
  SELECT COUNT(*) INTO v_lines FROM ultaura_lines;
  SELECT COUNT(*) INTO v_schedules FROM ultaura_schedules;
  SELECT COUNT(*) INTO v_call_sessions FROM ultaura_call_sessions;
  SELECT COUNT(*) INTO v_reminders FROM ultaura_reminders;
  SELECT COUNT(*) INTO v_mood_snapshots FROM ultaura_mood_snapshots;
  SELECT COUNT(*) INTO v_call_insights FROM ultaura_call_insights;
  SELECT COUNT(*) INTO v_minute_ledger FROM ultaura_minute_ledger;
  SELECT COUNT(*) INTO v_memories FROM ultaura_memories WHERE active = true;
  SELECT COUNT(*) INTO v_memory_embeddings FROM ultaura_memory_embeddings;
  SELECT COUNT(*) INTO v_relationships FROM ultaura_relationships;
  SELECT COUNT(*) INTO v_milestones FROM ultaura_milestones;
  SELECT COUNT(*) INTO v_safety_events FROM ultaura_safety_events;
  SELECT COUNT(*) INTO v_wellness_alerts FROM ultaura_wellness_alerts;
  SELECT COUNT(*) INTO v_trusted_contacts FROM ultaura_trusted_contacts;
  SELECT COUNT(*) INTO v_consents FROM ultaura_consents;
  SELECT COUNT(*) INTO v_life_chapters FROM ultaura_life_chapters;
  SELECT COUNT(*) INTO v_cognitive_flags FROM ultaura_cognitive_flags;
  SELECT COUNT(*) INTO v_emotional_patterns FROM ultaura_emotional_patterns;
  SELECT COUNT(*) INTO v_weekly_summaries FROM ultaura_weekly_summaries;
  SELECT COUNT(*) INTO v_notification_prefs FROM ultaura_notification_preferences;

  -- Validate core tables
  ASSERT v_auth_users >= 1,
    format('Expected >= 1 auth.users, got %s', v_auth_users);
  ASSERT v_public_users >= 1,
    format('Expected >= 1 public.users, got %s', v_public_users);
  ASSERT v_organizations >= 1,
    format('Expected >= 1 organizations, got %s', v_organizations);
  ASSERT v_memberships >= 1,
    format('Expected >= 1 memberships, got %s', v_memberships);
  ASSERT v_accounts >= 1,
    format('Expected >= 1 ultaura_accounts, got %s', v_accounts);
  ASSERT v_lines >= 4,
    format('Expected >= 4 ultaura_lines (4 full personas + test line), got %s', v_lines);
  ASSERT v_schedules >= 7,
    format('Expected >= 7 ultaura_schedules, got %s', v_schedules);
  ASSERT v_call_sessions >= 400,
    format('Expected >= 400 ultaura_call_sessions, got %s', v_call_sessions);
  ASSERT v_reminders >= 12,
    format('Expected >= 12 ultaura_reminders, got %s', v_reminders);
  ASSERT v_mood_snapshots >= 300,
    format('Expected >= 300 ultaura_mood_snapshots, got %s', v_mood_snapshots);
  ASSERT v_minute_ledger >= 300,
    format('Expected >= 300 ultaura_minute_ledger entries, got %s', v_minute_ledger);

  -- Validate personalization tables
  ASSERT v_memories >= 12,
    format('Expected >= 12 active ultaura_memories, got %s', v_memories);
  ASSERT v_memory_embeddings >= 12,
    format('Expected >= 12 ultaura_memory_embeddings, got %s', v_memory_embeddings);
  ASSERT v_relationships >= 14,
    format('Expected >= 14 ultaura_relationships, got %s', v_relationships);
  ASSERT v_milestones >= 10,
    format('Expected >= 10 ultaura_milestones, got %s', v_milestones);
  ASSERT v_life_chapters >= 10,
    format('Expected >= 10 ultaura_life_chapters, got %s', v_life_chapters);
  ASSERT v_cognitive_flags >= 4,
    format('Expected >= 4 ultaura_cognitive_flags, got %s', v_cognitive_flags);
  ASSERT v_emotional_patterns >= 4,
    format('Expected >= 4 ultaura_emotional_patterns, got %s', v_emotional_patterns);

  -- Validate safety/wellness
  ASSERT v_safety_events >= 20,
    format('Expected >= 20 ultaura_safety_events, got %s', v_safety_events);
  ASSERT v_wellness_alerts >= 20,
    format('Expected >= 20 ultaura_wellness_alerts, got %s', v_wellness_alerts);
  ASSERT v_trusted_contacts >= 9,
    format('Expected >= 9 ultaura_trusted_contacts, got %s', v_trusted_contacts);

  -- Validate consent/notifications
  ASSERT v_consents >= 24,
    format('Expected >= 24 ultaura_consents, got %s', v_consents);
  ASSERT v_weekly_summaries >= 80,
    format('Expected >= 80 ultaura_weekly_summaries, got %s', v_weekly_summaries);
  ASSERT v_notification_prefs >= 4,
    format('Expected >= 4 ultaura_notification_preferences, got %s', v_notification_prefs);

  RAISE NOTICE '============================================================';
  RAISE NOTICE 'SEED VALIDATION PASSED';
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'auth.users:                   %', v_auth_users;
  RAISE NOTICE 'public.users:                 %', v_public_users;
  RAISE NOTICE 'organizations:                %', v_organizations;
  RAISE NOTICE 'memberships:                  %', v_memberships;
  RAISE NOTICE 'ultaura_accounts:             %', v_accounts;
  RAISE NOTICE 'ultaura_lines:                %', v_lines;
  RAISE NOTICE 'ultaura_schedules:            %', v_schedules;
  RAISE NOTICE 'ultaura_call_sessions:        %', v_call_sessions;
  RAISE NOTICE 'ultaura_reminders:            %', v_reminders;
  RAISE NOTICE 'ultaura_mood_snapshots:       %', v_mood_snapshots;
  RAISE NOTICE 'ultaura_call_insights:        %', v_call_insights;
  RAISE NOTICE 'ultaura_minute_ledger:        %', v_minute_ledger;
  RAISE NOTICE 'ultaura_memories (active):    %', v_memories;
  RAISE NOTICE 'ultaura_memory_embeddings:    %', v_memory_embeddings;
  RAISE NOTICE 'ultaura_relationships:        %', v_relationships;
  RAISE NOTICE 'ultaura_milestones:           %', v_milestones;
  RAISE NOTICE 'ultaura_life_chapters:        %', v_life_chapters;
  RAISE NOTICE 'ultaura_cognitive_flags:      %', v_cognitive_flags;
  RAISE NOTICE 'ultaura_emotional_patterns:   %', v_emotional_patterns;
  RAISE NOTICE 'ultaura_safety_events:        %', v_safety_events;
  RAISE NOTICE 'ultaura_wellness_alerts:      %', v_wellness_alerts;
  RAISE NOTICE 'ultaura_trusted_contacts:     %', v_trusted_contacts;
  RAISE NOTICE 'ultaura_consents:             %', v_consents;
  RAISE NOTICE 'ultaura_weekly_summaries:     %', v_weekly_summaries;
  RAISE NOTICE 'ultaura_notification_prefs:   %', v_notification_prefs;
  RAISE NOTICE '============================================================';

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'SEED VALIDATION FAILED: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END $$;
