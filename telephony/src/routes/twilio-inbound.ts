// Twilio inbound call webhook handler

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { findLineByPhone, checkLineAccess } from '../services/line-lookup.js';
import { getLastDetectedLanguageForLine } from '../services/language.js';
import { getAccountPrivacySettings } from '../services/privacy.js';
import { createCallSession } from '../services/call-session.js';
import { generateStreamTwiML, generateMessageTwiML, formatToE164, validateTwilioSignature } from '../utils/twilio.js';
import { getPublicUrl, getWebsocketUrl } from '../utils/env.js';
import { redactPhone } from '../utils/redact.js';

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
  MINUTES_CAP: "Hello, this account has reached its monthly spending cap. Please ask your family member or caregiver to adjust the cap or wait until the next billing cycle. Goodbye.",
  INBOUND_BLOCKED: "Hello, inbound calls are not enabled for this line. Please contact your family member or caregiver. Goodbye.",
  NOT_VERIFIED: "Hello, this phone number has not been verified yet. Please ask your family member to complete the verification process. Goodbye.",
  ACCOUNT_CANCELED: "Hello, the account associated with this phone number is no longer active. Goodbye.",
};

// Handle inbound voice calls from Twilio
twilioInboundRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    const { From, To, CallSid, CallStatus } = req.body;

    logger.info({
      from: redactPhone(From),
      to: redactPhone(To),
      callSid: CallSid,
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

    // Check if the line can receive calls
    const accessCheck = await checkLineAccess(line, account, 'inbound');

    if (!accessCheck.allowed) {
      logger.info({ lineId: line.id, reason: accessCheck.reason }, 'Line access denied');

      let message: string;
      switch (accessCheck.reason) {
        case 'disabled':
          message = MESSAGES.DISABLED;
          break;
        case 'inbound_blocked':
          message = MESSAGES.INBOUND_BLOCKED;
          break;
        case 'not_verified':
          message = MESSAGES.NOT_VERIFIED;
          break;
        case 'trial_expired':
          message = MESSAGES.TRIAL_EXPIRED;
          break;
        case 'minutes_cap':
          message = MESSAGES.MINUTES_CAP;
          break;
        case 'account_canceled':
          message = MESSAGES.ACCOUNT_CANCELED;
          break;
        default:
          message = MESSAGES.DISABLED;
      }

      res.type('text/xml').send(generateMessageTwiML(message));
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

    const privacySettings = await getAccountPrivacySettings(account.id);
    const recordingActive = process.env.ULTAURA_ENABLE_RECORDING === 'true' &&
      !!privacySettings?.recordingEnabled;
    const startingLanguage = await getLastDetectedLanguageForLine(line.id);
    const publicUrl = getPublicUrl().replace(/\/$/, '');

    // Generate TwiML to connect to WebSocket stream
    const websocketUrl = getWebsocketUrl();
    const twiml = generateStreamTwiML(session.id, websocketUrl, {
      includeDisclosure: true,
      disclosureLanguage: startingLanguage || undefined,
      recordCall: recordingActive,
      recordingStatusCallback: recordingActive ? `${publicUrl}/twilio/recording-status` : undefined,
    });

    logger.info({ sessionId: session.id, lineId: line.id }, 'Connecting to media stream');

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error }, 'Error handling inbound call');
    res.type('text/xml').send(generateMessageTwiML("I'm sorry, I'm having technical difficulties. Please try again later."));
  }
});
