import type { Stripe } from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

import { NextResponse } from 'next/server';

import getStripeInstance from '~/core/stripe/get-stripe';
import StripeWebhooks from '~/core/stripe/stripe-webhooks.enum';
import getLogger from '~/core/logger';

import {
  throwBadRequestException,
  throwInternalServerErrorException,
} from '~/core/http-exceptions';

import {
  addSubscription,
  deleteSubscription,
  updateSubscriptionById,
} from '~/lib/subscriptions/mutations';

import {
  syncUltauraSubscription,
  handleUltauraSubscriptionDeleted,
  isUltauraPriceId,
} from '~/lib/ultaura/billing';

import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { setOrganizationSubscriptionData } from '~/lib/organizations/database/mutations';

export const dynamic = 'force-dynamic';

const STRIPE_SIGNATURE_HEADER = 'stripe-signature';

const webhookSecretKey = process.env.STRIPE_WEBHOOK_SECRET as string;

/**
 * @description Handle the webhooks from Stripe related to checkouts
 */
export async function POST(request: Request) {
  const logger = getLogger();
  const signature = request.headers.get(STRIPE_SIGNATURE_HEADER);

  logger.info(`[Stripe] Received Stripe Webhook`);

  if (!webhookSecretKey) {
    return throwInternalServerErrorException(
      `The variable STRIPE_WEBHOOK_SECRET is unset. Please add the STRIPE_WEBHOOK_SECRET environment variable`,
    );
  }

  // verify signature header is not missing
  if (!signature) {
    return throwBadRequestException();
  }

  const rawBody = await request.text();
  const stripe = await getStripeInstance();

  // create an Admin client to write to the subscriptions table
  const client = getSupabaseRouteHandlerClient({
    admin: true,
  });

  try {
    // build the event from the raw body and signature using Stripe
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecretKey,
    );

    logger.info(
      {
        type: event.type,
      },
      `[Stripe] Processing Stripe Webhook...`,
    );

    switch (event.type) {
      case StripeWebhooks.Completed: {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId = session.subscription;

        if (!subscriptionId || typeof subscriptionId !== 'string') {
          logger.error(
            { eventId: event.id },
            `[Stripe] Missing subscription ID in checkout session`,
          );
          return throwBadRequestException('Missing subscription ID');
        }

        let subscription =
          await stripe.subscriptions.retrieve(subscriptionId);
        let organizationUid = getOrganizationUidFromClientReference(session);

        if (!organizationUid) {
          if (!isOnboardingCheckoutSession(session)) {
            logger.error(
              {
                eventId: event.id,
                sessionId: session.id,
              },
              '[Stripe] Missing client_reference_id in checkout session',
            );

            return throwBadRequestException('Missing client_reference_id');
          }

          const resolved = await resolveOrganizationUid({
            client,
            session,
            subscription,
          });
          organizationUid = resolved.organizationUid;

          if (!organizationUid) {
            logger.warn(
              {
                eventId: event.id,
                sessionId: session.id,
                subscriptionId: subscription.id,
                issue: 'onboarding_missing_client_reference_id_unresolved',
              },
              '[Stripe] Onboarding checkout missing client_reference_id and could not resolve org UID. Deferred to onboarding completion + reconciliation.',
            );
            break;
          }

          if (subscription.metadata?.organization_uid !== organizationUid) {
            try {
              subscription = await stripe.subscriptions.update(subscription.id, {
                metadata: {
                  ...(subscription.metadata ?? {}),
                  organization_uid: organizationUid,
                },
              });
            } catch (error) {
              logger.warn(
                {
                  eventId: event.id,
                  sessionId: session.id,
                  subscriptionId: subscription.id,
                  organizationUid,
                  error,
                },
                '[Stripe] Failed to persist resolved organization UID on onboarding subscription metadata',
              );
            }
          }

          logger.info(
            {
              eventId: event.id,
              sessionId: session.id,
              subscriptionId: subscription.id,
              organizationUid,
              strategy: resolved.strategy,
            },
            '[Stripe] Resolved onboarding organization UID without client_reference_id',
          );
        }

        await onCheckoutCompleted(client, session, subscription, organizationUid);

        // Sync Ultaura subscription if this is an Ultaura plan
        const hasUltauraPrice = subscription.items.data.some((item) => {
          const priceId = item.price?.id;
          return !!priceId && isUltauraPriceId(priceId);
        });

        if (hasUltauraPrice) {
          await syncUltauraSubscription(client, subscription, organizationUid);
          logger.info({ subscriptionId: subscription.id }, '[Ultaura] Synced subscription');
        }

        break;
      }

      case StripeWebhooks.SubscriptionDeleted: {
        const subscription = event.data.object as Stripe.Subscription;

        await deleteSubscription(client, subscription.id);

        // Handle Ultaura subscription deletion
        await handleUltauraSubscriptionDeleted(client, subscription.id);

        break;
      }

      case StripeWebhooks.SubscriptionUpdated: {
        const subscription = event.data.object as Stripe.Subscription;

        await updateSubscriptionById(client, subscription);

        // Sync Ultaura subscription updates
        const hasUltauraPrice = subscription.items.data.some((item) => {
          const priceId = item.price?.id;
          return !!priceId && isUltauraPriceId(priceId);
        });

        if (hasUltauraPrice) {
          // Get organization from subscription metadata
          const metadata = subscription.metadata;
          const organizationUid =
            metadata?.organization_uid || (metadata as Record<string, string | undefined>)?.organizationUid;

          if (organizationUid) {
            await syncUltauraSubscription(client, subscription, organizationUid);
            logger.info({ subscriptionId: subscription.id }, '[Ultaura] Updated subscription');
          } else {
            logger.warn({ subscriptionId: subscription.id }, '[Ultaura] Missing organization UID on subscription metadata');
          }
        }

        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(
      {
        error,
        eventType: 'unknown',
      },
      `[Stripe] Webhook handling failed`,
    );

    return throwInternalServerErrorException();
  }
}

/**
 * @description When the checkout is completed, we store the order. The
 * subscription is only activated if the order was paid successfully.
 * Otherwise, we have to wait for a further webhook
 */
async function onCheckoutCompleted(
  client: SupabaseClient,
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
  organizationUid: string,
) {
  const customerId = session.customer as string;

  // build organization subscription and set on the organization document
  // we add just enough data in the DB, so we do not query
  // Stripe for every bit of data
  // if you need your DB record to contain further data
  // add it to {@link buildOrganizationSubscription}
  const { error, data } = await addSubscription(client, subscription);

  if (error) {
    return Promise.reject(
      `Failed to add subscription to the database: ${error}`,
    );
  }

  return setOrganizationSubscriptionData(client, {
    organizationUid,
    customerId,
    subscriptionId: data.id,
  });
}

/**
 * @name getOrganizationUidFromClientReference
 * @description Get the organization UUID from the client reference ID
 * @param session
 */
function getOrganizationUidFromClientReference(
  session: Stripe.Checkout.Session,
) {
  return session.client_reference_id ?? null;
}

function isOnboardingCheckoutSession(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};
  return (
    metadata.checkout_flow === 'onboarding' ||
    typeof metadata.onboarding_state_token === 'string'
  );
}

