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

    const gt = vi.fn(() => ({
      is: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(async () => ({ data: existing, error: null })),
        })),
      })),
    }));

    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt,
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
    expect(gt).toHaveBeenCalledWith('confirmation_token_expires_at', updatePayload.updated_at);
  });

  it('logs and stops trusted-contact follow-up when recipient link-back update fails', async () => {
    const loggerError = vi.fn();
    const existing = {
      id: 'recipient-1',
      account_id: 'acct-1',
      name: 'Mary Trusted',
      relationship: 'Daughter',
      is_trusted_contact: true,
      trusted_contact_id: null,
      phone_e164: '+14155550123',
      confirmation_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      confirmed_at: null,
    };

    let recipientTableCalls = 0;
    const recipientSelectForToken = {
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
      })),
    };
    const confirmUpdate = vi.fn(() => ({
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
    const linkBackUpdate = vi.fn(() => ({
      eq: vi.fn(async () => ({ data: null, error: { message: 'link failed' } })),
    }));

    const trustedContactInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: { id: 'trusted-1' }, error: null })),
      })),
    }));
    const consentsInsert = vi.fn(async () => ({ data: null, error: null }));

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_notification_recipients') {
          recipientTableCalls += 1;
          if (recipientTableCalls === 1) {
            return { select: vi.fn(() => recipientSelectForToken) };
          }
          if (recipientTableCalls === 2) {
            return { update: confirmUpdate };
          }
          if (recipientTableCalls === 3) {
            return { update: linkBackUpdate };
          }
          throw new Error(`Unexpected recipients table call #${recipientTableCalls}`);
        }
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { name: 'Ultaura Family' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_lines') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [{ id: 'line-1', phone_verified_at: new Date().toISOString(), created_at: new Date().toISOString() }],
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'ultaura_trusted_contacts') {
          return {
            insert: trustedContactInsert,
          };
        }
        if (table === 'ultaura_consents') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            })),
            insert: consentsInsert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        error: loggerError,
        warn: vi.fn(),
        debug: vi.fn(),
      })),
    }));
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
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'link failed' }),
        recipientId: 'recipient-1',
        trustedContactId: 'trusted-1',
      }),
      'Failed to link recipient to trusted contact'
    );
    expect(consentsInsert).not.toHaveBeenCalled();
  });

  it('logs consent-insert failure when trusted-contact consent cannot be created', async () => {
    const loggerError = vi.fn();
    const existing = {
      id: 'recipient-1',
      account_id: 'acct-1',
      name: 'Mary Trusted',
      relationship: 'Daughter',
      is_trusted_contact: true,
      trusted_contact_id: null,
      phone_e164: '+14155550123',
      confirmation_token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      confirmed_at: null,
    };

    let recipientTableCalls = 0;
    const recipientSelectForToken = {
      eq: vi.fn(() => ({
        maybeSingle: vi.fn(async () => ({ data: existing, error: null })),
      })),
    };
    const confirmUpdate = vi.fn(() => ({
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
    const linkBackUpdate = vi.fn(() => ({
      eq: vi.fn(async () => ({ data: null, error: null })),
    }));

    const consentInsertError = { message: 'consent failed' };
    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_notification_recipients') {
          recipientTableCalls += 1;
          if (recipientTableCalls === 1) {
            return { select: vi.fn(() => recipientSelectForToken) };
          }
          if (recipientTableCalls === 2) {
            return { update: confirmUpdate };
          }
          if (recipientTableCalls === 3) {
            return { update: linkBackUpdate };
          }
          throw new Error(`Unexpected recipients table call #${recipientTableCalls}`);
        }
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { name: 'Ultaura Family' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_lines') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [{ id: 'line-1', phone_verified_at: new Date().toISOString(), created_at: new Date().toISOString() }],
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'ultaura_trusted_contacts') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'trusted-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_consents') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            })),
            insert: vi.fn(async () => ({ data: null, error: consentInsertError })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({
        info: vi.fn(),
        error: loggerError,
        warn: vi.fn(),
        debug: vi.fn(),
      })),
    }));
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
    expect(loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: 'consent failed' }),
        recipientId: 'recipient-1',
        lineId: 'line-1',
      }),
      'Failed to grant trusted contact consent from recipient confirmation'
    );
  });
});
