import { z } from 'zod';

export const OrganizationIdSchema = z.number().int().positive();

export const GetOrCreateAccountInputSchema = z.object({
  organizationId: OrganizationIdSchema,
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
});

export type GetOrCreateAccountInput = z.infer<typeof GetOrCreateAccountInputSchema>;
