import { z } from 'zod';
import { IANAZone } from 'luxon';

export const LineStatusSchema = z.enum(['active', 'paused', 'disabled']);
export const VoicemailBehaviorSchema = z.enum(['none', 'brief', 'detailed']);

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
  seedInterests: z.array(z.string()).optional(),
  seedAvoidTopics: z.array(z.string()).optional(),
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
  voicemailBehavior: VoicemailBehaviorSchema.optional(),
  status: LineStatusSchema.optional(),
}).partial();

export type UpdateLineInput = z.infer<typeof UpdateLineInputSchema>;
