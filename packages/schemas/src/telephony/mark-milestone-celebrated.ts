import { z } from 'zod';

export const MarkMilestoneCelebratedInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  milestone_id: z.string().optional(),
  milestone_title: z.string().optional(),
});

export type MarkMilestoneCelebratedInput = z.infer<typeof MarkMilestoneCelebratedInputSchema>;
