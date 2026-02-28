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
    const updateMaybeSingle = vi.fn(async () => ({
      data: { id: 'recipient-1' },
      error: null,
    }));
    const table = {
      select: vi.fn(() => ({ eq: selectEq })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              gt: vi.fn(() => ({
                select: vi.fn(() => ({
                  maybeSingle: updateMaybeSingle,
                })),
              })),
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
      }),
    );
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
});
