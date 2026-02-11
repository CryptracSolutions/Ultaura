import { NextRequest } from 'next/server';
import type { Stripe } from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  listSessionsMock,
  retrieveSubscriptionMock,
  updateSubscriptionMock,
  syncUltauraSubscriptionMock,
  fromMock,
  settingsMaybeSingleMock,
  settingsUpsertMock,
  loggerErrorMock,
  loggerWarnMock,
  loggerInfoMock,
  loggerDebugMock,
} = vi.hoisted(() => ({
  listSessionsMock: vi.fn(),
  retrieveSubscriptionMock: vi.fn(),
  updateSubscriptionMock: vi.fn(),
  syncUltauraSubscriptionMock: vi.fn(),
  fromMock: vi.fn(),
  settingsMaybeSingleMock: vi.fn(),
  settingsUpsertMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerDebugMock: vi.fn(),
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    error: loggerErrorMock,
    warn: loggerWarnMock,
    info: loggerInfoMock,
    debug: loggerDebugMock,
  })),
}));

vi.mock('~/core/stripe/get-stripe', () => ({
  default: vi.fn(async () => ({
    checkout: {
      sessions: {
        list: listSessionsMock,
      },
    },
    subscriptions: {
      retrieve: retrieveSubscriptionMock,
      update: updateSubscriptionMock,
    },
  })),
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  default: vi.fn(() => ({
    from: fromMock,
  })),
}));

vi.mock('~/lib/ultaura/billing', () => ({
  syncUltauraSubscription: syncUltauraSubscriptionMock,
}));

import { GET } from '~/app/api/internal/reconcile-onboarding-subscriptions/route';

const ONBOARDING_ORG_UID = '4f06a403-6021-4450-9f17-a48610b07736';

function createRequest(params?: {
  secret?: string;
  search?: string;
}) {
  return new NextRequest(
    `http://localhost/api/internal/reconcile-onboarding-subscriptions${params?.search ?? ''}`,
    {
      method: 'GET',
      headers: {
        'x-webhook-secret': params?.secret ?? 'test-secret',
      },
    },
  );
}

function createCheckoutSession(
  id: string,
  options?: {
    created?: number;
    subscriptionId?: string;
  },
) {
  return {
    id,
    object: 'checkout.session',
    mode: 'subscription',
    created: options?.created ?? Math.floor(Date.now() / 1000),
    subscription: options?.subscriptionId ?? `sub_${id}`,
    metadata: {
      checkout_flow: 'onboarding',
      organization_uid: ONBOARDING_ORG_UID,
    },
  } as unknown as Stripe.Checkout.Session;
}

function createSubscription(id: string) {
  return {
    id,
    object: 'subscription',
    metadata: {
      organization_uid: ONBOARDING_ORG_UID,
    },
    items: {
      data: [],
    },
  } as unknown as Stripe.Subscription;
}

describe('reconcile onboarding subscriptions route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.ULTAURA_INTERNAL_API_SECRET = 'test-secret';

    fromMock.mockImplementation((table: string) => {
      if (table !== 'ultaura_system_settings') {
        throw new Error(`Unexpected table ${table}`);
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: settingsMaybeSingleMock,
          })),
        })),
        upsert: settingsUpsertMock,
      };
    });

    settingsMaybeSingleMock.mockResolvedValue({
      data: {
        value: {
          checkpoint: 'cs_checkpoint',
        },
      },
      error: null,
    });

    settingsUpsertMock.mockResolvedValue({ error: null });

    updateSubscriptionMock.mockResolvedValue(null);
    syncUltauraSubscriptionMock.mockResolvedValue(undefined);
    retrieveSubscriptionMock.mockImplementation(async (subscriptionId: string) =>
      createSubscription(subscriptionId),
    );
  });

  it('requires the internal webhook secret header', async () => {
    const response = await GET(createRequest({ secret: 'wrong-secret' }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(listSessionsMock).not.toHaveBeenCalled();
  });

  it('paginates from newest, stops at checkpoint boundary, and advances checkpoint to latest seen session', async () => {
    listSessionsMock
      .mockResolvedValueOnce({
        object: 'list',
        data: [
          createCheckoutSession('cs_new_2'),
          createCheckoutSession('cs_new_1'),
        ],
        has_more: true,
      })
      .mockResolvedValueOnce({
        object: 'list',
        data: [
          createCheckoutSession('cs_new_0'),
          createCheckoutSession('cs_checkpoint'),
          createCheckoutSession('cs_old_should_not_process'),
        ],
        has_more: true,
      });

    const response = await GET(createRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listSessionsMock).toHaveBeenCalledTimes(2);
    expect(listSessionsMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        limit: 50,
        created: expect.objectContaining({
          gte: expect.any(Number),
        }),
      }),
    );
    expect(listSessionsMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        starting_after: 'cs_new_1',
      }),
    );

    expect(retrieveSubscriptionMock).toHaveBeenCalledTimes(3);
    expect(syncUltauraSubscriptionMock).toHaveBeenCalledTimes(3);
    expect(retrieveSubscriptionMock).not.toHaveBeenCalledWith(
      'sub_cs_old_should_not_process',
    );

    expect(settingsUpsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'onboarding_reconcile_checkpoint',
        value: expect.objectContaining({
          checkpoint: 'cs_new_2',
        }),
      }),
      { onConflict: 'key' },
    );

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        processed: 3,
        synced: 3,
        unresolved: 0,
        checkpoint: 'cs_new_2',
        hasMore: false,
        reachedCheckpointBoundary: true,
        pagesProcessed: 2,
      }),
    );
  });
});
