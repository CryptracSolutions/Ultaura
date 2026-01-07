import { z } from 'zod';
import { IANAZone } from 'luxon';
import { MAX_SNOOZE_COUNT, VALID_SNOOZE_MINUTES } from './constants.js';

const isValidIANATimezone = (tz: string) => {
  const normalized = tz.trim();
  if (!normalized || !IANAZone.isValidZone(normalized)) return false;
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
};

const DateTimeStringSchema = z.string().refine((value) => {
  if (!value || typeof value !== 'string') return false;
  const dt = value.trim();
  if (!dt) return false;
  const parsed = Date.parse(dt);
  return !Number.isNaN(parsed);
}, 'Invalid datetime');

export const RecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'custom']);
export const EditRecurrenceFrequencySchema = z.enum(['daily', 'weekly', 'monthly', 'custom', 'once']);

export const RecurrenceSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  interval: z.number().int().min(1).max(365).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  endsAt: DateTimeStringSchema.optional(),
});

export const CreateReminderInputSchema = z.object({
  lineId: z.string().uuid(),
  dueAt: DateTimeStringSchema,
  message: z.string().min(1).max(500),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone'),
  recurrence: RecurrenceSchema.optional(),
});

export type CreateReminderInput = z.infer<typeof CreateReminderInputSchema>;

export const EditReminderInputSchema = z.object({
  message: z.string().min(1).max(500).optional(),
  dueAt: DateTimeStringSchema.optional(),
  recurrence: z.object({
    frequency: EditRecurrenceFrequencySchema,
    interval: z.number().int().min(1).max(365).optional(),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    dayOfMonth: z.number().int().min(1).max(31).optional(),
    endsAt: DateTimeStringSchema.nullable().optional(),
  }).optional(),
});

export type EditReminderInput = z.infer<typeof EditReminderInputSchema>;

export const SnoozeInputSchema = z.object({
  reminderId: z.string().uuid(),
  minutes: z.number().refine(
    (value) => VALID_SNOOZE_MINUTES.includes(value as (typeof VALID_SNOOZE_MINUTES)[number]),
    `Minutes must be one of: ${VALID_SNOOZE_MINUTES.join(', ')}`
  ),
});

export const ReminderDeliveryMethodSchema = z.enum(['outbound_call']);

export { MAX_SNOOZE_COUNT, VALID_SNOOZE_MINUTES };
