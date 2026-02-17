import crypto from 'crypto';
import { getSupabaseClient } from '../utils/supabase';
import { logger } from '../utils/logger';

// --- Redaction policy for Twilio webhook payloads ---
// strip: transcription, caller name, recordings, speech-to-text, digits
// mask:  phone numbers (show last 4 digits)
// allow: SIDs, timestamps, status, event types, durations, error codes, geographic

// Fields safe to keep unredacted in the sanitized payload
const REDACTED_ALLOWLIST = new Set([
  // Identifiers (not PII, needed for debugging)
  'CallSid',
  'AccountSid',
  'ParentCallSid',
  'RecordingSid',
  'StreamSid',
  'ConferenceSid',
  // Status and metadata
  'CallStatus',
  'ApiVersion',
  'Direction',
  'CallDuration',
  'Duration',
  'RecordingDuration',
  'RecordingStatus',
  'RecordingSource',
  'RecordingChannels',
  'AnsweredBy',
  'MachineDetectionDuration',
  'Timestamp',
  'SequenceNumber',
  'StatusCallbackEvent',
  'ErrorCode',
  'ErrorUrl',
  'FinishedOnKey',
  // Geographic (useful for carrier routing diagnostics, not strongly identifying)
  'FromCity',
  'FromState',
  'FromCountry',
  'ToCity',
  'ToState',
  'ToCountry',
]);

// Fields to mask (show last 4 chars only) — phone numbers
const PHONE_FIELDS = new Set([
  'From',
  'To',
  'Caller',
  'Called',
  'ForwardedFrom',
  'CalledVia',
]);

// Fields to always strip — sensitive content, PII, recordings
const STRIP_FIELDS = new Set([
  'CallerName',
  'RecordingUrl',
  'RecordingTrack',
  'TranscriptionText',
  'TranscriptionUrl',
  'TranscriptionSid',
  'TranscriptionStatus',
  'SpeechResult',
  'Digits',
  'FromZip',
  'ToZip',
]);

function maskPhone(value: string): string {
  if (!value || value.length < 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

function redactPayload(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (STRIP_FIELDS.has(key)) {
      continue;
    }

    if (PHONE_FIELDS.has(key) && typeof value === 'string') {
      redacted[key] = maskPhone(value);
      continue;
    }

    if (REDACTED_ALLOWLIST.has(key)) {
      redacted[key] = value;
      continue;
    }

    // Unknown fields: include the key but redact the value
    redacted[key] = '[redacted]';
  }

  return redacted;
}

// --- Payload encryption (AES-256-GCM) ---
// Uses ULTAURA_ENCRYPTION_KEY (same KEK used for memory encryption).
// If the key is unavailable, encryption is skipped and payload_ciphertext is null.
const ENC_ALGORITHM = 'aes-256-gcm';
const ENC_IV_LENGTH = 12;
const ENC_TAG_LENGTH = 16;

function getPayloadKey(): Buffer | null {
  const hex = process.env.ULTAURA_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

function encryptPayload(raw: Record<string, unknown>): Buffer | null {
  const key = getPayloadKey();
  if (!key) return null;

  try {
    const plaintext = Buffer.from(JSON.stringify(raw), 'utf8');
    const iv = crypto.randomBytes(ENC_IV_LENGTH);
    const cipher = crypto.createCipheriv(ENC_ALGORITHM, key, iv, {
      authTagLength: ENC_TAG_LENGTH,
    });
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Pack as iv || ciphertext || tag for single-column storage
    return Buffer.concat([iv, ciphertext, tag]);
  } catch (err) {
    logger.error({ err }, 'Failed to encrypt telephony payload');
    return null;
  }
}

type Severity = 'info' | 'warn' | 'error';

interface LogTelephonyEventOptions {
  accountId?: string;
  lineId?: string;
  callSessionId?: string;
  eventType: string;
  providerId?: string;
  payload: Record<string, unknown>;
  severity?: Severity;
}

export async function logTelephonyEvent(
  opts: LogTelephonyEventOptions,
): Promise<void> {
  try {
    const client = getSupabaseClient();
    const payloadRedacted = redactPayload(opts.payload);
    const payloadCiphertext = encryptPayload(opts.payload);

    const { error } = await client
      .from('ultaura_telephony_event_log' as any)
      .insert({
        account_id: opts.accountId ?? null,
        line_id: opts.lineId ?? null,
        call_session_id: opts.callSessionId ?? null,
        provider: 'twilio',
        event_type: opts.eventType,
        provider_id: opts.providerId ?? null,
        payload_ciphertext: payloadCiphertext,
        payload_redacted: payloadRedacted,
        severity: opts.severity ?? 'info',
      });

    if (error) {
      logger.error(
        { error, eventType: opts.eventType },
        'Failed to insert telephony event log',
      );
    }
  } catch (err) {
    logger.error(
      { err, eventType: opts.eventType },
      'Exception inserting telephony event log',
    );
  }
}

export { redactPayload };
