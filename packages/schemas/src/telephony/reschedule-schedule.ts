import { z } from 'zod';

const DateTimeStringSchema = z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Invalid datetime');

export const RescheduleScheduleInputSchema = z.object({
  callSessionId: z.string().uuid(),
  lineId: z.string().uuid(),
  scheduleId: z.string().uuid().optional(),
  newDatetime: DateTimeStringSchema,
});

export type RescheduleScheduleInput = z.infer<typeof RescheduleScheduleInputSchema>;
