'use server';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import type Stripe from 'stripe';

const logger = getLogger();

const ULTAURA_PRICE_IDS: Record<string, { monthly?: string; annual?: string }> = {
  care: {
    monthly: process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID,
  },
  comfort: {
    monthly: process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID,
  },
  family: {
    monthly: process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID,
    annual: process.env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID,
  },
  payg: {
    monthly: process.env.STRIPE_ULTAURA_PAYG_PRICE_ID,
  },
};

export async function createUltauraCheckout(
  planId: string,
  billingInterval: 'monthly' | 'annual',
  organizationUid: string,
  returnUrl: string
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
  if (!['care', 'comfort', 'family', 'payg'].includes(planId)) {
    return { success: false, error: 'Invalid plan selected' };
  }

  const priceConfig = ULTAURA_PRICE_IDS[planId];
  const priceId = billingInterval === 'annual' && priceConfig?.annual
    ? priceConfig.annual
    : priceConfig?.monthly;

  if (!priceId) {
    logger.error({ planId, billingInterval }, 'Missing Stripe price ID for Ultaura plan');
    return { success: false, error: 'Pricing configuration error. Please contact support.' };
  }

  try {
    const getStripeInstance = (await import('~/core/stripe/get-stripe')).default;
    const stripe = await getStripeInstance();

    const client = getSupabaseServerComponentClient();

    const { data: organization, error: organizationError } = await client
      .from('organizations')
      .select('id')
      .eq('uuid', organizationUid)
      .single();

    if (organizationError || !organization) {
      return { success: false, error: 'Organization not found' };
    }

    const { data: orgSubscription, error: orgSubscriptionError } = await client
      .from('organizations_subscriptions')
      .select('customer_id')
      .eq('organization_id', organization.id)
      .maybeSingle();

    if (orgSubscriptionError) {
      logger.error(
        { orgSubscriptionError, organizationUid },
        'Failed to load organization subscription for checkout',
      );
    }

    const customerId = orgSubscription?.customer_id ?? undefined;

    const successUrl = `${returnUrl}?success=true&plan=${planId}`;
    const cancelUrl = `${returnUrl}?canceled=true`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: organizationUid,
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          organization_uid: organizationUid,
          ultaura_plan_id: planId,
        },
      },
      metadata: {
        organization_uid: organizationUid,
        ultaura_plan_id: planId,
      },
    };

    if (customerId) {
      sessionParams.customer = customerId;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return { success: false, error: 'Failed to create checkout session' };
    }

    return { success: true, checkoutUrl: session.url };
  } catch (error) {
    logger.error({ error, planId }, 'Failed to create Ultaura checkout session');
    return { success: false, error: 'Failed to create checkout session' };
  }
}

export async function getUltauraPriceId(
  planId: string,
  billingInterval: 'monthly' | 'annual'
): Promise<string | null> {
  const priceConfig = ULTAURA_PRICE_IDS[planId];
  if (!priceConfig) return null;

  if (billingInterval === 'annual' && priceConfig.annual) {
    return priceConfig.annual;
  }
  return priceConfig.monthly || null;
}
