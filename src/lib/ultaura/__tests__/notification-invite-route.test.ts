import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('ultaura invite route rollback behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('~/core/supabase/route-handler-client');
    vi.doUnmock('~/lib/ultaura/notification-recipients');
    vi.doUnmock('~/core/logger');
  });

  it('rolls back recipient mutation when invite email send fails after DB write', async () => {
    const accountId = '11111111-1111-4111-8111-111111111111';
    const rollbackContext = {
      accountId,
      recipientId: 'recipient-1',
      mutationType: 'insert' as const,
    };

    const maybeSingle = vi.fn(async () => ({
      data: { id: accountId },
      error: null,
    }));

    const accountQuery = {
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle,
        })),
      })),
    };

    const supabase = {
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: { id: 'user-1' } },
          error: null,
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => accountQuery),
      })),
    };

    vi.doMock('~/core/supabase/route-handler-client', () => ({
      default: vi.fn(() => supabase),
    }));

    class NotificationInviteSendError extends Error {
      context: typeof rollbackContext;

      constructor(message: string, context: typeof rollbackContext) {
        super(message);
        this.name = 'NotificationInviteSendError';
        this.context = context;
      }
    }

    const rollbackNotificationInviteMutation = vi.fn(async () => ({
      success: true as const,
      data: undefined,
    }));

    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      NotificationInviteSendError,
      rollbackNotificationInviteMutation,
      inviteNotificationRecipient: vi.fn(async () => {
        throw new NotificationInviteSendError('email failed', rollbackContext);
      }),
    }));

    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        error: vi.fn(),
      })),
    }));

    const { POST } = await import('~/app/api/ultaura/invite/route');

    const response = await POST(
      new Request('http://localhost/api/ultaura/invite', {
        method: 'POST',
        body: JSON.stringify({
          accountId,
          name: 'Casey Doe',
          email: 'casey@example.com',
        }),
        headers: { 'content-type': 'application/json' },
      }),
    );

    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toEqual({
      success: false,
      error: {
        code: 'INVITE_SEND_FAILED',
        message: 'We could not send the invite email. Please try again.',
      },
    });
    expect(rollbackNotificationInviteMutation).toHaveBeenCalledWith(rollbackContext, {
      client: supabase,
    });
  });
});
