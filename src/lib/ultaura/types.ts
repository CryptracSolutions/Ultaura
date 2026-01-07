// Ultaura Types
// Shared TypeScript types for the Ultaura AI Voice Companion Service

import type {
  AccountStatus,
  GrokTool,
  MemoryType,
  PlanId,
  PrivacyScope,
  SafetyTier,
} from '@ultaura/types';
import type { Database } from '~/database.types';
export type {
  AccountStatus,
  GrokTool,
  Memory,
  MemoryType,
  PlanId,
  PrivacyScope,
  SafetyActionTaken,
  SafetyTier,
} from '@ultaura/types';

// ============================================
// ENUMS
// ============================================
export type LineStatus = 'active' | 'paused' | 'disabled';
export type CallStatus = 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled';
export type CallDirection = 'inbound' | 'outbound';
export type BillableType = 'trial' | 'included' | 'overage' | 'payg';
export type ScheduleResult = 'success' | 'missed' | 'suppressed_quiet_hours' | 'failed';
export type ReminderStatus = 'scheduled' | 'sent' | 'missed' | 'canceled';
export type ReminderDeliveryStatus = 'completed' | 'no_answer' | 'failed';
export type ReminderDeliveryMethod = 'outbound_call';
export type ReminderEventType =
  | 'created'
  | 'edited'
  | 'paused'
  | 'resumed'
  | 'snoozed'
  | 'skipped'
  | 'canceled'
  | 'delivered'
  | 'no_answer'
  | 'failed';
export type ReminderEventTrigger = 'dashboard' | 'voice' | 'system';
export type ConsentType = 'outbound_calls' | 'trusted_contact_notify' | 'sms_to_payer' | 'data_retention';
export type OptOutChannel = 'outbound_calls' | 'sms' | 'all';
export type CallEndReason = 'hangup' | 'no_answer' | 'busy' | 'trial_cap' | 'minutes_cap' | 'error';
export type CallAnsweredBy =
  | 'human'
  | 'machine_start'
  | 'machine_end_beep'
  | 'machine_end_silence'
  | 'machine_end_other'
  | 'fax'
  | 'unknown';
export type VoicemailBehavior = 'none' | 'brief' | 'detailed';
export type VerificationChannel = 'sms' | 'call';
export type VerificationStatus = 'pending' | 'approved' | 'canceled' | 'expired';

// ============================================
// PLANS
// ============================================

export interface Plan {
  id: string;
  displayName: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  minutesIncluded: number;
  linesIncluded: number;
  overageRateCentsPerMin: number;
}

// ============================================
// ACCOUNTS
// ============================================

export interface UltauraAccount {
  id: string;
  organizationId: number;
  createdAt: string;
  name: string;
  billingEmail: string;
  defaultLocale: string;
  status: AccountStatus;
  planId: PlanId;
  trialPlanId: PlanId | null;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  minutesIncluded: number;
  minutesUsed: number;
  cycleStart: string | null;
  cycleEnd: string | null;
  overageCentsCap: number;
  createdByUserId: string;
}

// ============================================
// LINES
// ============================================

export interface Line {
  id: string;
  shortId: string;
  accountId: string;
  createdAt: string;
  displayName: string;
  phoneE164: string;
  phoneVerifiedAt: string | null;
  status: LineStatus;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  doNotCall: boolean;
  inboundAllowed: boolean;
  lastSuccessfulCallAt: string | null;
  nextScheduledCallAt: string | null;
  seedInterests: string[] | null;
  seedAvoidTopics: string[] | null;
  allowVoiceReminderControl: boolean;
  voicemailBehavior: VoicemailBehavior;
}

export interface CreateLineInput {
  accountId: string;
  displayName: string;
  phoneE164: string;
  timezone?: string;
  seedInterests?: string[];
  seedAvoidTopics?: string[];
}

export interface UpdateLineInput {
  displayName?: string;
  timezone?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  doNotCall?: boolean;
  inboundAllowed?: boolean;
  seedInterests?: string[];
  seedAvoidTopics?: string[];
  allowVoiceReminderControl?: boolean;
  voicemailBehavior?: VoicemailBehavior;
}

