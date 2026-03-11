export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextResponse } from 'next/server';
import getLogger from '~/core/logger';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import renderSafetyAlertEmail from '~/lib/emails/safety-alert';
import {
  appendTrustedContactSmsDestinations,
  resolveFamilyAlertDestinations,
  sendAlertSms,
} from '~/lib/ultaura/alert-fanout';

interface SafetyAlertPayload {
  accountId: string;
  lineId: string;
  callSessionId?: string;
  severity: 'high';
  actionTaken: string;
  dashboardUrl: string;
}

const logger = getLogger();

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

function buildSafetyEmailAction(
  actionTaken: string,
  tier: 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4',
): string {
  if (tier === 'tier_4') {
    return actionTaken;
  }

  if (tier === 'tier_2' || tier === 'tier_3') {
    return 'A high-priority safety concern was detected and support actions were taken.';
  }

  return 'A high-priority safety alert requires a check-in.';
}

function buildSafetySmsBody(input: {
  lineName: string;
  action: string;
  dashboardUrl: string;
}): string {
  return `Ultaura safety alert for ${input.lineName}: ${input.action} View details: ${input.dashboardUrl}`;
}

export async function POST(request: Request) {
  const unauthorizedResponse = validateWebhookSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = await request.json().catch(() => null);
  const payload = body as SafetyAlertPayload | null;

  if (!payload?.accountId || !payload?.lineId || !payload?.dashboardUrl || !payload?.actionTaken) {
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
  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('billing_email, user_type, sharing_enabled, created_by_user_id')
    .eq('id', payload.accountId)
    .single();

  if (accountError || !account?.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  const { data: line, error: lineError } = await supabase
    .from('ultaura_lines')
    .select('display_name, account_id')
    .eq('id', payload.lineId)
    .eq('account_id', payload.accountId)
    .single();

  if (lineError || !line) {
    return NextResponse.json({ error: 'Invalid line/account pairing' }, { status: 400 });
  }

  const lineName = line.display_name || 'Your loved one';
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
  const hasGrantedSharingConsent = sharingConsent === 'granted' && !isPaused;

  const canSendToBillingEmail = insightsEnabled && (
    isSelfUser || hasGrantedSharingConsent
  );
  const canSendToRecipients = insightsEnabled && hasGrantedSharingConsent && (
    !isSelfUser || account.sharing_enabled
  );
  const effectiveTier = isSelfUser ? 'tier_4' : sharingTier;

  try {
    const familyDestinations = await resolveFamilyAlertDestinations({
      supabase,
      account: {
        id: payload.accountId,
        billing_email: account.billing_email,
        created_by_user_id: account.created_by_user_id,
      },
      includeOwner: canSendToBillingEmail,
      includeRecipients: canSendToRecipients,
    });

    const smsDestinations = await appendTrustedContactSmsDestinations({
      supabase,
      lineId: payload.lineId,
      sms: familyDestinations.sms,
    });

    const subject = `Safety alert for ${lineName}`;
    const redactedAction = buildSafetyEmailAction(payload.actionTaken, effectiveTier);
    let deliveredEmailCount = 0;
    let deliveredSmsCount = 0;

    for (const destination of familyDestinations.emails) {
      const { html, text } = renderSafetyAlertEmail({
        lineName,
        actionTaken: redactedAction,
        severity: payload.severity ?? 'high',
        dashboardUrl: payload.dashboardUrl,
      });

      try {
        await sendEmail({
          from: emailFrom,
          to: destination.email,
          subject,
          html,
          text,
          replyTo,
        });
        deliveredEmailCount += 1;
      } catch (error) {
        logger.error(
          { error, accountId: payload.accountId, lineId: payload.lineId, to: destination.email },
          'Failed to send safety alert email',
        );
      }
    }

    const smsBody = buildSafetySmsBody({
      lineName,
      action: redactedAction,
      dashboardUrl: payload.dashboardUrl,
    });

    for (const destination of smsDestinations) {
      const smsResult = await sendAlertSms({
        accountId: payload.accountId,
        lineId: payload.lineId,
        callSessionId: payload.callSessionId,
        phoneNumber: destination.phoneE164,
        body: smsBody,
        notificationType: 'safety_alert',
      });

      if (smsResult.status === 'sent') {
        deliveredSmsCount += 1;
      } else {
        logger.warn(
          {
            accountId: payload.accountId,
            lineId: payload.lineId,
            phoneNumber: destination.phoneE164,
            status: smsResult.status,
            error: 'error' in smsResult ? smsResult.error : undefined,
          },
          'Failed to deliver safety alert SMS',
        );
      }
    }

    if (
      familyDestinations.emails.length + smsDestinations.length > 0 &&
      deliveredEmailCount + deliveredSmsCount === 0
    ) {
      return NextResponse.json({ error: 'Failed to deliver safety alert' }, { status: 502 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send safety alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
