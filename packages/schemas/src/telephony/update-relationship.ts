import { z } from 'zod';

export const UpdateRelationshipInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  name: z.string().min(1),
  updates: z.object({
    nickname: z.string().optional(),
    contact_frequency: z.string().optional(),
    sentiment: z.string().optional(),
    recent_topic: z.string().optional(),
    location: z.string().optional(),
    shared_activity: z.string().optional(),
  }),
});

export type UpdateRelationshipInput = z.infer<typeof UpdateRelationshipInputSchema>;
