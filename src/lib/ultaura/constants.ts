// Ultaura Constants
// Plans, pricing, limits, and configuration

import type { Plan, PlanId } from './types';

// ============================================
// PLANS
// ============================================

export const PLANS: Record<PlanId, Plan> = {
  free_trial: {
    id: 'free_trial',
    displayName: 'Free Trial',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    minutesIncluded: 20,
    linesIncluded: 1,
    overageRateCentsPerMin: 0, // No overage on trial - hard stop
  },
  care: {
    id: 'care',
    displayName: 'Care',
    monthlyPriceCents: 3900, // $39
    annualPriceCents: 39900, // $399
    minutesIncluded: 300,
    linesIncluded: 1,
    overageRateCentsPerMin: 15, // $0.15
  },
  comfort: {
    id: 'comfort',
    displayName: 'Comfort',
    monthlyPriceCents: 9900, // $99
    annualPriceCents: 99900, // $999
    minutesIncluded: 900,
    linesIncluded: 2,
    overageRateCentsPerMin: 15,
  },
  family: {
    id: 'family',
    displayName: 'Family',
    monthlyPriceCents: 19900, // $199
    annualPriceCents: 199900, // $1,999
    minutesIncluded: 2000,
    linesIncluded: 4,
    overageRateCentsPerMin: 15,
  },
  payg: {
    id: 'payg',
    displayName: 'Pay As You Go',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    minutesIncluded: 0,
    linesIncluded: 4,
    overageRateCentsPerMin: 15,
  },
};

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

// ============================================
// STRIPE PRICE IDS (set via environment)
// ============================================

export const STRIPE_PRICES = {
  care_monthly: process.env.STRIPE_PRICE_CARE_MONTHLY || '',
  care_annual: process.env.STRIPE_PRICE_CARE_ANNUAL || '',
  comfort_monthly: process.env.STRIPE_PRICE_COMFORT_MONTHLY || '',
  comfort_annual: process.env.STRIPE_PRICE_COMFORT_ANNUAL || '',
  family_monthly: process.env.STRIPE_PRICE_FAMILY_MONTHLY || '',
  family_annual: process.env.STRIPE_PRICE_FAMILY_ANNUAL || '',
  payg_metered: process.env.STRIPE_PRICE_PAYG_METERED || '',
} as const;

// Map Stripe price IDs to plan IDs
export function getPlanIdFromStripePrice(priceId: string): PlanId | null {
  if (priceId === STRIPE_PRICES.care_monthly || priceId === STRIPE_PRICES.care_annual) {
    return 'care';
  }
  if (priceId === STRIPE_PRICES.comfort_monthly || priceId === STRIPE_PRICES.comfort_annual) {
    return 'comfort';
  }
  if (priceId === STRIPE_PRICES.family_monthly || priceId === STRIPE_PRICES.family_annual) {
    return 'family';
  }
  if (priceId === STRIPE_PRICES.payg_metered) {
    return 'payg';
  }
  return null;
}

// ============================================
// BILLING
// ============================================

export const BILLING = {
  OVERAGE_RATE_CENTS: 15, // $0.15 per minute
  DEFAULT_OVERAGE_CAP_CENTS: 10000, // $100 default cap
  TRIAL_MINUTES: 20,
  TRIAL_DURATION_DAYS: 30,
  LOW_MINUTES_WARNING_THRESHOLD: 15, // Warn when <= 15 minutes remaining
  CRITICAL_MINUTES_THRESHOLD: 5, // Critical warning at <= 5 minutes
  ANNUAL_DISCOUNT: 0.15,
} as const;

// ============================================
// TELEPHONY
// ============================================

export const TELEPHONY = {
  // Twilio phone number format
  PHONE_REGEX: /^\+1[2-9]\d{9}$/, // US E.164 format

  // Default quiet hours
  DEFAULT_QUIET_HOURS_START: '21:00',
  DEFAULT_QUIET_HOURS_END: '09:00',

  // Default timezone
  DEFAULT_TIMEZONE: 'America/Los_Angeles',

  // Call limits
  MAX_CALL_DURATION_SECONDS: 3600, // 1 hour max
  MIN_BILLABLE_CALL_SECONDS: 30, // Minimum for "successful" call

  // Retry policy
  DEFAULT_RETRY_MAX: 2,
  DEFAULT_RETRY_WINDOW_MINUTES: 30,
  RETRY_DELAY_MINUTES: 15,

  // DTMF mappings
  DTMF_REPEAT: '1',
  DTMF_SLOWER: '2',
  DTMF_CHANGE_TOPIC: '3',
  DTMF_OPT_OUT: '9',
  DTMF_HELP: '0',

  // Audio formats (for Grok/Twilio bridge)
  AUDIO_FORMAT_TWILIO: 'audio/x-mulaw',
  AUDIO_FORMAT_GROK: 'audio/pcmu',
  AUDIO_SAMPLE_RATE: 8000,
} as const;

// ============================================
// GROK VOICE AGENT
// ============================================

