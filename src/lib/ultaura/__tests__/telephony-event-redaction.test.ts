import { describe, it, expect } from 'vitest';

// Test the webhook payload redaction logic
// Mirrors the logic in telephony/src/services/telephony-event-log.ts

const REDACTED_ALLOWLIST = new Set([
  'CallSid', 'AccountSid', 'ParentCallSid', 'RecordingSid', 'StreamSid',
  'ConferenceSid', 'CallStatus', 'ApiVersion', 'Direction', 'CallDuration',
  'Duration', 'RecordingDuration', 'RecordingStatus', 'RecordingSource',
  'RecordingChannels', 'AnsweredBy', 'MachineDetectionDuration', 'Timestamp',
  'SequenceNumber', 'StatusCallbackEvent', 'ErrorCode', 'ErrorUrl',
  'Digits', 'FinishedOnKey', 'SpeechResult',
]);

const PHONE_FIELDS = new Set([
  'From', 'To', 'Caller', 'Called', 'ForwardedFrom', 'CalledVia',
  'FromCity', 'FromState', 'FromZip', 'FromCountry',
  'ToCity', 'ToState', 'ToZip', 'ToCountry',
]);

const STRIP_FIELDS = new Set([
  'CallerName', 'RecordingUrl', 'RecordingTrack', 'TranscriptionText',
  'TranscriptionUrl', 'TranscriptionSid', 'TranscriptionStatus', 'SpeechResult',
]);

function maskPhone(value: string): string {
  if (!value || value.length < 4) return '****';
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

function redactPayload(raw: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (STRIP_FIELDS.has(key)) continue;
    if (PHONE_FIELDS.has(key) && typeof value === 'string') {
      redacted[key] = maskPhone(value);
      continue;
    }
    if (REDACTED_ALLOWLIST.has(key)) {
      redacted[key] = value;
      continue;
    }
    redacted[key] = '[redacted]';
  }
  return redacted;
}

describe('telephony event payload redaction', () => {
  const samplePayload: Record<string, unknown> = {
    CallSid: 'CA1234567890abcdef',
    AccountSid: 'AC1234567890abcdef',
    CallStatus: 'completed',
    Direction: 'outbound-api',
    Duration: '120',
    From: '+15551234567',
    To: '+15559876543',
    Caller: '+15551234567',
    Called: '+15559876543',
    CallerName: 'John Doe',
    RecordingUrl: 'https://api.twilio.com/recordings/RE123',
    ApiVersion: '2010-04-01',
    SomeUnknownField: 'secret-data',
  };

  it('keeps SIDs and status fields unchanged', () => {
    const result = redactPayload(samplePayload);
    expect(result.CallSid).toBe('CA1234567890abcdef');
    expect(result.AccountSid).toBe('AC1234567890abcdef');
    expect(result.CallStatus).toBe('completed');
    expect(result.Direction).toBe('outbound-api');
    expect(result.Duration).toBe('120');
    expect(result.ApiVersion).toBe('2010-04-01');
  });

  it('masks phone numbers showing only last 4 digits', () => {
    const result = redactPayload(samplePayload);
    expect(result.From).toBe('********4567');
    expect(result.To).toBe('********6543');
    expect(result.Caller).toBe('********4567');
    expect(result.Called).toBe('********6543');
  });

  it('completely strips sensitive fields', () => {
    const result = redactPayload(samplePayload);
    expect(result).not.toHaveProperty('CallerName');
    expect(result).not.toHaveProperty('RecordingUrl');
  });

  it('redacts unknown fields', () => {
    const result = redactPayload(samplePayload);
    expect(result.SomeUnknownField).toBe('[redacted]');
  });

  it('handles empty payload', () => {
    const result = redactPayload({});
    expect(result).toEqual({});
  });

  it('handles short phone numbers gracefully', () => {
    const result = redactPayload({ From: '+1' });
    expect(result.From).toBe('****');
  });

  it('handles non-string phone field values', () => {
    const result = redactPayload({ From: 12345 as unknown as string });
    // Non-string phone fields get treated as unknown → redacted
    expect(result.From).toBe('[redacted]');
  });

  it('preserves error-related fields', () => {
    const errorPayload = {
      CallSid: 'CA123',
      ErrorCode: '21215',
      ErrorUrl: 'https://www.twilio.com/docs/errors/21215',
    };
    const result = redactPayload(errorPayload);
    expect(result.ErrorCode).toBe('21215');
    expect(result.ErrorUrl).toBe('https://www.twilio.com/docs/errors/21215');
  });
});
