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
  '{"provider": "email", "providers": ["email"]}',
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
  'test@example.com',
  'active',
  'family',
  2200,
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
  timezone
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Test User',
  '+15555550100',
  NOW(),
  'active',
  'America/Los_Angeles'
) ON CONFLICT (id) DO NOTHING;
