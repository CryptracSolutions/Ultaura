import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, recordCallEvent } from '../../services/call-session.js';

export const overageActionRouter = Router();

overageActionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, action, planId } = req.body as {
      callSessionId?: string;
      action?: 'continue' | 'upgrade' | 'stop';
      planId?: string;
    };

    if (!callSessionId || !action) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (!['continue', 'upgrade', 'stop'].includes(action)) {
      res.status(400).json({ error: 'Invalid action' });
      return;
    }

    if (action === 'upgrade' && !planId) {
      res.status(400).json({ error: 'Missing planId for upgrade action' });
      return;
    }

    if (action === 'upgrade' && !['care', 'comfort', 'family', 'payg'].includes(planId)) {
      res.status(400).json({ error: 'Invalid planId' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    await recordCallEvent(callSessionId, 'state_change', {
      event: 'overage_action',
      action,
      planId,
    });

    if (action === 'upgrade') {
      const appBaseUrl =
        process.env.ULTAURA_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        'http://localhost:3000';
      const upgradeUrl = `${appBaseUrl.replace(/\/$/, '')}/api/telephony/upgrade`;

      const response = await fetch(upgradeUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify({
          accountId: session.account_id,
          planId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        logger.error({ callSessionId, data }, 'Failed to send upgrade email');
        res.status(500).json({ error: 'Failed to send upgrade email' });
        return;
      }

      res.json({
        success: true,
        message:
          'Upgrade link sent to the billing email on file. Confirm that they can check their email to continue.',
      });
      return;
    }

    if (action === 'stop') {
      res.json({
        success: true,
        message: 'User requested to stop. Say a short warm goodbye and end the call.',
      });
      return;
    }

    res.json({
      success: true,
      message: 'User chose to continue. Continue the call.',
    });
  } catch (error) {
    logger.error({ error }, 'Error handling overage action');
    res.status(500).json({ error: 'Failed to process overage action' });
  }
});
