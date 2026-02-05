// Ultaura Types
// Shared TypeScript types for the Ultaura AI Voice Companion Service

import type {
  AccountStatus,
  CallInsights,
  ConcernCode,
  FollowUpReasonCode,
  GrokTool,
  MemoryType,
  PlanId,
  PrivacyScope,
  SafetyCategory,
  SafetyTier,
  SharingTier,
  TopicCode,
  VoiceConsentStatus,
} from '@ultaura/types';
import type { Database } from '~/database.types';
import type { RetentionInsights } from './types/retention';
import type { GrokVoice } from './constants';
export type {
  AccountStatus,
  CallInsights,
  ConcernCode,
  ConsentAuditAction,
  ConsentAuditEntry,
  DataExportRequest,
  FollowUpReasonCode,
  GrokTool,
  Memory,
  MemoryType,
  AccountPrivacySettings,
  PlanId,
  PrivacyScope,
  RetentionPeriod,
  SafetyActionTaken,
  SafetyCategory,
  SafetyTier,
  SharingTier,
  TopicCode,
  LineVoiceConsent,
  VoiceConsentStatus,
} from '@ultaura/types';
export * from './types/retention';

// ============================================
// ENUMS
// ============================================
export type LineStatus = 'active' | 'paused' | 'disabled';
export type CallStatus = 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled';
export type CallDirection = 'inbound' | 'outbound';
export type BillableType = 'trial' | 'included' | 'overage' | 'payg';
export type ScheduleResult =
  | 'success'
  | 'missed'
  | 'suppressed_quiet_hours'
  | 'skipped'
  | 'suppressed_vacation'
  | 'failed';
export type ScheduleExceptionType = 'skip' | 'snooze' | 'reschedule';
export type ScheduleEventType =
  | 'created'
  | 'edited'
  | 'enabled'
  | 'disabled'
  | 'exception_added'
  | 'exception_removed'
  | 'vacation_started'
  | 'vacation_ended';
export type ScheduleEventTrigger = 'dashboard' | 'voice' | 'system';
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
export type ConsentType =
  | 'outbound_calls'
  | 'trusted_contact_notify'
  | 'sms_to_payer'
  | 'data_retention'
  | 'audio_processing'
  | 'recording';
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
export type SupportedLanguageIso =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'pt'
  | 'ja'
  | 'ko'
  | 'zh'
  | 'nl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'tr'
  | 'pl'
  | 'sv'
  | 'da'
  | 'no'
  | 'fi'
  | 'cs'
  | 'th'
  | 'vi'
  | 'id'
  | 'ms'
  | 'tl'
  | 'uk'
  | 'el'
  | 'he'
  | 'ro'
  | 'hu';
export type VerificationChannel = 'sms' | 'call';
export type VerificationStatus = 'pending' | 'approved' | 'canceled' | 'expired';
export type UserType = 'self' | 'family_managed';

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
  userType: UserType;
  sharingEnabled: boolean;
  sharingEnabledAt: string | null;
}

export interface NotificationRecipient {
  id: string;
  accountId: string;
  name: string;
  email: string;
  phoneE164: string | null;
  relationship?: string | null;
  isTrustedContact: boolean;
  trustedContactId: string | null;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  lastAnsweredCallAt: string | null;
  consecutiveMissedCalls: number;
  missedAlertSentAt: string | null;
  lastWeeklySummaryAt: string | null;
  nextScheduledCallAt: string | null;
  seedInterests: string[] | null;
  seedAvoidTopics: string[] | null;
  allowVoiceReminderControl: boolean;
  allowVoiceScheduleControl: boolean;
  voicemailBehavior: VoicemailBehavior;
  preferredGrokVoice?: GrokVoice;
  preferredLanguageBcp47: string | null;
  preferredLanguageIso: string | null;
  vacationRanges?: Array<{ start: string; end: string }>;
  birthYear?: number | null;
  birthDecade?: number | null;
  formativeDecade?: number | null;
  hometown?: string | null;
  currentLocation?: string | null;
  optimalCallTime?: string | null;
  optimalCallTimeSource?: 'family_set' | 'ai_learned' | 'senior_request' | null;
  optimalCallDays?: number[] | null;
  interruptionTolerance?: 'high' | 'normal' | 'low' | null;
  fillerWordPatience?: 'high' | 'normal' | 'low' | null;
  silenceToleranceMs?: number | null;
  crosstalkRecoveryMode?: 'immediate' | 'patient' | 'very_patient' | null;
}

