// Tools router - handles Grok tool calls

import { Router } from 'express';
import { setReminderRouter } from './set-reminder.js';
import { scheduleCallRouter } from './schedule-call.js';
import { optOutRouter } from './opt-out.js';
import { forgetMemoryRouter } from './forget-memory.js';
import { markPrivateRouter } from './mark-private.js';
import { safetyEventRouter } from './safety-event.js';

export const toolsRouter = Router();

toolsRouter.use('/set_reminder', setReminderRouter);
toolsRouter.use('/schedule_call', scheduleCallRouter);
toolsRouter.use('/opt_out', optOutRouter);
toolsRouter.use('/forget_memory', forgetMemoryRouter);
toolsRouter.use('/mark_private', markPrivateRouter);
toolsRouter.use('/safety_event', safetyEventRouter);
