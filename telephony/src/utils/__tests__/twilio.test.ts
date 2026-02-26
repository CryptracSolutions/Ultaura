import { beforeEach, describe, expect, it, vi } from 'vitest';

const twilioMessagesCreate = vi.hoisted(() => vi.fn());
const twilioValidateRequest = vi.hoisted(() => vi.fn());
const twilioFactory = vi.hoisted(() =>
  vi.fn(() => ({
    messages: {
      create: twilioMessagesCreate,
    },
  }))
);
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
const getSupabaseClient = vi.hoisted(() => vi.fn());
const supabaseFrom = vi.hoisted(() => vi.fn());
const supabaseSelect = vi.hoisted(() => vi.fn());
const supabaseEq = vi.hoisted(() => vi.fn());
const supabaseMaybeSingle = vi.hoisted(() => vi.fn());

vi.mock('twilio', () => {
  const MockTwilio = Object.assign(twilioFactory, {
    validateRequest: twilioValidateRequest,
  });

  return { default: MockTwilio };
});

vi.mock('../../server.js', () => ({
  logger: loggerMock,
}));

vi.mock('../supabase.js', () => ({
  getSupabaseClient,
}));

import {
  sendSms,
  SMS_OPT_OUT_ERROR_MESSAGE,
  SMS_OPT_OUT_LOOKUP_UNAVAILABLE_ERROR_MESSAGE,
} from '../twilio.js';

describe('sendSms', () => {
  const smsOptions = {
    to: '+15551234567',
    body: 'Test message',
  } as const;

  function expectTwilioMessageCreateCalled(): void {
    expect(twilioMessagesCreate).toHaveBeenCalledWith({
      to: smsOptions.to,
      from: '+10000000000',
      body: smsOptions.body,
    });
  }

  function mockOptOutLookupResult(
    data: { id: string } | null,
    error: { message: string } | null
  ): void {
    supabaseMaybeSingle.mockResolvedValueOnce({ data, error });
  }

  beforeEach(() => {
    twilioMessagesCreate.mockReset();
    twilioValidateRequest.mockReset();
    twilioFactory.mockClear();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
    loggerMock.debug.mockReset();
    getSupabaseClient.mockReset();
    supabaseFrom.mockReset();
    supabaseSelect.mockReset();
    supabaseEq.mockReset();
    supabaseMaybeSingle.mockReset();

    const queryBuilder = {
      select: supabaseSelect,
      eq: supabaseEq,
      maybeSingle: supabaseMaybeSingle,
    };
    supabaseSelect.mockReturnValue(queryBuilder);
    supabaseEq.mockReturnValue(queryBuilder);
    supabaseFrom.mockReturnValue(queryBuilder);
    getSupabaseClient.mockReturnValue({ from: supabaseFrom });

    twilioMessagesCreate.mockResolvedValue({ sid: 'SM123' });
  });

  it('blocks sends for opted-out recipients and does not call Twilio', async () => {
    mockOptOutLookupResult({ id: 'opt-out-1' }, null);

    await expect(sendSms(smsOptions)).rejects.toThrow(SMS_OPT_OUT_ERROR_MESSAGE);

    expect(twilioMessagesCreate).not.toHaveBeenCalled();
  });

  it('sends SMS when recipient is not opted out', async () => {
    mockOptOutLookupResult(null, null);

    const sid = await sendSms(smsOptions);

    expect(sid).toBe('SM123');
    expectTwilioMessageCreateCalled();
  });

  it('fails closed when opt-out lookup errors and does not call Twilio', async () => {
    mockOptOutLookupResult(null, { message: 'db unavailable' });

    await expect(sendSms(smsOptions)).rejects.toThrow(
      SMS_OPT_OUT_LOOKUP_UNAVAILABLE_ERROR_MESSAGE
    );

    expect(twilioMessagesCreate).not.toHaveBeenCalled();
    expect(loggerMock.error).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'db unavailable' }),
      }),
      SMS_OPT_OUT_LOOKUP_UNAVAILABLE_ERROR_MESSAGE
    );
  });

  it('bypasses opt-out lookup when skipOptOutCheck is true', async () => {
    const sid = await sendSms({
      ...smsOptions,
      skipOptOutCheck: true,
    });

    expect(sid).toBe('SM123');
    expect(supabaseFrom).not.toHaveBeenCalled();
    expectTwilioMessageCreateCalled();
  });
});
