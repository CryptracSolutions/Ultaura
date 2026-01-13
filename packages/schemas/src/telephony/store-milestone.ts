import { z } from 'zod';

export const StoreMilestoneInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  milestone_type: z.enum(['birthday', 'anniversary', 'memorial', 'achievement', 'holiday', 'custom']),
  title: z.string().min(1),
  date_month: z.number().int().min(1).max(12),
  date_day: z.number().int().min(1).max(31),
  date_year: z.number().int().optional(),
  related_person_name: z.string().optional(),
  is_recurring: z.boolean().optional(),
});

export type StoreMilestoneInput = z.infer<typeof StoreMilestoneInputSchema>;
