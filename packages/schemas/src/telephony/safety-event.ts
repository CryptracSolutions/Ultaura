import { z } from 'zod';

export const SafetyCategorySchema = z.enum([
  'SUICIDAL_IDEATION',
  'SELF_HARM',
  'HOPELESSNESS',
  'ISOLATION_DISTRESS',
  'PHYSICAL_DANGER',
  'MEDICAL_EMERGENCY',
  'ABUSE_CONCERN',
  'COGNITIVE_DECLINE',
  'GENERAL_CONCERN',
]);

export const SafetyEventInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  category: SafetyCategorySchema,
  tier: z.enum(['low', 'medium', 'high']).optional(),
  confidence: z.number().min(0).max(1),
  actionTaken: z.enum([
    'none',
    'suggested_988',
    'suggested_911',
    'notified_contact',
    'transferred_call',
  ]),
  source: z.enum(['model', 'keyword_backstop']).optional(),
}).superRefine((data, ctx) => {
  if (data.category === 'GENERAL_CONCERN' && !data.tier) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'GENERAL_CONCERN requires tier',
      path: ['tier'],
    });
  }
});

export type SafetyEventInput = z.infer<typeof SafetyEventInputSchema>;
export type SafetyCategory = z.infer<typeof SafetyCategorySchema>;
