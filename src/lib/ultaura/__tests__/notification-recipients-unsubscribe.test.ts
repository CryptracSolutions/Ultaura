import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: any[]) => any) => fn };
});

describe('unsubscribeNotificationRecipient token flow', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('accepts a valid token, hashes it for lookup, and clears token fields', async () => {
    const updateMaybeSingle = vi.fn(async () => ({
      data: { id: 'recipient-1' },
      error: null,
    }));
    const gt = vi.fn(() => ({
      select: vi.fn(() => ({
        maybeSingle: updateMaybeSingle,
      })),
    }));
    const selectEq = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({
        data: {
          id: 'recipient-1',
          unsubscribe_token_expires_at: new Date(
            Date.now() + 60 * 60 * 1000,
          ).toISOString(),
          unsubscribed_at: null,
        },
        error: null,
      })),
    }));
    const table = {
      select: vi.fn(() => ({ eq: selectEq })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              gt,
            })),
          })),
        })),
      })),
    };
    const adminClient = {
      from: vi.fn(() => table),
    };

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => adminClient),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => adminClient),
    }));
    vi.doMock('~/core/email/send-email', () => ({
      default: vi.fn(async () => undefined),
    }));
    vi.doMock('~/lib/emails/notification-invite', () => ({
      default: vi.fn(() => ({ html: '', text: '' })),
    }));
    vi.doMock('~/lib/server/queries', () => ({
      getUserDataById: vi.fn(async () => null),
    }));

    const { unsubscribeNotificationRecipient } = await import(
      '~/lib/ultaura/notification-recipients'
    );
    const { hashNotificationToken } = await import(
      '~/lib/ultaura/notification-tokens'
    );

    const token = 'raw-unsubscribe-token';
    const result = await unsubscribeNotificationRecipient(token);

    expect(result.success).toBe(true);
    expect(selectEq).toHaveBeenCalledWith(
      'unsubscribe_token_hash',
      hashNotificationToken(token),
    );
    expect(table.update).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribed_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    const updateCalls = table.update.mock.calls as unknown as Array<[{
      unsubscribed_at: string;
      updated_at: string;
    }]>;
    const updatePayload = updateCalls[0]?.[0];
    expect(updatePayload).toBeDefined();
    expect(updatePayload.unsubscribed_at).toBe(updatePayload.updated_at);
    expect(gt).toHaveBeenCalledWith('unsubscribe_token_expires_at', updatePayload.updated_at);
  });

  it('rejects invalid tokens', async () => {
    const selectEq = vi.fn(() => ({
      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
    }));
    const adminClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: selectEq })),
      })),
    };

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => adminClient),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => adminClient),
    }));
    vi.doMock('~/core/email/send-email', () => ({
      default: vi.fn(async () => undefined),
    }));
    vi.doMock('~/lib/emails/notification-invite', () => ({
      default: vi.fn(() => ({ html: '', text: '' })),
    }));
    vi.doMock('~/lib/server/queries', () => ({
      getUserDataById: vi.fn(async () => null),
    }));

    const { unsubscribeNotificationRecipient } = await import(
      '~/lib/ultaura/notification-recipients'
    );

    const result = await unsubscribeNotificationRecipient('bad-token');

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected failure for invalid token');
    }
    expect(result.error.message).toContain(
      'This unsubscribe link is invalid or has expired.',
    );
  });

  it('issues unsubscribe token with ISO timestamps and persists updated_at', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: { id: 'recipient-1' },
      error: null,
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          select: vi.fn(() => ({
            maybeSingle,
          })),
        })),
      })),
    }));
    const adminClient = {
      from: vi.fn(() => ({
        update,
      })),
    };

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => adminClient),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => adminClient),
    }));
    vi.doMock('~/core/email/send-email', () => ({
      default: vi.fn(async () => undefined),
    }));
    vi.doMock('~/lib/emails/notification-invite', () => ({
      default: vi.fn(() => ({ html: '', text: '' })),
    }));
    vi.doMock('~/lib/server/queries', () => ({
      getUserDataById: vi.fn(async () => null),
    }));

    const { issueNotificationRecipientUnsubscribeToken } = await import(
      '~/lib/ultaura/notification-recipients'
    );

    const result = await issueNotificationRecipientUnsubscribeToken('recipient-1');

    expect(result.success).toBe(true);
    const updatePayload = (update.mock.calls[0] as Array<any>)[0];
    expect(updatePayload.updated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    expect(updatePayload.unsubscribe_token_expires_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
    if (!result.success) {
      throw new Error('Expected successful unsubscribe token issuance');
    }
    expect(result.data.expiresAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});
