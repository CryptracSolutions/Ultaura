import { z } from 'zod';

const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const APPROX_DATE_REGEX = /^\d{4}(-\d{2}){0,2}$/;

// ---------------------------------------------------------------------------
// Shared sub-schemas (inline — avoid cross-package import at schema layer)
// ---------------------------------------------------------------------------

const approximateDateSchema = z.object({
  precision: z.enum(['year', 'month', 'day']),
  value: z.string().regex(APPROX_DATE_REGEX, 'Must be YYYY, YYYY-MM, or YYYY-MM-DD'),
});

const timesOfDaySchema = z
  .array(z.string().regex(TIME_OF_DAY_REGEX, 'Must be HH:MM in 24-hour format'))
  .max(8);

const conditionSuggestionProposedFieldsSchema = z.object({
  standardizedId: z.object({ system: z.string(), code: z.string() }).nullable(),
  status: z.enum(['active', 'monitoring', 'resolved']).optional(),
  diagnosedOnsetDate: approximateDateSchema.nullable().optional(),
});

const medicationSuggestionProposedFieldsSchema = z.object({
  standardizedId: z.object({ system: z.string(), code: z.string() }).nullable(),
  status: z.enum(['current', 'as_needed', 'discontinued']).optional(),
  dosage: z.string().nullable().optional(),
  frequency: z.string().nullable().optional(),
  timesOfDay: timesOfDaySchema.optional(),
  startDate: approximateDateSchema.nullable().optional(),
  endDate: approximateDateSchema.nullable().optional(),
});

// ---------------------------------------------------------------------------
// queueHealthSuggestionCandidateInputSchema
// ---------------------------------------------------------------------------

export const queueHealthSuggestionCandidateInputSchema = z.object({
  lineId: z.string().uuid(),
  callSessionId: z.string().uuid(),
  suggestionType: z.enum(['condition', 'medication']),
  suggestionMode: z.enum(['new', 'update']),
  normalizedName: z.string().min(1).max(120),
  confidenceLabel: z.enum(['high', 'medium']),
  summaryParaphrase: z.string().min(1).max(240),
  proposedFields: z.union([
    conditionSuggestionProposedFieldsSchema,
    medicationSuggestionProposedFieldsSchema,
  ]),
});

export type QueueHealthSuggestionCandidateInputPayload = z.infer<
  typeof queueHealthSuggestionCandidateInputSchema
>;

// ---------------------------------------------------------------------------
// healthSpokenConsentToolInputSchema
// ---------------------------------------------------------------------------

export const healthSpokenConsentToolInputSchema = z.object({
  lineId: z.string().uuid(),
  callSessionId: z.string().uuid(),
});

export type HealthSpokenConsentToolInputPayload = z.infer<
  typeof healthSpokenConsentToolInputSchema
>;

// ---------------------------------------------------------------------------
// markHealthDisclosurePrivateInputSchema
// ---------------------------------------------------------------------------

export const markHealthDisclosurePrivateInputSchema = z.object({
  lineId: z.string().uuid(),
  callSessionId: z.string().uuid(),
});

export type MarkHealthDisclosurePrivateInputPayload = z.infer<
  typeof markHealthDisclosurePrivateInputSchema
>;

// ---------------------------------------------------------------------------
// telephonyHealthContextSchema
// Validates the shape returned by GET /api/telephony/health/context
// ---------------------------------------------------------------------------

export const telephonyHealthContextSchema = z.object({
  schemaVersion: z.literal('health-context-v1'),
  lineId: z.string().uuid(),
  consentStatus: z.enum(['not_requested', 'granted', 'denied', 'revoked']),
  canUseHealthInCall: z.boolean(),
  familyManagedConsentPrompt: z
    .object({
      hasOutstandingOwnerRequest: z.boolean(),
      requestedAt: z.string().nullable(),
      lastPromptedAt: z.string().nullable(),
    })
    .nullable(),
  selfManagedExplanationPrompt: z
    .object({
      hasOutstandingOwnerRequest: z.boolean(),
      requestedAt: z.string().nullable(),
      lastPromptedAt: z.string().nullable(),
    })
    .nullable(),
  conditions: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['active', 'monitoring']),
    })
  ),
  medications: z.array(
    z.object({
      name: z.string(),
      status: z.enum(['current', 'as_needed']),
      timesOfDay: timesOfDaySchema,
    })
  ),
  observations: z.array(
    z.object({
      ownerSafeSummary: z.string(),
      category: z
        .enum([
          'memory',
          'mood_emotional',
          'physical_mobility',
          'nutrition_eating',
          'sleep',
          'social_engagement',
          'medication_compliance',
          'general_other',
        ])
        .nullable(),
      concernLevel: z.enum(['note', 'mild_concern', 'significant_concern']).nullable(),
      observedDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
        .nullable(),
    })
  ),
  pendingNotices: z.array(
    z.union([
      z.object({
        id: z.string().uuid(),
        noticeType: z.literal('consent_change'),
        spokenText: z.string(),
        spokenLanguage: z.string().nullable(),
        consentStatus: z.enum(['granted', 'denied', 'revoked']),
      }),
      z.object({
        id: z.string().uuid(),
        noticeType: z.literal('major_profile_change'),
        spokenText: z.string(),
        spokenLanguage: z.string().nullable(),
        changeTypes: z.array(
          z.enum([
            'condition_added',
            'condition_status_changed',
            'medication_added',
            'medication_status_changed',
            'medication_schedule_changed',
          ])
        ),
      }),
    ])
  ),
});

export type TelephonyHealthContextPayload = z.infer<typeof telephonyHealthContextSchema>;