export const GROK = {
  // WebSocket endpoint
  REALTIME_URL: 'wss://api.x.ai/v1/realtime',

  // Available voices
  VOICES: ['Ara', 'Rex', 'Sal', 'Eve', 'Leo'] as const,
  DEFAULT_VOICE: 'Ara' as const,

  // Turn detection settings
  TURN_DETECTION: {
    type: 'server_vad',
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500,
  },

  // Tools available
  TOOLS: {
    WEB_SEARCH: 'web_search',
    SET_REMINDER: 'set_reminder',
    SCHEDULE_CALL: 'schedule_call',
  },
} as const;

export type GrokVoice = typeof GROK.VOICES[number];

// ============================================
// LANGUAGES
// ============================================

export const LANGUAGES = {
  AUTO: 'auto',
  ENGLISH: 'en',
  SPANISH: 'es',
} as const;

export const LANGUAGE_LABELS: Record<string, string> = {
  auto: 'Auto-detect',
  en: 'English',
  es: 'Spanish',
};

export const SPANISH_FORMALITY_LABELS: Record<string, string> = {
  usted: 'Formal (usted)',
  tu: 'Informal (tú)',
};

// ============================================
// TIMEZONES (US-focused)
// ============================================

export const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Phoenix', label: 'Arizona (no DST)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AKT)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HST)' },
] as const;

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;

export const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minutes = index % 2 === 0 ? '00' : '30';
  const value = `${hour.toString().padStart(2, '0')}:${minutes}`;

  const label = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minutes === '30' ? 30 : 0)));

  return { value, label };
});

// ============================================
// SAFETY
// ============================================

export const SAFETY = {
  // Keywords that may indicate distress (simplified for MVP)
  DISTRESS_KEYWORDS: [
    'suicide',
    'kill myself',
    'end it all',
    'want to die',
    'hurt myself',
    'self-harm',
    'hopeless',
    'give up',
    'not worth living',
  ],

  // Crisis resources
  CRISIS_HOTLINE: '988',
  EMERGENCY_NUMBER: '911',

  // Escalation tiers
  TIERS: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
  } as const,
} as const;

// ============================================
// UI CONSTANTS
// ============================================

export const UI = {
  // Days of week for schedule picker
  DAYS_OF_WEEK: [
    { value: 0, label: 'Sun', fullLabel: 'Sunday' },
    { value: 1, label: 'Mon', fullLabel: 'Monday' },
    { value: 2, label: 'Tue', fullLabel: 'Tuesday' },
    { value: 3, label: 'Wed', fullLabel: 'Wednesday' },
    { value: 4, label: 'Thu', fullLabel: 'Thursday' },
    { value: 5, label: 'Fri', fullLabel: 'Friday' },
    { value: 6, label: 'Sat', fullLabel: 'Saturday' },
  ],

  // Time options for schedule picker (every 30 minutes)
  TIME_OPTIONS: Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    const period = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return {
      value: `${hour.toString().padStart(2, '0')}:${minute}`,
      label: `${displayHour}:${minute} ${period}`,
    };
  }),

  // Status badge colors
  STATUS_COLORS: {
    active: 'success',
    paused: 'warning',
    disabled: 'destructive',
    pending: 'warning',
    verified: 'success',
    completed: 'success',
    failed: 'destructive',
    scheduled: 'info',
    in_progress: 'primary',
  } as const,
} as const;

// ============================================
// FEATURE FLAGS
// ============================================

export const FEATURES = {
  // Enable/disable features for MVP
  TRANSCRIPTS_ENABLED: false,
  SENTIMENT_DASHBOARD_ENABLED: false,
  INTERNATIONAL_CALLING_ENABLED: false,
  SMS_NOTIFICATIONS_ENABLED: false,
  HIPAA_INTEGRATIONS_ENABLED: false,
} as const;

// ============================================
// API ENDPOINTS
// ============================================

export const API = {
  TELEPHONY_BACKEND_URL: process.env.TELEPHONY_BACKEND_URL || 'http://localhost:3001',

  // Telephony backend routes
  ROUTES: {
    TWILIO_INBOUND: '/twilio/voice/inbound',
    TWILIO_OUTBOUND: '/twilio/voice/outbound',
    TWILIO_STATUS: '/twilio/status',
    TWILIO_MEDIA: '/twilio/media',
    CALLS_OUTBOUND: '/calls/outbound',
    TOOLS_SCHEDULE_CALL: '/tools/schedule_call',
    TOOLS_SET_REMINDER: '/tools/set_reminder',
    TOOLS_MESSAGE_FAMILY: '/tools/message_family',
  },
} as const;

// ============================================
// VALIDATION
// ============================================

export const VALIDATION = {
  // Phone number
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 15,

  // Display name
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,

  // Reminder message
  REMINDER_MESSAGE_MAX_LENGTH: 500,

  // Verification code
  VERIFICATION_CODE_LENGTH: 6,
  VERIFICATION_EXPIRY_MINUTES: 10,
} as const;
