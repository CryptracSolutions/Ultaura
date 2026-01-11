// Internal API for initiating calls

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { getLineById, checkLineAccess, isInQuietHours } from '../services/line-lookup.js';
import { createCallSession, failCallSession, getCallSessionByIdempotencyKey } from '../services/call-session.js';
import { initiateOutboundCall } from '../utils/twilio.js';
import { getPublicUrl } from '../utils/env.js';
import { requireInternalSecret } from '../middleware/auth.js';

export const callsRouter = Router();

callsRouter.use(requireInternalSecret);

// Initiate an outbound call
callsRouter.post('/outbound', async (req: Request, res: Response) => {
  try {
    const { lineId, reason, reminderId, reminderMessage, schedulerIdempotencyKey } = req.body;

    if (!lineId) {
      res.status(400).json({ error: 'Missing lineId' });
      return;
    }

    const isReminderCall = reason === 'reminder' && !!reminderMessage;
    const isTestCall = reason === 'test';

    logger.info({ lineId, reason, isReminderCall, schedulerIdempotencyKey }, 'Outbound call request');

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
      isReminderCall,
      isTestCall,
      reminderId: isReminderCall ? reminderId : undefined,
      reminderMessage: isReminderCall ? reminderMessage : undefined,
      schedulerIdempotencyKey,
    });

    if (!session) {
      // Check if this was an idempotency conflict (already processed)
      if (schedulerIdempotencyKey) {
        const existing = await getCallSessionByIdempotencyKey(schedulerIdempotencyKey);
        if (existing) {
          res.status(409).json({
            error: 'Duplicate scheduled call',
            code: 'DUPLICATE_SCHEDULED_CALL',
            existingSessionId: existing.id,
          });
          return;
        }
      }
      res.status(500).json({ error: 'Failed to create call session' });
      return;
    }

    // Get base URL for callbacks
    const publicUrl = getPublicUrl().replace(/\/$/, '');

    try {
      // Initiate the call via Twilio
      const callSid = await initiateOutboundCall({
        to: line.phone_e164,
        from: process.env.TWILIO_PHONE_NUMBER!,
        callbackUrl: `${publicUrl}/twilio/voice/outbound`,
        statusCallbackUrl: `${publicUrl}/twilio/status`,
        callSessionId: session.id,
      });

      logger.info({ sessionId: session.id, callSid, lineId, isReminderCall }, 'Outbound call initiated');

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
  // Forward to outbound with test reason
  req.body.reason = 'test';

  // Call the outbound handler logic directly
  const { lineId } = req.body;

  if (!lineId) {
    res.status(400).json({ error: 'Missing lineId' });
    return;
  }

  // Get line info
  const lineWithAccount = await getLineById(lineId);
  if (!lineWithAccount) {
    res.status(404).json({ error: 'Line not found' });
    return;
  }

  const { line, account } = lineWithAccount;

  // Skip opt-out check for test calls
  // Skip quiet hours check for test calls

  // Check access (but allow even if low minutes for testing)
  const accessCheck = await checkLineAccess(line, account, 'outbound');
  if (!accessCheck.allowed) {
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
    isTestCall: true,
  });

  if (!session) {
    res.status(500).json({ error: 'Failed to create call session' });
    return;
  }

  const publicUrl = getPublicUrl().replace(/\/$/, '');

  try {
    const callSid = await initiateOutboundCall({
      to: line.phone_e164,
      from: process.env.TWILIO_PHONE_NUMBER!,
      callbackUrl: `${publicUrl}/twilio/voice/outbound`,
      statusCallbackUrl: `${publicUrl}/twilio/status`,
      callSessionId: session.id,
    });

    logger.info({ sessionId: session.id, callSid, lineId, reason: 'test' }, 'Test call initiated');

    res.json({ success: true, sessionId: session.id, callSid });
  } catch (error) {
    logger.error({ error, sessionId: session.id }, 'Failed to initiate test call');
    await failCallSession(session.id, 'error');
    res.status(500).json({ error: 'Failed to initiate test call' });
  }
});
