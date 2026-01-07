import { z } from 'zod';

export const SafetyEventInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  tier: z.enum(['low', 'medium', 'high']),
  signals: z.string().optional(),
  actionTaken: z.enum([
    'none',
    'suggested_988',
    'suggested_911',
    'notified_contact',
    'transferred_call',
  ]),
  source: z.enum(['model', 'keyword_backstop']).optional(),
});

export type SafetyEventInput = z.infer<typeof SafetyEventInputSchema>;
