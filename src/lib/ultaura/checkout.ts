'use server';

import { createHash } from 'crypto';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';
import configuration from '~/configuration';
import requireSession from '~/lib/user/require-session';
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
const VALID_PLAN_IDS = ['care', 'comfort', 'family', 'payg'] as const;

type BillingInterval = 'monthly' | 'annual';

function isValidPlanId(planId: string) {
  return VALID_PLAN_IDS.includes(planId as (typeof VALID_PLAN_IDS)[number]);
}

export async function createUltauraCheckout(
  planId: string,
  billingInterval: BillingInterval,
  organizationUid: string,
  returnUrl: string,
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
  if (!isValidPlanId(planId)) {
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
    const idempotencyKey = buildCheckoutIdempotencyKey('ultaura-checkout', [
      organizationUid,
      planId,
      billingInterval,
      returnUrl,
    ]);

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

    const session = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });

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
  billingInterval: BillingInterval,
): Promise<string | null> {
  const priceConfig = ULTAURA_PRICE_IDS[planId];
  if (!priceConfig) return null;

  if (billingInterval === 'annual' && priceConfig.annual) {
    return priceConfig.annual;
  }
  return priceConfig.monthly || null;
}

export async function createOnboardingCheckout(
  planId: string,
  billingInterval: BillingInterval = 'monthly',
  stateToken: string,
): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
  if (!stateToken.trim()) {
    return {
      success: false,
      error: 'Missing onboarding state token',
    };
  }

  if (!isValidPlanId(planId)) {
    return { success: false, error: 'Invalid plan selected' };
  }

  const priceId = await getUltauraPriceId(planId, billingInterval);

  if (!priceId) {
    logger.error({ planId, billingInterval }, 'Missing Stripe price ID for onboarding checkout');
    return {
      success: false,
      error: 'Pricing configuration error. Please contact support.',
    };
  }

  try {
    const getStripeInstance = (await import('~/core/stripe/get-stripe')).default;
    const stripe = await getStripeInstance();
    const actionClient = getSupabaseServerActionClient();
    const session = await requireSession(actionClient);
    const userId = session.user.id;
    const baseUrl = getOnboardingBaseUrl();
    const encodedStateToken = encodeURIComponent(stateToken);
    const successUrl = `${baseUrl}/onboarding?checkout_success=true&session_id={CHECKOUT_SESSION_ID}&state=${encodedStateToken}`;
    const cancelUrl = `${baseUrl}/onboarding?checkout_success=false&state=${encodedStateToken}&canceled=true`;
    const metadata = {
      checkout_flow: 'onboarding',
      auth_user_id: userId,
      onboarding_state_token: stateToken,
      ultaura_plan_id: planId,
      ultaura_billing_interval: billingInterval,
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      subscription_data: {
        trial_period_days: 14,
        metadata,
      },
      customer_email: session.user.email ?? undefined,
    };

    const idempotencyKey = buildCheckoutIdempotencyKey('onboarding-checkout', [
      userId,
      planId,
      billingInterval,
    ]);

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams, {
      idempotencyKey,
    });

    if (!checkoutSession.url) {
      return {
        success: false,
        error: 'Failed to create checkout session',
      };
    }

    return {
      success: true,
      checkoutUrl: checkoutSession.url,
    };
  } catch (error) {
    logger.error({ error, planId }, 'Failed to create onboarding checkout session');
    return {
      success: false,
      error: 'Failed to create checkout session',
    };
  }
}

function buildCheckoutIdempotencyKey(
  prefix: string,
  parts: Array<string | number>,
  useTimeBucket = true,
) {
  const bucketPart = useTimeBucket
    ? `:${Math.floor(Date.now() / 30_000)}`
    : '';
  const raw = `${prefix}:${parts.join(':')}${bucketPart}`;
  const digest = createHash('sha256').update(raw).digest('hex').slice(0, 48);
  return `${prefix}:${digest}`;
}

function getOnboardingBaseUrl() {
  const rawBase =
    configuration.site.siteUrl ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    'http://localhost:3000';

  return rawBase.replace(/\/$/, '');
}
