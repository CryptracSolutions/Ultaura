// Twilio inbound call webhook handler

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { findLineByPhone, checkLineAccess } from '../services/line-lookup.js';
import { createCallSession } from '../services/call-session.js';
import { generateStreamTwiML, generateMessageTwiML, formatToE164 } from '../utils/twilio.js';

export const twilioInboundRouter = Router();

// Call messages
const MESSAGES = {
  UNRECOGNIZED: "Hello, this is Ultaura. I don't recognize this phone number. If you'd like to set up phone companionship for yourself or a loved one, please visit our website. Goodbye.",
  DISABLED: "Hello, this phone line is currently disabled. Please contact your family member or caregiver to re-enable it. Goodbye.",
  MINUTES_EXHAUSTED: "Hello, your free trial minutes have been used up. To continue using Ultaura, please ask your family member to upgrade your plan. I hope we can talk again soon. Goodbye.",
  INBOUND_BLOCKED: "Hello, inbound calls are not enabled for this line. Please contact your family member or caregiver. Goodbye.",
  NOT_VERIFIED: "Hello, this phone number has not been verified yet. Please ask your family member to complete the verification process. Goodbye.",
  ACCOUNT_CANCELED: "Hello, the account associated with this phone number is no longer active. Goodbye.",
};

// Handle inbound voice calls from Twilio
twilioInboundRouter.post('/inbound', async (req: Request, res: Response) => {
  try {
    const { From, To, CallSid, CallStatus } = req.body;

    logger.info({ from: From, to: To, callSid: CallSid, status: CallStatus }, 'Inbound call received');

    // Format phone number to E.164
    const fromE164 = formatToE164(From);

    // Look up the line by caller ID
    const lineWithAccount = await findLineByPhone(fromE164);

    if (!lineWithAccount) {
      logger.info({ phone: fromE164 }, 'Unrecognized caller');
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
        case 'minutes_exhausted':
          message = MESSAGES.MINUTES_EXHAUSTED;
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

    // Generate TwiML to connect to WebSocket stream
    const websocketUrl = process.env.TELEPHONY_WEBSOCKET_URL || `wss://${req.headers.host}/twilio/media`;
    const twiml = generateStreamTwiML(session.id, websocketUrl);

    logger.info({ sessionId: session.id, lineId: line.id }, 'Connecting to media stream');

    res.type('text/xml').send(twiml);
  } catch (error) {
    logger.error({ error }, 'Error handling inbound call');
    res.type('text/xml').send(generateMessageTwiML("I'm sorry, I'm having technical difficulties. Please try again later."));
  }
});
