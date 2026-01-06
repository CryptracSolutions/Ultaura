// Supabase client for telephony backend
// Uses service role key for full access

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  }

  supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

// Type definitions for Ultaura tables
export interface UltauraAccountRow {
  id: string;
  organization_id: number;
  created_at: string;
  name: string;
  billing_email: string;
  default_locale: string;
  status: 'trial' | 'active' | 'past_due' | 'canceled';
  plan_id: string;
  trial_plan_id: string | null;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  minutes_included: number;
  minutes_used: number;
  cycle_start: string | null;
  cycle_end: string | null;
  overage_cents_cap: number;
  created_by_user_id: string;
}

export interface LineRow {
  id: string;
  account_id: string;
  created_at: string;
  display_name: string;
  phone_e164: string;
  phone_verified_at: string | null;
  status: 'active' | 'paused' | 'disabled';
  timezone: string;
  quiet_hours_start: string;
  quiet_hours_end: string;
  do_not_call: boolean;
  inbound_allowed: boolean;
  last_successful_call_at: string | null;
  next_scheduled_call_at: string | null;
  seed_interests: string[] | null;
  seed_avoid_topics: string[] | null;
  voicemail_behavior: 'none' | 'brief' | 'detailed';
}

export interface CallSessionRow {
  id: string;
  account_id: string;
  line_id: string;
  created_at: string;
  direction: 'inbound' | 'outbound';
  status: 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled';
  started_at: string | null;
  connected_at: string | null;
  ended_at: string | null;
  seconds_connected: number | null;
  twilio_call_sid: string | null;
  twilio_from: string | null;
  twilio_to: string | null;
  recording_sid: string | null;
  end_reason: 'hangup' | 'no_answer' | 'busy' | 'trial_cap' | 'minutes_cap' | 'error' | null;
  answered_by: 'human' | 'machine_start' | 'machine_end_beep' | 'machine_end_silence' | 'machine_end_other' | 'fax' | 'unknown' | null;
  language_detected: string | null;
  tool_invocations: number;
  cost_estimate_cents_twilio: number | null;
  cost_estimate_cents_model: number | null;
  // Reminder call fields
  is_reminder_call: boolean;
  reminder_id: string | null;
  reminder_message: string | null;
}

export interface ScheduleRow {
  id: string;
  account_id: string;
  line_id: string;
  created_at: string;
  enabled: boolean;
  timezone: string;
  days_of_week: number[];
  time_of_day: string;
  next_run_at: string | null;
  retry_policy: { max_retries: number; retry_window_minutes: number };
  last_run_at: string | null;
  last_result: 'success' | 'missed' | 'suppressed_quiet_hours' | 'failed' | null;
  retry_count: number;
}

export interface MemoryRow {
  id: string;
  account_id: string;
  line_id: string;
  created_at: string;
  updated_at: string | null;
  type: 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing';
  key: string;
  value_ciphertext: Uint8Array;
  value_iv: Uint8Array;
  value_tag: Uint8Array;
  value_alg: string;
  value_kid: string;
  confidence: number | null;
  source: 'onboarding' | 'conversation' | 'caregiver_seed' | null;
  version: number;
  active: boolean;
  privacy_scope: 'line_only' | 'shareable_with_payer';
  redaction_level: 'none' | 'low' | 'high';
}

export interface MinuteLedgerRow {
  id: string;
  account_id: string;
  line_id: string;
  call_session_id: string;
  created_at: string;
  cycle_start: string | null;
  cycle_end: string | null;
  seconds_connected: number;
  billable_minutes: number;
  direction: 'inbound' | 'outbound';
  billable_type: 'trial' | 'included' | 'overage' | 'payg';
  stripe_usage_reported: boolean;
  stripe_usage_record_id: string | null;
  idempotency_key: string;
}

export interface ReminderRow {
  id: string;
  account_id: string;
  line_id: string;
  created_at: string;
  due_at: string;
  timezone: string;
  message: string;
  delivery_method: string;
  status: 'scheduled' | 'sent' | 'missed' | 'canceled';
  privacy_scope: 'line_only' | 'shareable_with_payer';
  created_by_call_session_id: string | null;
  // Recurrence fields
  is_recurring: boolean;
  rrule: string | null;
  interval_days: number | null;
  days_of_week: number[] | null;
  day_of_month: number | null;
  time_of_day: string | null;
  ends_at: string | null;
  occurrence_count: number;
}

export interface AccountCryptoKeyRow {
  id: string;
  account_id: string;
  created_at: string;
  dek_wrapped: Uint8Array;
  dek_wrap_iv: Uint8Array;
  dek_wrap_tag: Uint8Array;
  dek_kid: string;
  dek_alg: string;
  rotated_at: string | null;
}
