import { z } from 'zod';

const MoodSchema = z.enum(['positive', 'neutral', 'low', 'anxious', 'sad', 'frustrated']);

export const LogMoodSnapshotInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  mood_start: MoodSchema,
  mood_mid: MoodSchema.optional(),
  mood_end: MoodSchema,
  mood_trajectory: z.enum(['improved', 'declined', 'stable']),
  techniques_used: z.array(z.string()).optional(),
  energy_level: z.enum(['high', 'normal', 'low', 'very_low']),
});

export type LogMoodSnapshotInput = z.infer<typeof LogMoodSnapshotInputSchema>;
