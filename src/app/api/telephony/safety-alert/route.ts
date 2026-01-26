import crypto from 'crypto';
import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import renderSafetyAlertEmail from '~/lib/emails/safety-alert';

interface SafetyAlertPayload {
  accountId: string;
  lineId: string;
  severity: 'high';
  actionTaken: string;
  dashboardUrl: string;
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

function buildTextAlert(payload: {
  lineName: string;
  severity: 'high';
  actionTaken: string;
  dashboardUrl: string;
}): string {
  return [
    `Safety alert for ${payload.lineName}`,
    '',
    `Action taken: ${payload.actionTaken}`,
    '',
    'Suggested next step: reach out and check in.',
    'If you believe there is immediate danger, contact local emergency services (911 in the US).',
    '',
    `View safety alerts: ${payload.dashboardUrl}`,
  ].join('\n');
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

  const emailFrom = process.env.EMAIL_SENDER;
  if (!emailFrom) {
    return NextResponse.json({ error: 'Missing EMAIL_SENDER configuration' }, { status: 500 });
  }

  const supabase = getSupabaseServerComponentClient({ admin: true });
  const { data: account, error: accountError } = await supabase
    .from('ultaura_accounts')
    .select('billing_email')
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

  try {
    const subject = `Safety alert for ${lineName}`;
    const html = renderSafetyAlertEmail({
      lineName,
      actionTaken: payload.actionTaken,
      severity: payload.severity ?? 'high',
      dashboardUrl: payload.dashboardUrl,
    });
    const text = buildTextAlert({
      lineName,
      severity: payload.severity ?? 'high',
      actionTaken: payload.actionTaken,
      dashboardUrl: payload.dashboardUrl,
    });

    await sendEmail({
      from: emailFrom,
      to: account.billing_email,
      subject,
      html,
      text,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send safety alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
