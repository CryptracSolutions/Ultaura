export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

import { confirmNotificationRecipient } from '~/lib/ultaura/notification-recipients';

function buildConfirmPageUrl(request: Request, token: string) {
  return new URL(`/ultaura/confirm/${encodeURIComponent(token)}`, request.url);
}

export async function GET(request: Request, context: { params: { token: string } }) {
  const { token } = context.params;

  return NextResponse.redirect(buildConfirmPageUrl(request, token));
}

export async function POST(request: Request, context: { params: { token: string } }) {
  const { token } = context.params;
  const redirectUrl = buildConfirmPageUrl(request, token);

  try {
    const result = await confirmNotificationRecipient(token);

    if (!result.success) {
      redirectUrl.searchParams.set('status', 'error');
      redirectUrl.searchParams.set(
        'message',
        result.error.message || 'This confirmation link is invalid or expired.',
      );

      return NextResponse.redirect(redirectUrl, 303);
    }

    if (result.data.smsVerificationToken) {
      return NextResponse.redirect(
        new URL(
          `/ultaura/alerts/verify-phone/${encodeURIComponent(result.data.smsVerificationToken)}`,
          request.url,
        ),
        303,
      );
    }

    redirectUrl.searchParams.set('status', 'success');
    redirectUrl.searchParams.set('accountName', result.data.accountName);

    return NextResponse.redirect(redirectUrl, 303);
  } catch {
    redirectUrl.searchParams.set('status', 'error');
    redirectUrl.searchParams.set('message', 'Please try again later.');

    return NextResponse.redirect(redirectUrl, 303);
  }
}
