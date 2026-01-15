import { z } from 'zod';

export const SnoozeScheduleInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
  snoozeMinutes: z.number().int().min(5).max(1440),
});

export type SnoozeScheduleInput = z.infer<typeof SnoozeScheduleInputSchema>;
