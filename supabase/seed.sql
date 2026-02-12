-- Seed data for testing

-- Create test user for local development (test@makerkit.dev / testingpassword)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'a9c1aab7-24e3-4e69-aea2-93b7cd0ae1c9',
  'authenticated',
  'authenticated',
  'test@makerkit.dev',
  crypt('testingpassword', gen_salt('bf')),
  NOW(),
  '{"provider": "email", "providers": ["email"], "role": "super-admin"}',
  '{}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
) ON CONFLICT (id) DO NOTHING;

-- Create identity for test user
INSERT INTO auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a9c1aab7-24e3-4e69-aea2-93b7cd0ae1c9',
  'a9c1aab7-24e3-4e69-aea2-93b7cd0ae1c9',
  'test@makerkit.dev',
  '{"sub": "a9c1aab7-24e3-4e69-aea2-93b7cd0ae1c9", "email": "test@makerkit.dev"}',
  'email',
  NOW(),
  NOW(),
  NOW()
) ON CONFLICT (provider_id, provider) DO NOTHING;

-- Create public user record
INSERT INTO public.users (id, onboarded, created_at)
VALUES ('a9c1aab7-24e3-4e69-aea2-93b7cd0ae1c9', true, NOW())
ON CONFLICT (id) DO NOTHING;

-- Create test organization
INSERT INTO public.organizations (id, name, created_at)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Test Organization', NOW())
ON CONFLICT (id) DO NOTHING;

-- Create membership for test user
INSERT INTO public.memberships (user_id, organization_id, role, created_at)
VALUES ('a9c1aab7-24e3-4e69-aea2-93b7cd0ae1c9', 1, 2, NOW())
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Insert test account
INSERT INTO ultaura_accounts (
  id,
  organization_id,
  name,
  billing_email,
  status,
  plan_id,
  minutes_included,
  cycle_start,
  cycle_end
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  1,  -- Replace with actual org ID
  'Test Account',
  'test@makerkit.dev',
  'active',
  'family',
  1200,
  NOW(),
  NOW() + INTERVAL '30 days'
) ON CONFLICT (id) DO NOTHING;