// ============================================
// SUBSCRIPTIONS
// ============================================

export interface Subscription {
  id: string;
  accountId: string;
  createdAt: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planId: PlanId;
  billingInterval: 'month' | 'year';
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// ============================================
// MINUTE LEDGER
// ============================================

export interface MinuteLedgerEntry {
  id: string;
  accountId: string;
  lineId: string;
  callSessionId: string;
  createdAt: string;
  cycleStart: string | null;
  cycleEnd: string | null;
  secondsConnected: number;
  billableMinutes: number;
  direction: CallDirection;
  billableType: BillableType;
  stripeUsageReported: boolean;
  stripeUsageRecordId: string | null;
  idempotencyKey: string;
}

// ============================================
// CALL SESSIONS
// ============================================

export interface CallSession {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  direction: CallDirection;
  status: CallStatus;
  startedAt: string | null;
  connectedAt: string | null;
  endedAt: string | null;
  secondsConnected: number | null;
  twilioCallSid: string | null;
  twilioFrom: string | null;
  twilioTo: string | null;
  recordingSid: string | null;
  endReason: CallEndReason | null;
  answeredBy: CallAnsweredBy | null;
  languageDetected: string | null;
  toolInvocations: number;
  costEstimateCentsTwilio: number | null;
  costEstimateCentsModel: number | null;
  isReminderCall: boolean;
  reminderId: string | null;
  reminderMessage: string | null;
}

export interface CallEvent {
  id: string;
  callSessionId: string;
  createdAt: string;
  type: 'dtmf' | 'tool_call' | 'state_change' | 'error' | 'safety_tier';
  payload: Record<string, unknown> | null;
}

// ============================================
// SCHEDULES
// ============================================

export interface Schedule {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  enabled: boolean;
  timezone: string;
  daysOfWeek: number[];
  timeOfDay: string;
  nextRunAt: string | null;
  retryPolicy: {
    maxRetries: number;
    retryWindowMinutes: number;
  };
  lastRunAt: string | null;
  lastResult: ScheduleResult | null;
}

export interface CreateScheduleInput {
  lineId: string;
  timezone: string;
  daysOfWeek: number[];
  timeOfDay: string;
  retryPolicy?: {
    maxRetries: number;
    retryWindowMinutes: number;
  };
}

export interface UpdateScheduleInput {
  enabled?: boolean;
  timezone?: string;
  daysOfWeek?: number[];
  timeOfDay?: string;
  retryPolicy?: {
    maxRetries: number;
    retryWindowMinutes: number;
  };
}

// ============================================
// REMINDERS
// ============================================

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  interval?: number; // Every N days/weeks/months
  daysOfWeek?: number[]; // [0-6] for weekly
  dayOfMonth?: number; // 1-31 for monthly
  endsAt?: string; // ISO date
}

export interface Reminder {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  dueAt: string;
  timezone: string;
  message: string;
  deliveryMethod: ReminderDeliveryMethod;
  status: ReminderStatus;
  privacyScope: PrivacyScope;
  createdByCallSessionId: string | null;
  // Recurrence fields
  isRecurring: boolean;
  rrule: string | null;
  intervalDays: number | null;
  daysOfWeek: number[] | null;
  dayOfMonth: number | null;
  timeOfDay: string | null;
  endsAt: string | null;
  occurrenceCount: number;
  // Pause/snooze fields
  isPaused: boolean;
  pausedAt: string | null;
  snoozedUntil: string | null;
  originalDueAt: string | null;
  currentSnoozeCount: number;
  lastDeliveryStatus: ReminderDeliveryStatus | null;
}

