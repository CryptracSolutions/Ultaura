import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock, subscribeToNewsletterMock, warnMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  subscribeToNewsletterMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock('~/core/supabase/route-handler-client', () => ({
  default: vi.fn(() => ({
    rpc: rpcMock,
  })),
}));

vi.mock('~/lib/ultaura/newsletter', () => ({
  subscribeToNewsletter: subscribeToNewsletterMock,
}));

vi.mock('~/core/logger', () => ({
  default: vi.fn(() => ({
    warn: warnMock,
  })),
}));

import { POST } from '~/app/api/newsletter/subscribe/route';

function createRequest(body: unknown, headers?: HeadersInit): Request {
  return new Request('http://localhost/api/newsletter/subscribe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'VitestAgent/1.0',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('newsletter subscribe route', () => {
  const expectImmediateSuccessPayload = (payload: { success: boolean; message: string }) => {
    expect(payload.success).toBe(true);
    expect(payload.message.toLowerCase()).toContain('subscribed');
    expect(payload.message.toLowerCase()).not.toContain('confirm');
  };

  beforeEach(() => {
    vi.clearAllMocks();
    rpcMock.mockResolvedValue({ data: 0, error: null });
    subscribeToNewsletterMock.mockResolvedValue({
      success: true,
      message: 'You are now subscribed!',
    });
  });

  it('returns 200 for email-only payload with source', async () => {
    const response = await POST(
      createRequest(
        { email: 'family@example.com', source: 'landing_page' },
        { 'x-real-ip': '198.51.100.50' },
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expectImmediateSuccessPayload(payload);
    expect(subscribeToNewsletterMock).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'family@example.com',
        firstName: undefined,
        source: 'landing_page',
        ip: '198.51.100.50',
        userAgent: 'VitestAgent/1.0',
      }),
    );
  });

  it.each([
    { name: 'empty topics array', topics: [] },
    {
      name: 'non-empty topics array',
      topics: ['blog_digest', 'elder_care_tips'],
    },
  ])(
    'returns 200 and ignores client-provided topics for $name',
    async ({ topics }) => {
      const response = await POST(
        createRequest(
          {
            email: 'family@example.com',
            source: 'landing_page',
            topics,
          },
          { 'x-real-ip': '198.51.100.50' },
        ),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expectImmediateSuccessPayload(payload);
      expect(subscribeToNewsletterMock).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'family@example.com',
          firstName: undefined,
          source: 'landing_page',
          ip: '198.51.100.50',
          userAgent: 'VitestAgent/1.0',
        }),
      );
    },
  );

  it('returns 400 for invalid email', async () => {
    const response = await POST(
      createRequest({ email: 'not-an-email', source: 'landing_page' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(String(payload.message).toLowerCase()).toContain('email');
    expect(subscribeToNewsletterMock).not.toHaveBeenCalled();
  });

  it('returns 429 when rate limiter triggers', async () => {
    rpcMock.mockResolvedValueOnce({ data: 6, error: null });

    const response = await POST(
      createRequest({ email: 'family@example.com', source: 'landing_page' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(429);
    expect(payload).toEqual({
      success: false,
      message: 'Too many requests. Please try again later.',
    });
    expect(subscribeToNewsletterMock).not.toHaveBeenCalled();
  });
});
