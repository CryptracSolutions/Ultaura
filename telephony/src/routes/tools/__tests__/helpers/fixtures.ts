import type { CallSessionRow } from '../../../../utils/supabase.js';

export const BASE_SESSION_ID = 'test-session-00000000-0000-0000-0000-000000000001';
export const BASE_LINE_ID = 'test-line-00000000-0000-0000-0000-000000000001';
export const BASE_ACCOUNT_ID = 'test-account-00000000-0000-0000-0000-000000000001';

export const MOCK_ENCRYPTED_MESSAGE = {
  ciphertext: Buffer.alloc(16),
  iv: Buffer.alloc(12),
  tag: Buffer.alloc(16),
  alg: 'aes-256-gcm' as const,
  kid: 'test-kid',
};

export const baseLine = {
  id: BASE_LINE_ID,
  account_id: BASE_ACCOUNT_ID,
  phone_number: '+15559876543',
  phone_verified: true,
  display_name: 'Test Line',
  timezone: 'America/New_York',
  preferred_grok_voice: 'Ara' as const,
  allow_voice_reminder_control: true,
  allow_voice_schedule_control: true,
  call_status: 'do_not_disturb' as const,
  next_scheduled_call_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export const baseAccount = {
  id: BASE_ACCOUNT_ID,
  user_type: 'self' as const,
  plan_id: 'care',
  sharing_enabled: false,
  sharing_enabled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

export const baseSession: CallSessionRow = {
  id: BASE_SESSION_ID,
  account_id: BASE_ACCOUNT_ID,
  line_id: BASE_LINE_ID,
  created_at: '2026-01-12T00:00:00.000Z',
  direction: 'outbound',
  status: 'in_progress',
  started_at: '2026-01-12T00:00:00.000Z',
  connected_at: '2026-01-12T00:00:05.000Z',
  ended_at: null,
  seconds_connected: null,
  twilio_call_sid: 'CA-test-sid',
  twilio_from: '+15551234567',
  twilio_to: '+15559876543',
  recording_sid: null,
  end_reason: null,
  answered_by: 'human',
  language_detected: null,
  tool_invocations: 0,
  cost_estimate_cents_twilio: null,
  cost_estimate_cents_model: null,
  is_reminder_call: false,
  reminder_id: null,
  scheduler_idempotency_key: null,
  is_test_call: false,
  is_preview_mode: false,
};
