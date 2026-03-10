export const dynamic = 'force-dynamic';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

import getLogger from '~/core/logger';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { renderChangelogEmail } from '~/lib/emails/changelog';
import {
  ChangelogEmailRouteRequestSchema,
  type ChangelogEmailRouteFailure,
  toChangelogEmailEntry,
} from '~/lib/ultaura/changelog-shared';
import { listChangelogEntries } from '~/lib/ultaura/changelog';

const logger = getLogger();
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';
const ACTIVE_AUDIENCE_STATUSES = ['active', 'trial'] as const;
const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

type AccountBillingRow = {
  id: string;
  billing_email: string | null;
  status: string;
};

function validateWebhookSecret(request: NextRequest): NextResponse | null {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get(INTERNAL_SECRET_HEADER);

  if (!expectedSecret) {
    logger.error('ULTAURA_INTERNAL_API_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!providedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const expected = Buffer.from(expectedSecret, 'utf8');
  const provided = Buffer.from(providedSecret, 'utf8');

  if (
    expected.length !== provided.length ||
    !crypto.timingSafeEqual(expected, provided)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

function getSiteUrl() {
  const candidate =
    process.env.NODE_ENV !== 'production'
      ? process.env.SITE_URL || 'http://localhost:3000'
      : process.env.SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'http://localhost:3000';

  return candidate.replace(/\/$/, '');
}

function getEmailSender() {
  return getNotificationsEmailSender();
}

function getReplyToEmail() {
  return getSupportReplyToEmail();
}

function buildSubject(publishedAt: string | undefined | null) {
  const date = publishedAt ? new Date(publishedAt) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const monthYear = MONTH_YEAR_FORMATTER.format(safeDate);

  return `What’s New at Ultaura — ${monthYear}`;
}

function normalizeEmail(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function redactEmailForLog(email: string) {
  const [localPart = '', domainPart = ''] = email.split('@');
  const localPrefix = localPart.slice(0, 1);
  const maskedLocal = localPrefix ? `${localPrefix}***` : '***';

  return domainPart ? `${maskedLocal}@${domainPart}` : maskedLocal;
}

export async function POST(request: NextRequest) {
  const unauthorizedResponse = validateWebhookSecret(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ChangelogEmailRouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { batchId, entryIds } = parsed.data;
  const uniqueEntryIds = Array.from(new Set(entryIds));
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });

  const entries = await listChangelogEntries(adminClient as any, {
    ids: uniqueEntryIds,
    published: true,
    publishBatchId: batchId,
    limit: null,
  });

  if (entries.length === 0) {
    return NextResponse.json(
      {
        success: false,
        batchId,
        error: 'No published changelog entries found for the requested batch',
        entryCount: 0,
        recipientsAttempted: 0,
        recipientsSent: 0,
        recipientsFailed: 0,
        dedupedFrom: 0,
        failures: [],
      },
      { status: 404 },
    );
  }

  let emailFrom: string;
  let replyTo: string;

  try {
    emailFrom = getEmailSender();
    replyTo = getReplyToEmail();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Missing email sender configuration' },
      { status: 500 },
    );
  }

  const { data: accounts, error: accountsError } = await adminClient
    .from('ultaura_accounts')
    .select('id, billing_email, status')
    .in('status', [...ACTIVE_AUDIENCE_STATUSES]);

  if (accountsError) {
    logger.error({ error: accountsError }, 'Failed to load changelog email audience');
    return NextResponse.json(
      { error: 'Failed to load changelog email audience' },
      { status: 500 },
    );
  }

  const accountRows = (accounts as AccountBillingRow[] | null) ?? [];
  const recipientsByKey = new Map<string, string>();
  let candidateRecipientCount = 0;

  for (const account of accountRows) {
    const email = normalizeEmail(account.billing_email);
    if (!email) {
      continue;
    }

    candidateRecipientCount += 1;
    const key = email.toLowerCase();
    if (!recipientsByKey.has(key)) {
      recipientsByKey.set(key, email);
    }
  }

  const recipientEmails = Array.from(recipientsByKey.values());
  const dedupedFrom = Math.max(0, candidateRecipientCount - recipientEmails.length);
  const siteUrl = getSiteUrl();
  const emailEntries = entries.map(toChangelogEmailEntry);
  const emailContent = renderChangelogEmail({
    entries: emailEntries,
    dashboardUrl: `${siteUrl}/dashboard`,
    previewText: emailEntries[0]?.title,
  });
  const subject = buildSubject(entries[0]?.publishedAt ?? entries[0]?.createdAt);

  const failures: ChangelogEmailRouteFailure[] = [];
  let recipientsAttempted = 0;
  let recipientsSent = 0;
  let recipientsFailed = 0;

  for (const email of recipientEmails) {
    recipientsAttempted += 1;

    try {
      await sendEmail({
        from: emailFrom,
        to: email,
        subject,
        html: emailContent.html,
        text: emailContent.text,
        replyTo,
      });
      recipientsSent += 1;
    } catch (error) {
      recipientsFailed += 1;
      failures.push({
        email,
        message: error instanceof Error ? error.message : 'Unknown send error',
      });

      logger.error(
        {
          error,
          batchId,
          entryIds: uniqueEntryIds,
          recipientEmailRedacted: redactEmailForLog(email),
        },
        'Failed to send changelog email',
      );
    }
  }

  const hasSendFailures = recipientsFailed > 0;
  const responseBody = {
    success: recipientsFailed === 0,
    batchId,
    entryCount: entries.length,
    recipientsAttempted,
    recipientsSent,
    recipientsFailed,
    dedupedFrom,
    ...(hasSendFailures
      ? { error: 'Some changelog emails failed to send' }
      : {}),
    failures,
  };

  return NextResponse.json(responseBody, {
    status: hasSendFailures ? 207 : 200,
  });
}
