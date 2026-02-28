import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('newsletter unsubscribe route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    vi.doUnmock('~/lib/ultaura/newsletter');
  });

  it('GET renders form/action with token path', async () => {
    const unsubscribeNewsletterSubscriber = vi.fn();
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      unsubscribeNewsletterSubscriber,
    }));

    const { GET } = await import(
      '~/app/api/newsletter/unsubscribe/[subscriberId]/[token]/route'
    );

    const response = await GET(
      new Request(
        'http://localhost/api/newsletter/unsubscribe/subscriber-1/token-1',
      ),
      { params: { subscriberId: 'subscriber-1', token: 'token-1' } },
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "img-src 'self' http://localhost:3000",
    );
    expect(html).toContain('Unsubscribe from newsletter');
    expect(html).toContain(
      '<form method="post" action="/api/newsletter/unsubscribe/subscriber-1/token-1">',
    );
    expect(unsubscribeNewsletterSubscriber).not.toHaveBeenCalled();
  });

  it('POST success returns success content when service succeeds', async () => {
    const unsubscribeNewsletterSubscriber = vi.fn(async () => ({
      success: true,
      message: 'You are unsubscribed from the Ultaura newsletter.',
    }));
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      unsubscribeNewsletterSubscriber,
    }));

    const { POST } = await import(
      '~/app/api/newsletter/unsubscribe/[subscriberId]/[token]/route'
    );

    const response = await POST(
      new Request(
        'http://localhost/api/newsletter/unsubscribe/subscriber-1/token-1',
        { method: 'POST' },
      ),
      { params: { subscriberId: 'subscriber-1', token: 'token-1' } },
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toContain(
      'font-src https://fonts.gstatic.com',
    );
    expect(html).toContain('You are unsubscribed');
    expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledWith(
      'subscriber-1',
      'token-1',
    );
  });

  it('POST invalid token path returns 400 with error content', async () => {
    const unsubscribeNewsletterSubscriber = vi.fn(async () => ({
      success: false,
      message: 'This unsubscribe link is invalid or has expired.',
    }));
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      unsubscribeNewsletterSubscriber,
    }));

    const { POST } = await import(
      '~/app/api/newsletter/unsubscribe/[subscriberId]/[token]/route'
    );

    const response = await POST(
      new Request(
        'http://localhost/api/newsletter/unsubscribe/subscriber-1/invalid-token',
        { method: 'POST' },
      ),
      { params: { subscriberId: 'subscriber-1', token: 'invalid-token' } },
    );
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(html).toContain('Unsubscribe failed');
    expect(html).toContain('This unsubscribe link is invalid or has expired.');
    expect(unsubscribeNewsletterSubscriber).toHaveBeenCalledWith(
      'subscriber-1',
      'invalid-token',
    );
  });

  it('GET escapes unsafe token segments in action URL', async () => {
    const unsubscribeNewsletterSubscriber = vi.fn();
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      unsubscribeNewsletterSubscriber,
    }));

    const { GET } = await import(
      '~/app/api/newsletter/unsubscribe/[subscriberId]/[token]/route'
    );

    const response = await GET(
      new Request('http://localhost/api/newsletter/unsubscribe/subscriber-1/token-1'),
      { params: { subscriberId: 'subscriber-1', token: 'bad" onclick="alert(1)' } },
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('bad%22%20onclick%3D%22alert(1)');
    expect(html).not.toContain('onclick="alert(1)"');
  });

});

describe('confirmSubscription welcome email unsubscribe link', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doUnmock('~/lib/ultaura/newsletter');
    process.env.NEXT_PUBLIC_SITE_URL = 'https://ultaura.test';
    process.env.ULTAURA_INTERNAL_API_SECRET = 'ultaura-internal-secret';
  });

  it('passes unsubscribeUrl into renderNewsletterWelcomeEmail', async () => {
    const confirmSubscriber = {
      id: 'subscriber-confirm',
      email: 'confirm@example.com',
      first_name: 'Confirm User',
      pending_topics: ['blog_digest', 'elder_care_tips', 'product_updates'],
      resend_contact_id: 'resend-contact-confirm',
    };

    const buildSubscriberUpdateChain = (payload: Record<string, unknown>) => {
      const chain: any = {
        eq: vi.fn(() => chain),
        is: vi.fn(() => chain),
        gt: vi.fn(() => chain),
        select: vi.fn(() => ({
          single: vi.fn(async () => {
            if (payload.status === 'confirmed') {
              return { data: confirmSubscriber, error: null };
            }

            return { data: null, error: null };
          }),
        })),
      };

      return chain;
    };

    const subscribersTable = {
      update: vi.fn((payload: Record<string, unknown>) =>
        buildSubscriberUpdateChain(payload),
      ),
    };

    const topicSubscriptionsTable = {
      upsert: vi.fn(async () => ({ error: null })),
    };

    const adminClient = {
      from: vi.fn((table: string) => {
        if (table === 'ultaura_newsletter_subscribers') {
          return subscribersTable;
        }

        if (table === 'ultaura_newsletter_topic_subscriptions') {
          return topicSubscriptionsTable;
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const renderWelcomeEmail = vi.fn(() => ({
      html: '<p>Welcome</p>',
      text: 'Welcome',
    }));

    vi.doMock('~/core/supabase/action-client', () => ({
      default: vi.fn(() => adminClient),
    }));

    vi.doMock('~/lib/resend/contacts', () => ({
      createPendingContact: vi.fn(async () => 'resend-contact'),
      ensureResendContact: vi.fn(async () => 'resend-contact'),
      confirmResendContact: vi.fn(async (resendContactId: string) => resendContactId),
      unsubscribeResendContact: vi.fn(async () => undefined),
    }));

    vi.doMock('~/lib/resend/topics', () => ({
      TOPIC_KEYS: ['blog_digest', 'elder_care_tips', 'product_updates'],
    }));

    vi.doMock('server-only', () => ({}));

    vi.doMock('~/core/email/send-email', () => ({
      default: vi.fn(async () => undefined),
    }));
    vi.doMock('~/lib/emails/newsletter-welcome', () => ({
      default: renderWelcomeEmail,
    }));

    const { confirmSubscription } = await import('~/lib/ultaura/newsletter');
    const { buildNewsletterUnsubscribeToken } = await import(
      '~/lib/ultaura/newsletter-tokens'
    );

    const result = await confirmSubscription('valid-token', '203.0.113.11', 'vitest-agent');

    expect(result).toEqual({ success: true, message: 'You are now subscribed!' });
    const expectedToken = buildNewsletterUnsubscribeToken('subscriber-confirm');
    expect(renderWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        unsubscribeUrl:
          `https://ultaura.test/api/newsletter/unsubscribe/subscriber-confirm/${expectedToken}`,
      }),
    );
  });
});
