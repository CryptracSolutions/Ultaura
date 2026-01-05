// Twilio status callback webhook handler

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import {
  getCallSessionByTwilioSid,
  updateCallStatus,
  completeCallSession,
  failCallSession,
} from '../services/call-session.js';
import { validateTwilioSignature } from '../utils/twilio.js';

export const twilioStatusRouter = Router();

// Twilio signature validation middleware
function validateTwilioWebhook(req: Request, res: Response, next: () => void) {
  if (process.env.SKIP_TWILIO_SIGNATURE_VALIDATION === 'true') {
    logger.warn('Twilio signature validation skipped (development mode)');
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const isValid = validateTwilioSignature(url, req.body, signature);

  if (!isValid) {
    logger.warn({ url }, 'Invalid Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  next();
}

twilioStatusRouter.use(validateTwilioWebhook);

// Map Twilio call status to our internal status
function mapTwilioStatus(twilioStatus: string): 'created' | 'ringing' | 'in_progress' | 'completed' | 'failed' | 'canceled' | null {
  switch (twilioStatus) {
    case 'queued':
    case 'initiated':
      return 'created';
    case 'ringing':
      return 'ringing';
    case 'in-progress':
      return 'in_progress';
    case 'completed':
      return 'completed';
    case 'busy':
    case 'no-answer':
    case 'failed':
      return 'failed';
    case 'canceled':
      return 'canceled';
    default:
      return null;
  }
}

// Map Twilio status to end reason
function getEndReason(twilioStatus: string): 'hangup' | 'no_answer' | 'busy' | 'error' | null {
  switch (twilioStatus) {
    case 'completed':
      return 'hangup';
    case 'no-answer':
      return 'no_answer';
    case 'busy':
      return 'busy';
    case 'failed':
      return 'error';
    default:
      return null;
  }
}

// Handle Twilio status callbacks
twilioStatusRouter.post('/status', async (req: Request, res: Response) => {
  try {
    const {
      CallSid,
      CallStatus,
      CallDuration,
      Direction,
      Timestamp,
      ErrorCode,
      ErrorMessage,
    } = req.body;

    logger.info({
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration,
      direction: Direction,
      errorCode: ErrorCode,
    }, 'Twilio status callback');

    // Find the call session
    const session = await getCallSessionByTwilioSid(CallSid);

    if (!session) {
      // This might happen for calls we didn't create (e.g., test calls)
      logger.info({ callSid: CallSid }, 'No session found for Twilio SID');
      res.sendStatus(200);
      return;
    }

    const internalStatus = mapTwilioStatus(CallStatus);

    if (!internalStatus) {
      logger.warn({ callSid: CallSid, status: CallStatus }, 'Unknown Twilio status');
      res.sendStatus(200);
      return;
    }

    // Handle status updates
    switch (internalStatus) {
      case 'ringing':
        await updateCallStatus(session.id, 'ringing');
        break;

      case 'in_progress':
        await updateCallStatus(session.id, 'in_progress', {
          connectedAt: Timestamp || new Date().toISOString(),
        });
        break;

      case 'completed': {
        const endReason = session.end_reason || getEndReason(CallStatus) || 'hangup';
        await completeCallSession(session.id, {
          endReason,
          endedAt: Timestamp || new Date().toISOString(),
        });
        break;
      }

      case 'failed': {
        const endReason = getEndReason(CallStatus) || 'error';

        if (ErrorCode || ErrorMessage) {
          logger.error({
            sessionId: session.id,
            errorCode: ErrorCode,
            errorMessage: ErrorMessage,
          }, 'Twilio call error');
        }

        await failCallSession(session.id, endReason);
        break;
      }

      case 'canceled':
        await updateCallStatus(session.id, 'canceled', {
          endedAt: Timestamp || new Date().toISOString(),
        });
        break;
    }

    res.sendStatus(200);
  } catch (error) {
    logger.error({ error }, 'Error handling status callback');
    res.sendStatus(500);
  }
});
