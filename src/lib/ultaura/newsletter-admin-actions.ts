'use server';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { isUltauraAdmin } from '~/lib/ultaura/admin-actions';
import {
  getCurrentAdminContext,
  writeAdminAuditLog,
} from '~/lib/ultaura/admin/audit-log';
import {
  listBroadcasts as listResendBroadcasts,
  getBroadcast as getResendBroadcast,
  createBroadcast as createResendBroadcast,
  sendBroadcast as sendResendBroadcast,
  scheduleBroadcast as scheduleResendBroadcast,
  removeBroadcast as removeResendBroadcast,
} from '~/lib/resend/broadcasts';
import { TOPIC_LABELS } from '~/lib/resend/topic-metadata';
import type { TopicKey } from '~/lib/resend/topics';
import sanitizeHtml from 'sanitize-html';
import { renderBroadcastHtmlEmail } from '~/lib/emails/newsletter-broadcast';

const logger = getLogger();
const DEFAULT_SUBSCRIBERS_PER_PAGE = 25;
const MIN_SUBSCRIBERS_PER_PAGE = 1;
const MAX_SUBSCRIBERS_PER_PAGE = 100;

type AdminAuditLogEntry = Parameters<typeof writeAdminAuditLog>[1];

async function assertAdmin() {
  const isAdmin = await isUltauraAdmin();
  if (!isAdmin) throw new Error('Unauthorized');
}

function getEffectiveSubscriberPerPage(perPage: number) {
  const normalizedPerPage = Number.isFinite(perPage)
    ? Math.floor(perPage)
    : DEFAULT_SUBSCRIBERS_PER_PAGE;

  return Math.min(
    MAX_SUBSCRIBERS_PER_PAGE,
    Math.max(MIN_SUBSCRIBERS_PER_PAGE, normalizedPerPage),
  );
}

async function safeWriteNewsletterAdminAuditLog(entry: AdminAuditLogEntry) {
  try {
    const adminContext = await getCurrentAdminContext();

    if (!adminContext) {
      return;
    }

    await writeAdminAuditLog(adminContext, entry);
  } catch (error) {
    logger.warn(
      {
        error,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
      },
      'Failed to write newsletter admin audit log',
    );
  }
}

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'h2',
    'h3',
    'strong',
    'em',
    'a',
    'ul',
    'ol',
    'li',
    'br',
    'hr',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
  },
};

export interface SubscriberRow {
  id: string;
  email: string;
  first_name: string | null;
  status: string;
  source: string;
  confirmed_at: string | null;
  created_at: string;
  topics: Array<{ topic_key: string; subscribed: boolean }>;
}

export interface SubscriberListResult {
  subscribers: SubscriberRow[];
  total: number;
  effectivePerPage: number;
}

function mapSubscriberRow(row: any): SubscriberRow {
  return {
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    status: row.status,
    source: row.source,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
    topics: row.ultaura_newsletter_topic_subscriptions || [],
  };
}

export async function listSubscribers(params: {
  page: number;
  perPage: number;
  status?: string;
  source?: string;
  topic?: string;
}): Promise<SubscriberListResult> {
  await assertAdmin();
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const { page, perPage, status, source, topic } = params;
  const effectivePerPage = getEffectiveSubscriberPerPage(perPage);
  const offset = (page - 1) * effectivePerPage;
  const topicRelation = topic
    ? 'ultaura_newsletter_topic_subscriptions!inner(topic_key, subscribed)'
    : 'ultaura_newsletter_topic_subscriptions(topic_key, subscribed)';

  let query = adminClient
    .from('ultaura_newsletter_subscribers')
    .select(
      `id, email, first_name, status, source, confirmed_at, created_at, ${topicRelation}`,
      { count: 'exact' },
    );

  if (status) {
    query = query.eq('status', status);
  }
  if (source) {
    query = query.eq('source', source);
  }
  if (topic) {
    query = query
      .eq('ultaura_newsletter_topic_subscriptions.topic_key', topic)
      .eq('ultaura_newsletter_topic_subscriptions.subscribed', true);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + effectivePerPage - 1);

  const total = count || 0;
  if (error) {
    logger.error({ error }, 'Failed to list newsletter subscribers');
  }
  const subscribers = error ? [] : (data || []).map(mapSubscriberRow);

  await safeWriteNewsletterAdminAuditLog({
    action: 'newsletter.subscribers.list',
    targetType: 'newsletter_subscribers',
    metadata: {
      filters: {
        page,
        perPage,
        status: status ?? null,
        source: source ?? null,
        topic: topic ?? null,
      },
      resultCount: total,
    },
  });

  return { subscribers, total, effectivePerPage };
}

