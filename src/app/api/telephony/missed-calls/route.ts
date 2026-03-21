export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import getLogger from '~/core/logger';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import renderMissedCallsAlertEmail from '~/lib/emails/missed-calls-alert';
import {
  resolveFamilyAlertDestinations,
  sendAlertSms,
} from '~/lib/ultaura/alert-fanout';
import { validateWebhookSecret } from '../webhook-auth';
import { getSiteUrl } from '~/lib/server/route-html';

interface MissedCallsAlertPayload {
  lineId: string;
  accountId: string;
  lineName: string;
  consecutiveMissedCount: number;
  lastAttemptAt: string;
  dashboardUrl: string;
  settingsUrl: string;
}

const logger = getLogger();

function buildMissedCallSmsBody(input: {
  lineName: string;
  consecutiveMissedCount: number;
  dashboardUrl: string;
}): string {
  return `Ultaura missed check-in alert for ${input.lineName}: ${input.consecutiveMissedCount} consecutive missed calls. View details: ${input.dashboardUrl}`;
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
    .select('billing_email, user_type, sharing_enabled, created_by_user_id')
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
    const destinations = await resolveFamilyAlertDestinations({
      supabase,
      account: {
        id: normalizedPayload.accountId,
        billing_email: account.billing_email,
        created_by_user_id: account.created_by_user_id,
      },
      lineId: normalizedPayload.lineId,
      includeOwner: canSendToBillingEmail,
      includeRecipients: canSendToRecipients,
    });

    const subject = `Missed check-ins for ${normalizedPayload.lineName}`;
    let deliveredEmailCount = 0;
    let deliveredSmsCount = 0;

    for (const destination of destinations.emails) {
      const unsubscribeLink = destination.isPrimary || !destination.unsubscribeToken
        ? undefined
        : `${getSiteUrl()}/api/ultaura/unsubscribe/${destination.unsubscribeToken}`;
      const { html, text } = renderMissedCallsAlertEmail({
        lineName: normalizedPayload.lineName,
        consecutiveMissedCount: normalizedPayload.consecutiveMissedCount,
        dashboardUrl: normalizedPayload.dashboardUrl,
        settingsUrl: normalizedPayload.settingsUrl,
        hasDashboardAccess: destination.hasDashboardAccess,
        unsubscribeLink,
      });
      const headers = unsubscribeLink
        ? {
            'List-Unsubscribe': `<${unsubscribeLink}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          }
        : undefined;

      try {
        await sendEmail({
          from: emailFrom,
          to: destination.email,
          subject,
          html,
          text,
          headers,
          replyTo,
        });
        deliveredEmailCount += 1;
      } catch (error) {
        logger.error(
          { error, accountId: normalizedPayload.accountId, lineId: normalizedPayload.lineId, to: destination.email },
          'Failed to send missed-call alert email',
        );
      }
    }

    const smsBody = buildMissedCallSmsBody({
      lineName: normalizedPayload.lineName,
      consecutiveMissedCount: normalizedPayload.consecutiveMissedCount,
      dashboardUrl: normalizedPayload.dashboardUrl,
    });

    for (const destination of destinations.sms) {
      const smsResult = await sendAlertSms({
        accountId: normalizedPayload.accountId,
        lineId: normalizedPayload.lineId,
        phoneNumber: destination.phoneE164,
        body: smsBody,
        notificationType: 'missed_calls',
      });

      if (smsResult.status === 'sent') {
        deliveredSmsCount += 1;
      } else {
        logger.warn(
          {
            accountId: normalizedPayload.accountId,
            lineId: normalizedPayload.lineId,
            phoneNumber: destination.phoneE164,
            status: smsResult.status,
            error: 'error' in smsResult ? smsResult.error : undefined,
          },
          'Failed to deliver missed-call alert SMS',
        );
      }
    }

    if (
      destinations.emails.length + destinations.sms.length > 0 &&
      deliveredEmailCount + deliveredSmsCount === 0
    ) {
      return NextResponse.json({ error: 'Failed to deliver missed call alert' }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: 'Failed to send missed call alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
