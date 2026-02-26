import { z } from 'zod';

export const LifeNoteInputSchema = z.object({
  note: z
    .string()
    .trim()
    .min(1, 'Note cannot be empty')
    .max(200, 'Note must be 200 characters or fewer'),
  authorName: z.string().trim().min(1).max(100),
  authorRelationship: z.string().trim().max(100).nullable().optional(),
});

export type LifeNoteInput = z.infer<typeof LifeNoteInputSchema>;
