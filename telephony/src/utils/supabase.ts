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
  user_type: 'self' | 'family_managed';
  sharing_enabled: boolean;
  sharing_enabled_at: string | null;
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
  short_id: string;
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
  consecutive_missed_calls: number;
  last_answered_call_at: string | null;
  missed_alert_sent_at: string | null;
  last_weekly_summary_at: string | null;
  birth_year: number | null;
  birth_decade: number | null;
  formative_decade: number | null;
  hometown: string | null;
  current_location: string | null;
  optimal_call_time: string | null;
  optimal_call_time_source: 'family_set' | 'ai_learned' | 'senior_request' | null;
  optimal_call_days: number[] | null;
  interruption_tolerance: 'high' | 'normal' | 'low' | null;
  filler_word_patience: 'high' | 'normal' | 'low' | null;
  silence_tolerance_ms: number | null;
  crosstalk_recovery_mode: 'immediate' | 'patient' | 'very_patient' | null;
  allow_voice_reminder_control: boolean;
  allow_voice_schedule_control: boolean;
  vacation_ranges: Array<{ start: string; end: string }>;
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
  scheduler_idempotency_key: string | null;
  is_test_call: boolean;
  is_preview_mode: boolean;
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
  last_result: 'success' | 'missed' | 'suppressed_quiet_hours' | 'skipped' | 'suppressed_vacation' | 'failed' | null;
  retry_count: number;
  is_one_time: boolean;
}

