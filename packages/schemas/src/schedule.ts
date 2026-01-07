import { z } from 'zod';
import { IANAZone } from 'luxon';

const isValidIANATimezone = (tz: string) => {
  const normalized = tz.trim();
  if (!normalized || !IANAZone.isValidZone(normalized)) return false;
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
};

const TimeOfDaySchema = z.string().regex(/^\d{2}:\d{2}$/, 'timeOfDay must be HH:mm');

const DaysOfWeekSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1, 'daysOfWeek must include at least one day');

export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(10),
  retryWindowMinutes: z.number().int().min(5).max(1440),
});

export const CreateScheduleInputSchema = z.object({
  lineId: z.string().uuid(),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone'),
  daysOfWeek: DaysOfWeekSchema,
  timeOfDay: TimeOfDaySchema,
  retryPolicy: RetryPolicySchema.optional(),
});

export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>;

export const UpdateScheduleInputSchema = z.object({
  enabled: z.boolean().optional(),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone').optional(),
  daysOfWeek: DaysOfWeekSchema.optional(),
  timeOfDay: TimeOfDaySchema.optional(),
  retryPolicy: RetryPolicySchema.optional(),
});

export type UpdateScheduleInput = z.infer<typeof UpdateScheduleInputSchema>;
