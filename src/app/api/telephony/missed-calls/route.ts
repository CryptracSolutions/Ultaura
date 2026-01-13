import crypto from 'crypto';
import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import renderMissedCallsAlertEmail from '~/lib/emails/missed-calls-alert';
import { buildNotificationRecipientToken } from '~/lib/ultaura/notification-tokens';

interface MissedCallsAlertPayload {
  lineId: string;
  accountId: string;
  lineName: string;
  consecutiveMissedCount: number;
  lastAttemptAt: string;
  dashboardUrl: string;
  settingsUrl: string;
}

function validateWebhookSecret(request: Request): NextResponse | null {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function buildTextAlert(
  payload: MissedCallsAlertPayload,
  options?: { unsubscribeLink?: string }
): string {
  return [
    `Missed check-ins for ${payload.lineName}`,
    '',
    `${payload.lineName} has missed ${payload.consecutiveMissedCount} consecutive scheduled calls from Ultaura.`,
    '',
    `Last attempt: ${payload.lastAttemptAt}`,
    '',
    'What you can do:',
    '- Give them a call to check in',
    '- Review call schedule in your dashboard',
    '',
    `View dashboard: ${payload.dashboardUrl}`,
    `Line settings: ${payload.settingsUrl}`,
    options?.unsubscribeLink ? `Unsubscribe: ${options.unsubscribeLink}` : null,
  ].filter(Boolean).join('\n');
}

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export async function POST(request: Request) {
  const unauthorizedResponse = validateWebhookSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = await request.json().catch(() => null);
  const payload = body as MissedCallsAlertPayload | null;

  if (!payload?.accountId || !payload?.lineName || !payload?.dashboardUrl || !payload?.settingsUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const emailFrom = process.env.EMAIL_SENDER;
  if (!emailFrom) {
    return NextResponse.json({ error: 'Missing EMAIL_SENDER configuration' }, { status: 500 });
  }

  const supabase = getSupabaseServerComponentClient({ admin: true });
  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('billing_email, user_type, sharing_enabled')
    .eq('id', payload.accountId)
    .single();

  if (accountError || !account?.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  try {
    const recipients = new Map<string, { isPrimary: boolean; token?: string }>();
    recipients.set(account.billing_email, { isPrimary: true });

    if (
      account.user_type === 'family_managed' ||
      (account.user_type === 'self' && account.sharing_enabled)
    ) {
      const { data: recipientRows, error: recipientError } = await supabase
        .from('ultaura_notification_recipients')
        .select('id, email')
        .eq('account_id', payload.accountId)
        .not('confirmed_at', 'is', null)
        .is('unsubscribed_at', null);

      if (recipientError) {
        return NextResponse.json({ error: 'Failed to load recipients' }, { status: 500 });
      }

      for (const recipient of recipientRows || []) {
        if (!recipients.has(recipient.email)) {
          recipients.set(recipient.email, {
            isPrimary: false,
            token: buildNotificationRecipientToken(recipient.id),
          });
        }
      }
    }

    const subject = `Missed check-ins for ${payload.lineName}`;

    for (const [email, meta] of Array.from(recipients.entries())) {
      const unsubscribeLink = meta.isPrimary || !meta.token
        ? undefined
        : `${getSiteUrl()}/api/ultaura/unsubscribe/${meta.token}`;
      const html = renderMissedCallsAlertEmail({
        lineName: payload.lineName,
        consecutiveMissedCount: payload.consecutiveMissedCount,
        dashboardUrl: payload.dashboardUrl,
        settingsUrl: payload.settingsUrl,
        unsubscribeLink,
      });
      const text = buildTextAlert(payload, { unsubscribeLink });
      const headers = unsubscribeLink
        ? {
            'List-Unsubscribe': `<${unsubscribeLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined;

      await sendEmail({
        from: emailFrom,
        to: email,
        subject,
        html,
        text,
        headers,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send missed call alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
