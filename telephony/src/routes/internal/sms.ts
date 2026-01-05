// Internal SMS endpoint for cross-service SMS sending
// Called by Next.js app to send SMS via Twilio

import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { sendSms } from '../../utils/twilio.js';
import { redactPhone } from '../../utils/redact.js';
import { requireInternalSecret } from '../../middleware/auth.js';

export const internalSmsRouter = Router();

internalSmsRouter.use(requireInternalSecret);

internalSmsRouter.post('/sms', async (req: Request, res: Response) => {
  try {
    const { to, body } = req.body as {
      to?: string;
      body?: string;
    };

    if (!to || !body) {
      res.status(400).json({ error: 'Missing required fields: to, body' });
      return;
    }

    // Validate phone number format (E.164)
    if (!to.match(/^\+[1-9]\d{1,14}$/)) {
      res.status(400).json({ error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)' });
      return;
    }

    const messageSid = await sendSms({ to, body });

    logger.info({ to: redactPhone(to), messageSid }, 'SMS sent via internal endpoint');

    res.json({
      success: true,
      messageSid,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send SMS via internal endpoint');
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});
