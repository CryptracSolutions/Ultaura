import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  verifyMock: vi.fn(),
  fromMock: vi.fn(),
  schedulePruneMock: vi.fn(),
}));

vi.mock('svix', () => ({
  Webhook: vi.fn(() => ({ verify: state.verifyMock })),
}));

vi.mock('~/lib/ultaura/newsletter-retention', () => ({
  scheduleNewsletterRetentionPrune: state.schedulePruneMock,
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  default: vi.fn(() => ({
    from: state.fromMock,
    rpc: vi.fn(async () => ({ data: null, error: null })),
  })),
}));

function createWebhookRequest(svixId = 'evt_1') {
  return new Request('http://localhost/api/newsletter/webhooks', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: {
      'svix-id': svixId,
      'svix-timestamp': '1',
      'svix-signature': 'sig',
    },
  });
}

describe('newsletter webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = 'secret';
  });

  it('returns 500 when contact.updated topic upsert fails', async () => {
    state.verifyMock.mockReturnValue({
      type: 'contact.updated',
      data: {
        id: 'contact_1',
        subscribed_topics: ['blog_digest'],
        unsubscribed_topics: [],
      },
    });

    const table = {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
      insert: vi.fn(async () => ({ error: null })),
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      upsert: vi.fn(async () => ({ error: { message: 'db fail' } })),
    } as any;

    state.fromMock.mockImplementation((name: string) => {
      if (name === 'ultaura_newsletter_webhook_events') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: null })) })) })),
          insert: vi.fn(async () => ({ error: null })),
          update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        };
      }

      if (name === 'ultaura_newsletter_subscribers') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: vi.fn(async () => ({ data: { id: 'sub_1' } })) })) })),
        };
      }

      if (name === 'ultaura_newsletter_topic_subscriptions') {
        return table;
      }

      return table;
    });

    const { POST } = await import('~/app/api/newsletter/webhooks/route');

    const response = await POST(createWebhookRequest());

    expect(response.status).toBe(500);
    expect(state.schedulePruneMock).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and marks event failed when email.bounced subscriber update fails', async () => {
    state.verifyMock.mockReturnValue({
      type: 'email.bounced',
      data: {
        to: ['family@example.com'],
      },
    });

    const eventStatusUpdates: Array<Record<string, unknown>> = [];

    state.fromMock.mockImplementation((name: string) => {
      if (name === 'ultaura_newsletter_webhook_events') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: null })),
            })),
          })),
          insert: vi.fn(async () => ({ error: null })),
          update: vi.fn((payload: Record<string, unknown>) => {
            eventStatusUpdates.push(payload);
            return { eq: vi.fn(async () => ({ error: null })) };
          }),
        };
      }

      if (name === 'ultaura_newsletter_subscribers') {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: { message: 'db fail' } })),
          })),
        };
      }

      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({ data: null })),
          })),
        })),
        insert: vi.fn(async () => ({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
        upsert: vi.fn(async () => ({ error: null })),
      } as any;
    });

    const { POST } = await import('~/app/api/newsletter/webhooks/route');
    const response = await POST(createWebhookRequest('evt_2'));

    expect(response.status).toBe(500);
    expect(
      eventStatusUpdates.map((update) => update.status),
    ).toContain('failed');
    expect(state.schedulePruneMock).toHaveBeenCalledTimes(1);
  });
});
