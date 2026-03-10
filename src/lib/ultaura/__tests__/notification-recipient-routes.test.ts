import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const CSP_HEADER = 'content-security-policy';

describe('ultaura confirm route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('~/lib/ultaura/notification-recipients');
  });

  it('GET redirects to the themed confirm page with the encoded token', async () => {
    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      confirmNotificationRecipient: vi.fn(),
    }));

    const { GET } = await import('~/app/api/ultaura/confirm/[token]/route');
    const response = await GET(new Request('http://localhost'), {
      params: { token: 'abc" onclick="alert(1)' },
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost/ultaura/confirm/abc%22%20onclick%3D%22alert(1)',
    );
  });

  it('POST forwards token to service and redirects to success state', async () => {
    const confirmNotificationRecipient = vi.fn(async () => ({
      success: true as const,
      data: { accountName: 'Ultaura Family' },
    }));
    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      confirmNotificationRecipient,
    }));

    const { POST } = await import('~/app/api/ultaura/confirm/[token]/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: { token: 'token-123' },
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost/ultaura/confirm/token-123?status=success&accountName=Ultaura+Family',
    );
    expect(confirmNotificationRecipient).toHaveBeenCalledWith('token-123');
  });

  it('POST redirects to error state when service throws', async () => {
    const confirmNotificationRecipient = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      confirmNotificationRecipient,
    }));

    const { POST } = await import('~/app/api/ultaura/confirm/[token]/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: { token: 'token-123' },
    });

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      'http://localhost/ultaura/confirm/token-123?status=error&message=Please+try+again+later.',
    );
  });
});

describe('ultaura unsubscribe route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.doUnmock('~/lib/ultaura/notification-recipients');
  });

  it('GET escapes token in form action and includes CSP header', async () => {
    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      unsubscribeNotificationRecipient: vi.fn(),
    }));

    const { GET } = await import('~/app/api/ultaura/unsubscribe/[token]/route');
    const response = await GET(new Request('http://localhost'), {
      params: { token: 'bad" onclick="alert(1)' },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get(CSP_HEADER)).toContain("default-src 'none'");
    expect(html).toContain(
      '/api/ultaura/unsubscribe/bad%22%20onclick%3D%22alert(1)',
    );
    expect(html).not.toContain('onclick="alert(1)"');
  });

  it('POST forwards token to unsubscribe service and includes CSP header', async () => {
    const unsubscribeNotificationRecipient = vi.fn(async () => ({
      success: true as const,
      data: undefined,
    }));
    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      unsubscribeNotificationRecipient,
    }));

    const { POST } = await import('~/app/api/ultaura/unsubscribe/[token]/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: { token: 'unsubscribe-token-1' },
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get(CSP_HEADER)).toContain("default-src 'none'");
    expect(html).toContain('You are unsubscribed');
    expect(unsubscribeNotificationRecipient).toHaveBeenCalledWith(
      'unsubscribe-token-1',
    );
  });

  it('POST returns generic 500 page when unsubscribe service throws', async () => {
    const unsubscribeNotificationRecipient = vi.fn(async () => {
      throw new Error('boom');
    });
    vi.doMock('~/lib/ultaura/notification-recipients', () => ({
      unsubscribeNotificationRecipient,
    }));

    const { POST } = await import('~/app/api/ultaura/unsubscribe/[token]/route');
    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: { token: 'unsubscribe-token-1' },
    });
    const html = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get(CSP_HEADER)).toContain("default-src 'none'");
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Please try again later.');
    expect(html).not.toContain('boom');
  });
});
