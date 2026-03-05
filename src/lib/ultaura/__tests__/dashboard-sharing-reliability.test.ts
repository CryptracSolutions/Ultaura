import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: any[]) => any) => fn };
});

function createDeleteBuilder(result: { data: Array<{ id: number }> | null; error: any }) {
  const builder: any = {
    eq: vi.fn(() => builder),
    select: vi.fn(async () => result),
  };
  return builder;
}

function createSelectBuilder(result: { data: Array<{ id: number }> | null; error: any }) {
  const builder: any = {
    eq: vi.fn(() => builder),
    limit: vi.fn(async () => result),
  };
  return builder;
}

describe('dashboard sharing reliability', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns failure when membership cleanup leaves viewer access behind', async () => {
    const deleteResults = [
      { data: [{ id: 1 }], error: null },
      { data: [{ id: 2 }], error: null },
    ];
    const selectResults = [
      { data: [{ id: 3 }], error: null },
      { data: [], error: null },
    ];

    const adminClient = {
      rpc: vi.fn(async () => ({ data: 'user-1', error: null })),
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { organization_id: 42 }, error: null })),
              })),
            })),
          };
        }

        if (table === 'memberships') {
          return {
            delete: vi.fn(() => createDeleteBuilder(deleteResults.shift() ?? { data: [], error: null })),
            select: vi.fn(() => createSelectBuilder(selectResults.shift() ?? { data: [], error: null })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => adminClient),
    }));

    const { deleteViewerMembershipForRecipient } = await import('~/lib/ultaura/dashboard-sharing');
    const result = await deleteViewerMembershipForRecipient('acct-1', 'recipient@example.com');

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected membership cleanup to fail');
    }
    expect(result.error.message).toContain('still exists');
  });

  it('does not delete recipient when membership cleanup fails', async () => {
    const recipientsDelete = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(async () => ({ error: null })),
      })),
    }));

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_notification_recipients') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: {
                    id: 'recipient-1',
                    account_id: 'acct-1',
                    email: 'recipient@example.com',
                  },
                  error: null,
                })),
              })),
            })),
            delete: recipientsDelete,
          };
        }

        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: { id: 'acct-1' }, error: null })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => client),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'owner-1' } })),
    }));
    vi.doMock('~/lib/ultaura/dashboard-sharing', async () => {
      const actual = await vi.importActual<typeof import('~/lib/ultaura/dashboard-sharing')>(
        '~/lib/ultaura/dashboard-sharing'
      );
      return {
        ...actual,
        deleteViewerMembershipForRecipient: vi.fn(async () => ({
          success: false,
          error: { message: 'cleanup failed' },
        })),
      };
    });

    const { removeNotificationRecipient } = await import('~/lib/ultaura/notification-recipients');
    const result = await removeNotificationRecipient('recipient-1');

    expect(result.success).toBe(false);
    expect(recipientsDelete).not.toHaveBeenCalled();
  });

  it('blocks dashboard grants when account sharing is disabled', async () => {
    const userClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({
                    data: {
                      id: 'acct-1',
                      user_type: 'self',
                      sharing_enabled: false,
                    },
                    error: null,
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => userClient),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'owner-1' } })),
    }));

    const { grantDashboardAccess } = await import('~/lib/ultaura/dashboard-sharing');
    const result = await grantDashboardAccess('acct-1', 'recipient-1');

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('Expected grant to be blocked when sharing is disabled');
    }
    expect(result.error.message).toContain('disabled');
  });
});
