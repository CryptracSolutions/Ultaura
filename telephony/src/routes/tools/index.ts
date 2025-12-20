// Tools router - handles Grok tool calls

import { Router } from 'express';
import { setReminderRouter } from './set-reminder.js';
import { scheduleCallRouter } from './schedule-call.js';

export const toolsRouter = Router();

toolsRouter.use('/set_reminder', setReminderRouter);
toolsRouter.use('/schedule_call', scheduleCallRouter);
