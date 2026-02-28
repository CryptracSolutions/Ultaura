export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  buildHtmlRouteHeaders,
  renderSimpleActionPage,
} from '~/lib/server/route-html';
import { confirmNotificationRecipient } from '~/lib/ultaura/notification-recipients';

const HTML_HEADERS = buildHtmlRouteHeaders({
  cspDirectives: {
    'default-src': ["'none'"],
    'style-src': ["'unsafe-inline'"],
    'form-action': ["'self'"],
    'base-uri': ["'none'"],
    'frame-ancestors': ["'none'"],
  },
});

export async function GET(_: Request, context: { params: { token: string } }) {
  const { token } = context.params;
  const actionUrl = `/api/ultaura/confirm/${encodeURIComponent(token)}`;
  const html = renderSimpleActionPage({
    title: 'Confirm family updates',
    body: 'Confirm that you want to receive weekly summaries and alerts from Ultaura.',
    actionLabel: 'Confirm updates',
    actionUrl,
  });

  return new NextResponse(html, { headers: HTML_HEADERS });
}

export async function POST(_: Request, context: { params: { token: string } }) {
  try {
    const { token } = context.params;
    const result = await confirmNotificationRecipient(token);

    if (!result.success) {
      const html = renderSimpleActionPage({
        title: 'Confirmation failed',
        body: result.error.message || 'This confirmation link is invalid or expired.',
        isError: true,
      });
      return new NextResponse(html, { headers: HTML_HEADERS, status: 400 });
    }

    const html = renderSimpleActionPage({
      title: 'You are confirmed',
      body: `You will now receive updates from ${result.data.accountName}. You can close this page.`,
    });

    return new NextResponse(html, { headers: HTML_HEADERS });
  } catch {
    const html = renderSimpleActionPage({
      title: 'Something went wrong',
      body: 'Please try again later.',
      isError: true,
    });
    return new NextResponse(html, { headers: HTML_HEADERS, status: 500 });
  }
}
