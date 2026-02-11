// Twilio inbound call webhook handler

import { Router, Request, Response } from 'express';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../server.js';
import { findLineByPhone, checkLineAccess } from '../services/line-lookup.js';
import { createCallSession, failCallSession } from '../services/call-session.js';
import { generateStreamTwiML, generateMessageTwiML, formatToE164, validateTwilioSignature } from '../utils/twilio.js';
import { getWebsocketUrl } from '../utils/env.js';
import { redactPhone } from '../utils/redact.js';
import { updateLogContext } from '../observability/log-context.js';

export const twilioInboundRouter = Router();

// Twilio signature validation middleware
function validateTwilioWebhook(req: Request, res: Response, next: () => void) {
  // Skip validation in development if configured
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

  // Build the full URL for validation
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

twilioInboundRouter.use(validateTwilioWebhook);

// Call messages
const MESSAGES = {
  UNRECOGNIZED: "Hello, this is Ultaura. I don't recognize this phone number. If you'd like to set up phone companionship for yourself or a loved one, please visit our website. Goodbye.",
  DISABLED: "Hello, this phone line is currently disabled. Please contact your family member or caregiver to re-enable it. Goodbye.",
  TRIAL_EXPIRED: "Hello, your free trial has ended. To continue using Ultaura, please ask your family member to subscribe to a plan. Goodbye.",
  TRIAL_CAP: "Hello, you've reached your free trial's daily 20-minute limit. Please call back tomorrow, or ask your family member to subscribe for unlimited daily access. Goodbye.",
  MINUTES_CAP: "Hello, this account has reached its monthly spending cap. Please ask your family member or caregiver to adjust the cap or wait until the next billing cycle. Goodbye.",
  INBOUND_BLOCKED: "Hello, inbound calls are not enabled for this line. Please contact your family member or caregiver. Goodbye.",
  NOT_VERIFIED: "Hello, this phone number has not been verified yet. Please ask your family member to complete the verification process. Goodbye.",
  ACCOUNT_CANCELED: "Hello, the account associated with this phone number is no longer active. Goodbye.",
};

function getDeniedMessage(reason: string | undefined): string {
  switch (reason) {
    case 'disabled':
      return MESSAGES.DISABLED;
    case 'inbound_blocked':
      return MESSAGES.INBOUND_BLOCKED;
    case 'not_verified':
      return MESSAGES.NOT_VERIFIED;
    case 'trial_expired':
      return MESSAGES.TRIAL_EXPIRED;
    case 'trial_cap':
      return MESSAGES.TRIAL_CAP;
    case 'minutes_cap':
      return MESSAGES.MINUTES_CAP;
    case 'account_canceled':
      return MESSAGES.ACCOUNT_CANCELED;
    default:
      return MESSAGES.DISABLED;
  }
}

// Handle inbound voice calls from Twilio
twilioInboundRouter.post('/inbound', async (req: Request, res: Response) => {
  const { CallSid } = req.body;
  const span = trace.getActiveSpan();
  if (span && typeof CallSid === 'string') {
    span.setAttribute('twilioCallSid', CallSid);
  }
  try {
    const { From, To, CallStatus } = req.body;

    logger.info({
      from: redactPhone(From),
      to: redactPhone(To),
      twilioCallSid: CallSid,
      status: CallStatus,
    }, 'Inbound call received');

    // Format phone number to E.164
    const fromE164 = formatToE164(From);

    // Look up the line by caller ID
    const lineWithAccount = await findLineByPhone(fromE164);

    if (!lineWithAccount) {
      logger.info({ phone: redactPhone(fromE164) }, 'Unrecognized caller');
      res.type('text/xml').send(generateMessageTwiML(MESSAGES.UNRECOGNIZED));
      return;
    }

    const { line, account } = lineWithAccount;

    // Initial access check without trial reservation (session ID is not created yet).
    const accessCheck = await checkLineAccess(line, account, 'inbound', {
      skipTrialReservation: true,
    });

    if (!accessCheck.allowed) {
      logger.info({ lineId: line.id, reason: accessCheck.reason }, 'Line access denied');
      res.type('text/xml').send(generateMessageTwiML(getDeniedMessage(accessCheck.reason)));
      return;
    }

    // Create a call session
    const session = await createCallSession({
      accountId: account.id,
      lineId: line.id,
      direction: 'inbound',
      twilioCallSid: CallSid,
      twilioFrom: From,
      twilioTo: To,
    });

    if (!session) {
      logger.error({ lineId: line.id }, 'Failed to create call session');
      res.type('text/xml').send(generateMessageTwiML("I'm sorry, I'm having technical difficulties. Please try again later."));
      return;
    }

    // Reserve trial daily cap using the real call session ID (idempotent for repeated checks).
    if (account.status === 'trial') {
      const trialCapCheck = await checkLineAccess(line, account, 'inbound', {
        callSessionId: session.id,
      });

      if (!trialCapCheck.allowed) {
        logger.info(
          { lineId: line.id, callSessionId: session.id, reason: trialCapCheck.reason },
          'Trial call denied after reservation check'
        );
        await failCallSession(
          session.id,
          trialCapCheck.reason === 'trial_cap' ? 'trial_cap' : 'error',
        );
        res.type('text/xml').send(generateMessageTwiML(getDeniedMessage(trialCapCheck.reason)));
        return;
      }
    }

    updateLogContext({ callSessionId: session.id, twilioCallSid: CallSid });
    span?.setAttribute('callSessionId', session.id);

    // Generate TwiML to connect to WebSocket stream
    const websocketUrl = getWebsocketUrl();
    const twiml = generateStreamTwiML(session.id, websocketUrl, {
      includeDisclosure: false,
    });

    logger.info({ callSessionId: session.id, lineId: line.id }, 'Connecting to media stream');

    res.type('text/xml').send(twiml);
  } catch (error) {
    span?.recordException(error as Error);
    span?.setStatus({ code: SpanStatusCode.ERROR });
    logger.error({ error }, 'Error handling inbound call');
    res.type('text/xml').send(generateMessageTwiML("I'm sorry, I'm having technical difficulties. Please try again later."));
  }
});
