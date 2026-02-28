import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

describe('newsletter confirm route', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  });

  it('GET includes Sunset header and escaped action path', async () => {
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      confirmSubscription: vi.fn(),
    }));

    const { GET } = await import('~/app/api/newsletter/confirm/[token]/route');

    const response = await GET(new Request('http://localhost'), {
      params: { token: 'abc" onclick="alert(1)' },
    });
    const html = await response.text();

    expect(response.headers.get('Sunset')).toBe('Sat, 11 Apr 2026 00:00:00 GMT');
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(response.headers.get('content-security-policy')).toContain(
      'font-src https://fonts.gstatic.com',
    );
    expect(response.headers.get('content-security-policy')).toContain(
      "img-src 'self' http://localhost:3000",
    );
    expect(html).toContain('/api/newsletter/confirm/abc%22%20onclick%3D%22alert(1)');
    expect(html).not.toContain('onclick="alert(1)"');
  });

  it('POST escapes service error text', async () => {
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      confirmSubscription: vi.fn(async () => ({
        success: false,
        message: '<script>alert(1)</script>',
      })),
    }));

    const { POST } = await import('~/app/api/newsletter/confirm/[token]/route');

    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: { token: 'abc' },
    });
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('POST returns generic 500 page when service throws', async () => {
    vi.doMock('~/lib/ultaura/newsletter', () => ({
      confirmSubscription: vi.fn(async () => {
        throw new Error('db-down');
      }),
    }));

    const { POST } = await import('~/app/api/newsletter/confirm/[token]/route');

    const response = await POST(new Request('http://localhost', { method: 'POST' }), {
      params: { token: 'abc' },
    });
    const html = await response.text();

    expect(response.status).toBe(500);
    expect(response.headers.get('content-security-policy')).toContain(
      "style-src 'unsafe-inline' https://fonts.googleapis.com",
    );
    expect(html).toContain('Something went wrong');
    expect(html).toContain('Please try again later.');
    expect(html).not.toContain('db-down');
  });
});
