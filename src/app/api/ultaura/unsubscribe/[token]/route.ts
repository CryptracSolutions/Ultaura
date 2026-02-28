export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  buildHtmlRouteHeaders,
  renderSimpleActionPage,
} from '~/lib/server/route-html';
import { unsubscribeNotificationRecipient } from '~/lib/ultaura/notification-recipients';

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
  const actionUrl = `/api/ultaura/unsubscribe/${encodeURIComponent(token)}`;
  const html = renderSimpleActionPage({
    title: 'Unsubscribe from updates',
    body: 'You will stop receiving weekly summaries and alerts from Ultaura.',
    actionLabel: 'Unsubscribe',
    actionUrl,
    buttonColor: '#0f172a',
  });

  return new NextResponse(html, { headers: HTML_HEADERS });
}

export async function POST(_: Request, context: { params: { token: string } }) {
  const { token } = context.params;
  const result = await unsubscribeNotificationRecipient(token);

  if (!result.success) {
    const html = renderSimpleActionPage({
      title: 'Unsubscribe failed',
      body: result.error.message || 'We could not process your request.',
      isError: true,
      buttonColor: '#0f172a',
    });
    return new NextResponse(html, { headers: HTML_HEADERS, status: 400 });
  }

  const html = renderSimpleActionPage({
    title: 'You are unsubscribed',
    body: 'You will no longer receive Ultaura updates at this email address.',
    buttonColor: '#0f172a',
  });

  return new NextResponse(html, { headers: HTML_HEADERS });
}
