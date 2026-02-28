import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

function createHeaders() {
  return {
    get: (name: string) => {
      if (name === 'x-forwarded-for') {
        return '203.0.113.10';
      }
      if (name === 'user-agent') {
        return 'Vitest';
      }
      return null;
    },
  };
}

describe('privacy required audit + deletion behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock('react', () => ({
      cache: <T extends (...args: any[]) => any>(fn: T) => fn,
    }));
  });

  it('updatePrivacySettings fails when required audit write fails', async () => {
    const revalidatePath = vi.fn();
    const loggerError = vi.fn();

    const userClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'acct-1', created_by_user_id: 'user-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_account_privacy_settings') {
          return {
            update: vi.fn(() => ({
              eq: vi.fn(async () => ({ error: null })),
            })),
          };
        }
        throw new Error(`Unexpected user table: ${table}`);
      }),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_consent_audit_log') {
          return {
            insert: vi.fn(async () => ({ error: { message: 'write failed' } })),
          };
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
    };

    const componentClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_account_privacy_settings') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    id: 'privacy-1',
                    account_id: 'acct-1',
                    created_at: '2026-01-01T00:00:00.000Z',
                    updated_at: '2026-01-01T00:00:00.000Z',
                    recording_enabled: false,
                    ai_summarization_enabled: false,
                    retention_period: '90_days',
                    vendor_disclosure_acknowledged_at: null,
                    vendor_disclosure_acknowledged_by: null,
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected component table: ${table}`);
      }),
    };

    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => createHeaders()) }));
    vi.doMock('next/cache', () => ({ revalidatePath }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({ error: loggerError, info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'user-1' } })),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn((params?: { admin?: boolean }) => (params?.admin ? adminClient : userClient)),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => componentClient),
    }));

    const { updatePrivacySettings } = await import('~/lib/ultaura/privacy');
    const result = await updatePrivacySettings('acct-1', { recordingEnabled: true });

    expect(result).toEqual({ success: false, error: 'Failed to record required audit entry' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('acknowledgeVendorDisclosure fails when required audit write fails', async () => {
    const revalidatePath = vi.fn();

    const userClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'acct-1', created_by_user_id: 'user-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_account_privacy_settings') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { vendor_disclosure_acknowledged_at: null }, error: null })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  select: vi.fn(async () => ({ error: null, data: [{ account_id: 'acct-1' }] })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected user table: ${table}`);
      }),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_consent_audit_log') {
          return {
            insert: vi.fn(async () => ({ error: { message: 'write failed' } })),
          };
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
    };

    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => createHeaders()) }));
    vi.doMock('next/cache', () => ({ revalidatePath }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'user-1' } })),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn((params?: { admin?: boolean }) => (params?.admin ? adminClient : userClient)),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => userClient),
    }));

    const { acknowledgeVendorDisclosure } = await import('~/lib/ultaura/privacy');
    const result = await acknowledgeVendorDisclosure('acct-1');

    expect(result).toEqual({ success: false, error: 'Failed to record required audit entry' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('requestAccountDataDeletion fails on grief-interactions delete and does not delete call sessions', async () => {
    const deleteTables: string[] = [];
    const auditInsert = vi.fn(async () => ({ error: null }));

    const buildDeleteChain = (table: string) => ({
      eq: vi.fn(async () => {
        deleteTables.push(table);
        if (table === 'ultaura_grief_interactions') {
          return { error: { message: 'failed' } };
        }
        return { error: null };
      }),
      in: vi.fn(async () => {
        deleteTables.push(table);
        if (table === 'ultaura_grief_interactions') {
          return { error: { message: 'failed' } };
        }
        return { error: null };
      }),
    });

    const userClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'acct-1', created_by_user_id: 'user-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_lines') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [{ id: 'line-1' }], error: null })),
            })),
          };
        }
        throw new Error(`Unexpected user table: ${table}`);
      }),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_consent_audit_log') {
          return { insert: auditInsert };
        }
        if (table === 'ultaura_call_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  is: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            delete: vi.fn(() => buildDeleteChain(table)),
          };
        }
        if (table === 'ultaura_memories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
            delete: vi.fn(() => buildDeleteChain(table)),
          };
        }
        return {
          delete: vi.fn(() => buildDeleteChain(table)),
          insert: vi.fn(async () => ({ error: null })),
        };
      }),
    };

    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => createHeaders()) }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'user-1' } })),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn((params?: { admin?: boolean }) => (params?.admin ? adminClient : userClient)),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => userClient),
    }));

    const { requestAccountDataDeletion } = await import('~/lib/ultaura/privacy');
    const result = await requestAccountDataDeletion('acct-1', 'user_request');

    expect(result).toEqual({ success: false, error: 'Failed to delete account data' });
    expect(deleteTables).toContain('ultaura_grief_interactions');
    expect(deleteTables).not.toContain('ultaura_call_sessions');
    expect(auditInsert).toHaveBeenCalled();
  });

  it('requestRecordingReenable fails when required audit write fails', async () => {
    const revalidatePath = vi.fn();

    const userClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ultaura_lines') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'line-1', account_id: 'acct-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { id: 'acct-1', created_by_user_id: 'user-1', user_type: 'family_managed' },
                  error: null,
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected user table: ${table}`);
      }),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_line_voice_consent') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: {
                    recording_consent: 'denied',
                    recording_preference_permanent: true,
                    recording_reenable_requested_at: null,
                    recording_reenable_decline_count: 0,
                    recording_reenable_blocked_at: null,
                  },
                  error: null,
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    is: vi.fn(() => ({
                      is: vi.fn(() => ({
                        lt: vi.fn(() => ({
                          select: vi.fn(async () => ({ error: null, data: [{ line_id: 'line-1' }] })),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'ultaura_consent_audit_log') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                    })),
                  })),
                })),
              })),
            })),
            insert: vi.fn(async () => ({ error: { message: 'write failed' } })),
          };
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
    };

    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => createHeaders()) }));
    vi.doMock('next/cache', () => ({ revalidatePath }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'user-1' } })),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn((params?: { admin?: boolean }) => (params?.admin ? adminClient : userClient)),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => userClient),
    }));

    const { requestRecordingReenable } = await import('~/lib/ultaura/privacy');
    const result = await requestRecordingReenable('line-1');

    expect(result).toEqual({ success: false, error: 'Failed to record required audit entry' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('requestDataExport fails when required audit write fails and marks export request failed', async () => {
    const revalidatePath = vi.fn();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const exportFailedUpdate = vi.fn(() => ({
      eq: vi.fn(async () => ({ error: null })),
    }));

    const userClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'acct-1', created_by_user_id: 'user-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_data_export_requests') {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'exp-1' }, error: null })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected user table: ${table}`);
      }),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_consent_audit_log') {
          return {
            insert: vi.fn(async () => ({ error: { message: 'write failed' } })),
          };
        }
        if (table === 'ultaura_data_export_requests') {
          return {
            update: exportFailedUpdate,
          };
        }
        throw new Error(`Unexpected admin table: ${table}`);
      }),
    };

    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => createHeaders()) }));
    vi.doMock('next/cache', () => ({ revalidatePath }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'user-1' } })),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn((params?: { admin?: boolean }) => (params?.admin ? adminClient : userClient)),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => userClient),
    }));

    const { requestDataExport } = await import('~/lib/ultaura/privacy');
    const result = await requestDataExport('acct-1');

    expect(result).toEqual({ success: false, error: 'Failed to record required audit entry' });
    expect(exportFailedUpdate).toHaveBeenCalledWith({
      status: 'failed',
      processed_at: expect.any(String),
      error_message: 'Failed to record required audit entry',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('requestAccountDataDeletion explicitly deletes round-5 privacy tables before call sessions', async () => {
    const deleteTables: string[] = [];
    const auditInsert = vi.fn(async () => ({ error: null }));

    const buildDeleteChain = (table: string) => ({
      eq: vi.fn(async () => {
        deleteTables.push(table);
        return { error: null };
      }),
      in: vi.fn(async () => {
        deleteTables.push(table);
        return { error: null };
      }),
    });

    const userClient = {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from: vi.fn((table: string) => {
        if (table === 'ultaura_accounts') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { id: 'acct-1', created_by_user_id: 'user-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'ultaura_lines') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
          };
        }
        throw new Error(`Unexpected user table: ${table}`);
      }),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_consent_audit_log') {
          return { insert: auditInsert };
        }
        if (table === 'ultaura_call_sessions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  is: vi.fn(async () => ({ data: [], error: null })),
                })),
              })),
            })),
            delete: vi.fn(() => buildDeleteChain(table)),
          };
        }
        if (table === 'ultaura_memories') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
            delete: vi.fn(() => buildDeleteChain(table)),
          };
        }
        return {
          delete: vi.fn(() => buildDeleteChain(table)),
          insert: vi.fn(async () => ({ error: null })),
        };
      }),
    };

    vi.doMock('next/headers', () => ({ headers: vi.fn(async () => createHeaders()) }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('~/core/logger', () => ({
      default: vi.fn(() => ({ error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() })),
    }));
    vi.doMock('~/lib/user/require-session', () => ({
      default: vi.fn(async () => ({ user: { id: 'user-1' } })),
    }));
    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn((params?: { admin?: boolean }) => (params?.admin ? adminClient : userClient)),
    }));
    vi.doMock('~/core/supabase/server-component-client', () => ({
      default: vi.fn(() => userClient),
    }));

    const { requestAccountDataDeletion } = await import('~/lib/ultaura/privacy');
    const result = await requestAccountDataDeletion('acct-1', 'user_request');

    expect(result).toEqual({ success: true });
    const expectedRoundFiveDeletes = [
      'ultaura_schedules',
      'ultaura_subscriptions',
      'ultaura_minute_ledger',
      'ultaura_opt_outs',
      'ultaura_debug_logs',
      'ultaura_topic_exclusions',
      'ultaura_line_crypto_keys',
      'ultaura_phone_verifications',
      'ultaura_telephony_event_log',
    ];

    const callSessionsIndex = deleteTables.indexOf('ultaura_call_sessions');
    expect(callSessionsIndex).toBeGreaterThan(-1);
    for (const table of expectedRoundFiveDeletes) {
      expect(deleteTables).toContain(table);
      expect(deleteTables.indexOf(table)).toBeLessThan(callSessionsIndex);
    }
    expect(auditInsert).toHaveBeenCalled();
  });
});
