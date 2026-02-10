'use server';

import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import {
  buildNewsletterUnsubscribeToken,
  hashConfirmationToken,
  verifyNewsletterUnsubscribeToken,
} from './newsletter-tokens';
import {
  confirmResendContact,
  createPendingContact,
  ensureResendContact,
  unsubscribeResendContact,
} from '~/lib/resend/contacts';
import { TOPIC_KEYS, type TopicKey } from '~/lib/resend/topics';
import sendEmail from '~/core/email/send-email';
import renderNewsletterWelcomeEmail from '~/lib/emails/newsletter-welcome';

const logger = getLogger();

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || process.env.EMAIL_SENDER || 'Ultaura <newsletter@ultaura.com>';
}

interface SubscribeParams {
  email: string;
  firstName?: string;
  source: string;
  sourceUrl?: string;
  ip: string | null;
  userAgent: string | null;
}

export async function subscribeToNewsletter(params: SubscribeParams): Promise<{ success: boolean; message: string }> {
  const { email, firstName, source, sourceUrl, ip, userAgent } = params;
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const trimmedEmail = email.trim();
  const now = new Date().toISOString();
  const defaultTopics = TOPIC_KEYS.slice();

  // Check for existing subscriber
  const { data: existing } = await adminClient
    .from('ultaura_newsletter_subscribers')
    .select('id, status, resend_contact_id')
    .eq('email', trimmedEmail)
    .single();

  if (existing) {
    if (existing.status === 'confirmed') {
      return { success: true, message: 'You are already subscribed.' };
    }

    const { error: updateError } = await adminClient
      .from('ultaura_newsletter_subscribers')
      .update({
        status: 'confirmed',
        first_name: firstName || null,
        source,
        source_url: sourceUrl || null,
        confirmation_token_hash: null,
        confirmation_token_expires_at: null,
        confirmation_token_consumed_at: now,
        pending_topics: null,
        confirmed_at: now,
        consent_ip: ip,
        consent_user_agent: userAgent,
        consent_timestamp: now,
        confirmation_ip: ip,
        confirmation_user_agent: userAgent,
        unsubscribed_at: null,
        updated_at: now,
      })
      .eq('id', existing.id);

    if (updateError) {
      logger.error({ error: updateError }, 'Failed to update newsletter subscriber');
      return { success: false, message: 'Something went wrong. Please try again.' };
    }

    const topicRows = defaultTopics.map((topicKey) => ({
      subscriber_id: existing.id,
      topic_key: topicKey,
      subscribed: true,
      subscribed_at: now,
      unsubscribed_at: null,
    }));

    const { error: topicError } = await adminClient
      .from('ultaura_newsletter_topic_subscriptions')
      .upsert(topicRows, { onConflict: 'subscriber_id,topic_key' });

    if (topicError) {
      logger.error({ error: topicError, subscriberId: existing.id }, 'Failed to upsert topic subscriptions');
      return { success: false, message: 'Something went wrong. Please try again.' };
    }

    try {
      const ensuredResendId = await ensureResendContact(trimmedEmail, firstName || null, existing.resend_contact_id);
      const resendId = await confirmResendContact(ensuredResendId, trimmedEmail, firstName || null, defaultTopics);
      if (resendId !== existing.resend_contact_id && resendId) {
        await adminClient
          .from('ultaura_newsletter_subscribers')
          .update({ resend_contact_id: resendId })
          .eq('id', existing.id);
      }
    } catch (err) {
      logger.error({ error: err }, 'Failed to sync Resend contact');
    }

    try {
      await sendWelcomeEmail(trimmedEmail, firstName || null, existing.id, defaultTopics);
    } catch (err) {
      logger.error({ error: err }, 'Failed to send welcome email');
    }

    return { success: true, message: 'You are now subscribed!' };
  }

  // New subscriber
  const { data: newSub, error: insertError } = await adminClient
    .from('ultaura_newsletter_subscribers')
    .insert({
      email: trimmedEmail,
      first_name: firstName || null,
      source,
      source_url: sourceUrl || null,
      status: 'confirmed',
      confirmation_token_hash: null,
      confirmation_token_expires_at: null,
      confirmation_token_consumed_at: now,
      pending_topics: null,
      confirmed_at: now,
      consent_ip: ip,
      consent_user_agent: userAgent,
      consent_timestamp: now,
      confirmation_ip: ip,
      confirmation_user_agent: userAgent,
    })
    .select('id')
    .single();

  if (insertError) {
    logger.error({ error: insertError }, 'Failed to insert newsletter subscriber');
    return { success: false, message: 'Something went wrong. Please try again.' };
  }

  const topicInserts = defaultTopics.map((topicKey) => ({
    subscriber_id: newSub.id,
    topic_key: topicKey,
    subscribed: true,
    subscribed_at: now,
    unsubscribed_at: null,
  }));

  const { error: topicError } = await adminClient
    .from('ultaura_newsletter_topic_subscriptions')
    .upsert(topicInserts, { onConflict: 'subscriber_id,topic_key' });

  if (topicError) {
    logger.error({ error: topicError, subscriberId: newSub.id }, 'Failed to upsert topic subscriptions');
    return { success: false, message: 'Something went wrong. Please try again.' };
  }

  try {
    const pendingResendId = await createPendingContact(trimmedEmail, firstName || null, source);
    const resendId = await confirmResendContact(pendingResendId, trimmedEmail, firstName || null, defaultTopics);
    await adminClient
      .from('ultaura_newsletter_subscribers')
      .update({ resend_contact_id: resendId })
      .eq('id', newSub.id);
  } catch (err) {
    logger.error({ error: err }, 'Failed to create Resend contact');
  }

  try {
    await sendWelcomeEmail(trimmedEmail, firstName || null, newSub.id, defaultTopics);
  } catch (err) {
    logger.error({ error: err }, 'Failed to send welcome email');
  }

  return { success: true, message: 'You are now subscribed!' };
}

