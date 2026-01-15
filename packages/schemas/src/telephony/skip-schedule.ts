import { z } from 'zod';

export const SkipScheduleInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
});

export type SkipScheduleInput = z.infer<typeof SkipScheduleInputSchema>;
