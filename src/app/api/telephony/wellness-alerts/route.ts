import crypto from 'crypto';
import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import renderWellnessAlertEmail from '~/lib/emails/wellness-alert';
import { buildNotificationRecipientToken } from '~/lib/ultaura/notification-tokens';

interface WellnessAlertPayload {
  alertId: string;
  accountId: string;
  lineId: string;
  lineName: string;
  alertType: string;
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  summary: string;
  createdAt: string;
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

function buildTextAlert(
  payload: WellnessAlertPayload,
  options?: { unsubscribeLink?: string }
): string {
  return [
    `Wellness alert for ${payload.lineName}`,
    '',
    `${payload.title}`,
    `${payload.summary}`,
    '',
    `Created at: ${payload.createdAt}`,
    '',
    'Suggested next step: reach out and check in.',
    '',
    `View alerts: ${payload.dashboardUrl}`,
    `Alert settings: ${payload.settingsUrl}`,
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
  const payload = body as WellnessAlertPayload | null;

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

  const { data: voiceConsent } = await supabase
    .from('ultaura_line_voice_consent')
    .select('sharing_consent, sharing_tier')
    .eq('line_id', payload.lineId)
    .maybeSingle();

  const { data: privacy } = await supabase
    .from('ultaura_insight_privacy')
    .select('is_paused, insights_enabled')
    .eq('line_id', payload.lineId)
    .maybeSingle();

  const isSelfUser = account.user_type === 'self';
  const sharingConsent = voiceConsent?.sharing_consent ?? 'pending';
  const sharingTier = (voiceConsent?.sharing_tier ?? 'tier_1') as
    | 'tier_1'
    | 'tier_2'
    | 'tier_3'
    | 'tier_4';
  const isPaused = privacy?.is_paused ?? false;
  const insightsEnabled = privacy?.insights_enabled ?? true;

  const canSendToBillingEmail = insightsEnabled && (
    isSelfUser || (sharingConsent === 'granted' && !isPaused)
  );
  const canSendToRecipients = insightsEnabled && sharingConsent === 'granted' && !isPaused && (
    !isSelfUser || account.sharing_enabled
  );

  if (!canSendToBillingEmail && !canSendToRecipients) {
    return NextResponse.json({ success: true, skipped: 'no_eligible_recipients' });
  }

  const effectiveTier = isSelfUser ? 'tier_4' : sharingTier;
  if (!isSelfUser && effectiveTier === 'tier_1') {
    return NextResponse.json({ success: true, skipped: 'tier_restricted' });
  }

  const { title, summary } = redactAlertContentByTier(
    payload.alertType,
    payload.title,
    payload.summary,
    effectiveTier
  );

  const emailPayload = {
    ...payload,
    title,
    summary,
  };

  try {
    const recipients = new Map<string, { isPrimary: boolean; token?: string }>();
    if (canSendToBillingEmail) {
      recipients.set(account.billing_email, { isPrimary: true });
    }

    if (canSendToRecipients) {
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

    const subject = `${emailPayload.title} - ${emailPayload.lineName}`;

    for (const [email, meta] of Array.from(recipients.entries())) {
      const unsubscribeLink = meta.isPrimary || !meta.token
        ? undefined
        : `${getSiteUrl()}/api/ultaura/unsubscribe/${meta.token}`;
      const html = renderWellnessAlertEmail({
        lineName: emailPayload.lineName,
        title: emailPayload.title,
        summary: emailPayload.summary,
        severity: emailPayload.severity,
        dashboardUrl: emailPayload.dashboardUrl,
        settingsUrl: emailPayload.settingsUrl,
        unsubscribeLink,
      });
      const text = buildTextAlert(emailPayload, { unsubscribeLink });
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
    return NextResponse.json({ error: 'Failed to send wellness alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function redactAlertContentByTier(
  alertType: string,
  title: string,
  summary: string,
  tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'
): { title: string; summary: string } {
  if (tier === 'tier_4') {
    return { title, summary };
  }

  if (tier === 'tier_2' || tier === 'tier_3') {
    if (alertType === 'mood_drop') {
      return {
        title: 'Mood change noted',
        summary: 'A mood trend was observed during recent calls.',
      };
    }

    return {
      title: 'Wellness observation',
      summary: 'A wellness observation was noted. Consider checking in.',
    };
  }

  return { title, summary };
}
