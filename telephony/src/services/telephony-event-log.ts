import { getSupabaseClient } from '../utils/supabase';
import { logger } from '../utils/logger';

// Fields safe to keep in the redacted payload
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
  // Event-specific
  'Digits',
  'FinishedOnKey',
  'SpeechResult',
]);

// Fields to mask (show last 4 chars only)
const PHONE_FIELDS = new Set([
  'From',
  'To',
  'Caller',
  'Called',
  'ForwardedFrom',
  'CalledVia',
  'FromCity',
  'FromState',
  'FromZip',
  'FromCountry',
  'ToCity',
  'ToState',
  'ToZip',
  'ToCountry',
]);

// Fields to always strip
const STRIP_FIELDS = new Set([
  'CallerName',
  'RecordingUrl',
  'RecordingTrack',
  'TranscriptionText',
  'TranscriptionUrl',
  'TranscriptionSid',
  'TranscriptionStatus',
  'SpeechResult',
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

    const { error } = await client
      .from('ultaura_telephony_event_log')
      .insert({
        account_id: opts.accountId ?? null,
        line_id: opts.lineId ?? null,
        call_session_id: opts.callSessionId ?? null,
        provider: 'twilio',
        event_type: opts.eventType,
        provider_id: opts.providerId ?? null,
        payload: opts.payload,
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
