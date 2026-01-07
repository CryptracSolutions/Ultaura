import { z } from 'zod';

export const OptOutInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  source: z.enum(['voice']).optional(),
});

export type OptOutInput = z.infer<typeof OptOutInputSchema>;
