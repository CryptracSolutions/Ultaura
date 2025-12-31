// Request upgrade tool - handles proactive upgrade requests during calls

import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, recordCallEvent } from '../../services/call-session.js';
import { getLineById } from '../../services/line-lookup.js';

// Plan information for Grok to explain
const PLAN_INFO: Record<string, { name: string; price: string; minutes: number | null; lines: number }> = {
  care: { name: 'Care', price: '$39/month', minutes: 300, lines: 1 },
  comfort: { name: 'Comfort', price: '$99/month', minutes: 900, lines: 2 },
  family: { name: 'Family', price: '$199/month', minutes: 2200, lines: 4 },
  payg: { name: 'Pay as you go', price: '$0/month + $0.15/minute', minutes: null, lines: 4 },
};

export const requestUpgradeRouter = Router();

requestUpgradeRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, accountId, planId, sendLink } = req.body as {
      callSessionId?: string;
      lineId?: string;
      accountId?: string;
      planId?: 'care' | 'comfort' | 'family' | 'payg';
      sendLink?: boolean;
    };

    if (!callSessionId) {
      res.status(400).json({ error: 'Missing callSessionId' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // Record the upgrade request event
    await recordCallEvent(callSessionId, 'state_change', {
      event: 'upgrade_request',
      planId: planId || null,
      sendLink: sendLink || false,
    });

    // If no plan specified, return plan options for Grok to explain
    if (!planId) {
      const planList = Object.entries(PLAN_INFO)
        .map(([_id, info]) => {
          if (info.minutes) {
            return `${info.name}: ${info.price}, ${info.minutes} minutes/month, ${info.lines} phone line${info.lines > 1 ? 's' : ''}`;
          }
          return `${info.name}: ${info.price}, ${info.lines} phone lines`;
        })
        .join('. ');

      res.json({
        success: true,
        message: `Here are the available plans: ${planList}. Ask which plan they would like to upgrade to.`,
      });
      return;
    }

    // Validate plan
    if (!PLAN_INFO[planId]) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    const plan = PLAN_INFO[planId];

    // If sendLink is not true, just confirm the plan choice
    if (!sendLink) {
      const planDesc = plan.minutes
        ? `${plan.name} at ${plan.price} with ${plan.minutes} minutes per month`
        : `${plan.name} at ${plan.price}`;

      res.json({
        success: true,
        message: `Confirm they want the ${planDesc}. Once they confirm, call this tool again with send_link set to true.`,
      });
      return;
    }

    // Get line info for phone number
    if (!lineId) {
      res.status(400).json({ error: 'Missing lineId for sending upgrade link' });
      return;
    }

    const lineWithAccount = await getLineById(lineId);
    if (!lineWithAccount) {
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const phoneNumber = lineWithAccount.line.phone_e164;

    // Call upgrade API to create checkout session and send email + SMS
    const appBaseUrl =
      process.env.ULTAURA_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      'http://localhost:3000';
    const upgradeUrl = `${appBaseUrl.replace(/\/$/, '')}/api/telephony/upgrade`;

    logger.info({
      callSessionId,
      accountId: accountId || session.account_id,
      planId,
      phoneNumber,
    }, 'Sending upgrade link');

    const upgradeResponse = await fetch(upgradeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': process.env.TELEPHONY_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify({
        accountId: accountId || session.account_id,
        planId,
        phoneNumber, // Include phone for SMS delivery
      }),
    });

    const upgradeData = (await upgradeResponse.json()) as { success?: boolean };

    if (!upgradeResponse.ok || !upgradeData.success) {
      logger.error({ callSessionId, upgradeData }, 'Failed to send upgrade link');
      res.status(500).json({ error: 'Failed to send upgrade link' });
      return;
    }

    res.json({
      success: true,
      message: `Great! I've sent the upgrade link for the ${plan.name} plan to their phone via text message and also to the billing email on file. Tell them to check their phone for a text with a link to complete the upgrade.`,
    });
  } catch (error) {
    logger.error({ error }, 'Error processing upgrade request');
    res.status(500).json({ error: 'Failed to process upgrade request' });
  }
});
