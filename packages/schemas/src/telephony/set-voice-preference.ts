import { z } from 'zod';
import { GrokVoiceSchema } from '../line.js';

export const SetVoicePreferenceInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  voice: GrokVoiceSchema,
});

export type SetVoicePreferenceInput = z.infer<typeof SetVoicePreferenceInputSchema>;