-- Insert test line
INSERT INTO ultaura_lines (
  id,
  account_id,
  display_name,
  phone_e164,
  phone_verified_at,
  status,
  timezone,
  short_id
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Test User',
  '+15555550100',
  NOW(),
  'active',
  'America/Los_Angeles',
  '00000000'
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Mock Line: Margaret Johnson (78-year-old grandmother)
-- Rich test data for dashboard UI testing
-- Account: 00000000-0000-0000-0000-000000000001 (Test Account)
-- ============================================================

-- Fixed UUIDs for referential integrity
-- Line:          11111111-1111-1111-1111-111111111111
-- Schedules:     22222222-2222-2222-2222-222222222201, ...02
-- Reminders:     33333333-3333-3333-3333-333333333301, ...02, ...03
-- Contacts:      44444444-4444-4444-4444-444444444401, ...02
-- Call Sessions: 55555555-5555-5555-5555-555555555501 through ...08
-- Milestones:    66666666-6666-6666-6666-666666666601 through ...04
-- Relationships: 77777777-7777-7777-7777-777777777701 through ...05
-- Wellness:      88888888-8888-8888-8888-888888888801 through ...03
-- Safety:        99999999-9999-9999-9999-999999999901

-- 1. THE LINE
INSERT INTO ultaura_lines (
  id, account_id, display_name, phone_e164, phone_verified_at, status,
  timezone, quiet_hours_start, quiet_hours_end, do_not_call, inbound_allowed,
  last_successful_call_at, next_scheduled_call_at,
  seed_interests, seed_avoid_topics,
  allow_voice_reminder_control, voicemail_behavior,
  consecutive_missed_calls, last_answered_call_at, missed_alert_sent_at,
  last_weekly_summary_at, short_id, vacation_ranges, allow_voice_schedule_control,
  birth_year, formative_decade, hometown, current_location,
  optimal_call_time, optimal_call_time_source, optimal_call_days,
  interruption_tolerance, filler_word_patience, silence_tolerance_ms,
  crosstalk_recovery_mode,
  preferred_language_bcp47, preferred_language_iso,
  preferred_grok_voice
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000001',
  'Margaret Johnson',
  '+15555550201',
  NOW() - INTERVAL '45 days',
  'active',
  'America/New_York',
  '21:00', '08:00',
  false, true,
  NOW() - INTERVAL '6 hours',
  NOW() + INTERVAL '18 hours',
  ARRAY['gardening', 'classical music', 'baking', 'bird watching', 'crossword puzzles', 'history'],
  ARRAY['politics', 'violent news'],
  true, 'brief',
  0,
  NOW() - INTERVAL '6 hours',
  NULL,
  NOW() - INTERVAL '3 days',
  'marg0001',
  '[]'::jsonb,
  true,
  1947, 1960, 'Charleston, South Carolina', 'Savannah, Georgia',
  '10:00', 'ai_learned', ARRAY[1,2,3,4,5],
  'normal', 'high', 2500,
  'patient',
  'en-US', 'en',
  'Eve'
) ON CONFLICT (id) DO NOTHING;

-- 2. SCHEDULES (weekday morning + weekend afternoon)
INSERT INTO ultaura_schedules (id, account_id, line_id, enabled, timezone, days_of_week, time_of_day, next_run_at, last_run_at, last_result) VALUES
('22222222-2222-2222-2222-222222222201', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 true, 'America/New_York', ARRAY[1,2,3,4,5], '10:00',
 (NOW() + INTERVAL '18 hours')::timestamptz,
 (NOW() - INTERVAL '6 hours')::timestamptz, 'success'),
('22222222-2222-2222-2222-222222222202', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 true, 'America/New_York', ARRAY[6,0], '14:00',
 (NOW() + INTERVAL '2 days')::timestamptz,
 (NOW() - INTERVAL '1 day')::timestamptz, 'success')
ON CONFLICT (id) DO NOTHING;

-- 3. CALL SESSIONS (8 calls over past 2 weeks)
INSERT INTO ultaura_call_sessions (
  id, account_id, line_id, direction, status, started_at, connected_at, ended_at,
  seconds_connected, twilio_call_sid, twilio_from, twilio_to, end_reason,
  language_detected, tool_invocations, answered_by, is_test_call
) VALUES
('55555555-5555-5555-5555-555555555501', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '13 days 14 hours', NOW() - INTERVAL '13 days 13 hours 59 minutes',
 NOW() - INTERVAL '13 days 13 hours 41 minutes', 1080, 'CA_mock_001', '+18005551234', '+15555550201',
 'hangup', 'en', 12, 'human', false),
('55555555-5555-5555-5555-555555555502', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '11 days 14 hours', NOW() - INTERVAL '11 days 13 hours 59 minutes',
 NOW() - INTERVAL '11 days 13 hours 37 minutes', 1320, 'CA_mock_002', '+18005551234', '+15555550201',
 'hangup', 'en', 15, 'human', false),
('55555555-5555-5555-5555-555555555503', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '9 days 14 hours', NOW() - INTERVAL '9 days 13 hours 59 minutes',
 NOW() - INTERVAL '9 days 13 hours 44 minutes', 900, 'CA_mock_003', '+18005551234', '+15555550201',
 'hangup', 'en', 8, 'human', false),
('55555555-5555-5555-5555-555555555504', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '7 days 14 hours', NOW() - INTERVAL '7 days 13 hours 59 minutes',
 NOW() - INTERVAL '7 days 13 hours 34 minutes', 1500, 'CA_mock_004', '+18005551234', '+15555550201',
 'hangup', 'en', 18, 'human', false),
('55555555-5555-5555-5555-555555555505', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '5 days 14 hours', NOW() - INTERVAL '5 days 14 hours',
 NOW() - INTERVAL '5 days 13 hours 59 minutes', 0, 'CA_mock_005', '+18005551234', '+15555550201',
 'no_answer', 'en', 0, 'machine_start', false),
('55555555-5555-5555-5555-555555555506', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '4 days 14 hours', NOW() - INTERVAL '4 days 13 hours 59 minutes',
 NOW() - INTERVAL '4 days 13 hours 39 minutes', 1200, 'CA_mock_006', '+18005551234', '+15555550201',
 'hangup', 'en', 14, 'human', false),
('55555555-5555-5555-5555-555555555507', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '2 days 14 hours', NOW() - INTERVAL '2 days 13 hours 59 minutes',
 NOW() - INTERVAL '2 days 13 hours 47 minutes', 720, 'CA_mock_007', '+18005551234', '+15555550201',
 'hangup', 'en', 9, 'human', false),
('55555555-5555-5555-5555-555555555508', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound', 'completed', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 59 minutes',
 NOW() - INTERVAL '5 hours 40 minutes', 1140, 'CA_mock_008', '+18005551234', '+15555550201',
 'hangup', 'en', 16, 'human', false)
ON CONFLICT (id) DO NOTHING;

-- 4. MOOD SNAPSHOTS (one per answered call)
INSERT INTO ultaura_mood_snapshots (
  id, call_session_id, line_id, account_id,
  mood_start, mood_mid, mood_end,
  mood_start_at, mood_mid_at, mood_end_at,
  mood_trajectory, techniques_used, technique_effectiveness, energy_level
) VALUES
(gen_random_uuid(), '55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'neutral', 'positive', 'positive', NOW()-INTERVAL '13 days 14 hours', NOW()-INTERVAL '13 days 13 hours 50 minutes', NOW()-INTERVAL '13 days 13 hours 41 minutes',
 'improved', ARRAY['reminiscence', 'humor'], '{"reminiscence": "effective", "humor": "effective"}'::jsonb, 'normal'),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'positive', 'positive', 'positive', NOW()-INTERVAL '11 days 14 hours', NOW()-INTERVAL '11 days 13 hours 48 minutes', NOW()-INTERVAL '11 days 13 hours 37 minutes',
 'stable', ARRAY['storytelling'], '{"storytelling": "effective"}'::jsonb, 'high'),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'low', 'neutral', 'neutral', NOW()-INTERVAL '9 days 14 hours', NOW()-INTERVAL '9 days 13 hours 52 minutes', NOW()-INTERVAL '9 days 13 hours 44 minutes',
 'improved', ARRAY['active_listening', 'validation'], '{"active_listening": "effective", "validation": "somewhat_effective"}'::jsonb, 'low'),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'positive', 'positive', 'positive', NOW()-INTERVAL '7 days 14 hours', NOW()-INTERVAL '7 days 13 hours 47 minutes', NOW()-INTERVAL '7 days 13 hours 34 minutes',
 'stable', ARRAY['trivia', 'humor', 'reminiscence'], '{"trivia": "effective", "humor": "effective", "reminiscence": "effective"}'::jsonb, 'high'),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'neutral', 'neutral', 'positive', NOW()-INTERVAL '4 days 14 hours', NOW()-INTERVAL '4 days 13 hours 49 minutes', NOW()-INTERVAL '4 days 13 hours 39 minutes',
 'improved', ARRAY['reminiscence', 'gratitude'], '{"reminiscence": "effective", "gratitude": "effective"}'::jsonb, 'normal'),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'sad', 'low', 'neutral', NOW()-INTERVAL '2 days 14 hours', NOW()-INTERVAL '2 days 13 hours 53 minutes', NOW()-INTERVAL '2 days 13 hours 47 minutes',
 'improved', ARRAY['active_listening', 'validation', 'gentle_redirect'], '{"active_listening": "effective", "validation": "effective", "gentle_redirect": "somewhat_effective"}'::jsonb, 'low'),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555508', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'neutral', 'positive', 'positive', NOW()-INTERVAL '6 hours', NOW()-INTERVAL '5 hours 50 minutes', NOW()-INTERVAL '5 hours 40 minutes',
 'improved', ARRAY['humor', 'trivia', 'storytelling'], '{"humor": "effective", "trivia": "effective", "storytelling": "effective"}'::jsonb, 'normal')
