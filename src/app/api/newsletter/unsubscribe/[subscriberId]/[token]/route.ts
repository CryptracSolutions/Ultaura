export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildHtmlRouteHeaders } from '~/lib/server/route-html';
import { unsubscribeNewsletterSubscriber } from '~/lib/ultaura/newsletter';
import { renderNewsletterActionPage } from '~/lib/ultaura/newsletter-html';

const DEFAULT_SITE_URL = 'http://localhost:3000';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(
  /\/$/,
  '',
);
const siteOrigin = (() => {
  try {
    return new URL(siteUrl).origin;
  } catch {
    return DEFAULT_SITE_URL;
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

function htmlResponse(
  options: Parameters<typeof renderNewsletterActionPage>[0],
  status = 200,
) {
  return new NextResponse(renderNewsletterActionPage(options), {
    headers: HTML_HEADERS,
    status,
  });
}

export async function GET(
  _: Request,
  context: { params: { subscriberId: string; token: string } },
) {
  const { subscriberId, token } = context.params;

  return htmlResponse({
    title: 'Unsubscribe from newsletter',
    body: 'Click the button below to stop receiving Ultaura newsletter emails.',
    actionLabel: 'Unsubscribe',
    actionUrl: `/api/newsletter/unsubscribe/${encodeURIComponent(subscriberId)}/${encodeURIComponent(token)}`,
  });
}

export async function POST(
  _: Request,
  context: { params: { subscriberId: string; token: string } },
) {
  try {
    const { subscriberId, token } = context.params;
    const result = await unsubscribeNewsletterSubscriber(subscriberId, token);

    if (!result.success) {
      return htmlResponse({
        title: 'Unsubscribe failed',
        body: result.message || 'We could not process your request.',
        isError: true,
      }, 400);
    }

    return htmlResponse({
      title: 'You are unsubscribed',
      body: 'You will no longer receive the Ultaura newsletter at this email address.',
    });
  } catch {
    return htmlResponse({
      title: 'Something went wrong',
      body: 'Please try again later.',
      isError: true,
    }, 500);
  }
}
