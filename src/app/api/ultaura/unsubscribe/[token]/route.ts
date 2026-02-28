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
const BUTTON_COLOR = '#0f172a';

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
    title: 'Unsubscribe from updates',
    body: 'You will stop receiving weekly summaries and alerts from Ultaura.',
    actionLabel: 'Unsubscribe',
    actionUrl: `/api/ultaura/unsubscribe/${encodeURIComponent(token)}`,
    buttonColor: BUTTON_COLOR,
  });
}

export async function POST(_: Request, context: { params: { token: string } }) {
  try {
    const { token } = context.params;
    const result = await unsubscribeNotificationRecipient(token);

    if (!result.success) {
      return htmlResponse({
        title: 'Unsubscribe failed',
        body: result.error.message || 'We could not process your request.',
        isError: true,
        buttonColor: BUTTON_COLOR,
      }, 400);
    }

    return htmlResponse({
      title: 'You are unsubscribed',
      body: 'You will no longer receive Ultaura updates at this email address.',
      buttonColor: BUTTON_COLOR,
    });
  } catch {
    return htmlResponse({
      title: 'Something went wrong',
      body: 'Please try again later.',
      isError: true,
      buttonColor: BUTTON_COLOR,
    }, 500);
  }
}