ON CONFLICT (call_session_id) DO NOTHING;

-- 5. CALL INSIGHTS (encrypted placeholder per answered call)
INSERT INTO ultaura_call_insights (
  id, call_session_id, line_id, account_id,
  insights_ciphertext, insights_iv, insights_tag, insights_alg, insights_kid,
  extraction_method, duration_seconds, has_concerns, needs_follow_up, has_baseline
) VALUES
(gen_random_uuid(), '55555555-5555-5555-5555-555555555501', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 1080, false, false, true),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555502', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 1320, false, false, true),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555503', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 900, true, true, true),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 1500, false, false, true),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555506', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 1200, false, false, true),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 720, true, true, true),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555508', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '\x00'::bytea, '\x000000000000000000000000'::bytea, '\x00000000000000000000000000000000'::bytea, 'aes-256-gcm', 'kek_v1', 'tool_call', 1140, false, false, true)
ON CONFLICT (call_session_id) DO NOTHING;

-- 6. MINUTE LEDGER (billing entries per call)
INSERT INTO ultaura_minute_ledger (
  id, account_id, line_id, call_session_id, cycle_start, cycle_end,
  seconds_connected, billable_minutes, direction, billable_type, idempotency_key
) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555501', NOW()-INTERVAL '30 days', NOW(), 1080, 18, 'outbound', 'included', 'mock_ledger_001'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555502', NOW()-INTERVAL '30 days', NOW(), 1320, 22, 'outbound', 'included', 'mock_ledger_002'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555503', NOW()-INTERVAL '30 days', NOW(), 900, 15, 'outbound', 'included', 'mock_ledger_003'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555504', NOW()-INTERVAL '30 days', NOW(), 1500, 25, 'outbound', 'included', 'mock_ledger_004'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555506', NOW()-INTERVAL '30 days', NOW(), 1200, 20, 'outbound', 'included', 'mock_ledger_005'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555507', NOW()-INTERVAL '30 days', NOW(), 720, 12, 'outbound', 'included', 'mock_ledger_006'),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555508', NOW()-INTERVAL '30 days', NOW(), 1140, 19, 'outbound', 'included', 'mock_ledger_007')
ON CONFLICT (idempotency_key) DO NOTHING;

