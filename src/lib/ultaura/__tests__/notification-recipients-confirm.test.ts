import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: any[]) => any) => fn };
});

describe('confirmNotificationRecipient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('persists unsubscribe token hash and expiry on successful confirmation', async () => {
    const nowPlusOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const existing = {
      id: 'recipient-1',
      account_id: 'acct-1',
      is_trusted_contact: false,
      trusted_contact_id: null,
      phone_e164: null,
      confirmation_token_expires_at: nowPlusOneDay,
      confirmed_at: null,
    };

    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            is: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: existing, error: null })),
              })),
            })),
          })),
        })),
      })),
    }));

    const recipientSelect = {
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
      })),
    };

    const accountSelect = {
      eq: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { name: 'Ultaura Family' }, error: null })),
      })),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_notification_recipients') {
          return {
            select: vi.fn(() => recipientSelect),
            update,
          };
        }
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => accountSelect),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
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

    const { confirmNotificationRecipient } = await import(
      '~/lib/ultaura/notification-recipients'
    );

    const result = await confirmNotificationRecipient('raw-confirm-token');

    expect(result.success).toBe(true);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmed_at: expect.any(String),
        confirmation_token_hash: null,
        confirmation_token_expires_at: null,
        unsubscribe_token_hash: expect.any(String),
        unsubscribe_token_expires_at: expect.any(String),
        updated_at: expect.any(String),
      }),
    );
    const updateCalls = update.mock.calls as unknown as Array<[{
      confirmed_at: string;
      updated_at: string;
    }]>;
    const updatePayload = updateCalls[0]?.[0];
    expect(updatePayload).toBeDefined();
    expect(updatePayload.confirmed_at).toBe(updatePayload.updated_at);
  });
});
