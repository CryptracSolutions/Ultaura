import { NextResponse } from 'next/server';
import crypto from 'crypto';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

const RECOMMENDED_ACTIONS: Record<string, string> = {
  repeated_hits:
    'Review recent activity for this account. Consider temporarily blocking if the pattern continues.',
  cost_threshold:
    'Daily verification spend has exceeded $10. Review for potential abuse. Consider enabling the kill switch if unauthorized.',
  ip_blocked:
    'An IP address has been rate-limited. If this is a legitimate user, they can retry after the cooldown window.',
  enumeration:
    'Potential phone number enumeration detected. Review the source IP. Consider adding it to a blocklist if malicious.',
};

function formatAnomalyType(type: string): string {
  return type.replace(/_/g, ' ');
}

function buildEmailContent(options: {
  anomalyType: string;
  source: string;
  sourceType: string;
  timestamp: string;
  details: Record<string, unknown>;
  recommendedAction: string;
}): { subject: string; text: string; html: string } {
  const subject = `[Ultaura Security Alert] ${formatAnomalyType(options.anomalyType)}`;
  const detailsJson = JSON.stringify(options.details, null, 2);

  const text = [
    `Ultaura Security Alert`,
    ``,
    `Type: ${options.anomalyType}`,
    `Source: ${options.source} (${options.sourceType})`,
    `Timestamp: ${options.timestamp}`,
    ``,
    `Details:`,
    detailsJson,
    ``,
    `Recommended actions:`,
    options.recommendedAction,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <h2>Ultaura Security Alert</h2>
      <p><strong>Type:</strong> ${options.anomalyType}</p>
      <p><strong>Source:</strong> ${options.source} (${options.sourceType})</p>
      <p><strong>Timestamp:</strong> ${options.timestamp}</p>
      <p><strong>Details:</strong></p>
      <pre style="background: #f4f4f4; padding: 12px; border-radius: 6px;">${detailsJson}</pre>
      <p><strong>Recommended actions:</strong> ${options.recommendedAction}</p>
    </div>
  `;

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
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
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

  const emailFrom = process.env.EMAIL_SENDER;
  if (!emailFrom) {
    return NextResponse.json({ error: 'Missing EMAIL_SENDER configuration' }, { status: 500 });
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

  const supabase = getSupabaseServerComponentClient({ admin: true });
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
      });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true, recipients: Array.from(recipientSet) });
}
