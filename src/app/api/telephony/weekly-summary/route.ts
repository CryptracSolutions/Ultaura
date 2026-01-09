import crypto from 'crypto';
import { NextResponse } from 'next/server';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import renderWeeklySummaryEmail from '~/lib/emails/weekly-summary';
import type { WeeklySummaryData } from '~/lib/ultaura/types';

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

function formatTrend(value: number | null, unit?: string): string {
  if (value === null) return '';
  const sign = value > 0 ? `+${value}` : `${value}`;
  return ` (${sign}${unit ?? ''} vs last week)`;
}

function buildTextSummary(summary: WeeklySummaryData): string {
  const lines: Array<string | null> = [
    `Weekly Check-in Summary for ${summary.lineName}`,
    `Week of ${summary.weekStartDate} to ${summary.weekEndDate}`,
    '',
    `Calls answered: ${summary.answeredCalls}/${summary.scheduledCalls} scheduled${formatTrend(summary.answerTrendValue)}`,
    `Average duration: ${summary.avgDurationMinutes}m${formatTrend(summary.durationTrendValue, 'm')}`,
    summary.showMissedCallsWarning ? `Missed calls: ${summary.missedCalls}` : null,
    summary.engagementNote ? `Engagement: ${summary.engagementNote}` : null,
    summary.moodSummary ? `Mood: ${summary.moodSummary}` : null,
    summary.moodShiftNote ? `Mood pattern: ${summary.moodShiftNote}` : null,
    summary.socialNeedNote ? summary.socialNeedNote : null,
    summary.topTopics.length > 0
      ? `Topics: ${summary.topTopics.map((topic) => topic.label).join(', ')}`
      : null,
    summary.concerns.length > 0
      ? `Wellbeing notes: ${summary.concerns
          .map((concern) => {
            const novelty = concern.novelty[0].toUpperCase() + concern.novelty.slice(1);
            const severity =
              concern.novelty === 'resolved'
                ? ` (was ${concern.severity})`
                : ` (${concern.severity})`;
            return `${novelty}: ${concern.label}${severity}`;
          })
          .join('; ')}`
      : null,
    summary.needsFollowUp
      ? `Follow-up suggested: ${summary.followUpReasons.join(', ')}`
      : null,
    '',
    `Manage notification preferences: ${summary.settingsUrl}`,
  ];

  return lines.filter(Boolean).join('\n');
}

export async function POST(request: Request) {
  const unauthorizedResponse = validateWebhookSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const body = await request.json().catch(() => null);
  const summary = body as WeeklySummaryData | null;

  if (!summary?.accountId || !summary?.lineName || !summary?.settingsUrl) {
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
    .eq('id', summary.accountId)
    .single();

  if (accountError || !account?.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  const subject = `Weekly Check-in Summary for ${summary.lineName}`;
  const html = renderWeeklySummaryEmail({
    ...summary,
    billingEmail: account.billing_email,
  });
  const text = buildTextSummary(summary);

  try {
    await sendEmail({
      from: emailFrom,
      to: account.billing_email,
      subject,
      html,
      text,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send weekly summary email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
