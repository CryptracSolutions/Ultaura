export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import renderSecurityAlertEmail from '~/lib/emails/security-alert';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';

const RECOMMENDED_ACTIONS: Record<string, string> = {
  repeated_hits:
    'Review recent activity for this account. Consider temporarily blocking if the pattern continues.',
  cost_threshold:
    'Daily verification spend has exceeded $10. Review for potential abuse. Consider enabling the kill switch if unauthorized.',
  ip_blocked:
    'An IP address has been rate-limited. If this is a legitimate user, they can retry after the cooldown window.',
  enumeration:
    'Potential phone number enumeration detected. Review the source IP. Consider adding it to a blocklist if malicious.',
  ws_security_non_twilio_ip:
    'WebSocket connection attempted from a non-Twilio IP. In audit mode, review logs for the source IP. If legitimate, add it to TWILIO_MEDIA_IP_ALLOWLIST. If malicious, no action needed when enforce mode is enabled.',
  ws_security_duplicate_connection:
    'Multiple WebSocket connections attempted for the same call session. This could indicate a replay attack or Twilio reconnection. Review call logs and escalate if the pattern persists.',
  ws_security_invalid_token:
    'WebSocket connection with an invalid token signature from a Twilio IP range. Verify token generation and validation, and check for clock skew.',
  ws_security_expired_token:
    'WebSocket connection with an expired token. Usually indicates network delays or clock skew. If frequent, consider increasing token lifetime.',
  routing_bridge_missing_on_reconnect:
    'Twilio reconnected to a pod that did not have the in-memory Grok bridge for this call session. This usually indicates missing sticky sessions (hash by callSessionId) or a pod restart mid-call. Verify ingress session affinity and check pod health/restarts.',
  routing_bridge_missing_for_tool:
    'A tool call landed on a pod that did not have the in-memory Grok bridge for this call session. Ensure tool calls are routed to the same pod (e.g., set ULTAURA_INTERNAL_BACKEND_URL to localhost inside the telephony container) and verify sticky session configuration.',
};

function buildEmailContent(options: {
  anomalyType: string;
  source: string;
  sourceType: string;
  timestamp: string;
  details: Record<string, unknown>;
  recommendedAction: string;
}): { subject: string; text: string; html: string } {
  const subject = `[Ultaura Security Alert] ${options.anomalyType.replace(/_/g, ' ')}`;
  const detailsJson = JSON.stringify(options.details, null, 2);
  const { html, text } = renderSecurityAlertEmail({
    anomalyType: options.anomalyType,
    source: options.source,
    sourceType: options.sourceType,
    timestamp: options.timestamp,
    detailsJson,
    recommendedAction: options.recommendedAction,
  });
  return { subject, text, html };
}

export async function POST(request: Request) {
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

  const body = await request.json().catch(() => null);

  const anomalyType = body?.anomalyType as string | undefined;
  const source = body?.source as string | undefined;
  const sourceType = body?.sourceType as string | undefined;
  const timestamp = body?.timestamp as string | undefined;
  const details = (body?.details ?? {}) as Record<string, unknown>;
  const accountIds = Array.isArray(body?.accountIds) ? body.accountIds.filter(Boolean) : [];

  if (!anomalyType || !source || !sourceType || !timestamp) {
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

  const recommendedAction = RECOMMENDED_ACTIONS[anomalyType] || 'Review recent activity for details.';
  const { subject, text, html } = buildEmailContent({
    anomalyType,
    source,
    sourceType,
    timestamp,
    details,
    recommendedAction,
  });

  const supabase = getSupabaseRouteHandlerClient({ admin: true });
  const recipientSet = new Set<string>();

  if (accountIds.length > 0) {
    const { data: accounts, error } = await supabase
      .from('ultaura_accounts')
      .select('billing_email')
      .in('id', accountIds);

    if (error) {
      return NextResponse.json({ error: 'Failed to resolve billing emails' }, { status: 500 });
    }

    accounts?.forEach((account) => {
      if (account.billing_email) {
        recipientSet.add(account.billing_email);
      }
    });
  }

  if (recipientSet.size === 0) {
    const adminEmail = process.env.SECURITY_ALERT_ADMIN_EMAIL;
    if (!adminEmail) {
      return NextResponse.json({ error: 'No alert recipients configured' }, { status: 500 });
    }
    recipientSet.add(adminEmail);
  }

  try {
    const recipients = Array.from(recipientSet);
    for (let i = 0; i < recipients.length; i += 1) {
      const recipient = recipients[i];
      await sendEmail({
        from: emailFrom,
        to: recipient,
        subject,
        text,
        html,
        replyTo,
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, recipients: Array.from(recipientSet) });
}
