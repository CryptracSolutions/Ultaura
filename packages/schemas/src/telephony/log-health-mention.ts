import { z } from 'zod';

export const LogHealthMentionInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  category: z.enum(['pain', 'medication', 'appointment', 'symptom', 'sleep', 'appetite', 'mobility', 'energy', 'general']),
  summary: z.string().min(1),
  severity: z.enum(['mild', 'moderate', 'concerning']).optional(),
});

export type LogHealthMentionInput = z.infer<typeof LogHealthMentionInputSchema>;