-- 7. REMINDERS
INSERT INTO ultaura_reminders (
  id, account_id, line_id, due_at, timezone, message, delivery_method, status,
  privacy_scope, is_recurring, rrule, time_of_day, occurrence_count
) VALUES
('33333333-3333-3333-3333-333333333301', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 NOW() + INTERVAL '1 day' + INTERVAL '8 hours', 'America/New_York',
 'Time to take your morning medications - blood pressure pill and vitamin D',
 'outbound_call', 'scheduled', 'line_only', true,
 'FREQ=DAILY', '08:00', 12),
('33333333-3333-3333-3333-333333333302', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 NOW() + INTERVAL '5 days' + INTERVAL '14 hours', 'America/New_York',
 'Doctor appointment with Dr. Reynolds at 2:00 PM tomorrow - remember to bring your medication list',
 'outbound_call', 'scheduled', 'shareable_with_payer', false,
 NULL, NULL, 0),
('33333333-3333-3333-3333-333333333303', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 NOW() + INTERVAL '3 days' + INTERVAL '9 hours', 'America/New_York',
 'Garden club meeting at the community center at 10 AM - Helen said she would give you a ride',
 'outbound_call', 'scheduled', 'line_only', true,
 'FREQ=WEEKLY;BYDAY=WE', '09:00', 6)
ON CONFLICT (id) DO NOTHING;

-- 8. TRUSTED CONTACTS
INSERT INTO ultaura_trusted_contacts (
  id, account_id, line_id, name, relationship, phone_e164, notify_on, enabled
) VALUES
('44444444-4444-4444-4444-444444444401', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'Susan Chen', 'Daughter', '+15555550301', ARRAY['safety_event', 'missed_calls', 'wellness_alert'], true),
('44444444-4444-4444-4444-444444444402', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'Robert Miller', 'Neighbor', '+15555550302', ARRAY['safety_event'], true)
ON CONFLICT (id) DO NOTHING;

-- 9. MILESTONES
INSERT INTO ultaura_milestones (
  id, line_id, account_id, milestone_type, title, description,
  date_month, date_day, date_year, is_recurring,
  related_person_name, notify_days_before, notify_on_day,
  last_celebrated_at, times_celebrated, source, privacy_scope
) VALUES
('66666666-6666-6666-6666-666666666601', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'birthday', 'Margaret''s Birthday', 'Margaret turns 79 this year',
 4, 15, 1947, true, NULL, 3, true,
 NOW() - INTERVAL '300 days', 1, 'family_input', 'shareable_with_payer'),
