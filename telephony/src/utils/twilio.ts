// Twilio utility functions

import Twilio from 'twilio';
import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../server.js';
import { redactPhone } from './redact.js';

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
export function generateStreamTwiML(
  callSessionId: string,
  websocketUrl: string,
  options?: {
    includeDisclosure?: boolean;
    disclosureLanguage?: string;
    recordCall?: boolean;
    recordingStatusCallback?: string;
  }
): string {
  const streamUrl = `${websocketUrl}?callSessionId=${callSessionId}`;
  const includeDisclosure = options?.includeDisclosure ?? false;
  const recordCall = options?.recordCall ?? false;
  const recordingStatusCallback = options?.recordingStatusCallback;

  const disclosure = includeDisclosure
    ? buildRecordingDisclosure(options?.disclosureLanguage)
    : '';

  const recordAttribute = recordCall ? ' record="record-from-answer"' : '';
  const recordingCallback = recordCall && recordingStatusCallback
    ? ` recordingStatusCallback="${recordingStatusCallback}" recordingStatusCallbackEvent="completed"`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${disclosure}  <Connect${recordAttribute}${recordingCallback}>
    <Stream url="${streamUrl}">
      <Parameter name="callSessionId" value="${callSessionId}" />
    </Stream>
  </Connect>
</Response>`;
}

// Generate TwiML for a simple message and hangup
const TWILIO_VOICE_MAP: Record<string, { voice: string; language: string }> = {
  en: { voice: 'Polly.Joanna', language: 'en-US' },
  es: { voice: 'Polly.Lupe', language: 'es-US' },
  fr: { voice: 'Polly.Lea', language: 'fr-FR' },
  de: { voice: 'Polly.Vicki', language: 'de-DE' },
  it: { voice: 'Polly.Bianca', language: 'it-IT' },
  pt: { voice: 'Polly.Camila', language: 'pt-BR' },
  ja: { voice: 'Polly.Mizuki', language: 'ja-JP' },
  ko: { voice: 'Polly.Seoyeon', language: 'ko-KR' },
  zh: { voice: 'Polly.Zhiyu', language: 'cmn-CN' },
  default: { voice: 'Polly.Joanna', language: 'en-US' },
};

function getTwilioVoiceConfig(languageCode?: string): { voice: string; language: string } {
  if (!languageCode) {
    return TWILIO_VOICE_MAP.default;
  }

  const normalized = normalizeLanguageCode(languageCode);
  return TWILIO_VOICE_MAP[normalized] ?? TWILIO_VOICE_MAP.default;
}

export function getVoiceConfigForLanguage(languageCode?: string): { voice: string; language: string } {
  return getTwilioVoiceConfig(languageCode);
}

export function getVoiceForLanguage(languageCode?: string): string {
  return getTwilioVoiceConfig(languageCode).voice;
}

export function generateMessageTwiML(message: string, languageCode?: string): string {
  const { voice, language } = getTwilioVoiceConfig(languageCode);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}" language="${language}">${escapeXml(message)}</Say>
  <Hangup />
</Response>`;
}

// Generate TwiML to hang up without a message
export function generateHangupTwiML(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
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

function getRecordingDisclosureMessage(languageCode?: string): string {
  // TODO: Expand localization beyond English and Spanish as demographics require.
  const normalized = languageCode ? normalizeLanguageCode(languageCode) : 'en';
  if (normalized === 'es') {
    return 'Esta llamada puede ser grabada para fines de calidad.';
  }
  return 'This call may be recorded for quality purposes.';
}

function buildRecordingDisclosure(languageCode?: string): string {
  const { voice, language } = getTwilioVoiceConfig(languageCode);
  const message = getRecordingDisclosureMessage(languageCode);

  return `  <Say voice="${voice}" language="${language}">${escapeXml(message)}</Say>
  <Pause length="1" />
`;
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
  amdEnabled?: boolean;
}): Promise<string> {
  const client = getTwilioClient();
  const amdEnabled = options.amdEnabled ?? isAmdEnabled(process.env.TWILIO_AMD_ENABLED);

  const callOptions: Parameters<typeof client.calls.create>[0] = {
    to: options.to,
    from: options.from,
    url: `${options.callbackUrl}?callSessionId=${options.callSessionId}`,
    statusCallback: options.statusCallbackUrl,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST',
    ...(amdEnabled && {
      machineDetection: 'Enable',
      machineDetectionTimeout: 30,
    }),
  };

  const call = await client.calls.create(callOptions);

  logger.info({ callSid: call.sid, to: redactPhone(options.to) }, 'Outbound call initiated');

  return call.sid;
}

const AMD_DISABLED_VALUES = new Set(['false', '0', 'no']);

function isAmdEnabled(value?: string): boolean {
  if (!value) {
    return true;
  }

  return !AMD_DISABLED_VALUES.has(value.toLowerCase());
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

  logger.info({ phone: redactPhone(phoneNumber), channel, sid: verification.sid }, 'Verification sent');

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
    logger.info({ phone: redactPhone(phoneNumber), approved }, 'Verification check completed');

    return approved;
  } catch (error) {
    logger.error({ error, phone: redactPhone(phoneNumber) }, 'Verification check failed');
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

  logger.info({ messageSid: message.sid, to: redactPhone(options.to) }, 'SMS sent');
    return message.sid;
  } catch (error) {
    logger.error({ error, to: redactPhone(options.to) }, 'Failed to send SMS');
    throw error;
  }
}
