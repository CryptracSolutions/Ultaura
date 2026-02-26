import { z } from 'zod';
import { IANAZone } from 'luxon';
import { ReminderDeliveryMethodSchema } from '../reminder.js';

const isValidIANATimezone = (tz: string) => {
  const normalized = tz.trim();
  if (!normalized || !IANAZone.isValidZone(normalized)) return false;
  return normalized.includes('/') || normalized === 'UTC' || normalized === 'Etc/UTC';
};

const LocalDateTimeSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/,
  'Invalid local datetime format'
);

export const EditReminderInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  reminderId: z.string().uuid(),
  newMessage: z.string().max(500).optional(),
  newTimeLocal: LocalDateTimeSchema.optional(),
  newDeliveryMethod: ReminderDeliveryMethodSchema.optional(),
  timezone: z.string().refine(isValidIANATimezone, 'Must be a valid IANA timezone').optional(),
}).refine((data) => Boolean(data.newMessage || data.newTimeLocal || data.newDeliveryMethod), {
  message: 'Provide a message, time, or delivery method update',
});

export type EditReminderInput = z.infer<typeof EditReminderInputSchema>;
