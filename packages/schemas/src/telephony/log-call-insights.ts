import { z } from 'zod';

const TopicCodeSchema = z.enum([
  'family',
  'friends',
  'activities',
  'interests',
  'memories',
  'plans',
  'daily_life',
  'entertainment',
  'feelings',
  'requests',
]);

const ConcernCodeSchema = z.enum([
  'loneliness',
  'sadness',
  'anxiety',
  'sleep',
  'pain',
  'fatigue',
  'appetite',
]);

const FollowUpReasonSchema = z.enum([
  'loneliness',
  'sadness',
  'anxiety',
  'sleep',
  'pain',
  'fatigue',
  'appetite',
  'wants_more_contact',
  'missed_routine',
]);

export const LogCallInsightsInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  mood_overall: z.enum(['positive', 'neutral', 'low']),
  mood_intensity: z.number().int().min(0).max(3),
  engagement_score: z.number().min(1).max(10),
  social_need_level: z.number().int().min(0).max(3),
  topics: z.array(z.object({
    code: TopicCodeSchema,
    weight: z.number().min(0).max(1),
  })),
  private_topics: z.array(TopicCodeSchema).optional().default([]),
  concerns: z.array(z.object({
    code: ConcernCodeSchema,
    severity: z.number().int().min(1).max(3),
    confidence: z.number().min(0).max(1),
    is_novel: z.boolean().optional(),
  })).optional().default([]),
  needs_follow_up: z.boolean(),
  follow_up_reasons: z.array(FollowUpReasonSchema).optional().default([]),
  confidence_overall: z.number().min(0).max(1),
});

export type LogCallInsightsInput = z.infer<typeof LogCallInsightsInputSchema>;
