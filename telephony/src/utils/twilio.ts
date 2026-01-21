// Twilio utility functions

import Twilio from 'twilio';
import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../server.js';
import { generateStreamToken } from '../services/stream-token.js';
import { redactPhone } from './redact.js';
import { getSupabaseClient } from './supabase.js';

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
  }
): string {
  const token = generateStreamToken(callSessionId);
  const streamUrl = `${websocketUrl}?callSessionId=${callSessionId}&token=${token}`;
  const includeDisclosure = options?.includeDisclosure ?? false;

  const disclosure = includeDisclosure
    ? buildRecordingDisclosure(options?.disclosureLanguage)
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
${disclosure}  <Connect>
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
  nl: { voice: 'Google.nl-NL-Standard-F', language: 'nl-NL' },
  ru: { voice: 'Google.ru-RU-Standard-A', language: 'ru-RU' },
  uk: { voice: 'Google.uk-UA-Standard-A', language: 'uk-UA' },
  ar: { voice: 'Polly.Hala-Neural', language: 'ar-AE' },
  hi: { voice: 'Google.hi-IN-Standard-A', language: 'hi-IN' },
  tr: { voice: 'Google.tr-TR-Standard-A', language: 'tr-TR' },
  pl: { voice: 'Google.pl-PL-Standard-F', language: 'pl-PL' },
  sv: { voice: 'Google.sv-SE-Standard-F', language: 'sv-SE' },
  da: { voice: 'Google.da-DK-Standard-F', language: 'da-DK' },
  no: { voice: 'Google.nb-NO-Standard-F', language: 'nb-NO' },
  fi: { voice: 'Google.fi-FI-Standard-B', language: 'fi-FI' },
  cs: { voice: 'Google.cs-CZ-Standard-B', language: 'cs-CZ' },
  th: { voice: 'Google.th-TH-Standard-A', language: 'th-TH' },
  vi: { voice: 'Google.vi-VN-Standard-A', language: 'vi-VN' },
  id: { voice: 'Google.id-ID-Standard-A', language: 'id-ID' },
  ms: { voice: 'Google.ms-MY-Standard-A', language: 'ms-MY' },
  tl: { voice: 'Google.fil-PH-Standard-A', language: 'fil-PH' },
  el: { voice: 'Google.el-GR-Standard-B', language: 'el-GR' },
  he: { voice: 'Google.he-IL-Standard-A', language: 'he-IL' },
  ro: { voice: 'Google.ro-RO-Standard-B', language: 'ro-RO' },
  hu: { voice: 'Google.hu-HU-Standard-B', language: 'hu-HU' },
  cmn: { voice: 'Polly.Zhiyu', language: 'cmn-CN' },
  fil: { voice: 'Google.fil-PH-Standard-A', language: 'fil-PH' },
  nb: { voice: 'Google.nb-NO-Standard-F', language: 'nb-NO' },
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

export async function startRecordingForCall(options: {
  callSid: string;
  recordingStatusCallback?: string;
}): Promise<string | null> {
  const client = getTwilioClient();
  try {
    const recording = await client.calls(options.callSid).recordings.create({
      recordingStatusCallback: options.recordingStatusCallback,
      recordingStatusCallbackEvent: options.recordingStatusCallback ? ['completed'] : undefined,
    });
    return recording.sid || null;
  } catch (error) {
    logger.error({ error, twilioCallSid: options.callSid }, 'Failed to start call recording');
    return null;
  }
}

export async function stopRecordingForCall(options: {
  callSid: string;
  recordingSid: string;
}): Promise<boolean> {
  const client = getTwilioClient();
  try {
    await client
      .calls(options.callSid)
      .recordings(options.recordingSid)
      .update({ status: 'stopped' });
    return true;
  } catch (error) {
    logger.error({
      error,
      recordingSid: options.recordingSid,
      twilioCallSid: options.callSid,
    }, 'Failed to stop call recording');
    return false;
  }
}

export async function pauseRecordingForCall(options: {
  callSid: string;
  recordingSid: string;
}): Promise<boolean> {
  const client = getTwilioClient();
  try {
    await client
      .calls(options.callSid)
      .recordings(options.recordingSid)
      .update({ status: 'paused' });
    return true;
  } catch (error) {
    logger.error({
      error,
      recordingSid: options.recordingSid,
      twilioCallSid: options.callSid,
    }, 'Failed to pause call recording');
    return false;
  }
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
  const normalized = normalizeLanguageCode(languageCode || 'en');

  const messages: Record<string, string> = {
    en: 'This call may be recorded for quality purposes.',
    es: 'Esta llamada puede ser grabada para fines de calidad.',
    fr: "Cet appel peut être enregistré à des fins de qualité.",
    de: 'Dieser Anruf kann zu Qualitätszwecken aufgezeichnet werden.',
    it: 'Questa chiamata può essere registrata a fini di qualità.',
    pt: 'Esta chamada pode ser gravada para fins de qualidade.',
    ja: 'この通話は品質向上のため録音される場合があります。',
    ko: '이 통화는 품질 향상을 위해 녹음될 수 있습니다.',
    zh: '此通话可能会被录音用于质量改进。',
    nl: 'Dit gesprek kan worden opgenomen voor kwaliteitsdoeleinden.',
    ru: 'Этот звонок может быть записан в целях контроля качества.',
    ar: 'قد يتم تسجيل هذه المكالمة لأغراض الجودة.',
    hi: 'गुणवत्ता के उद्देश्य से यह कॉल रिकॉर्ड की जा सकती है।',
    tr: 'Bu arama kalite amaçları için kaydedilebilir.',
    pl: 'Ta rozmowa może być nagrywana w celach jakościowych.',
    sv: 'Det här samtalet kan spelas in i kvalitetssyfte.',
    da: 'Dette opkald kan blive optaget til kvalitetsformål.',
    no: 'Denne samtalen kan bli tatt opp for kvalitetsformål.',
    fi: 'Tämä puhelu voidaan tallentaa laatutarkoituksiin.',
    cs: 'Tento hovor může být nahráván pro účely kvality.',
    th: 'การสนทนานี้อาจถูกบันทึกเพื่อวัตถุประสงค์ด้านคุณภาพ',
    vi: 'Cuộc gọi này có thể được ghi âm cho mục đích chất lượng.',
    id: 'Panggilan ini dapat direkam untuk tujuan kualitas.',
    ms: 'Panggilan ini mungkin dirakam untuk tujuan kualiti.',
    tl: 'Maaaring i-record ang tawag na ito para sa layunin ng kalidad.',
    uk: 'Цей дзвінок може бути записаний для контролю якості.',
    el: 'Η κλήση αυτή ενδέχεται να καταγραφεί για σκοπούς ποιότητας.',
    he: 'ייתכן שהשיחה הזו תוקלט למטרות איכות.',
    ro: 'Acest apel poate fi înregistrat în scopuri de calitate.',
    hu: 'Ezt a hívást minőségi célokból rögzíthetjük.',
  };

  return messages[normalized] ?? messages.en;
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

  logger.info({ twilioCallSid: call.sid, to: redactPhone(options.to) }, 'Outbound call initiated');

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
  skipOptOutCheck?: boolean;
}): Promise<string> {
  if (!options.skipOptOutCheck) {
    const isOptedOut = await checkSmsOptOut(options.to);
    if (isOptedOut) {
      logger.info({ to: redactPhone(options.to) }, 'SMS blocked due to opt-out');
      throw new Error('Recipient has opted out of SMS');
    }
  }

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

async function checkSmsOptOut(phoneE164: string): Promise<boolean> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('ultaura_sms_opt_outs')
    .select('id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();

  if (error) {
    logger.error({ error, phone: redactPhone(phoneE164) }, 'Failed to check SMS opt-out status');
    return false;
  }

  return !!data;
}