export interface CreateLineInput {
  accountId: string;
  displayName: string;
  phoneE164: string;
  timezone?: string;
  preferredGrokVoice?: GrokVoice;
  preferredLanguageIso?: SupportedLanguageIso | null;
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
  preferredGrokVoice?: GrokVoice;
  preferredLanguageIso?: SupportedLanguageIso | null;
  seedInterests?: string[];
  seedAvoidTopics?: string[];
  allowVoiceReminderControl?: boolean;
  voicemailBehavior?: VoicemailBehavior;
  birthYear?: number | null;
  formativeDecade?: number | null;
  hometown?: string | null;
  currentLocation?: string | null;
  optimalCallTime?: string | null;
  optimalCallTimeSource?: 'family_set' | 'ai_learned' | 'senior_request' | null;
  optimalCallDays?: number[] | null;
  interruptionTolerance?: 'high' | 'normal' | 'low';
  fillerWordPatience?: 'high' | 'normal' | 'low';
  silenceToleranceMs?: number;
  crosstalkRecoveryMode?: 'immediate' | 'patient' | 'very_patient';
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
  isTestCall: boolean;
  isReminderCall: boolean;
  reminderId: string | null;
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
  isOneTime: boolean;
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

export interface ScheduleException {
  id: string;
  accountId: string;
  scheduleId: string;
  lineId: string;
  createdAt: string;
  exceptionDate: string;
  exceptionType: ScheduleExceptionType;
  newDatetime: string | null;
  rescheduleScheduleId: string | null;
  createdBy: 'dashboard' | 'voice';
  callSessionId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ScheduleEvent {
  id: string;
  accountId: string;
  scheduleId: string;
  lineId: string;
  createdAt: string;
  eventType: ScheduleEventType;
  triggeredBy: ScheduleEventTrigger;
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
    ipAddress?: string;
    userAgent?: string;
    dashboardUserId?: string;
    contactName?: string;
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
  source: 'dtmf' | 'voice' | 'dashboard' | 'sms_keyword';
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
  category: SafetyCategory | null;
  tier: SafetyTier;
  confidence: number | null;
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

export interface TotalUsageSummary {
  totalMinutes: number;
  totalCostCents: number;
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
// INSIGHTS DASHBOARD TYPES
// ============================================

export type InsightMood = 'positive' | 'neutral' | 'low';

export interface WeeklySummaryData {
  lineId: string;
  lineName: string;
  accountId: string;
  billingEmail: string;
  weekStartDate: string;
  weekEndDate: string;
  timezone: string;
  sharingTier?: SharingTier | null;
  safetyEvents: Array<{
    severity: 'low' | 'medium' | 'high';
    timestamp: string;
    actionTaken: string | null;
  }>;
  usageSummary: {
    minutesUsed: number;
    minutesRemaining: number;
    overageMinutes: number;
    overageCost: number;
  };
  scheduledCalls: number;
  answeredCalls: number;
  missedCalls: number;
  showMissedCallsWarning: boolean;
  answerTrend: 'up' | 'down' | 'stable' | null;
  answerTrendValue: number | null;
  avgDurationMinutes: number | null;
  durationTrend: 'up' | 'down' | 'stable' | null;
  durationTrendValue: number | null;
  engagementNote: string | null;
  moodSummary: string | null;
  moodShiftNote: string | null;
  moodDistribution: {
    positive: number;
    neutral: number;
    low: number;
  } | null;
  socialNeedNote: string | null;
  topTopics: Array<{
    code: string;
    label: string;
    weight: number;
  }>;
  concerns: Array<{
    code: string;
    label: string;
    severity: 'mild' | 'moderate' | 'significant';
    novelty: 'new' | 'recurring' | 'resolved';
  }>;
  needsFollowUp: boolean;
  followUpReasons: string[];
  isPaused: boolean;
  pausedNote: string | null;
  dashboardUrl: string;
  settingsUrl: string;
}

export interface InsightsDashboard {
  lineId: string;
  lineShortId: string;
  lineName: string;
  timezone: string;
  status: LineStatus;
  userType: UserType;
  sharingConsent: VoiceConsentStatus;
  sharingTier: SharingTier;
  insightsEnabled: boolean;
  isPaused: boolean;
  pausedReason: string | null;
  retention?: RetentionInsights;
  summary: {
    scheduledCalls: number;
    answeredCalls: number;
    answeredDelta: number | null;
    avgDurationMinutes: number | null;
    durationDeltaMinutes: number | null;
    moodSummary: string | null;
    moodShiftNote: string | null;
    engagementNote: string | null;
    showMissedCallsWarning: boolean;
    missedCalls: number;
    inboundCalls: number;
    needsFollowUp: boolean;
    followUpReasons: string[];
    socialNeedNote: string | null;
  };
  moodTrend: Array<{
    callSessionId: string;
    occurredAt: string;
    mood: InsightMood;
  }>;
  topics: Array<{
    code: string;
    label: string;
    weight: number;
  }>;
  concerns: Array<{
    code: string;
    label: string;
    severity: 'mild' | 'moderate' | 'significant';
    novelty: 'new' | 'recurring' | 'resolved';
  }>;
  callActivity: Array<{
    date: string;
    scheduled: number;
    reminder: number;
    inbound: number;
  }>;
  callHistory: Array<
    CallSessionRow & {
      mood_overall?: InsightMood | null;
    }
  >;
}

export type MoodSnapshotMood = 'positive' | 'neutral' | 'low' | 'anxious' | 'sad' | 'frustrated';
export type MoodEnergyLevel = 'high' | 'normal' | 'low' | 'very_low';
export type MoodTrajectory = 'improved' | 'declined' | 'stable';

export interface EmotionalTrendEntry {
  callSessionId: string;
  occurredAt: string;
  moodStart?: MoodSnapshotMood | null;
  moodMid?: MoodSnapshotMood | null;
  moodEnd?: MoodSnapshotMood | null;
  energyLevel?: MoodEnergyLevel | null;
  trajectory?: MoodTrajectory | null;
}

export interface EmotionalTrendsData {
  entries: EmotionalTrendEntry[];
  distribution: Record<MoodSnapshotMood, number>;
  energyLevels: Record<MoodEnergyLevel, number>;
  trajectories: Record<MoodTrajectory, number>;
}

export interface MoodCalendarDay {
  date: string;
  mood: MoodSnapshotMood | null;
}

export interface MoodCalendarData {
  month: string;
  days: MoodCalendarDay[];
}

export interface ConversationHighlight {
  callSessionId: string;
  occurredAt: string;
  mood: InsightMood | null;
  topics: string[];
  newMemoryKeys: string[];
  milestones: string[];
}

export interface ConversationHighlightsData {
  highlights: ConversationHighlight[];
}

export interface MemoryActivityItem {
  memoryId: string;
  type: MemoryType;
  key: string;
  createdAt: string;
  isPrivate: boolean;
}

export interface MemoryActivityData {
  items: MemoryActivityItem[];
}

export interface RelationshipIndicator {
  name: string;
  relationType: string;
  relationRole: string;
  sentiment: 'positive' | 'neutral' | 'complicated';
  mentionCount30d: number;
  lastMentionedAt: string | null;
}

export interface RelationshipIndicatorsData {
  indicators: RelationshipIndicator[];
}

export interface WellnessAlert {
  id: string;
  lineId: string;
  lineName: string;
  createdAt: string;
  alertType: string;
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  summary: string;
  acknowledgedAt: string | null;
}

// ============================================
// DATABASE ROW TYPES (snake_case for direct DB mapping)
// ============================================

export type UltauraAccountRow = Database['public']['Tables']['ultaura_accounts']['Row'];
export type LineRow = Database['public']['Tables']['ultaura_lines']['Row'];
export type ScheduleRow = Database['public']['Tables']['ultaura_schedules']['Row'];
export type ScheduleExceptionRow = Database['public']['Tables']['ultaura_schedule_exceptions']['Row'];
export type ScheduleEventRow = Database['public']['Tables']['ultaura_schedule_events']['Row'];
export type CallSessionRow = Database['public']['Tables']['ultaura_call_sessions']['Row'];
export type ReminderRow = Database['public']['Tables']['ultaura_reminders']['Row'];
export type ReminderEventRow = Database['public']['Tables']['ultaura_reminder_events']['Row'] & {
  reminder_message?: string;
};
export type CallPreviewRow = Database['public']['Tables']['ultaura_call_previews']['Row'];
export type SegmentEngagementRow = Database['public']['Tables']['ultaura_segment_engagement']['Row'];
export type StoryArcRow = Database['public']['Tables']['ultaura_story_arcs']['Row'];
export type InsightPrivacyRow = Database['public']['Tables']['ultaura_insight_privacy']['Row'];
export type InsightPrivacySettings = Omit<InsightPrivacyRow, 'private_topic_codes'>;
export type LineBaselineRow = Database['public']['Tables']['ultaura_line_baselines']['Row'];
export type NotificationPreferencesRow =
  Database['public']['Tables']['ultaura_notification_preferences']['Row'];
export type AccessibilitySettingsRow =
  Database['public']['Tables']['ultaura_accessibility_settings']['Row'];
export type ContentPreferencesRow =
  Database['public']['Tables']['ultaura_content_preferences']['Row'];
export type DailyRhythmRow =
  Database['public']['Tables']['ultaura_daily_rhythms']['Row'];
export type EmotionalPatternRow =
  Database['public']['Tables']['ultaura_emotional_patterns']['Row'];
export type LifeChapterRow =
  Database['public']['Tables']['ultaura_life_chapters']['Row'];
export type RelationshipRow =
  Database['public']['Tables']['ultaura_relationships']['Row'];
export type MilestoneRow =
  Database['public']['Tables']['ultaura_milestones']['Row'];
export type MoodSnapshotRow =
  Database['public']['Tables']['ultaura_mood_snapshots']['Row'];
export type PersonaAdaptationRow =
  Database['public']['Tables']['ultaura_persona_adaptations']['Row'];
export type CognitiveObservationRow =
  Database['public']['Tables']['ultaura_cognitive_observations']['Row'];
export type CognitiveFlagRow =
  Database['public']['Tables']['ultaura_cognitive_flags']['Row'];
export type GriefInteractionRow =
  Database['public']['Tables']['ultaura_grief_interactions']['Row'];
export type HealthMentionRow =
  Database['public']['Tables']['ultaura_health_mentions']['Row'];
export type WellnessAlertRow =
  Database['public']['Tables']['ultaura_wellness_alerts']['Row'];
export type WeeklySummaryRow = Database['public']['Tables']['ultaura_weekly_summaries']['Row'];
export type AccountPrivacySettingsRow =
  Database['public']['Tables']['ultaura_account_privacy_settings']['Row'];
export type LineVoiceConsentRow = Database['public']['Tables']['ultaura_line_voice_consent']['Row'];
export type ConsentAuditRow = Database['public']['Tables']['ultaura_consent_audit_log']['Row'];
export type DataExportRequestRow = Database['public']['Tables']['ultaura_data_export_requests']['Row'];
export type PendingRecordingDeletionRow =
  Database['public']['Tables']['ultaura_pending_recording_deletions']['Row'];

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
