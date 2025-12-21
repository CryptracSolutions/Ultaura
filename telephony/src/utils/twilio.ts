// Twilio utility functions

import Twilio from 'twilio';
import { logger } from '../server.js';

let twilioClient: Twilio.Twilio | null = null;

export function getTwilioClient(): Twilio.Twilio {
  if (twilioClient) {
    return twilioClient;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN environment variables');
  }

  twilioClient = Twilio(accountSid, authToken);
  return twilioClient;
}

// Validate Twilio webhook signature
export function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!authToken) {
    logger.error('Missing TWILIO_AUTH_TOKEN for signature validation');
    return false;
  }

  return Twilio.validateRequest(authToken, signature, url, params);
}

// Format phone number to E.164
export function formatToE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and is 11 digits (US), add +
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it's 10 digits (US without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise, assume it's already in E.164 format (just needs +)
  if (!phone.startsWith('+')) {
    return `+${digits}`;
  }

  return phone;
}

// Validate US phone number
export function isValidUSPhone(phone: string): boolean {
  const e164 = formatToE164(phone);
  // US E.164 format: +1 followed by 10 digits, area code can't start with 0 or 1
  return /^\+1[2-9]\d{9}$/.test(e164);
}

// Generate TwiML for connecting to WebSocket stream
export function generateStreamTwiML(callSessionId: string, websocketUrl: string): string {
  const streamUrl = `${websocketUrl}?callSessionId=${callSessionId}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}">
      <Parameter name="callSessionId" value="${callSessionId}" />
    </Stream>
  </Connect>
</Response>`;
}

// Generate TwiML for a simple message and hangup
export function generateMessageTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(message)}</Say>
  <Hangup />
</Response>`;
}

// Generate TwiML for hold message
export function generateHoldTwiML(message: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${escapeXml(message)}</Say>
  <Pause length="2" />
</Response>`;
}

// Escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Initiate an outbound call
export async function initiateOutboundCall(options: {
  to: string;
  from: string;
  callbackUrl: string;
  statusCallbackUrl: string;
  callSessionId: string;
}): Promise<string> {
  const client = getTwilioClient();

  const call = await client.calls.create({
    to: options.to,
    from: options.from,
    url: `${options.callbackUrl}?callSessionId=${options.callSessionId}`,
    statusCallback: options.statusCallbackUrl,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
  });

  logger.info({ callSid: call.sid, to: options.to }, 'Outbound call initiated');

  return call.sid;
}

// Send verification code via Twilio Verify
export async function sendVerificationCode(
  phoneNumber: string,
  channel: 'sms' | 'call'
): Promise<string> {
  const client = getTwilioClient();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!verifyServiceSid) {
    throw new Error('Missing TWILIO_VERIFY_SERVICE_SID environment variable');
  }

  const verification = await client.verify.v2
    .services(verifyServiceSid)
    .verifications.create({
      to: phoneNumber,
      channel,
    });

  logger.info({ phone: phoneNumber, channel, sid: verification.sid }, 'Verification sent');

  return verification.sid;
}

// Check verification code
export async function checkVerificationCode(
  phoneNumber: string,
  code: string
): Promise<boolean> {
  const client = getTwilioClient();
  const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

  if (!verifyServiceSid) {
    throw new Error('Missing TWILIO_VERIFY_SERVICE_SID environment variable');
  }

  try {
    const verificationCheck = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code,
      });

    const approved = verificationCheck.status === 'approved';
    logger.info({ phone: phoneNumber, approved }, 'Verification check completed');

    return approved;
  } catch (error) {
    logger.error({ error, phone: phoneNumber }, 'Verification check failed');
    return false;
  }
}

// Send SMS message
export async function sendSms(options: {
  to: string;
  body: string;
}): Promise<string> {
  const client = getTwilioClient();
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!from) {
    throw new Error('Missing TWILIO_PHONE_NUMBER environment variable');
  }

  try {
    const message = await client.messages.create({
      to: options.to,
      from,
      body: options.body,
    });

    logger.info({ messageSid: message.sid, to: options.to }, 'SMS sent');
    return message.sid;
  } catch (error) {
    logger.error({ error, to: options.to }, 'Failed to send SMS');
    throw error;
  }
}
