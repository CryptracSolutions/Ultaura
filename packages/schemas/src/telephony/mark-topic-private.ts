import { z } from 'zod';

export const MarkTopicPrivateInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  topic_code: z.enum([
    'family',
    'friends',
    'activities',
    'interests',
    'memories',
    'plans',
    'daily_life',
    'entertainment',
    'feelings',
    'requests',
  ]),
});

export type MarkTopicPrivateInput = z.infer<typeof MarkTopicPrivateInputSchema>;
