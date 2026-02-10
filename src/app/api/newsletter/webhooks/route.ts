export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import type { SupabaseClient } from '@supabase/supabase-js';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import getLogger from '~/core/logger';
import { hashPii } from '~/lib/ultaura/newsletter-log';
import { scheduleNewsletterRetentionPrune } from '~/lib/ultaura/newsletter-retention';

const logger = getLogger();

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    logger.error('RESEND_WEBHOOK_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const rawBody = await request.text();
  const svixId = request.headers.get('svix-id') || '';
  const svixTimestamp = request.headers.get('svix-timestamp') || '';
  const svixSignature = request.headers.get('svix-signature') || '';

  let parsedPayload: Record<string, unknown>;
  try {
    const wh = new Webhook(webhookSecret);
    parsedPayload = wh.verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as Record<string, unknown>;
  } catch (err) {
    logger.error({ error: err }, 'Webhook signature verification failed');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventType = (parsedPayload.type as string) || 'unknown';
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });
  const STALE_CLAIM_MS = 5 * 60 * 1000;

  scheduleNewsletterRetentionPrune(adminClient);

  // SELECT-first retry-safe idempotency
  const { data: existingEvent } = await adminClient
    .from('ultaura_newsletter_webhook_events')
    .select('status, claimed_at')
    .eq('svix_id', svixId)
    .single();

  if (existingEvent) {
    if (existingEvent.status === 'processed') {
      return NextResponse.json({ ok: true });
    }

    const isStale =
      existingEvent.status === 'processing' &&
      existingEvent.claimed_at &&
      Date.now() - new Date(existingEvent.claimed_at).getTime() > STALE_CLAIM_MS;

    if (existingEvent.status === 'processing' && !isStale) {
      // Another handler is actively processing this event
      return NextResponse.json({ ok: true });
    }

    // Failed or stale — reclaim for retry
    await adminClient
      .from('ultaura_newsletter_webhook_events')
      .update({
        status: 'processing',
        claimed_at: new Date().toISOString(),
        error_message: null,
        completed_at: null,
      })
      .eq('svix_id', svixId);
  } else {
    // New event — INSERT
    const { error: insertError } = await adminClient
      .from('ultaura_newsletter_webhook_events')
      .insert({
        svix_id: svixId,
        event_type: eventType,
      });

    if (insertError) {
      if (insertError.code === '23505') {
        // Race condition: another handler inserted between our SELECT and INSERT
        const { data: raceCheck } = await adminClient
          .from('ultaura_newsletter_webhook_events')
          .select('status')
          .eq('svix_id', svixId)
          .single();
        if (raceCheck?.status === 'processed') {
          return NextResponse.json({ ok: true });
        }
        // Another handler is working on it — let them finish
        return NextResponse.json({ ok: true });
      }
      logger.error({ error: insertError }, 'Failed to insert webhook event');
      return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
  }

  // Route by event type
  try {
    switch (eventType) {
      case 'contact.updated':
        await handleContactUpdated(adminClient, parsedPayload);
        break;
      case 'contact.deleted':
        await handleContactDeleted(adminClient, parsedPayload);
        break;
      case 'email.bounced':
        await handleEmailBounced(adminClient, parsedPayload);
        break;
      case 'email.complained':
        await handleEmailComplained(adminClient, parsedPayload);
        break;
      default:
        logger.info({ eventType }, 'Unhandled newsletter webhook event type');
        break;
    }

    // Mark as processed
    const { error: processedError } = await adminClient
      .from('ultaura_newsletter_webhook_events')
      .update({ status: 'processed', completed_at: new Date().toISOString() })
      .eq('svix_id', svixId);

    if (processedError) {
      logger.warn({ error: processedError, svixId }, 'Failed to mark webhook event as processed (work was completed)');
    }
  } catch (err) {
    logger.error({ error: err, eventType }, 'Error processing newsletter webhook event');

    // Mark as failed — stale claim timeout will allow retries
    const { error: failedError } = await adminClient
      .from('ultaura_newsletter_webhook_events')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      })
      .eq('svix_id', svixId);

    if (failedError) {
      logger.error({ error: failedError, svixId }, 'Failed to mark webhook event as failed');
    }

    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