export async function getSubscriberStats() {
  await assertAdmin();
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const [
    confirmed,
    pending,
    unsubscribed,
    blogDigest,
    elderCareTips,
    productUpdates,
  ] = await Promise.all([
    adminClient
      .from('ultaura_newsletter_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed'),
    adminClient
      .from('ultaura_newsletter_subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    adminClient
      .from('ultaura_newsletter_subscribers')
      .select('*', { count: 'exact', head: true })
      .in('status', ['unsubscribed', 'expired_pending']),
    adminClient
      .from('ultaura_newsletter_topic_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('topic_key', 'blog_digest')
      .eq('subscribed', true),
    adminClient
      .from('ultaura_newsletter_topic_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('topic_key', 'elder_care_tips')
      .eq('subscribed', true),
    adminClient
      .from('ultaura_newsletter_topic_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('topic_key', 'product_updates')
      .eq('subscribed', true),
  ]);

  return {
    confirmed: confirmed.count || 0,
    pending: pending.count || 0,
    unsubscribed: unsubscribed.count || 0,
    topicCounts: {
      blog_digest: blogDigest.count || 0,
      elder_care_tips: elderCareTips.count || 0,
      product_updates: productUpdates.count || 0,
    },
  };
}

export async function adminListBroadcasts() {
  await assertAdmin();
  try {
    const { data, error } = await listResendBroadcasts();
    if (error) throw error;
    return { broadcasts: data?.data || [], error: null };
  } catch (err) {
    logger.error({ error: err }, 'Failed to list broadcasts');
    return { broadcasts: [], error: 'Failed to load broadcasts' };
  }
}

export async function adminGetBroadcast(broadcastId: string) {
  await assertAdmin();
  try {
    const { data, error } = await getResendBroadcast(broadcastId);
    if (error) throw error;
    if (data && typeof data === 'object' && 'html' in data) {
      const broadcast = data as { html?: string };
      broadcast.html = sanitizeHtml(
        String(broadcast.html || ''),
        SANITIZE_OPTIONS,
      );
    }
    return { broadcast: data, error: null };
  } catch (err) {
    logger.error({ error: err }, 'Failed to get broadcast');
    return { broadcast: null, error: 'Failed to load broadcast' };
  }
}

export async function adminCreateAndSendBroadcast(params: {
  subject: string;
  previewText?: string;
  html: string;
  topicKey: TopicKey;
  scheduleAt?: string;
}) {
  await assertAdmin();
  const sanitizedHtml = sanitizeHtml(params.html, SANITIZE_OPTIONS);
  const rendered = renderBroadcastHtmlEmail({
    subject: params.subject,
    topicLabel: TOPIC_LABELS[params.topicKey],
    htmlContent: sanitizedHtml,
    unsubscribeUrl: '{{{RESEND_UNSUBSCRIBE_URL}}}',
    previewText: params.previewText,
  });

  try {
    const { data: created, error: createError } = await createResendBroadcast({
      subject: params.subject,
      previewText: params.previewText,
      html: rendered.html,
      topicKey: params.topicKey,
    });

    if (createError || !created)
      throw createError || new Error('Failed to create broadcast');

    let action: 'scheduled' | 'sent';

    if (params.scheduleAt) {
      const { error: scheduleError } = await scheduleResendBroadcast(created.id, params.scheduleAt);
      if (scheduleError) throw scheduleError;
      action = 'scheduled';
    } else {
      const { error: sendError } = await sendResendBroadcast(created.id);
      if (sendError) throw sendError;
      action = 'sent';
    }

    await safeWriteNewsletterAdminAuditLog({
      action: 'newsletter.broadcast.send',
      targetType: 'broadcast',
      targetId: created.id,
      metadata: {
        broadcastId: created.id,
        subject: params.subject,
        topicKey: params.topicKey,
        action,
      },
    });

    return { success: true, broadcastId: created.id, action };
  } catch (err) {
    logger.error({ error: err }, 'Failed to create/send broadcast');
    return {
      success: false,
      broadcastId: null,
      action: null,
      error: 'Failed to send broadcast',
    };
  }
}

export async function adminCancelBroadcast(broadcastId: string) {
  await assertAdmin();
  try {
    const { error: removeError } = await removeResendBroadcast(broadcastId);
    if (removeError) throw removeError;

    await safeWriteNewsletterAdminAuditLog({
      action: 'newsletter.broadcast.cancel',
      targetType: 'broadcast',
      targetId: broadcastId,
      metadata: {
        broadcastId,
      },
    });

    return { success: true };
  } catch (err) {
    logger.error({ error: err }, 'Failed to cancel broadcast');
    return { success: false, error: 'Failed to cancel broadcast' };
  }
}
