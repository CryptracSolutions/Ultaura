import { z } from 'zod';
import { IANAZone } from 'luxon';

export const LineStatusSchema = z.enum(['active', 'paused', 'disabled']);
export const VoicemailBehaviorSchema = z.enum(['none', 'brief', 'detailed']);
export const SharingTierSchema = z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4']);
const SupportedLanguageIsoSchema = z.enum([
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh',
  'nl', 'ru', 'ar', 'hi', 'tr', 'pl', 'sv', 'da', 'no',
  'fi', 'cs', 'th', 'vi', 'id', 'ms', 'tl', 'uk', 'el',
  'he', 'ro', 'hu',
]);

const PHONE_E164_REGEX = /^\+1[2-9]\d{9}$/;

const isValidIANATimezone = (tz: string) => {
  const normalized = tz.trim();
  if (!normalized || !IANAZone.isValidZone(normalized)) return false;
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
};

export const CreateLineInputSchema = z.object({
  accountId: z.string().uuid(),
  displayName: z.string().min(1).max(100),
  phoneE164: z.string().regex(PHONE_E164_REGEX, 'Must be a valid US phone number'),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone'),
  voicemailBehavior: VoicemailBehaviorSchema.optional().default('brief'),
  preferredLanguageIso: SupportedLanguageIsoSchema.nullable().optional(),
  seedInterests: z.array(z.string()).optional(),
  seedAvoidTopics: z.array(z.string()).optional(),
  defaultSharingTier: SharingTierSchema.optional(),
});

export type CreateLineInput = z.infer<typeof CreateLineInputSchema>;

export const UpdateLineInputSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone').optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  doNotCall: z.boolean().optional(),
  inboundAllowed: z.boolean().optional(),
  seedInterests: z.array(z.string()).optional(),
  seedAvoidTopics: z.array(z.string()).optional(),
  allowVoiceReminderControl: z.boolean().optional(),
  allowVoiceScheduleControl: z.boolean().optional(),
  voicemailBehavior: VoicemailBehaviorSchema.optional(),
  preferredLanguageIso: SupportedLanguageIsoSchema.nullable().optional(),
  status: LineStatusSchema.optional(),
  birthYear: z.number().int().optional(),
  formativeDecade: z.number().int().optional(),
  hometown: z.string().optional(),
  currentLocation: z.string().optional(),
  optimalCallTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  optimalCallTimeSource: z.enum(['family_set', 'ai_learned', 'senior_request']).optional(),
  optimalCallDays: z.array(z.number().int().min(0).max(6)).optional(),
  interruptionTolerance: z.enum(['high', 'normal', 'low']).optional(),
  fillerWordPatience: z.enum(['high', 'normal', 'low']).optional(),
  silenceToleranceMs: z.number().int().min(500).optional(),
  crosstalkRecoveryMode: z.enum(['immediate', 'patient', 'very_patient']).optional(),
}).partial();

export type UpdateLineInput = z.infer<typeof UpdateLineInputSchema>;
