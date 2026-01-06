// Tools router - handles Grok tool calls

import { Router } from 'express';
import { setReminderRouter } from './set-reminder.js';
import { scheduleCallRouter } from './schedule-call.js';
import { optOutRouter } from './opt-out.js';
import { forgetMemoryRouter } from './forget-memory.js';
import { markPrivateRouter } from './mark-private.js';
import { storeMemoryRouter } from './store-memory.js';
import { updateMemoryRouter } from './update-memory.js';
import { safetyEventRouter } from './safety-event.js';
import { overageActionRouter } from './overage-action.js';
import { requestUpgradeRouter } from './request-upgrade.js';
import { reportConversationLanguageRouter } from './report-conversation-language.js';
// Reminder management tools
import { listRemindersRouter } from './list-reminders.js';
import { editReminderRouter } from './edit-reminder.js';
import { pauseReminderRouter } from './pause-reminder.js';
import { resumeReminderRouter } from './resume-reminder.js';
import { snoozeReminderRouter } from './snooze-reminder.js';
import { cancelReminderRouter } from './cancel-reminder.js';
import { requireInternalSecret } from '../../middleware/auth.js';

export const toolsRouter = Router();

toolsRouter.use(requireInternalSecret);

toolsRouter.use('/set_reminder', setReminderRouter);
toolsRouter.use('/schedule_call', scheduleCallRouter);
toolsRouter.use('/opt_out', optOutRouter);
toolsRouter.use('/forget_memory', forgetMemoryRouter);
toolsRouter.use('/mark_private', markPrivateRouter);
toolsRouter.use('/store_memory', storeMemoryRouter);
toolsRouter.use('/update_memory', updateMemoryRouter);
toolsRouter.use('/safety_event', safetyEventRouter);
toolsRouter.use('/overage_action', overageActionRouter);
toolsRouter.use('/request_upgrade', requestUpgradeRouter);
toolsRouter.use('/report_conversation_language', reportConversationLanguageRouter);
// Reminder management routes
toolsRouter.use('/list_reminders', listRemindersRouter);
toolsRouter.use('/edit_reminder', editReminderRouter);
toolsRouter.use('/pause_reminder', pauseReminderRouter);
toolsRouter.use('/resume_reminder', resumeReminderRouter);
toolsRouter.use('/snooze_reminder', snoozeReminderRouter);
toolsRouter.use('/cancel_reminder', cancelReminderRouter);
