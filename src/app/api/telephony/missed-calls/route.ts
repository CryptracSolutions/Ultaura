export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import renderMissedCallsAlertEmail from '~/lib/emails/missed-calls-alert';
import { issueNotificationRecipientUnsubscribeToken } from '~/lib/ultaura/notification-recipients';

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
    !crypto.timingSafeEqual(
      Uint8Array.from(providedBuffer),
      Uint8Array.from(expectedBuffer)
    )
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function getSiteUrl(): string {
  const siteUrl =
    process.env.NODE_ENV !== 'production'
      ? process.env.SITE_URL || 'http://localhost:3000'
      : process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return siteUrl.replace(/\/$/, '');
}

export async function POST(request: Request) {
  const unauthorizedResponse = validateWebhookSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = await request.json().catch(() => null);
  const payload = body as MissedCallsAlertPayload | null;

  if (!payload?.accountId || !payload?.lineId || !payload?.lineName || !payload?.dashboardUrl || !payload?.settingsUrl) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  let emailFrom: string;
  let replyTo: string;

  try {
    emailFrom = getNotificationsEmailSender();
    replyTo = getSupportReplyToEmail();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Missing email sender configuration' },
      { status: 500 },
    );
  }

  const supabase = getSupabaseRouteHandlerClient({ admin: true });
  const { data: line, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('id, account_id, display_name')
    .eq('id', payload.lineId)
    .eq('account_id', payload.accountId)
    .single();

  if (lineError || !line) {
    return NextResponse.json({ error: 'Invalid line/account pairing' }, { status: 400 });
  }

  const verifiedLineName = line.display_name || payload.lineName;
  const normalizedPayload = { ...payload, lineName: verifiedLineName };

  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('billing_email, user_type, sharing_enabled')
    .eq('id', normalizedPayload.accountId)
    .single();

  if (accountError || !account?.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  const { data: voiceConsent } = await supabase
    .from('ultaura_line_voice_consent')
    .select('sharing_consent')
    .eq('line_id', normalizedPayload.lineId)
    .maybeSingle();

  const { data: privacy } = await supabase
    .from('ultaura_insight_privacy')
    .select('is_paused, insights_enabled')
    .eq('line_id', normalizedPayload.lineId)
    .maybeSingle();

  const isSelfUser = account.user_type === 'self';
  const sharingConsent = voiceConsent?.sharing_consent ?? 'pending';
  const isPaused = privacy?.is_paused ?? false;
  const insightsEnabled = privacy?.insights_enabled ?? true;
  const hasGrantedSharingConsent = sharingConsent === 'granted' && !isPaused;

  const canSendToBillingEmail = insightsEnabled && (
    isSelfUser || hasGrantedSharingConsent
  );
  const canSendToRecipients = insightsEnabled && hasGrantedSharingConsent && (
    !isSelfUser || account.sharing_enabled
  );

  if (!canSendToBillingEmail && !canSendToRecipients) {
    return NextResponse.json({ success: true, skipped: 'consent_or_pause_blocked' });
  }

  try {
    const recipients = new Map<string, { isPrimary: boolean; token?: string; hasDashboardAccess: boolean }>();
    if (canSendToBillingEmail) {
      recipients.set(account.billing_email, { isPrimary: true, hasDashboardAccess: true });
    }

    if (canSendToRecipients) {
      const { data: recipientRows, error: recipientError } = await supabase
        .from('ultaura_notification_recipients')
        .select('id, email, dashboard_access_granted_at')
        .eq('account_id', normalizedPayload.accountId)
        .not('confirmed_at', 'is', null)
        .is('unsubscribed_at', null);

      if (recipientError) {
        return NextResponse.json({ error: 'Failed to load recipients' }, { status: 500 });
      }

      for (const recipient of recipientRows || []) {
        if (!recipients.has(recipient.email)) {
          const tokenResult = await issueNotificationRecipientUnsubscribeToken(
            recipient.id,
            { client: supabase }
          );

          if (!tokenResult.success) {
            return NextResponse.json(
              { error: 'Failed to issue unsubscribe tokens' },
              { status: 500 }
            );
          }

          recipients.set(recipient.email, {
            isPrimary: false,
            token: tokenResult.data.token,
            hasDashboardAccess: Boolean(recipient.dashboard_access_granted_at),
          });
        }
      }
    }

    const subject = `Missed check-ins for ${normalizedPayload.lineName}`;

    for (const [email, meta] of Array.from(recipients.entries())) {
      const unsubscribeLink = meta.isPrimary || !meta.token
        ? undefined
        : `${getSiteUrl()}/api/ultaura/unsubscribe/${meta.token}`;
      const { html, text } = renderMissedCallsAlertEmail({
        lineName: normalizedPayload.lineName,
        consecutiveMissedCount: normalizedPayload.consecutiveMissedCount,
        dashboardUrl: normalizedPayload.dashboardUrl,
        settingsUrl: normalizedPayload.settingsUrl,
        hasDashboardAccess: meta.hasDashboardAccess,
        unsubscribeLink,
      });
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
        replyTo,
      });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to send missed call alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
