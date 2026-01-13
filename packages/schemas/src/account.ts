import { z } from 'zod';

export const OrganizationIdSchema = z.number().int().positive();
export const UserTypeSchema = z.enum(['self', 'family_managed']);

export const GetOrCreateAccountInputSchema = z.object({
  organizationId: OrganizationIdSchema,
  userId: z.string().uuid(),
  name: z.string().min(1).max(200),
  email: z.string().email(),
  userType: UserTypeSchema.optional(),
});

export type GetOrCreateAccountInput = z.infer<typeof GetOrCreateAccountInputSchema>;
