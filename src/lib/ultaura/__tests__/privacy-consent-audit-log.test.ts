import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('getConsentAuditLog pagination edges', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock('react', () => ({
      cache: <T extends (...args: any[]) => any>(fn: T) => fn,
    }));
  });

  it('returns empty without querying when limit=0', async () => {
    const from = vi.fn();
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => ({ from })),
    }));

    const { getConsentAuditLog } = await import('~/lib/ultaura/privacy');
    const result = await getConsentAuditLog('account-1', { limit: 0, offset: 25 });

    expect(result).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it('uses default limit=50 when only offset is provided', async () => {
    const range = vi.fn(async () => ({ data: [], error: null }));
    const orderById = vi.fn(() => ({ range }));
    const orderByCreatedAt = vi.fn(() => ({ order: orderById }));
    const eq = vi.fn(() => ({ order: orderByCreatedAt }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => ({ from })),
    }));

    const { getConsentAuditLog } = await import('~/lib/ultaura/privacy');
    await getConsentAuditLog('account-1', { offset: 10 });

    expect(range).toHaveBeenCalledWith(10, 59);
  });

  it('uses explicit limit and offset range bounds', async () => {
    const row = {
      id: 'audit-1',
      created_at: '2026-02-10T00:00:00.000Z',
      account_id: 'account-1',
      line_id: null,
      actor_user_id: 'user-1',
      actor_type: 'payer',
      action: 'recording_consent_enabled',
      consent_type: 'recording',
      old_value: null,
      new_value: { enabled: true },
      call_session_id: null,
      metadata: null,
    };
    const range = vi.fn(async () => ({ data: [row], error: null }));
    const orderById = vi.fn(() => ({ range }));
    const orderByCreatedAt = vi.fn(() => ({ order: orderById }));
    const eq = vi.fn(() => ({ order: orderByCreatedAt }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));

    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => ({ from })),
    }));

    const { getConsentAuditLog } = await import('~/lib/ultaura/privacy');
    const result = await getConsentAuditLog('account-1', { limit: 5, offset: 15 });

    expect(range).toHaveBeenCalledWith(15, 19);
    expect(result[0]).toMatchObject({
      id: 'audit-1',
      actorType: 'payer',
      action: 'recording_consent_enabled',
      ipAddress: null,
      userAgent: null,
    });
  });
});