export interface ReminderEvent {
  id: string;
  accountId: string;
  reminderId: string;
  lineId: string;
  createdAt: string;
  eventType: ReminderEventType;
  triggeredBy: ReminderEventTrigger;
  callSessionId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface EncryptedMemory {
  id: string;
  accountId: string;
  lineId: string;
  type: MemoryType;
  key: string;
  valueCiphertext: Buffer;
  valueIv: Buffer;
  valueTag: Buffer;
  valueAlg: string;
  valueKid: string;
  confidence: number | null;
  source: 'onboarding' | 'conversation' | 'caregiver_seed' | null;
  version: number;
  active: boolean;
  privacyScope: PrivacyScope;
  redactionLevel: 'none' | 'low' | 'high';
}

// ============================================
// CONSENTS
// ============================================

export interface Consent {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  type: ConsentType;
  granted: boolean;
  grantedBy: 'payer_ack' | 'line_voice';
  evidence: {
    ip?: string;
    userAgent?: string;
    callSessionId?: string;
    timestamp?: string;
  } | null;
  revokedAt: string | null;
}

// ============================================
// OPT-OUTS
// ============================================

export interface OptOut {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  channel: OptOutChannel;
  reason: string | null;
  source: 'dtmf' | 'voice' | 'dashboard';
  callSessionId: string | null;
}

// ============================================
// TRUSTED CONTACTS
// ============================================

export interface TrustedContact {
  id: string;
  accountId: string;
  lineId: string;
  createdAt: string;
  name: string;
  relationship: string | null;
  phoneE164: string;
  notifyOn: SafetyTier[];
  enabled: boolean;
}

// ============================================
// SAFETY EVENTS
// ============================================

export interface SafetyEvent {
  id: string;
  accountId: string;
  lineId: string;
  callSessionId: string | null;
  createdAt: string;
  tier: SafetyTier;
  signals: Record<string, unknown> | null;
  actionTaken: 'none' | 'suggested_988' | 'suggested_911' | 'notified_contact' | 'transferred_call' | null;
}

// ============================================
// PHONE VERIFICATION
// ============================================

export interface PhoneVerification {
  id: string;
  lineId: string;
  createdAt: string;
  expiresAt: string;
  channel: VerificationChannel;
  status: VerificationStatus;
  twilioVerificationSid: string | null;
}

// ============================================
// USAGE & BILLING
// ============================================

export interface UsageSummary {
  minutesIncluded: number;
  minutesUsed: number;
  minutesRemaining: number;
  overageMinutes: number;
  cycleStart: string | null;
  cycleEnd: string | null;
}

export interface LineActivity {
  lineId: string;
  lineShortId: string;
  displayName: string;
  lastCallAt: string | null;
  lastCallDuration: number | null;
  nextScheduledAt: string | null;
}

// ============================================
// API RESPONSES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// TELEPHONY TYPES
// ============================================

export interface TwilioWebhookPayload {
  CallSid: string;
  AccountSid: string;
  From: string;
  To: string;
  CallStatus: string;
  Direction: string;
  ApiVersion: string;
  Digits?: string;
}

export interface TwilioMediaStreamMessage {
  event: 'connected' | 'start' | 'media' | 'dtmf' | 'stop';
  streamSid?: string;
  start?: {
    streamSid: string;
    callSid: string;
    accountSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  dtmf?: {
    track: string;
    digit: string;
  };
}

export interface GrokSessionConfig {
  voice: 'Ara' | 'Rex' | 'Sal' | 'Eve' | 'Leo';
  instructions: string;
  audio: {
    input: { format: { type: string } };
    output: { format: { type: string } };
  };
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  };
  tools: GrokTool[];
}

export interface GrokMessage {
  type: string;
  session?: Partial<GrokSessionConfig>;
  audio?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  delta?: string;
  item?: {
    type: string;
    call_id: string;
    output: string;
  };
}

// ============================================
// DATABASE ROW TYPES (snake_case for direct DB mapping)
// ============================================

export type UltauraAccountRow = Database['public']['Tables']['ultaura_accounts']['Row'];
export type LineRow = Database['public']['Tables']['ultaura_lines']['Row'];
export type ScheduleRow = Database['public']['Tables']['ultaura_schedules']['Row'];
export type CallSessionRow = Database['public']['Tables']['ultaura_call_sessions']['Row'];
export type ReminderRow = Database['public']['Tables']['ultaura_reminders']['Row'];
export type ReminderEventRow = Database['public']['Tables']['ultaura_reminder_events']['Row'] & {
  reminder_message?: string;
};

export interface EditReminderInput {
  message?: string;
  dueAt?: string;
  recurrence?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'custom' | 'once';
    interval?: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    endsAt?: string | null;
  };
}
