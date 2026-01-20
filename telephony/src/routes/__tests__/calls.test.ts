import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('../../server.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('../../services/line-lookup.js', () => ({
  getLineById: vi.fn(),
  checkLineAccess: vi.fn(),
  isInQuietHours: vi.fn(),
}));
vi.mock('../../services/call-session.js', () => ({
  createCallSession: vi.fn(),
  failCallSession: vi.fn(),
  getCallSessionByIdempotencyKey: vi.fn(),
}));
vi.mock('../../utils/twilio.js', () => ({
  initiateOutboundCall: vi.fn(),
}));
vi.mock('../../utils/env.js', () => ({
  getPublicUrl: vi.fn(),
}));
vi.mock('../../middleware/auth.js', () => ({
  requireInternalSecret: (_req: any, _res: any, next: () => void) => next(),
}));

import { callsRouter } from '../calls.js';
import { getLineById, checkLineAccess, isInQuietHours } from '../../services/line-lookup.js';
import { createCallSession } from '../../services/call-session.js';
import { initiateOutboundCall } from '../../utils/twilio.js';
import { getPublicUrl } from '../../utils/env.js';

function getPostHandler(router: Router, path: string) {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === path && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error(`POST handler not found for ${path}`);
  }
  return layer.route.stack[0].handle;
}

function createMockRes() {
  const res: any = {};
  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

const outboundHandler = getPostHandler(callsRouter, '/outbound');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getLineById).mockResolvedValue({
    line: {
      id: 'line-1',
      phone_e164: '+15551234567',
      do_not_call: false,
      timezone: 'America/Los_Angeles',
      inbound_allowed: true,
    },
    account: {
      id: 'acct-1',
      status: 'active',
      plan_id: 'care',
    },
  } as any);
  vi.mocked(checkLineAccess).mockResolvedValue({ allowed: true });
  vi.mocked(isInQuietHours).mockReturnValue(false);
  vi.mocked(createCallSession).mockResolvedValue({ id: 'session-1' } as any);
  vi.mocked(initiateOutboundCall).mockResolvedValue('CA123');
  vi.mocked(getPublicUrl).mockReturnValue('http://localhost:3001');
});

describe('calls/outbound', () => {
  it('marks reminder calls when reason is reminder and reminderId is provided', async () => {
    const res = createMockRes();

    await outboundHandler({
      body: {
        lineId: 'line-1',
        reason: 'reminder',
        reminderId: 'rem-1',
      },
    } as any, res);

    expect(createCallSession).toHaveBeenCalledWith(expect.objectContaining({
      isReminderCall: true,
      reminderId: 'rem-1',
    }));
    expect(res.body.success).toBe(true);
  });
});
