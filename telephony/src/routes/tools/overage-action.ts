import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, recordCallEvent } from '../../services/call-session.js';

export const overageActionRouter = Router();

const VALID_PLAN_IDS = ['care', 'comfort', 'family', 'payg'] as const;
type ValidPlanId = (typeof VALID_PLAN_IDS)[number];

function isValidPlanId(value: string): value is ValidPlanId {
  return (VALID_PLAN_IDS as readonly string[]).includes(value);
}

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

    let validatedPlanId: ValidPlanId | undefined;
    if (action === 'upgrade' && !planId) {
      res.status(400).json({ error: 'Missing planId for upgrade action' });
      return;
    }

    if (action === 'upgrade') {
      if (!planId) {
        res.status(400).json({ error: 'Missing planId for upgrade action' });
        return;
      }

      if (!isValidPlanId(planId)) {
        res.status(400).json({ error: 'Invalid planId' });
        return;
      }

      validatedPlanId = planId;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    await recordCallEvent(callSessionId, 'state_change', {
      event: 'overage_action',
      action,
      planId: validatedPlanId,
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
          planId: validatedPlanId,
        }),
      });

      const data = (await response
        .json()
        .catch(() => null)) as null | { success?: boolean; error?: string };

      if (!response.ok || !data || data.success !== true) {
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
