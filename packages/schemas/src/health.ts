import { z } from 'zod';

// ---------------------------------------------------------------------------
// ApproximateDate schema
// Validates: YYYY | YYYY-MM | YYYY-MM-DD; rejects calendar-invalid values;
// rejects values inconsistent with declared precision.
// ---------------------------------------------------------------------------

const APPROX_DATE_REGEX = /^\d{4}(-\d{2}){0,2}$/;
const TIME_OF_DAY_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export const approximateDateSchema = z
  .object({
    precision: z.enum(['year', 'month', 'day']),
    value: z.string().regex(APPROX_DATE_REGEX, 'Must be YYYY, YYYY-MM, or YYYY-MM-DD'),
  })
  .superRefine((val, ctx) => {
    const parts = val.value.split('-');

    // Precision must match value format
    if (val.precision === 'year' && parts.length !== 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "precision 'year' requires YYYY format" });
      return;
    }
    if (val.precision === 'month' && parts.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "precision 'month' requires YYYY-MM format" });
      return;
    }
    if (val.precision === 'day' && parts.length !== 3) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "precision 'day' requires YYYY-MM-DD format" });
      return;
    }

    // Calendar validity checks
    if (parts.length >= 2) {
      const month = parseInt(parts[1], 10);
      if (month < 1 || month > 12) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Month must be 01-12' });
        return;
      }
    }
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const maxDay = new Date(year, month, 0).getDate(); // last day of the month
      if (day < 1 || day > maxDay) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Day ${day} is invalid for ${parts[0]}-${parts[1]}` });
      }
    }
  });

export type ApproximateDateInput = z.infer<typeof approximateDateSchema>;

// ---------------------------------------------------------------------------
// timesOfDay schema
// ---------------------------------------------------------------------------

export const timesOfDaySchema = z
  .array(z.string().regex(TIME_OF_DAY_REGEX, 'Must be HH:MM in 24-hour format'))
  .max(8, 'Maximum 8 times of day')
  .superRefine((times, ctx) => {
    const unique = new Set(times);
    if (unique.size !== times.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Times of day must be unique' });
      return;
    }
    // Verify ascending order
    for (let i = 1; i < times.length; i++) {
      if (times[i] <= times[i - 1]) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Times of day must be sorted ascending' });
        return;
      }
    }
  });

// ---------------------------------------------------------------------------
// Condition form schema
// ---------------------------------------------------------------------------

export const conditionFormSchema = z.object({
  name: z.string().min(1).max(120),
  normalizedName: z.string().min(1).max(120).optional(),
  standardizedId: z
    .object({ system: z.string(), code: z.string() })
    .nullable()
    .optional(),
  status: z.enum(['active', 'monitoring', 'resolved']),
  diagnosedOnsetDate: approximateDateSchema.nullable().optional(),
  stageSeverity: z.string().max(120).optional().nullable(),
  treatingClinician: z.string().max(160).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ConditionFormInput = z.infer<typeof conditionFormSchema>;

// ---------------------------------------------------------------------------
// Medication form schema
// ---------------------------------------------------------------------------

export const medicationFormSchema = z.object({
  name: z.string().min(1).max(120),
  normalizedName: z.string().min(1).max(120).optional(),
  standardizedId: z
    .object({ system: z.string(), code: z.string() })
    .nullable()
    .optional(),
  status: z.enum(['current', 'as_needed', 'discontinued']),
  dosage: z.string().max(120).optional().nullable(),
  frequency: z.string().max(120).optional().nullable(),
  timesOfDay: timesOfDaySchema.optional().default([]),
  prescribedBy: z.string().max(160).optional().nullable(),
  startDate: approximateDateSchema.nullable().optional(),
  endDate: approximateDateSchema.nullable().optional(),
  linkedConditionId: z.string().uuid().nullable().optional(),
  linkedReason: z.string().max(200).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type MedicationFormInput = z.infer<typeof medicationFormSchema>;

// ---------------------------------------------------------------------------
// Observation form schema
// ---------------------------------------------------------------------------

export const observationFormSchema = z.object({
  text: z.string().min(1).max(2000),
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
    .nullable()
    .optional(),
  observedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional(),
  concernLevel: z.enum(['note', 'mild_concern', 'significant_concern']).nullable().optional(),
});

export type ObservationFormInput = z.infer<typeof observationFormSchema>;

// ---------------------------------------------------------------------------
// Document metadata schema
// ---------------------------------------------------------------------------

export const documentMetadataSchema = z.object({
  title: z.string().min(1).max(120),
  category: z
    .enum([
      'lab_results',
      'discharge_summary',
      'prescription',
      'insurance',
      'imaging_scans',
      'doctors_notes',
      'other',
    ])
    .nullable()
    .optional(),
  documentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
    .nullable()
    .optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;

// ---------------------------------------------------------------------------
// Health consent history payload schema (discriminated union)
// ---------------------------------------------------------------------------

export const healthConsentHistoryPayloadSchema = z.discriminatedUnion('eventType', [
  z.object({
    eventType: z.literal('owner_request'),
    requestedAt: z.string(),
  }),
  z.object({
    eventType: z.literal('spoken_prompt'),
    promptedAt: z.string(),
    callSessionId: z.string().uuid(),
  }),
  z.object({
    eventType: z.literal('spoken_decision'),
    consentStatus: z.enum(['granted', 'denied', 'revoked']),
    callSessionId: z.string().uuid(),
  }),
  z.object({
    eventType: z.literal('self_service_decision'),
    consentStatus: z.enum(['granted', 'revoked']),
    actedAt: z.string(),
  }),
]);

export type HealthConsentHistoryPayloadInput = z.infer<typeof healthConsentHistoryPayloadSchema>;

// ---------------------------------------------------------------------------
// Health export scope snapshot schema
// ---------------------------------------------------------------------------

export const healthExportScopeSnapshotSchema = z.object({
  requestedFormat: z.enum(['json', 'csv']),
  visibilityScope: z.enum(['standard_account', 'health_owner_only']),
  healthInclusionMode: z.literal('automatic_when_present'),
  includesHealthProfile: z.boolean(),
  includesDocumentFiles: z.boolean(),
  deliveredArtifactFormat: z.enum(['zip', 'requested_format_native']),
});

export type HealthExportScopeSnapshotInput = z.infer<typeof healthExportScopeSnapshotSchema>;

// ---------------------------------------------------------------------------
// summaryParaphrase schema (shared validation)
// ---------------------------------------------------------------------------

export const summaryParaphraseSchema = z
  .string()
  .min(1)
  .max(240);
