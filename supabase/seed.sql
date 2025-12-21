-- Seed data for testing
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
  'trial',
  'free_trial',
  20,
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
