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

function htmlResponse(
  options: Parameters<typeof renderSimpleActionPage>[0],
  status = 200,
) {
  return new NextResponse(renderSimpleActionPage(options), {
    headers: HTML_HEADERS,
    status,
  });
}

export async function GET(_: Request, context: { params: { token: string } }) {
  const { token } = context.params;
  return htmlResponse({
    title: 'Confirm family updates',
    body: 'Confirm that you want to receive weekly summaries and alerts from Ultaura.',
    actionLabel: 'Confirm updates',
    actionUrl: `/api/ultaura/confirm/${encodeURIComponent(token)}`,
  });
}

export async function POST(_: Request, context: { params: { token: string } }) {
  try {
    const { token } = context.params;
    const result = await confirmNotificationRecipient(token);

    if (!result.success) {
      return htmlResponse({
        title: 'Confirmation failed',
        body: result.error.message || 'This confirmation link is invalid or expired.',
        isError: true,
      }, 400);
    }

    return htmlResponse({
      title: 'You are confirmed',
      body: `You will now receive updates from ${result.data.accountName}. You can close this page.`,
    });
  } catch {
    return htmlResponse({
      title: 'Something went wrong',
      body: 'Please try again later.',
      isError: true,
    }, 500);
  }
}
