export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildHtmlRouteHeaders } from '~/lib/server/route-html';
import { unsubscribeNewsletterSubscriber } from '~/lib/ultaura/newsletter';
import { renderNewsletterActionPage } from '~/lib/ultaura/newsletter-html';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');
const siteOrigin = (() => {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return 'http://localhost:3000';
  }
})();
const HTML_HEADERS = buildHtmlRouteHeaders({
  cspDirectives: {
    'default-src': ["'none'"],
    'style-src': ["'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ['https://fonts.gstatic.com'],
    'img-src': ["'self'", siteOrigin],
    'connect-src': ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    'form-action': ["'self'"],
    'base-uri': ["'none'"],
    'frame-ancestors': ["'none'"],
  },
  contentType: 'text/html',
});

export async function GET(
  _: Request,
  context: { params: { subscriberId: string; token: string } },
) {
  const { subscriberId, token } = context.params;
  const actionUrl = `/api/newsletter/unsubscribe/${encodeURIComponent(subscriberId)}/${encodeURIComponent(token)}`;

  const html = renderNewsletterActionPage({
    title: 'Unsubscribe from newsletter',
    body: 'Click the button below to stop receiving Ultaura newsletter emails.',
    actionLabel: 'Unsubscribe',
    actionUrl,
  });

  return new NextResponse(html, {
    headers: HTML_HEADERS,
  });
}

export async function POST(
  _: Request,
  context: { params: { subscriberId: string; token: string } },
) {
  const { subscriberId, token } = context.params;
  const result = await unsubscribeNewsletterSubscriber(subscriberId, token);

  if (!result.success) {
    const html = renderNewsletterActionPage({
      title: 'Unsubscribe failed',
      body: result.message || 'We could not process your request.',
      isError: true,
    });

    return new NextResponse(html, {
      headers: HTML_HEADERS,
      status: 400,
    });
  }

  const html = renderNewsletterActionPage({
    title: 'You are unsubscribed',
    body: 'You will no longer receive the Ultaura newsletter at this email address.',
  });

  return new NextResponse(html, {
    headers: HTML_HEADERS,
  });
}
