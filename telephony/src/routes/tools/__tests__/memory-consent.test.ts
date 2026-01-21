import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('../../../server.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../services/call-session.js', () => ({
  getCallSession: vi.fn(),
  incrementToolInvocations: vi.fn(),
  recordCallEvent: vi.fn(),
}));

vi.mock('../../../services/privacy.js', () => ({
  getAccountPrivacySettings: vi.fn(),
  getLineVoiceConsent: vi.fn(),
}));

vi.mock('../../../services/memory.js', () => ({
  storeMemory: vi.fn(),
  updateMemory: vi.fn(),
  getMemoriesForLine: vi.fn(),
  searchMemoriesSemantic: vi.fn(),
  markMemoriesAccessed: vi.fn(),
}));

import { storeMemoryRouter } from '../store-memory.js';
import { updateMemoryRouter } from '../update-memory.js';
import { reviewMemoriesRouter } from '../review-memories.js';
import { getCallSession, recordCallEvent } from '../../../services/call-session.js';
import { getAccountPrivacySettings, getLineVoiceConsent } from '../../../services/privacy.js';
import { storeMemory, updateMemory, getMemoriesForLine } from '../../../services/memory.js';

const CALL_SESSION_ID = '00000000-0000-0000-0000-000000000010';
const LINE_ID = '00000000-0000-0000-0000-000000000020';

function getPostHandler(router: Router) {
  const layer = (router as any).stack.find((stackLayer: any) => (
    stackLayer.route?.path === '/' && stackLayer.route?.methods?.post
  ));
  if (!layer) {
    throw new Error('POST handler not found');
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

const storeHandler = getPostHandler(storeMemoryRouter);
const updateHandler = getPostHandler(updateMemoryRouter);
const reviewHandler = getPostHandler(reviewMemoriesRouter);

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(getCallSession).mockResolvedValue({
    id: CALL_SESSION_ID,
    line_id: LINE_ID,
    account_id: 'account-1',
    created_at: '2026-01-12T00:00:00.000Z',
    is_test_call: false,
  } as any);

  vi.mocked(getAccountPrivacySettings).mockResolvedValue({ aiSummarizationEnabled: true } as any);
  vi.mocked(getLineVoiceConsent).mockResolvedValue({ memoryConsent: 'pending' } as any);
});

describe('memory consent enforcement', () => {
  it('rejects store_memory pre-consent', async () => {
    const res = createMockRes();

    await storeHandler({
      body: {
        callSessionId: CALL_SESSION_ID,
        lineId: LINE_ID,
        memoryType: 'fact',
        key: 'preferred_name',
        value: 'Alice',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(vi.mocked(storeMemory)).not.toHaveBeenCalled();
    expect(vi.mocked(recordCallEvent)).toHaveBeenCalledWith(
      CALL_SESSION_ID,
      'tool_call',
      expect.objectContaining({
        tool: 'store_memory',
        success: false,
        errorCode: 'consent_not_granted',
      }),
      expect.anything()
    );
  });

  it('rejects update_memory pre-consent', async () => {
    const res = createMockRes();

    await updateHandler({
      body: {
        callSessionId: CALL_SESSION_ID,
        lineId: LINE_ID,
        existingKey: 'preferred_name',
        newValue: 'Alice',
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(vi.mocked(updateMemory)).not.toHaveBeenCalled();
    expect(vi.mocked(recordCallEvent)).toHaveBeenCalledWith(
      CALL_SESSION_ID,
      'tool_call',
      expect.objectContaining({
        tool: 'update_memory',
        success: false,
        errorCode: 'consent_not_granted',
      }),
      expect.anything()
    );
  });

  it('rejects review_memories pre-consent', async () => {
    const res = createMockRes();

    await reviewHandler({
      body: {
        callSessionId: CALL_SESSION_ID,
        lineId: LINE_ID,
      },
    } as any, res);

    expect(res.body.success).toBe(false);
    expect(vi.mocked(getMemoriesForLine)).not.toHaveBeenCalled();
    expect(vi.mocked(recordCallEvent)).toHaveBeenCalledWith(
      CALL_SESSION_ID,
      'tool_call',
      expect.objectContaining({
        tool: 'review_memories',
        success: false,
        errorCode: 'consent_not_granted',
      }),
      expect.anything()
    );
  });
});

