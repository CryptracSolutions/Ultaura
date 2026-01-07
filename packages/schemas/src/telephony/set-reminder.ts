import { z } from 'zod';
import { IANAZone } from 'luxon';

const isValidIANATimezone = (tz: string) => {
  const normalized = tz.trim();
  if (!normalized || !IANAZone.isValidZone(normalized)) return false;
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
};

const LocalDateTimeSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
  'Invalid local datetime format'
);

export const SetReminderInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  dueAtLocal: LocalDateTimeSchema,
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone').optional(),
  message: z.string().max(500).optional(),
  privacyScope: z.enum(['line_only', 'shareable_with_payer']).optional(),
  isRecurring: z.boolean().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']).optional(),
  interval: z.number().int().min(1).max(365).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endsAtLocal: LocalDateTimeSchema.optional(),
});

export type SetReminderInput = z.infer<typeof SetReminderInputSchema>;
