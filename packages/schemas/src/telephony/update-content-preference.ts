import { z } from 'zod';

export const UpdateContentPreferenceInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  content_type: z.enum(['trivia', 'story', 'memory_lane', 'brain_games']),
  preference_change: z.enum(['increase', 'decrease']),
  specific_update: z.record(z.unknown()).optional(),
});

export type UpdateContentPreferenceInput = z.infer<typeof UpdateContentPreferenceInputSchema>;
