import { z } from 'zod';

export const SetInsightsEnabledInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  enabled: z.boolean(),
});

export type SetInsightsEnabledInput = z.infer<typeof SetInsightsEnabledInputSchema>;
