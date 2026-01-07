import { z } from 'zod';
import { VALID_SNOOZE_MINUTES } from '../constants.js';

export const SnoozeReminderInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  reminderId: z.string().uuid().optional(),
  snoozeMinutes: z.number().refine(
    (value) => VALID_SNOOZE_MINUTES.includes(value as (typeof VALID_SNOOZE_MINUTES)[number]),
    `Minutes must be one of: ${VALID_SNOOZE_MINUTES.join(', ')}`
  ),
});

export type SnoozeReminderInput = z.infer<typeof SnoozeReminderInputSchema>;
