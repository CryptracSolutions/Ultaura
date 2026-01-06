// Twilio outbound call webhook handler

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import type { CallAnsweredBy } from '../services/call-session.js';
import { getCallSession, updateCallSession, updateCallStatus } from '../services/call-session.js';
import { getLineById, checkLineAccess, isInQuietHours } from '../services/line-lookup.js';
import { getLastDetectedLanguageForLine } from '../services/language.js';
import { generateStreamTwiML, generateMessageTwiML, generateHangupTwiML, validateTwilioSignature } from '../utils/twilio.js';
import { getWebsocketUrl } from '../utils/env.js';
import { getVoicemailMessage } from '../utils/voicemail-messages.js';

export const twilioOutboundRouter = Router();

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

twilioOutboundRouter.use(validateTwilioWebhook);

// Handle outbound call TwiML request (when Twilio answers the call)
twilioOutboundRouter.post('/outbound', async (req: Request, res: Response) => {
  try {
    const { callSessionId } = req.query;
    const { CallSid, CallStatus, AnsweredBy } = req.body;

    logger.info({ callSessionId, callSid: CallSid, status: CallStatus, answeredBy: AnsweredBy }, 'Outbound call answered');

    if (!callSessionId || typeof callSessionId !== 'string') {
      logger.error('Missing callSessionId in outbound request');
      res.type('text/xml').send(generateMessageTwiML("I'm sorry, there was an error. Goodbye."));
      return;
    }

    // Get the call session
    const session = await getCallSession(callSessionId);
    if (!session) {
      logger.error({ callSessionId }, 'Call session not found');
      res.type('text/xml').send(generateMessageTwiML("I'm sorry, there was an error. Goodbye."));
      return;
    }

    // Get line info
    const lineWithAccount = await getLineById(session.line_id);
    if (!lineWithAccount) {
      logger.error({ lineId: session.line_id }, 'Line not found');
      res.type('text/xml').send(generateMessageTwiML("I'm sorry, there was an error. Goodbye."));
      return;
    }

    const { line, account } = lineWithAccount;

    // Check if call should be suppressed
    if (line.do_not_call) {
      logger.info({ lineId: line.id }, 'Line opted out, ending call');
      res.type('text/xml').send(generateMessageTwiML("This line has opted out of calls. Goodbye."));
      return;
    }

    if (isInQuietHours(line)) {
      logger.info({ lineId: line.id }, 'In quiet hours, ending call');
      res.type('text/xml').send(generateMessageTwiML("I apologize for calling during quiet hours. I'll try again later. Goodbye."));
      return;
    }

    // Check access
    const accessCheck = await checkLineAccess(line, account, 'outbound');
    if (!accessCheck.allowed) {
      // If the call session was created before the trial ended, allow the call to proceed.
      // This avoids blocking calls that were initiated just before trial expiration.
      if (accessCheck.reason === 'trial_expired' && account.status === 'trial') {
        const trialEndsAt = account.trial_ends_at ?? account.cycle_end;
        if (trialEndsAt) {
          const trialEndsMs = new Date(trialEndsAt).getTime();
          const sessionCreatedMs = new Date(session.created_at).getTime();

          if (sessionCreatedMs < trialEndsMs) {
            logger.info({ callSessionId, trialEndsAt }, 'Trial expired after call initiation; allowing outbound call to proceed');
          } else {
            logger.info({ lineId: line.id, reason: accessCheck.reason }, 'Line access denied for outbound');
            res.type('text/xml').send(generateMessageTwiML("I'm sorry, there was an issue with your account. Please contact support. Goodbye."));
            return;
          }
        } else {
          logger.info({ lineId: line.id, reason: accessCheck.reason }, 'Line access denied for outbound');
          res.type('text/xml').send(generateMessageTwiML("I'm sorry, there was an issue with your account. Please contact support. Goodbye."));
          return;
        }
      } else {
      logger.info({ lineId: line.id, reason: accessCheck.reason }, 'Line access denied for outbound');
      res.type('text/xml').send(generateMessageTwiML("I'm sorry, there was an issue with your account. Please contact support. Goodbye."));
      return;
      }
    }

    // Update call session with Twilio SID
    await updateCallStatus(session.id, 'in_progress', {
      twilioCallSid: CallSid,
      connectedAt: new Date().toISOString(),
    });

    const answeredBy = typeof AnsweredBy === 'string' ? AnsweredBy : null;
    const machineAnswers = new Set([
      'machine_start',
      'machine_end_beep',
      'machine_end_silence',
      'machine_end_other',
    ]);
    const isMachine = answeredBy ? machineAnswers.has(answeredBy) : false;
    const isFax = answeredBy === 'fax';

    if (answeredBy) {
      await updateCallSession(session.id, {
        answeredBy: answeredBy as CallAnsweredBy,
        endReason: isMachine || isFax ? 'no_answer' : undefined,
      });
    }

    if (isFax) {
      logger.info({ callSessionId, answeredBy }, 'Fax detected, ending call');
      res.type('text/xml').send(generateHangupTwiML());
      return;
    }

    if (isMachine) {
      logger.info({ callSessionId, answeredBy }, 'Answering machine detected');
      const voicemailBehavior = line.voicemail_behavior || 'brief';

      if (voicemailBehavior === 'none') {
        res.type('text/xml').send(generateHangupTwiML());
        return;
      }

      const startingLanguage = await getLastDetectedLanguageForLine(line.id);
      const message = getVoicemailMessage({
        name: line.display_name,
        language: startingLanguage,
        behavior: voicemailBehavior,
        isReminderCall: session.is_reminder_call,
        reminderMessage: session.reminder_message,
      });

      res.type('text/xml').send(generateMessageTwiML(message, startingLanguage));
      return;
    }

    // Generate TwiML to connect to WebSocket stream
    const websocketUrl = getWebsocketUrl();
    const twiml = generateStreamTwiML(session.id, websocketUrl);

    logger.info({ sessionId: session.id, lineId: line.id }, 'Connecting outbound call to media stream');

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error }, 'Error handling outbound call');
    res.type('text/xml').send(generateMessageTwiML("I'm sorry, I'm having technical difficulties. Goodbye."));
  }
});
