export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildHtmlRouteHeaders } from '~/lib/server/route-html';
import { confirmSubscription } from '~/lib/ultaura/newsletter';
import { renderNewsletterActionPage } from '~/lib/ultaura/newsletter-html';
import getLogger from '~/core/logger';

const logger = getLogger();
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

const COMPATIBILITY_NOTICE =
  'This legacy confirmation endpoint remains available for compatibility and will be removed on April 11, 2026.';
const SUNSET_HEADER = 'Sat, 11 Apr 2026 00:00:00 GMT';
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
  extraHeaders: { Sunset: SUNSET_HEADER },
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

function getRequestIp(request: Request): string | null {
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null
  );
}

export async function GET(
  _: Request,
  context: { params: { token: string } },
) {
  const { token } = context.params;

  logger.info({ route: 'newsletter-confirm-compat' }, 'Serving legacy newsletter confirm compatibility route');

  return htmlResponse({
    title: 'Confirm your subscription',
    body: 'Click the button below to confirm your Ultaura newsletter subscription.',
    actionLabel: 'Confirm Subscription',
    actionUrl: `/api/newsletter/confirm/${encodeURIComponent(token)}`,
    compatibilityNotice: COMPATIBILITY_NOTICE,
  });
}

export async function POST(
  request: Request,
  context: { params: { token: string } },
) {
  try {
    const { token } = context.params;
    const ip = getRequestIp(request);
    const userAgent = request.headers.get('user-agent');

    const result = await confirmSubscription(token, ip, userAgent);

    if (!result.success) {
      return htmlResponse({
        title: 'Confirmation failed',
        body: result.message || 'This confirmation link is invalid or expired.',
        isError: true,
        compatibilityNotice: COMPATIBILITY_NOTICE,
      }, 400);
    }

    return NextResponse.redirect(`${siteUrl}/newsletter/confirmed`);
  } catch {
    return htmlResponse({
      title: 'Something went wrong',
      body: 'Please try again later.',
      isError: true,
      compatibilityNotice: COMPATIBILITY_NOTICE,
    }, 500);
  }
}
