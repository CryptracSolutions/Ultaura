// Internal SMS endpoint for cross-service SMS sending
// Called by Next.js app to send SMS via Twilio

import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import {
  sendSms,
  SMS_OPT_OUT_ERROR_MESSAGE,
} from '../../utils/twilio.js';
import { redactPhone } from '../../utils/redact.js';
import { requireInternalSecret } from '../../middleware/auth.js';
import { enforceRateLimit } from '../../services/rate-limiter.js';

export const internalSmsRouter = Router();

internalSmsRouter.use(requireInternalSecret);

internalSmsRouter.post('/sms', async (req: Request, res: Response) => {
  try {
    const { to, body, skipOptOutCheck } = req.body as {
      to?: string;
      body?: string;
      skipOptOutCheck?: boolean;
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

    const messageSid = await sendSms({ to, body, skipOptOutCheck });

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

internalSmsRouter.post('/alert-sms', async (req: Request, res: Response) => {
  try {
    const { accountId, lineId, callSessionId, phoneNumber, body, notificationType } =
      req.body as {
        accountId?: string;
        lineId?: string;
        callSessionId?: string;
        phoneNumber?: string;
        body?: string;
        notificationType?: string;
      };

    if (!accountId || !lineId || !phoneNumber || !body || !notificationType) {
      res.status(400).json({
        status: 'failed',
        error:
          'Missing required fields: accountId, lineId, phoneNumber, body, notificationType',
      });
      return;
    }

    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      res.status(400).json({
        status: 'failed',
        error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)',
      });
      return;
    }

    const rateLimit = await enforceRateLimit({
      action: 'sms',
      accountId,
      callSessionId,
      phoneNumber,
    });

    if (!rateLimit.allowed) {
      res.json({
        status: 'rate_limited',
        limitType: rateLimit.limitType ?? null,
      });
      return;
    }

    try {
      const messageSid = await sendSms({
        to: phoneNumber,
        body,
      });

      logger.info(
        {
          accountId,
          lineId,
          callSessionId,
          notificationType,
          to: redactPhone(phoneNumber),
          messageSid,
        },
        'Alert SMS sent via internal endpoint',
      );

      res.json({
        status: 'sent',
        messageSid,
      });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send SMS';

      if (
        message.includes(SMS_OPT_OUT_ERROR_MESSAGE)
      ) {
        res.json({
          status: 'opted_out',
        });
        return;
      }

      logger.error(
        { error, accountId, lineId, notificationType, to: redactPhone(phoneNumber) },
        'Failed to send alert SMS',
      );
      res.json({
        status: 'failed',
        error: message,
      });
      return;
    }
  } catch (error) {
    logger.error({ error }, 'Failed to process internal alert SMS endpoint');
    res.status(500).json({ status: 'failed', error: 'Failed to send SMS' });
  }
});