('66666666-6666-6666-6666-666666666602', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'memorial', 'Wedding Anniversary with Harold', 'Would have been 54 years together',
 6, 21, 1972, true, 'Harold Johnson', 1, true,
 NULL, 0, 'conversation', 'line_only'),
('66666666-6666-6666-6666-666666666603', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'birthday', 'Emma''s Birthday', 'Granddaughter Emma turns 12',
 3, 8, 2014, true, 'Emma', 2, true,
 NOW() - INTERVAL '340 days', 1, 'conversation', 'shareable_with_payer'),
('66666666-6666-6666-6666-666666666604', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'achievement', '30 Years of Teaching', 'Retired after 30 years teaching 3rd grade at Savannah Elementary',
 5, 30, 2007, false, NULL, 0, false,
 NULL, 0, 'conversation', 'shareable_with_payer')
ON CONFLICT (id) DO NOTHING;

-- 10. RELATIONSHIPS
INSERT INTO ultaura_relationships (
  id, line_id, account_id, name, nickname, relation_type, relation_role,
  contact_frequency, last_contact_mentioned, typical_contact_method,
  sentiment, emotional_significance, location, distance_category,
  shared_activities, conversation_topics, times_mentioned, last_mentioned_at,
  recent_topics, is_deceased, passed_at, death_mentioned_at, grief_sensitivity,
  privacy_scope
) VALUES
('77777777-7777-7777-7777-777777777701', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'Harold Johnson', 'Harry', 'spouse', 'husband',
 NULL, NULL, NULL,
 'positive', 'high', 'Savannah, Georgia', 'local',
 ARRAY['dancing', 'traveling', 'gardening'], ARRAY['marriage', 'travel memories', 'retirement'],
 28, NOW() - INTERVAL '2 days',
 ARRAY['their trip to Italy', 'his favorite roses'],
 true, '2021-11-15'::timestamptz, NOW() - INTERVAL '2 days', 'high', 'line_only'),
