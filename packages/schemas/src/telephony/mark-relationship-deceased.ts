import { z } from 'zod';

export const MarkRelationshipDeceasedInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  name: z.string().min(1),
  passed_at: z.string().optional(),
  grief_sensitivity: z.enum(['high', 'medium', 'low']).optional(),
});

export type MarkRelationshipDeceasedInput = z.infer<typeof MarkRelationshipDeceasedInputSchema>;
