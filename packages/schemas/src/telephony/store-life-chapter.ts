import { z } from 'zod';

export const StoreLifeChapterInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  chapter_type: z.enum([
    'childhood',
    'education',
    'career',
    'marriage',
    'parenting',
    'military',
    'travel',
    'retirement',
    'accomplishment',
    'loss',
    'other',
  ]),
  title: z.string().min(1),
  era_start_year: z.number().int().optional(),
  era_end_year: z.number().int().optional(),
  narrative_summary: z.string().min(1),
  key_people: z.array(z.string()).optional(),
  emotional_tone: z.enum(['joyful', 'proud', 'bittersweet', 'difficult', 'neutral']).optional(),
});

export type StoreLifeChapterInput = z.infer<typeof StoreLifeChapterInputSchema>;
