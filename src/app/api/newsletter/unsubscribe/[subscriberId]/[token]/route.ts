export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { unsubscribeNewsletterSubscriber } from '~/lib/ultaura/newsletter';
import { renderNewsletterActionPage } from '~/lib/ultaura/newsletter-html';

const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
).replace(/\/$/, '');

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
    headers: { 'content-type': 'text/html' },
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
      headers: { 'content-type': 'text/html' },
      status: 400,
    });
  }

  const html = renderNewsletterActionPage({
    title: 'You are unsubscribed',
    body: 'You will no longer receive the Ultaura newsletter at this email address.',
  });

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html' },
  });
}
