import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state = {
    isAdmin: true,
    fromCalls: [] as string[],
    getSupabaseArgs: [] as Array<Record<string, unknown>>,
    subscriberSelectColumns: [] as string[],
    subscriberEqCalls: [] as Array<[string, unknown]>,
    subscriberInCalls: [] as Array<[string, unknown[]]>,
    subscriberOrderCalls: [] as Array<[string, unknown]>,
    subscriberRangeCalls: [] as Array<[number, number]>,
    topicEqCalls: [] as Array<[string, unknown]>,
    subscriberQueryResult: {
      data: [] as Array<Record<string, unknown>>,
      count: 0,
      error: null as { message: string } | null,
    },
    topicQueryResult: {
      data: [] as Array<{ subscriber_id: string }>,
      error: null as { message: string } | null,
    },
    adminContext: {
      userId: 'admin-user-1',
      email: 'admin@example.com',
    } as { userId: string; email: string } | null,
  };

  const createThenableChain = (
    chain: Record<string, unknown>,
    getResult: () => unknown,
  ) => {
    const thenable = chain as Record<string, any>;
    thenable.then = (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(getResult()).then(onFulfilled, onRejected);
    thenable.catch = (onRejected: (reason: unknown) => unknown) =>
      Promise.resolve(getResult()).catch(onRejected);
    thenable.finally = (onFinally: () => void) =>
      Promise.resolve(getResult()).finally(onFinally);
    return thenable;
  };

  const buildSubscriberQuery = () => {
    const chain: Record<string, unknown> = {};

    chain.eq = vi.fn((column: string, value: unknown) => {
      state.subscriberEqCalls.push([column, value]);
      return chain;
    });
    chain.in = vi.fn((column: string, value: unknown[]) => {
      state.subscriberInCalls.push([column, value]);
      return chain;
    });
    chain.order = vi.fn((column: string, value: unknown) => {
      state.subscriberOrderCalls.push([column, value]);
      return chain;
    });
    chain.range = vi.fn((from: number, to: number) => {
      state.subscriberRangeCalls.push([from, to]);
      return chain;
    });

    return createThenableChain(chain, () => state.subscriberQueryResult);
  };

  const buildTopicQuery = () => {
    const chain: Record<string, unknown> = {};

    chain.eq = vi.fn((column: string, value: unknown) => {
      state.topicEqCalls.push([column, value]);
      return chain;
    });

    return createThenableChain(chain, () => state.topicQueryResult);
  };

  const subscribersTable = {
    select: vi.fn((columns: string) => {
      state.subscriberSelectColumns.push(columns);
      return buildSubscriberQuery();
    }),
  };

  const topicSubscriptionsTable = {
    select: vi.fn(() => buildTopicQuery()),
  };

  const adminClient = {
    from: vi.fn((table: string) => {
      state.fromCalls.push(table);

      if (table === 'ultaura_newsletter_subscribers') {
        return subscribersTable;
      }

      if (table === 'ultaura_newsletter_topic_subscriptions') {
        return topicSubscriptionsTable;
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    state,
    getSupabaseClient: vi.fn((params: Record<string, unknown>) => {
      state.getSupabaseArgs.push(params);
      return adminClient;
    }),
    isUltauraAdmin: vi.fn(async () => state.isAdmin),
    getCurrentAdminContext: vi.fn(async () => state.adminContext),
    writeAdminAuditLog: vi.fn(async () => undefined),
    loggerError: vi.fn(),
  };
});

vi.mock('~/core/supabase/action-client', () => ({
  default: mocks.getSupabaseClient,
}));

vi.mock('~/lib/ultaura/admin-actions', () => ({
  isUltauraAdmin: mocks.isUltauraAdmin,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    error: mocks.loggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('~/lib/ultaura/admin/audit-log', () => ({
  getCurrentAdminContext: mocks.getCurrentAdminContext,
  writeAdminAuditLog: mocks.writeAdminAuditLog,
}));

vi.mock('~/lib/resend/broadcasts', () => ({
  listBroadcasts: vi.fn(),
  getBroadcast: vi.fn(),
  createBroadcast: vi.fn(),
  sendBroadcast: vi.fn(),
  scheduleBroadcast: vi.fn(),
  removeBroadcast: vi.fn(),
}));

import { listSubscribers } from '../newsletter-admin-actions';

describe('listSubscribers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.isAdmin = true;
    mocks.state.fromCalls.length = 0;
    mocks.state.getSupabaseArgs.length = 0;
    mocks.state.subscriberSelectColumns.length = 0;
    mocks.state.subscriberEqCalls.length = 0;
    mocks.state.subscriberInCalls.length = 0;
    mocks.state.subscriberOrderCalls.length = 0;
    mocks.state.subscriberRangeCalls.length = 0;
    mocks.state.topicEqCalls.length = 0;
    mocks.state.subscriberQueryResult = { data: [], count: 0, error: null };
    mocks.state.topicQueryResult = { data: [], error: null };
    mocks.state.adminContext = {
      userId: 'admin-user-1',
      email: 'admin@example.com',
    };
  });

  it('returns original count and rows when no topic filter is provided', async () => {
    mocks.state.subscriberQueryResult = {
      data: [
        {
          id: 'sub-1',
          email: 'alpha@example.com',
          first_name: 'Alpha',
          status: 'confirmed',
          source: 'website',
          confirmed_at: '2026-01-05T00:00:00.000Z',
          created_at: '2026-01-06T00:00:00.000Z',
          ultaura_newsletter_topic_subscriptions: [
            { topic_key: 'blog_digest', subscribed: true },
          ],
        },
        {
          id: 'sub-2',
          email: 'beta@example.com',
          first_name: null,
          status: 'confirmed',
          source: 'website',
          confirmed_at: null,
          created_at: '2026-01-04T00:00:00.000Z',
          ultaura_newsletter_topic_subscriptions: [],
        },
      ],
      count: 11,
      error: null,
    };

    const result = await listSubscribers({
      page: 2,
      perPage: 2,
      status: 'confirmed',
      source: 'website',
    });

    expect(result.total).toBe(11);
    expect(result.effectivePerPage).toBe(2);
    expect(result.subscribers.map((subscriber) => subscriber.id)).toEqual(['sub-1', 'sub-2']);
    expect(mocks.state.fromCalls).toEqual(['ultaura_newsletter_subscribers']);
    expect(mocks.state.subscriberSelectColumns[0]).toContain(
      'ultaura_newsletter_topic_subscriptions(topic_key, subscribed)',
    );
    expect(mocks.state.subscriberSelectColumns[0]).not.toContain('!inner');
    expect(mocks.state.subscriberEqCalls).toContainEqual(['status', 'confirmed']);
    expect(mocks.state.subscriberEqCalls).toContainEqual(['source', 'website']);
    expect(
      mocks.state.subscriberEqCalls.some(
        ([column]) =>
          column === 'ultaura_newsletter_topic_subscriptions.topic_key' ||
          column === 'ultaura_newsletter_topic_subscriptions.subscribed',
      ),
    ).toBe(false);
    expect(mocks.state.subscriberInCalls).toHaveLength(0);
    expect(mocks.state.subscriberOrderCalls).toEqual([['created_at', { ascending: false }]]);
    expect(mocks.state.subscriberRangeCalls).toEqual([[2, 3]]);
    expect(mocks.state.getSupabaseArgs).toEqual([{ admin: true }]);
    expect(mocks.getCurrentAdminContext).toHaveBeenCalledTimes(1);
    expect(mocks.writeAdminAuditLog).toHaveBeenCalledWith(
      { userId: 'admin-user-1', email: 'admin@example.com' },
      expect.objectContaining({
        action: 'newsletter.subscribers.list',
        targetType: 'newsletter_subscribers',
        metadata: expect.objectContaining({
          resultCount: 11,
        }),
      }),
    );
  });

  it('returns filtered total and subscribers when a topic filter is provided', async () => {
    mocks.state.topicQueryResult = {
      data: [
        { subscriber_id: 'sub-2' },
        { subscriber_id: 'sub-1' },
        { subscriber_id: 'sub-2' },
      ],
      error: null,
    };

    mocks.state.subscriberQueryResult = {
      data: [
        {
          id: 'sub-2',
          email: 'beta@example.com',
          first_name: null,
          status: 'confirmed',
          source: 'website',
          confirmed_at: null,
          created_at: '2026-01-07T00:00:00.000Z',
          ultaura_newsletter_topic_subscriptions: [
            { topic_key: 'blog_digest', subscribed: true },
          ],
        },
        {
          id: 'sub-1',
          email: 'alpha@example.com',
          first_name: 'Alpha',
          status: 'confirmed',
          source: 'website',
          confirmed_at: '2026-01-08T00:00:00.000Z',
          created_at: '2026-01-08T00:00:00.000Z',
          ultaura_newsletter_topic_subscriptions: [
            { topic_key: 'blog_digest', subscribed: true },
          ],
        },
      ],
      count: 2,
      error: null,
    };

    const result = await listSubscribers({
      page: 1,
      perPage: 10,
      topic: 'blog_digest',
      status: 'confirmed',
    });

    expect(result.total).toBe(2);
    expect(result.effectivePerPage).toBe(10);
    expect(result.subscribers.map((subscriber) => subscriber.id)).toEqual(['sub-2', 'sub-1']);
    expect(mocks.state.fromCalls).toEqual(['ultaura_newsletter_subscribers']);
    expect(mocks.state.subscriberSelectColumns[0]).toContain(
      'ultaura_newsletter_topic_subscriptions!inner(topic_key, subscribed)',
    );
    expect(mocks.state.subscriberEqCalls).toContainEqual(['status', 'confirmed']);
    expect(mocks.state.subscriberEqCalls).toContainEqual(['ultaura_newsletter_topic_subscriptions.topic_key', 'blog_digest']);
    expect(mocks.state.subscriberEqCalls).toContainEqual(['ultaura_newsletter_topic_subscriptions.subscribed', true]);
    expect(mocks.state.subscriberInCalls).toEqual([]);
    expect(mocks.state.subscriberOrderCalls).toEqual([['created_at', { ascending: false }]]);
    expect(mocks.state.subscriberRangeCalls).toEqual([[0, 9]]);
  });

  it('defaults NaN perPage to a safe effectivePerPage for pagination', async () => {
    const result = await listSubscribers({
      page: 2,
      perPage: Number.NaN,
    });

    expect(result.effectivePerPage).toBe(25);
    expect(mocks.state.subscriberRangeCalls).toEqual([[25, 49]]);
  });

});
