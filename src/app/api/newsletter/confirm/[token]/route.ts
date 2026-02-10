export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { confirmSubscription } from '~/lib/ultaura/newsletter';
import { renderNewsletterActionPage } from '~/lib/ultaura/newsletter-html';
import getLogger from '~/core/logger';

const logger = getLogger();

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

const COMPATIBILITY_NOTICE =
  'This legacy confirmation endpoint remains available for compatibility and will be removed on April 11, 2026.';
const SUNSET_HEADER = 'Sat, 11 Apr 2026 00:00:00 GMT';

export async function GET(
  _: Request,
  context: { params: { token: string } },
) {
  const token = context.params.token;
  const actionUrl = `/api/newsletter/confirm/${encodeURIComponent(token)}`;

  logger.info({ route: 'newsletter-confirm-compat' }, 'Serving legacy newsletter confirm compatibility route');

  const html = renderNewsletterActionPage({
    title: 'Confirm your subscription',
    body: 'Click the button below to confirm your Ultaura newsletter subscription.',
    actionLabel: 'Confirm Subscription',
    actionUrl,
    compatibilityNotice: COMPATIBILITY_NOTICE,
  });

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html', Sunset: SUNSET_HEADER },
  });
}

export async function POST(
  request: Request,
  context: { params: { token: string } },
) {
  const token = context.params.token;
  const ip =
    request.headers.get('x-real-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  const userAgent = request.headers.get('user-agent');

  const result = await confirmSubscription(token, ip, userAgent);

  if (!result.success) {
    const html = renderNewsletterActionPage({
      title: 'Confirmation failed',
      body: result.message || 'This confirmation link is invalid or expired.',
      isError: true,
      compatibilityNotice: COMPATIBILITY_NOTICE,
    });

    return new NextResponse(html, {
      headers: { 'content-type': 'text/html', Sunset: SUNSET_HEADER },
      status: 400,
    });
  }

  return NextResponse.redirect(`${siteUrl}/newsletter/confirmed`);
}
