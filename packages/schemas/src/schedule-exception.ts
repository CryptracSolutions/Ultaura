import { z } from 'zod';

export const ScheduleExceptionTypeSchema = z.enum(['skip', 'snooze', 'reschedule']);

const DateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');
const DateTimeStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime');

export const CreateScheduleExceptionInputSchema = z.object({
  scheduleId: z.string().uuid(),
  exceptionDate: DateStringSchema,
  exceptionType: ScheduleExceptionTypeSchema,
  snoozeMinutes: z.number().int().min(5).max(1440).optional(),
  newDatetime: DateTimeStringSchema.optional(),
});

export type CreateScheduleExceptionInput = z.infer<typeof CreateScheduleExceptionInputSchema>;
