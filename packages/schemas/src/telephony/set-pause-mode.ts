import { z } from 'zod';

export const SetPauseModeInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  enabled: z.boolean(),
  reason: z.string().max(200).optional(),
});

export type SetPauseModeInput = z.infer<typeof SetPauseModeInputSchema>;