function getPayloadData(payload: Record<string, unknown>) {
  return payload.data as Record<string, unknown> | undefined;
}

function getPayloadEmail(data: Record<string, unknown>): string | undefined {
  return (data.to as string[] | undefined)?.[0] || (data.email as string | undefined);
}

async function handleContactUpdated(client: SupabaseClient, payload: Record<string, unknown>) {
  const data = getPayloadData(payload);
  if (!data) return;

  const resendContactId = data.id as string | undefined;
  if (!resendContactId) return;

  const { data: subscriber } = await client
    .from('ultaura_newsletter_subscribers')
    .select('id')
    .eq('resend_contact_id', resendContactId)
    .single();

  if (!subscriber) {
    logger.warn({ resendContactId }, 'No subscriber found for Resend contact update');
    return;
  }

  const subscribedTopics = (data.subscribed_topics as string[]) || [];
  const unsubscribedTopics = (data.unsubscribed_topics as string[]) || [];
  const now = new Date().toISOString();

  for (const topicKey of subscribedTopics) {
    const { error } = await client
      .from('ultaura_newsletter_topic_subscriptions')
      .upsert(
        {
          subscriber_id: subscriber.id,
          topic_key: topicKey,
          subscribed: true,
          subscribed_at: now,
          unsubscribed_at: null,
        },
        { onConflict: 'subscriber_id,topic_key' },
      );

    if (error) {
      throw new Error(`Failed syncing subscribed topic ${topicKey}: ${error.message}`);
    }
  }

  for (const topicKey of unsubscribedTopics) {
    const { error } = await client
      .from('ultaura_newsletter_topic_subscriptions')
      .upsert(
        {
          subscriber_id: subscriber.id,
          topic_key: topicKey,
          subscribed: false,
          unsubscribed_at: now,
        },
        { onConflict: 'subscriber_id,topic_key' },
      );

    if (error) {
      throw new Error(`Failed syncing unsubscribed topic ${topicKey}: ${error.message}`);
    }
  }

  logger.info({ resendContactId }, 'Synced contact topic preferences from Resend');
}

async function handleContactDeleted(client: SupabaseClient, payload: Record<string, unknown>) {
  const data = getPayloadData(payload);
  if (!data) return;

  const resendContactId = data.id as string | undefined;
  if (!resendContactId) return;

  const now = new Date().toISOString();
  const { error } = await client
    .from('ultaura_newsletter_subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: now, updated_at: now })
    .eq('resend_contact_id', resendContactId);

  if (error) {
    logger.error({ error, resendContactId }, 'Failed to mark subscriber as unsubscribed');
  } else {
    logger.info({ resendContactId }, 'Marked subscriber as unsubscribed (contact deleted in Resend)');
  }
}

async function updateSubscriberByEmail(
  client: SupabaseClient,
  payload: Record<string, unknown>,
  field: string,
  logLabel: string,
) {
  const data = getPayloadData(payload);
  if (!data) return;

  const email = getPayloadEmail(data);
  if (!email) return;

  const now = new Date().toISOString();
  const { error } = await client
    .from('ultaura_newsletter_subscribers')
    .update({ [field]: now, updated_at: now })
    .eq('email', email);

  if (error) {
    throw new Error(`Failed to mark subscriber as ${logLabel}: ${error.message}`);
  }

  logger.info({ emailHash: hashPii(email) }, `Marked subscriber as ${logLabel}`);
}

async function handleEmailBounced(client: SupabaseClient, payload: Record<string, unknown>) {
  await updateSubscriberByEmail(client, payload, 'bounced_at', 'bounced');
}

async function handleEmailComplained(client: SupabaseClient, payload: Record<string, unknown>) {
  await updateSubscriberByEmail(client, payload, 'complained_at', 'complained');
}