export async function confirmSubscription(
  token: string,
  ip: string | null,
  userAgent: string | null,
): Promise<{ success: boolean; message: string }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const tokenHash = hashConfirmationToken(token);
  const now = new Date().toISOString();

  // Atomic confirmation: only succeeds if token is valid, unconsumed, unexpired, and status is pending
  const { data: subscriber, error } = await adminClient
    .from('ultaura_newsletter_subscribers')
    .update({
      status: 'confirmed',
      confirmed_at: now,
      confirmation_token_consumed_at: now,
      confirmation_ip: ip,
      confirmation_user_agent: userAgent,
      updated_at: now,
    })
    .eq('confirmation_token_hash', tokenHash)
    .is('confirmation_token_consumed_at', null)
    .gt('confirmation_token_expires_at', now)
    .eq('status', 'pending')
    .select('id, email, first_name, pending_topics, resend_contact_id')
    .single();

  if (error || !subscriber) {
    const { data: alreadyConfirmed } = await adminClient
      .from('ultaura_newsletter_subscribers')
      .select('id')
      .eq('confirmation_token_hash', tokenHash)
      .eq('status', 'confirmed')
      .maybeSingle();

    if (alreadyConfirmed) {
      return { success: true, message: 'You are now subscribed!' };
    }

    return { success: false, message: 'This confirmation link is invalid, expired, or has already been used.' };
  }

  const selectedTopics = TOPIC_KEYS.slice();

  // Insert topic subscriptions
  const topicInserts = selectedTopics.map((topicKey) => ({
    subscriber_id: subscriber.id,
    topic_key: topicKey,
    subscribed: true,
    subscribed_at: now,
  }));

  const { error: topicError } = await adminClient
    .from('ultaura_newsletter_topic_subscriptions')
    .upsert(topicInserts, { onConflict: 'subscriber_id,topic_key' });

  if (topicError) {
    logger.error({ error: topicError, subscriberId: subscriber.id }, 'Failed to insert topic subscriptions');

    // Revert confirmation so the same link works on retry
    await adminClient
      .from('ultaura_newsletter_subscribers')
      .update({
        status: 'pending',
        confirmed_at: null,
        confirmation_token_consumed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', subscriber.id);

    return {
      success: false,
      message: 'Something went wrong while saving your preferences. Please click the confirmation link again.',
    };
  }

  // Clear pending_topics on successful topic insert
  await adminClient
    .from('ultaura_newsletter_subscribers')
    .update({ pending_topics: null })
    .eq('id', subscriber.id);

  // Confirm in Resend (add to segment, apply topic preferences)
  try {
    const resendId = await confirmResendContact(
      subscriber.resend_contact_id || '',
      subscriber.email,
      subscriber.first_name,
      selectedTopics,
    );
    if (resendId !== subscriber.resend_contact_id) {
      await adminClient
        .from('ultaura_newsletter_subscribers')
        .update({ resend_contact_id: resendId })
        .eq('id', subscriber.id);
    }
  } catch (err) {
    logger.error({ error: err }, 'Failed to confirm Resend contact');
  }

  try {
    await sendWelcomeEmail(subscriber.email, subscriber.first_name, subscriber.id, selectedTopics);
  } catch (err) {
    logger.error({ error: err }, 'Failed to send welcome email');
  }

  return { success: true, message: 'You are now subscribed!' };
}

export async function unsubscribeNewsletterSubscriber(
  subscriberId: string,
  token: string,
): Promise<{ success: boolean; message: string }> {
  if (!verifyNewsletterUnsubscribeToken(subscriberId, token)) {
    return {
      success: false,
      message: 'This unsubscribe link is invalid or has expired.',
    };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const now = new Date().toISOString();

  const { data: subscriber, error } = await adminClient
    .from('ultaura_newsletter_subscribers')
    .update({
      status: 'unsubscribed',
      unsubscribed_at: now,
      updated_at: now,
    })
    .eq('id', subscriberId)
    .select('id, resend_contact_id')
    .single();

  if (error || !subscriber) {
    logger.error({ error, subscriberId }, 'Failed to unsubscribe newsletter subscriber');
    return {
      success: false,
      message: 'We could not process your unsubscribe request.',
    };
  }

  if (subscriber.resend_contact_id) {
    try {
      const { data: topicRows } = await adminClient
        .from('ultaura_newsletter_topic_subscriptions')
        .select('topic_key')
        .eq('subscriber_id', subscriber.id)
        .eq('subscribed', true);
      const activeTopics = ((topicRows || []) as Array<{ topic_key: string }>).map(
        (row) => row.topic_key as TopicKey,
      );
      await unsubscribeResendContact(subscriber.resend_contact_id, activeTopics);
    } catch (err) {
      logger.error({ error: err, subscriberId }, 'Failed to unsubscribe Resend contact');
    }
  }

  return {
    success: true,
    message: 'You are unsubscribed from the Ultaura newsletter.',
  };
}

async function sendWelcomeEmail(
  email: string,
  firstName: string | null,
  subscriberId: string,
  subscribedTopics: TopicKey[],
) {
  const siteUrl = getSiteUrl();
  const unsubscribeToken = buildNewsletterUnsubscribeToken(subscriberId);
  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe/${subscriberId}/${unsubscribeToken}`;

  const { html, text } = renderNewsletterWelcomeEmail({
    firstName: firstName || undefined,
    subscribedTopics,
    unsubscribeUrl,
  });

  await sendEmail({
    from: getFromEmail(),
    to: email,
    subject: 'Welcome to the Ultaura newsletter',
    html,
    text,
  });
}