export interface MemoryRow {
  id: string;
  account_id: string;
  line_id: string;
  created_at: string;
  updated_at: string | null;
  type: 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing' | 'relationship' | 'temporal' | 'routine';
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
  last_accessed_at: string | null;
  access_count: number | null;
  pinned: boolean;
  pinned_reason: string | null;
  excluded_category: 'health_medical' | 'family_relationships' | 'finances' | 'location_address' | null;
  embedding_pending: boolean;
  expected_end_date: string | null;
  expiry_pending: boolean;
  created_in_call_session_id: string | null;
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

export interface CallInsightsRow {
  id: string;
  call_session_id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  insights_ciphertext: Uint8Array;
  insights_iv: Uint8Array;
  insights_tag: Uint8Array;
  insights_alg: string;
  insights_kid: string;
  extraction_method: 'tool_call' | 'post_call_fallback';
  duration_seconds: number | null;
  has_concerns: boolean;
  needs_follow_up: boolean;
  has_baseline: boolean;
}

export interface LineBaselineRow {
  line_id: string;
  updated_at: string;
  avg_engagement: number | null;
  avg_duration_seconds: number | null;
  calls_per_week: number | null;
  answer_rate: number | null;
  mood_distribution: Record<string, number>;
  recent_concern_codes: string[];
  baseline_call_count: number;
}

export interface InsightPrivacyRow {
  id: string;
  line_id: string;
  created_at: string;
  updated_at: string;
  insights_enabled: boolean;
  private_topic_codes: string[];
  is_paused: boolean;
  paused_at: string | null;
  paused_reason: string | null;
}

export interface AccessibilitySettingsRow {
  id: string;
  line_id: string;
  updated_at: string;
  hearing_mode: string;
  speech_rate: number;
  pause_between_sentences: boolean;
  repeat_key_info: boolean;
  cognitive_mode: string;
  simplified_language: boolean;
  shorter_responses: boolean;
  provide_call_recap: boolean;
  remind_of_previous_topics: boolean;
  context_window_calls: number;
  hearing_mode_source: string;
  cognitive_mode_source: string;
}

export interface ContentPreferencesRow {
  id: string;
  line_id: string;
  updated_at: string;
  trivia_preference: number;
  story_preference: number;
  memory_lane_preference: number;
  brain_games_preference: number;
  favorite_trivia_domains: string[];
  avoided_trivia_domains: string[];
  trivia_difficulty: string;
  favorite_story_genres: string[];
  avoided_story_themes: string[];
  preferred_story_length: string;
  favorite_eras: string[];
  favorite_memory_topics: string[];
  best_segment_time_of_call: string;
}

export interface DailyRhythmRow {
  id: string;
  line_id: string;
  updated_at: string;
  morning_energy: string | null;
  afternoon_energy: string | null;
  evening_energy: string | null;
  morning_routine_summary: string | null;
  afternoon_routine_summary: string | null;
  evening_routine_summary: string | null;
  best_engagement_time: string | null;
  worst_engagement_time: string | null;
  avg_duration_by_time: Record<string, number> | null;
  best_days_of_week: number[] | null;
  avoid_days_of_week: number[] | null;
}

export interface EmotionalPatternRow {
  id: string;
  line_id: string;
  updated_at: string;
  dominant_mood: string | null;
  mood_variability: string | null;
  best_time_of_day: string | null;
  worst_time_of_day: string | null;
  positive_triggers: string[] | null;
  negative_triggers: string[] | null;
  effective_techniques: string[] | null;
  ineffective_techniques: string[] | null;
}

export interface LifeChapterRow {
  id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  chapter_type: string;
  title: string;
  era_start_year: number | null;
  era_end_year: number | null;
  location: string | null;
  narrative_ciphertext: Uint8Array;
  narrative_iv: Uint8Array;
  narrative_tag: Uint8Array;
  narrative_alg: string;
  narrative_kid: string;
  key_people: string[] | null;
  emotional_tone: string | null;
  times_referenced: number;
  last_referenced_at: string | null;
  connects_to_chapter_ids: string[] | null;
  source: string;
}

export interface RelationshipRow {
  id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  name: string;
  nickname: string | null;
  relation_type: string;
  relation_role: string;
  contact_frequency: string | null;
  last_contact_mentioned: string | null;
  typical_contact_method: string | null;
  sentiment: string | null;
  emotional_significance: string | null;
  location: string | null;
  distance_category: string | null;
  shared_activities: string[] | null;
  conversation_topics: string[] | null;
  times_mentioned: number;
  last_mentioned_at: string | null;
  recent_topics: string[] | null;
  is_deceased: boolean;
  passed_at: string | null;
  death_mentioned_at: string | null;
  grief_sensitivity: string | null;
  privacy_scope: string;
}

export interface MilestoneRow {
  id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  milestone_type: string;
  title: string;
  description: string | null;
  date_month: number;
  date_day: number;
  date_year: number | null;
  is_recurring: boolean;
  related_relationship_id: string | null;
  related_person_name: string | null;
  notify_days_before: number;
  notify_on_day: boolean;
  last_celebrated_at: string | null;
  times_celebrated: number;
  source: string;
  privacy_scope: string;
}

export interface MoodSnapshotRow {
  id: string;
  call_session_id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  mood_start: string | null;
  mood_mid: string | null;
  mood_end: string | null;
  mood_start_at: string | null;
  mood_mid_at: string | null;
  mood_end_at: string | null;
  mood_trajectory: string | null;
  techniques_used: string[];
  technique_effectiveness: Record<string, unknown>;
  energy_level: string | null;
}

export interface PersonaAdaptationRow {
  id: string;
  line_id: string;
  updated_at: string;
  formality_level: string;
  humor_level: string;
  directness_level: string;
  vocabulary_complexity: string;
  regional_expressions: string[];
  preferred_phrases: string[];
  avoided_phrases: string[];
  prefers_short_exchanges: boolean;
  prefers_stories: boolean;
  asks_many_questions: boolean;
  typical_energy: string;
  morning_energy: string | null;
  afternoon_energy: string | null;
  evening_energy: string | null;
  calls_analyzed: number;
  confidence_score: number;
}

export interface CognitiveObservationRow {
  id: string;
  call_session_id: string;
  line_id: string;
  created_at: string;
  observation_type: string;
  severity: string | null;
  context: string | null;
  response_given: string | null;
  is_novel: boolean;
  similar_observation_count: number;
}

export interface CognitiveFlagRow {
  id: string;
  line_id: string;
  updated_at: string;
  concern_level: string;
  confusion_count_14d: number;
  repetition_count_14d: number;
  orientation_count_14d: number;
  consecutive_calls_with_concern: number;
  last_concern_at: string | null;
  flagged_at: string | null;
  family_notified_at: string | null;
}

export interface GriefInteractionRow {
  id: string;
  call_session_id: string;
  line_id: string;
  relationship_id: string | null;
  created_at: string;
  interaction_type: string;
  emotional_tone: string | null;
  support_techniques_used: string[] | null;
  days_since_passing: number | null;
}

export interface HealthMentionRow {
  id: string;
  call_session_id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  mention_ciphertext: Uint8Array;
  mention_iv: Uint8Array;
  mention_tag: Uint8Array;
  mention_alg: string;
  mention_kid: string;
  category: string;
  severity: string | null;
  triggers_alert: boolean;
  alert_sent_at: string | null;
}

export interface WellnessAlertRow {
  id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  alert_type: string;
  severity: string;
  title: string;
  summary: string;
  source_call_session_id: string | null;
  delivery_method: string;
  delivered_at: string | null;
  acknowledged_at: string | null;
  acknowledged_by_user_id: string | null;
}
