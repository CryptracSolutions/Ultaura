// Internal API for initiating calls

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { getLineById, checkLineAccess, isInQuietHours } from '../services/line-lookup.js';
import { createCallSession, failCallSession } from '../services/call-session.js';
import { initiateOutboundCall } from '../utils/twilio.js';

export const callsRouter = Router();

// Verify internal API access
function verifyInternalAccess(req: Request, res: Response, next: () => void) {
  const secret = req.headers['x-webhook-secret'];
  const expectedSecret = process.env.TELEPHONY_WEBHOOK_SECRET;

  if (!expectedSecret) {
    logger.warn('TELEPHONY_WEBHOOK_SECRET not set, skipping auth');
    next();
    return;
  }

  if (secret !== expectedSecret) {
    logger.warn('Invalid webhook secret');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

callsRouter.use(verifyInternalAccess);

// Initiate an outbound call
callsRouter.post('/outbound', async (req: Request, res: Response) => {
  try {
    const { lineId, reason } = req.body;

    if (!lineId) {
      res.status(400).json({ error: 'Missing lineId' });
      return;
    }

    logger.info({ lineId, reason }, 'Outbound call request');

    // Get line info
    const lineWithAccount = await getLineById(lineId);
    if (!lineWithAccount) {
      res.status(404).json({ error: 'Line not found' });
      return;
    }

    const { line, account } = lineWithAccount;

    // Check if line is opted out
    if (line.do_not_call) {
      logger.info({ lineId }, 'Line opted out, skipping call');
      res.status(400).json({ error: 'Line opted out', code: 'DO_NOT_CALL' });
      return;
    }

    // Check quiet hours
    if (isInQuietHours(line)) {
      logger.info({ lineId }, 'In quiet hours, skipping call');
      res.status(400).json({ error: 'In quiet hours', code: 'QUIET_HOURS' });
      return;
    }

    // Check access
    const accessCheck = await checkLineAccess(line, account, 'outbound');
    if (!accessCheck.allowed) {
      logger.info({ lineId, reason: accessCheck.reason }, 'Line access denied');
      res.status(400).json({ error: 'Access denied', code: accessCheck.reason });
      return;
    }

    // Create call session
    const session = await createCallSession({
      accountId: account.id,
      lineId: line.id,
      direction: 'outbound',
      twilioFrom: process.env.TWILIO_PHONE_NUMBER,
      twilioTo: line.phone_e164,
    });

    if (!session) {
      res.status(500).json({ error: 'Failed to create call session' });
      return;
    }

    // Get base URL for callbacks
    const baseUrl = process.env.TELEPHONY_BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;

    try {
      // Initiate the call via Twilio
      const callSid = await initiateOutboundCall({
        to: line.phone_e164,
        from: process.env.TWILIO_PHONE_NUMBER!,
        callbackUrl: `${baseUrl}/twilio/voice/outbound`,
        statusCallbackUrl: `${baseUrl}/twilio/status`,
        callSessionId: session.id,
      });

      logger.info({ sessionId: session.id, callSid, lineId }, 'Outbound call initiated');

      res.json({
        success: true,
        sessionId: session.id,
        callSid,
      });
    } catch (error) {
      logger.error({ error, sessionId: session.id }, 'Failed to initiate Twilio call');
      await failCallSession(session.id, 'error');
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  } catch (error) {
    logger.error({ error }, 'Error in outbound call request');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test call endpoint (for dashboard "Test call now" button)
callsRouter.post('/test', async (req: Request, res: Response) => {
  // Same as outbound, but marks it as a test
  req.body.reason = 'test';
  await callsRouter.handle(req, res, () => {});
});
