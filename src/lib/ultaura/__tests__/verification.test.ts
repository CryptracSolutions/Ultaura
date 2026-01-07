import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { checkPhoneVerification, startPhoneVerification } from '../verification';
import { cleanupTestData, createTestAccount, createTestLine, testServiceRoleClient } from './setup';

describe('verification', () => {
  let accountId: string;
  let organizationId: number;
  let userId: string;
  let lineId: string;

  beforeAll(async () => {
    const context = await createTestAccount();
    accountId = context.account.id;
    organizationId = context.organization.id;
    userId = context.user.id;

    const line = await createTestLine(accountId, {
      status: 'paused',
      phone_verified_at: null,
    });
    lineId = line.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await cleanupTestData({ accountId, organizationId, userId });
  });

  it('starts and completes phone verification', async () => {
    const sendMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', sendMock as unknown as typeof fetch);

    const startResult = await startPhoneVerification(lineId, 'sms');
    expect(startResult.success).toBe(true);
    expect(sendMock).toHaveBeenCalled();

    const checkMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ verified: true }),
    });
    vi.stubGlobal('fetch', checkMock as unknown as typeof fetch);

    const checkResult = await checkPhoneVerification(lineId, '123456');
    expect(checkResult.success).toBe(true);

    const { data: line } = await testServiceRoleClient
      .from('ultaura_lines')
      .select('status, phone_verified_at')
      .eq('id', lineId)
      .single();

    expect(line?.status).toBe('active');
    expect(line?.phone_verified_at).not.toBeNull();
  });
});
