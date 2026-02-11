import { createHash } from 'crypto';

import type { Stripe } from 'stripe';
import getStripeInstance from '~/core/stripe/get-stripe';

interface CreateCheckoutParams {
  returnUrl: string;
  organizationUid: string;
  priceId: string;
  customerId?: string;
  trialPeriodDays?: Maybe<number>;
  customerEmail?: string;
  embedded: boolean;
  idempotencyKey?: string;
}

/**
 * @name createStripeCheckout
 * @description Creates a Stripe Checkout session, and returns an Object
 * containing the session, which you can use to redirect the user to the
 * checkout page
 * @param params
 */
export default async function createStripeCheckout(
  params: CreateCheckoutParams,
) {
  // in JP3, a subscription belongs to an organization,
  // rather than to a user
  // if you wish to change it, use the current user ID instead
  const clientReferenceId = params.organizationUid;

  // we pass an optional customer ID, so we do not duplicate the Stripe
  // customers if an organization subscribes multiple times
  const customer = params.customerId || undefined;

  // if it's a one-time payment
  // you should change this to "payment"
  // docs: https://stripe.com/docs/billing/subscriptions/build-subscription
  const mode: Stripe.Checkout.SessionCreateParams.Mode = 'subscription';

  // get stripe instance
  const stripe = await getStripeInstance();

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    quantity: 1,
    price: params.priceId,
  };

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      trial_period_days: params.trialPeriodDays,
      metadata: {
        organizationUid: params.organizationUid,
      },
    };

  const urls = getUrls({
    embedded: params.embedded,
    returnUrl: params.returnUrl,
  });

  const uiMode = params.embedded ? 'embedded' : 'hosted';

  const customerData = customer
    ? {
        customer,
      }
    : {
        customer_email: params.customerEmail,
      };

  const idempotencyKey =
    params.idempotencyKey ??
    buildCheckoutIdempotencyKey([
      params.organizationUid,
      params.priceId,
      params.returnUrl,
      params.embedded ? 'embedded' : 'hosted',
    ]);

  return stripe.checkout.sessions.create({
    mode,
    ui_mode: uiMode,
    line_items: [lineItem],
    client_reference_id: clientReferenceId.toString(),
    subscription_data: subscriptionData,
    ...customerData,
    ...urls,
  }, {
    idempotencyKey,
  });
}

function getUrls(params: { returnUrl: string; embedded?: boolean }) {
  const successUrl = `${params.returnUrl}?success=true`;
  const cancelUrl = `${params.returnUrl}?cancel=true`;
  const returnUrl = `${params.returnUrl}/return?session_id={CHECKOUT_SESSION_ID}`;

  return params.embedded
    ? {
        return_url: returnUrl,
      }
    : {
        success_url: successUrl,
        cancel_url: cancelUrl,
      };
}

function buildCheckoutIdempotencyKey(parts: Array<string | number>) {
  const timeBucket = Math.floor(Date.now() / 30_000);
  const digest = createHash('sha256')
    .update(`${parts.join(':')}:${timeBucket}`)
    .digest('hex')
    .slice(0, 48);

  return `stripe-checkout:${digest}`;
}
