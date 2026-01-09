import crypto from 'crypto';
import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import renderMissedCallsAlertEmail from '~/lib/emails/missed-calls-alert';

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

function buildTextAlert(payload: MissedCallsAlertPayload): string {
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
  ].join('\n');
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
    .select('billing_email')
    .eq('id', payload.accountId)
    .single();

  if (accountError || !account?.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  const subject = `Missed check-ins for ${payload.lineName}`;
  const html = renderMissedCallsAlertEmail({
    lineName: payload.lineName,
    consecutiveMissedCount: payload.consecutiveMissedCount,
    dashboardUrl: payload.dashboardUrl,
    settingsUrl: payload.settingsUrl,
  });
  const text = buildTextAlert(payload);

  try {
    await sendEmail({
      from: emailFrom,
      to: account.billing_email,
      subject,
      html,
      text,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send missed call alert email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