async function resolveOrganizationUid(params: {
  client: SupabaseClient;
  session: Stripe.Checkout.Session;
  subscription: Stripe.Subscription;
}): Promise<{
  organizationUid: string | null;
  strategy: 'metadata' | 'auth_user_id' | 'email_fallback' | 'none';
}> {
  const metadataOrganizationUid =
    params.subscription.metadata?.organization_uid ||
    params.session.metadata?.organization_uid;

  if (metadataOrganizationUid && looksLikeUuid(metadataOrganizationUid)) {
    return {
      organizationUid: metadataOrganizationUid,
      strategy: 'metadata',
    };
  }

  const authUserIdCandidate = getAuthUserIdFromCheckout(params.session, params.subscription);
  if (authUserIdCandidate && looksLikeUuid(authUserIdCandidate)) {
    const organizationUid = await getOrganizationUidForAuthUser(
      params.client,
      authUserIdCandidate,
    );

    if (organizationUid) {
      return {
        organizationUid,
        strategy: 'auth_user_id',
      };
    }
  }

  const email =
    params.session.customer_details?.email ||
    params.session.customer_email ||
    null;

  if (email) {
    const organizationUid = await getOrganizationUidByBillingEmail(
      params.client,
      email,
    );

    if (organizationUid) {
      return {
        organizationUid,
        strategy: 'email_fallback',
      };
    }
  }

  return {
    organizationUid: null,
    strategy: 'none',
  };
}

function getAuthUserIdFromCheckout(
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
) {
  return (
    session.metadata?.auth_user_id ||
    subscription.metadata?.auth_user_id ||
    null
  );
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function getOrganizationUidForAuthUser(
  client: SupabaseClient,
  authUserId: string,
) {
  const { data } = await client
    .from('memberships')
    .select('created_at, organization:organizations!inner(uuid)')
    .eq('user_id', authUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.organization as { uuid?: string } | null)?.uuid ?? null;
}

async function getOrganizationUidByBillingEmail(
  client: SupabaseClient,
  email: string,
) {
  const { data } = await client
    .from('ultaura_accounts')
    .select('created_at, organization:organizations!inner(uuid)')
    .eq('billing_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.organization as { uuid?: string } | null)?.uuid ?? null;
}
