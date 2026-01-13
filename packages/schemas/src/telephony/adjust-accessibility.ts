import { z } from 'zod';

export const AdjustAccessibilityInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  setting: z.enum(['speech_rate', 'hearing_mode', 'cognitive_mode']),
  value: z.string().min(1),
  source: z.enum(['senior_request', 'ai_detected']).optional(),
});

export type AdjustAccessibilityInput = z.infer<typeof AdjustAccessibilityInputSchema>;