('77777777-7777-7777-7777-777777777702', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'Susan Chen', NULL, 'child', 'daughter',
 'weekly', NOW() - INTERVAL '3 days', 'phone',
 'positive', 'high', 'Atlanta, Georgia', 'regional',
 ARRAY['cooking together', 'shopping'], ARRAY['grandchildren', 'family events', 'health'],
 45, NOW() - INTERVAL '6 hours',
 ARRAY['Emma school play', 'Thanksgiving plans'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),
('77777777-7777-7777-7777-777777777703', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'Emma Chen', 'Emmy', 'grandchild', 'granddaughter',
 'weekly', NOW() - INTERVAL '5 days', 'video call',
 'positive', 'high', 'Atlanta, Georgia', 'regional',
 ARRAY['baking cookies', 'reading together', 'piano'], ARRAY['school', 'piano recital', 'friends'],
 32, NOW() - INTERVAL '6 hours',
 ARRAY['school play rehearsal', 'new piano piece'],
 false, NULL, NULL, NULL, 'shareable_with_payer'),
('77777777-7777-7777-7777-777777777704', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'Helen Martinez', NULL, 'friend', 'close friend',
 'weekly', NOW() - INTERVAL '4 days', 'in person',
 'positive', 'high', 'Savannah, Georgia', 'local',
 ARRAY['garden club', 'walking', 'church choir'], ARRAY['gardening tips', 'church', 'neighborhood news'],
 19, NOW() - INTERVAL '4 days',
 ARRAY['new rose variety', 'church fundraiser'],
 false, NULL, NULL, NULL, 'line_only'),
('77777777-7777-7777-7777-777777777705', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'Dr. Reynolds', NULL, 'professional', 'primary care doctor',
 'monthly', NOW() - INTERVAL '25 days', 'in person',
 'positive', 'medium', 'Savannah, Georgia', 'local',
 NULL, ARRAY['blood pressure', 'medications', 'checkups'],
 6, NOW() - INTERVAL '5 days',
 ARRAY['upcoming appointment', 'medication adjustment'],
 false, NULL, NULL, NULL, 'line_only')
ON CONFLICT (id) DO NOTHING;

-- 11. WELLNESS ALERTS
INSERT INTO ultaura_wellness_alerts (
  id, line_id, account_id, alert_type, severity, title, summary,
  source_call_session_id, delivery_method, delivered_at, acknowledged_at
) VALUES
('88888888-8888-8888-8888-888888888801', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'mood_drop', 'warning', 'Mood Decline Detected',
 'Margaret seemed notably sad during today''s call. She mentioned missing Harold and feeling lonely in the evenings. She brightened when talking about Emma but returned to a low mood when the conversation ended.',
 '55555555-5555-5555-5555-555555555507', 'email', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day 20 hours'),
('88888888-8888-8888-8888-888888888802', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'health_mention', 'info', 'Health Update: Knee Pain',
 'Margaret mentioned her left knee has been bothering her more than usual this week, especially when walking to the garden. She said she plans to ask Dr. Reynolds about it at her upcoming appointment.',
 '55555555-5555-5555-5555-555555555503', 'dashboard_only', NULL, NULL),
('88888888-8888-8888-8888-888888888803', '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'missed_calls', 'info', 'Missed Call',
 'Margaret did not answer the scheduled call on this day. The call went to voicemail. A brief message was left. She answered normally the following day.',
 '55555555-5555-5555-5555-555555555505', 'email', NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days 22 hours')
ON CONFLICT (id) DO NOTHING;

-- 12. SAFETY EVENTS
INSERT INTO ultaura_safety_events (
  id, account_id, line_id, call_session_id, tier, signals, action_taken,
  category, confidence
) VALUES
('99999999-9999-9999-9999-999999999901', '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 '55555555-5555-5555-5555-555555555503', 'low',
 '{"keywords_detected": ["lonely", "nobody visits"], "context": "Margaret expressed feeling isolated after church was canceled due to weather"}'::jsonb,
 'none', 'ISOLATION_DISTRESS', 0.35)
ON CONFLICT (id) DO NOTHING;

-- 13. COGNITIVE OBSERVATIONS
INSERT INTO ultaura_cognitive_observations (
  id, call_session_id, line_id, observation_type, severity, context,
  response_given, is_novel, similar_observation_count
) VALUES
(gen_random_uuid(), '55555555-5555-5555-5555-555555555504', '11111111-1111-1111-1111-111111111111',
 'repetition', 'mild', 'Margaret told the story about Harold''s surprise birthday party twice during the same call',
 'Gently acknowledged the story both times without drawing attention to the repetition', true, 1),
(gen_random_uuid(), '55555555-5555-5555-5555-555555555507', '11111111-1111-1111-1111-111111111111',
 'word_finding', 'mild', 'Margaret paused several times trying to recall Dr. Reynolds'' name, eventually said "my doctor"',
 'Provided the name naturally in conversation context', false, 2);

-- 14. COGNITIVE FLAGS
INSERT INTO ultaura_cognitive_flags (
  id, line_id, concern_level, confusion_count_14d, repetition_count_14d,
  orientation_count_14d, consecutive_calls_with_concern, last_concern_at
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
 'monitoring', 0, 2, 0, 1, NOW() - INTERVAL '2 days')
ON CONFLICT (line_id) DO NOTHING;

-- 15. EMOTIONAL PATTERNS
INSERT INTO ultaura_emotional_patterns (
  id, line_id, dominant_mood, mood_variability, best_time_of_day, worst_time_of_day,
  positive_triggers, negative_triggers, effective_techniques, ineffective_techniques
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
 'positive', 'moderate', 'morning', 'evening',
 ARRAY['grandchildren stories', 'gardening talk', 'music reminiscence', 'trivia games', 'baking'],
 ARRAY['loneliness', 'health concerns', 'missing Harold', 'rainy weather', 'canceled plans'],
 ARRAY['reminiscence', 'humor', 'trivia', 'storytelling', 'active_listening'],
 ARRAY['rushed conversation', 'overly direct questions about feelings'])
ON CONFLICT (line_id) DO NOTHING;

-- 16. LINE BASELINES
INSERT INTO ultaura_line_baselines (
  line_id, avg_engagement, avg_duration_seconds, calls_per_week,
  answer_rate, mood_distribution, recent_concern_codes, baseline_call_count
) VALUES
('11111111-1111-1111-1111-111111111111',
 4.2, 1123, 3.5, 0.875,
 '{"positive": 0.57, "neutral": 0.29, "low": 0.14}'::jsonb,
 ARRAY['ISOLATION_DISTRESS'], 7)
ON CONFLICT (line_id) DO NOTHING;

-- 17. NOTIFICATION PREFERENCES
INSERT INTO ultaura_notification_preferences (
  id, account_id, line_id, weekly_summary_enabled, weekly_summary_format,
  weekly_summary_day, weekly_summary_time,
  alert_missed_calls_enabled, alert_missed_calls_threshold,
  health_mention_alerts, mood_drop_alerts, cognitive_concern_alerts,
  alert_delivery_method
) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 true, 'email', 'sunday', '18:00',
 true, 2,
 true, true, true,
 'email');

-- 18. ACCESSIBILITY SETTINGS
INSERT INTO ultaura_accessibility_settings (
  id, line_id, hearing_mode, speech_rate, pause_between_sentences,
  repeat_key_info, cognitive_mode, simplified_language, shorter_responses,
  provide_call_recap, remind_of_previous_topics, context_window_calls,
  hearing_mode_source, cognitive_mode_source
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
 'enhanced_clarity', 0.9, true, true,
 'supportive', false, false,
 true, true, 8,
 'family', 'ai_detected')
ON CONFLICT (line_id) DO NOTHING;

-- 19. CONTENT PREFERENCES
INSERT INTO ultaura_content_preferences (
  id, line_id, trivia_preference, story_preference, memory_lane_preference,
  brain_games_preference, favorite_trivia_domains, avoided_trivia_domains,
  trivia_difficulty, favorite_story_genres, avoided_story_themes,
  preferred_story_length, favorite_eras, favorite_memory_topics,
  best_segment_time_of_call
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
 5, 4, 5, 3,
 ARRAY['history', 'nature', 'music', 'food'],
 ARRAY['technology', 'sports'],
 'medium',
 ARRAY['romance', 'mystery', 'historical fiction'],
 ARRAY['horror', 'war'],
 'medium',
 ARRAY['1950s', '1960s', '1970s'],
 ARRAY['childhood', 'teaching', 'family gatherings', 'travel', 'holidays'],
 'middle')
ON CONFLICT (line_id) DO NOTHING;

-- 20. DAILY RHYTHMS
INSERT INTO ultaura_daily_rhythms (
  id, line_id, morning_energy, afternoon_energy, evening_energy,
  morning_routine_summary, afternoon_routine_summary, evening_routine_summary,
  best_engagement_time, worst_engagement_time,
  avg_duration_by_time, best_days_of_week, avoid_days_of_week
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
 'high', 'moderate', 'low',
 'Wakes at 7 AM, has coffee and reads the newspaper, waters the garden',
 'Lunch at noon, often visits Helen or goes to garden club on Wednesdays, reads or does crosswords',
 'Dinner at 5:30, watches Jeopardy at 7, reads before bed at 9',
 '10:00', '20:00',
 '{"morning": 1200, "afternoon": 1050, "evening": 780}'::jsonb,
 ARRAY[1, 3, 4],
 ARRAY[6])
ON CONFLICT (line_id) DO NOTHING;

-- 21. PERSONA ADAPTATIONS
INSERT INTO ultaura_persona_adaptations (
  id, line_id, formality_level, humor_level, directness_level,
  vocabulary_complexity, regional_expressions, preferred_phrases,
  avoided_phrases, prefers_short_exchanges, prefers_stories,
  asks_many_questions, typical_energy, morning_energy, afternoon_energy,
  evening_energy, calls_analyzed, confidence_score
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
 'warm', 'light', 'balanced',
 'standard',
 ARRAY['bless your heart', 'fixing to', 'y''all'],
 ARRAY['dear', 'sweetie', 'well I declare'],
 ARRAY['elderly', 'old', 'senior citizen'],
 false, true, true,
 'moderate', 'high', 'moderate', 'low',
 7, 0.78)
ON CONFLICT (line_id) DO NOTHING;

-- 22. CONSENTS
INSERT INTO ultaura_consents (id, account_id, line_id, type, granted, granted_by, evidence) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'outbound_calls', true, 'payer_ack', '{"accepted_at": "2025-01-05T10:00:00Z"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'trusted_contact_notify', true, 'payer_ack', '{"accepted_at": "2025-01-05T10:00:00Z"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'data_retention', true, 'payer_ack', '{"accepted_at": "2025-01-05T10:00:00Z"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'audio_processing', true, 'line_voice', '{"call_session_id": "55555555-5555-5555-5555-555555555501", "captured_at": "2025-01-06T14:02:00Z"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
 'recording', true, 'line_voice', '{"call_session_id": "55555555-5555-5555-5555-555555555501", "captured_at": "2025-01-06T14:03:00Z"}'::jsonb);

-- 23. SEGMENT ENGAGEMENT
INSERT INTO ultaura_segment_engagement (
  id, line_id, account_id, call_session_id, segment_type, segment_domain,
  segment_context, duration_seconds, completed, engagement_signals, senior_response
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '55555555-5555-5555-5555-555555555504', 'trivia', 'history',
 '{"topic": "1960s American History", "difficulty": "medium"}'::jsonb,
 300, true, '{"laughs": 2, "correct_answers": 3, "asked_for_more": true}'::jsonb, 'enjoyed'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '55555555-5555-5555-5555-555555555508', 'story', 'historical fiction',
 '{"title": "The Letter from Charleston", "chapter": 2}'::jsonb,
 420, true, '{"emotional_responses": 3, "asked_questions": 2}'::jsonb, 'enjoyed'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 '55555555-5555-5555-5555-555555555502', 'memory_lane', 'childhood',
 '{"topic": "Growing up in Charleston"}'::jsonb,
 480, true, '{"stories_shared": 3, "laughs": 4, "emotional_moments": 1}'::jsonb, 'enjoyed');

-- 24. STORY ARCS
INSERT INTO ultaura_story_arcs (
  id, line_id, account_id, title, description, story_type,
  total_chapters, current_chapter, last_chapter_at,
  story_state, status, personalization_context,
  era_setting, themes, engagement_score
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'The Letter from Charleston', 'A historical fiction story about a letter found in an old Charleston home, connecting two women across generations',
 'serial', 6, 2, NOW() - INTERVAL '6 hours',
 '{"chapter_1_summary": "Evelyn finds a letter in her late grandmother''s attic", "chapter_2_summary": "The letter reveals a secret friendship during the Civil Rights era"}'::jsonb,
 'active',
 '{"hometown": "Charleston", "interests": ["history", "family"], "era_preference": "1960s"}'::jsonb,
 '1960s Charleston', ARRAY['family', 'history', 'friendship', 'courage'],
 4.5);

-- 25. CALL PREVIEWS
INSERT INTO ultaura_call_previews (
  id, line_id, account_id, topic_type, topic_key, topic_display,
  segment_type, segment_context, offered_at, status
) VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'segment', 'story_chapter_3', 'Continue "The Letter from Charleston" - Chapter 3',
 'story', '{"story_arc_title": "The Letter from Charleston", "chapter": 3}'::jsonb,
 NOW(), 'pending'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'memory_follow_up', 'emma_school_play', 'Ask about Emma''s school play rehearsal',
 NULL, NULL,
 NOW(), 'pending'),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001',
 'segment', 'trivia_nature', '1960s Nature & Wildlife Trivia',
 'trivia', '{"domain": "nature", "difficulty": "medium", "era_context": "1960s"}'::jsonb,
 NOW(), 'pending');

-- 26. SCHEDULE EVENTS (history)
INSERT INTO ultaura_schedule_events (
  id, account_id, schedule_id, line_id, event_type, triggered_by, metadata
) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111',
 'created', 'dashboard', '{"note": "Initial weekday schedule created"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111',
 'created', 'dashboard', '{"note": "Weekend afternoon schedule created"}'::jsonb);

-- 27. REMINDER EVENTS (history)
INSERT INTO ultaura_reminder_events (
  id, account_id, reminder_id, line_id, event_type, triggered_by, metadata
) VALUES
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111111',
 'created', 'dashboard', '{"note": "Daily medication reminder set up by family"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111111',
 'created', 'voice', '{"note": "Margaret asked to be reminded about her doctor appointment"}'::jsonb),
(gen_random_uuid(), '00000000-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111111',
 'created', 'voice', '{"note": "Margaret asked to be reminded about garden club"}'::jsonb);

-- 28. UPDATE ACCOUNT MINUTES USED (131 min from Margaret's calls)
UPDATE ultaura_accounts
SET minutes_used = minutes_used + 131
WHERE id = '00000000-0000-0000-0000-000000000001';
