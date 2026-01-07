import { z } from 'zod';

const PHONE_E164_REGEX = /^\+1[2-9]\d{9}$/;

export const SafetyTierSchema = z.enum(['low', 'medium', 'high']);

export const CreateTrustedContactInputSchema = z.object({
  name: z.string().min(1).max(100),
  phoneE164: z.string().regex(PHONE_E164_REGEX, 'Must be a valid US phone number'),
  relationship: z.string().min(1).max(100).optional(),
  notifyOn: z.array(SafetyTierSchema).optional(),
});

export type CreateTrustedContactInput = z.infer<typeof CreateTrustedContactInputSchema>;
