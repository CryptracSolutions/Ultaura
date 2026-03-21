export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import renderWeeklySummaryEmail from '~/lib/emails/weekly-summary';
import type { WeeklySummaryData } from '~/lib/ultaura/types';
import { issueNotificationRecipientUnsubscribeToken } from '~/lib/ultaura/notification-recipients';
import { validateWebhookSecret } from '../webhook-auth';
import { getSiteUrl } from '~/lib/server/route-html';

export async function POST(request: Request) {
  const unauthorizedResponse = validateWebhookSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = await request.json().catch(() => null);
  const payload = body as { summary?: WeeklySummaryData; sharingSummary?: WeeklySummaryData | null } | WeeklySummaryData | null;
  const summary = payload && 'summary' in payload ? payload.summary || null : (payload as WeeklySummaryData | null);
  const sharingSummary = payload && 'summary' in payload ? (payload.sharingSummary ?? null) : null;

  if (!summary?.accountId || !summary?.lineId || !summary?.lineName || !summary?.settingsUrl) {
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
    .eq('id', summary.lineId)
    .eq('account_id', summary.accountId)
    .single();

  if (lineError || !line) {
    return NextResponse.json({ error: 'Invalid line/account pairing' }, { status: 400 });
  }

  const verifiedLineName = line.display_name || summary.lineName;
  const normalizedSummary = {
    ...summary,
    accountId: line.account_id,
    lineId: line.id,
    lineName: verifiedLineName,
  };
  const normalizedSharingSummary = sharingSummary
    ? {
      ...sharingSummary,
      accountId: line.account_id,
      lineId: line.id,
      lineName: verifiedLineName,
    }
    : null;

  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('billing_email, user_type, sharing_enabled')
    .eq('id', normalizedSummary.accountId)
    .single();

  if (accountError || !account?.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  const { data: voiceConsent } = await supabase
    .from('ultaura_line_voice_consent')
    .select('sharing_consent, sharing_tier')
    .eq('line_id', normalizedSummary.lineId)
    .maybeSingle();

  const { data: privacy } = await supabase
    .from('ultaura_insight_privacy')
    .select('is_paused, insights_enabled')
    .eq('line_id', normalizedSummary.lineId)
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
  const hasGrantedSharingConsent = sharingConsent === 'granted' && !isPaused;
  const sharingPayload = normalizedSharingSummary ?? { ...normalizedSummary, sharingTier };

  try {
    const recipients = new Map<string, { isPrimary: boolean; token?: string; hasDashboardAccess: boolean }>();

    const canSendToBillingEmail = insightsEnabled && (
      isSelfUser || hasGrantedSharingConsent
    );
    const canSendToRecipients = insightsEnabled && hasGrantedSharingConsent && (
      !isSelfUser || account.sharing_enabled
    );

    if (!canSendToBillingEmail && !canSendToRecipients) {
      return NextResponse.json({ success: true, skipped: 'no_eligible_recipients' });
    }

    if (canSendToBillingEmail) {
      recipients.set(account.billing_email, { isPrimary: true, hasDashboardAccess: true });
    }

    if (canSendToRecipients) {
      // Get recipient IDs assigned to this line
      const { data: assignmentRows } = await supabase
        .from('ultaura_recipient_line_assignments')
        .select('recipient_id')
        .eq('line_id', normalizedSummary.lineId);

      const assignedRecipientIds = (assignmentRows || []).map((r) => r.recipient_id);
      let recipientRows: Array<{ id: string; email: string; dashboard_access_granted_at: string | null }> = [];

      if (assignedRecipientIds.length > 0) {
        const { data, error: recipientError } = await supabase
          .from('ultaura_notification_recipients')
          .select('id, email, dashboard_access_granted_at')
          .eq('account_id', normalizedSummary.accountId)
          .not('confirmed_at', 'is', null)
          .is('unsubscribed_at', null)
          .in('id', assignedRecipientIds);

        if (recipientError) {
          return NextResponse.json({ error: 'Failed to load recipients' }, { status: 500 });
        }
        recipientRows = data || [];
      }

      const uniqueRecipients = recipientRows.filter((r) => !recipients.has(r.email));
      const tokenResults = await Promise.all(
        uniqueRecipients.map((r) =>
          issueNotificationRecipientUnsubscribeToken(r.id, { client: supabase }),
        ),
      );

      for (let i = 0; i < uniqueRecipients.length; i++) {
        const tokenResult = tokenResults[i];
        if (!tokenResult.success) {
          return NextResponse.json(
            { error: 'Failed to issue unsubscribe tokens' },
            { status: 500 },
          );
        }
        const recipient = uniqueRecipients[i];
        recipients.set(recipient.email, {
          isPrimary: false,
          token: tokenResult.data.token,
          hasDashboardAccess: Boolean(recipient.dashboard_access_granted_at),
        });
      }
    }

    const subject = `Weekly Check-in Summary for ${normalizedSummary.lineName}`;

    for (const [email, meta] of Array.from(recipients.entries())) {
      const unsubscribeLink = meta.isPrimary || !meta.token
        ? undefined
        : `${getSiteUrl()}/api/ultaura/unsubscribe/${meta.token}`;
      const isSelfRecipient = isSelfUser && meta.isPrimary;
      const summaryForRecipient = isSelfRecipient ? normalizedSummary : {
        ...sharingPayload,
        sharingTier: sharingPayload.sharingTier ?? sharingTier,
      };

      const { html, text } = renderWeeklySummaryEmail({
        ...summaryForRecipient,
        billingEmail: email,
        isSelfRecipient,
        isPrimaryRecipient: meta.isPrimary,
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
    return NextResponse.json({ error: 'Failed to send weekly summary email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
