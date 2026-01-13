import { z } from 'zod';

export const LogCognitiveObservationInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  observation_type: z.enum(['confusion', 'repetition', 'word_finding', 'orientation', 'memory_lapse']),
  severity: z.enum(['mild', 'moderate', 'significant']),
  context: z.string().optional(),
  response_given: z.string().optional(),
});

export type LogCognitiveObservationInput = z.infer<typeof LogCognitiveObservationInputSchema>;
