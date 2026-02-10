'use server';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { isUltauraAdmin } from '~/lib/ultaura/admin-actions';
import {
  listBroadcasts as listResendBroadcasts,
  getBroadcast as getResendBroadcast,
  createBroadcast as createResendBroadcast,
  sendBroadcast as sendResendBroadcast,
  scheduleBroadcast as scheduleResendBroadcast,
  removeBroadcast as removeResendBroadcast,
} from '~/lib/resend/broadcasts';
import type { TopicKey } from '~/lib/resend/topics';
import sanitizeHtml from 'sanitize-html';

const logger = getLogger();

async function assertAdmin() {
  const isAdmin = await isUltauraAdmin();
  if (!isAdmin) throw new Error('Unauthorized');
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
  const offset = (page - 1) * perPage;

  let topicSubscriberIds: string[] | null = null;

  if (topic) {
    const { data: topicRows, error: topicError } = await adminClient
      .from('ultaura_newsletter_topic_subscriptions')
      .select('subscriber_id')
      .eq('topic_key', topic)
      .eq('subscribed', true);

    if (topicError) {
      logger.error({ error: topicError, topic }, 'Failed to resolve topic subscribers');
      return { subscribers: [], total: 0 };
    }

    topicSubscriberIds = Array.from(
      new Set(
        (topicRows || [])
          .map((row: { subscriber_id: string | null }) => row.subscriber_id)
          .filter((subscriberId): subscriberId is string => Boolean(subscriberId)),
      ),
    );

    if (topicSubscriberIds.length === 0) {
      return { subscribers: [], total: 0 };
    }
  }

  let query = adminClient
    .from('ultaura_newsletter_subscribers')
    .select(
      'id, email, first_name, status, source, confirmed_at, created_at, ultaura_newsletter_topic_subscriptions(topic_key, subscribed)',
      { count: 'exact' },
    );

  if (status) {
    query = query.eq('status', status);
  }
  if (source) {
    query = query.eq('source', source);
  }
  if (topicSubscriberIds) {
    query = query.in('id', topicSubscriberIds);
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    logger.error({ error }, 'Failed to list newsletter subscribers');
    return { subscribers: [], total: 0 };
  }

  let subscribers = (data || []).map((row: any) => ({
    id: row.id,
    email: row.email,
    first_name: row.first_name,
    status: row.status,
    source: row.source,
    confirmed_at: row.confirmed_at,
    created_at: row.created_at,
    topics: row.ultaura_newsletter_topic_subscriptions || [],
  }));

  return { subscribers, total: count || 0 };
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

  try {
    const { data: created, error: createError } = await createResendBroadcast({
      subject: params.subject,
      previewText: params.previewText,
      html: sanitizedHtml,
      topicKey: params.topicKey,
    });

    if (createError || !created)
      throw createError || new Error('Failed to create broadcast');

    if (params.scheduleAt) {
      const { error: scheduleError } = await scheduleResendBroadcast(created.id, params.scheduleAt);
      if (scheduleError) throw scheduleError;
      return {
        success: true,
        broadcastId: created.id,
        action: 'scheduled' as const,
      };
    }

    const { error: sendError } = await sendResendBroadcast(created.id);
    if (sendError) throw sendError;
    return { success: true, broadcastId: created.id, action: 'sent' as const };
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
    return { success: true };
  } catch (err) {
    logger.error({ error: err }, 'Failed to cancel broadcast');
    return { success: false, error: 'Failed to cancel broadcast' };
  }
}
