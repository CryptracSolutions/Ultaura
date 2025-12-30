// Ultaura Billing Service
// Handles Stripe subscription syncing for Ultaura accounts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Stripe } from 'stripe';

import { PLANS } from './constants';
import type { PlanId } from './types';

type UltauraSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

function getPlanIdFromPriceId(priceId: string): PlanId | null {
  if (
    priceId === process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID
  ) {
    return 'care';
  }

  if (
    priceId === process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID
  ) {
    return 'comfort';
  }

  if (
    priceId === process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID
  ) {
    return 'family';
  }

  if (priceId === process.env.STRIPE_ULTAURA_PAYG_PRICE_ID) {
    return 'payg';
  }

  return null;
}

export function isUltauraPriceId(priceId: string): boolean {
  const overagePriceId = process.env.STRIPE_ULTAURA_OVERAGE_PRICE_ID;
  if (overagePriceId && priceId === overagePriceId) {
    return true;
  }

  return getPlanIdFromPriceId(priceId) !== null;
}

function getUltauraPlanFromSubscription(subscription: Stripe.Subscription): {
  planId: PlanId;
  billingInterval: 'month' | 'year' | null;
} | null {
  for (const item of subscription.items.data) {
    const priceId = item.price?.id;
    if (!priceId) continue;

    const planId = getPlanIdFromPriceId(priceId);
    if (!planId) continue;

    const interval = item.price.recurring?.interval;
    const billingInterval = interval === 'month' || interval === 'year' ? interval : null;
    return { planId, billingInterval };
  }

  return null;
}

function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): UltauraSubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
      return 'past_due';
    default:
      return 'past_due';
  }
}

function isAccountTrialActive(account: { status: string; trial_ends_at: string | null; cycle_end: string | null }) {
  if (account.status !== 'trial') {
    return false;
  }

  const trialEndsAt = account.trial_ends_at ?? account.cycle_end;
  if (!trialEndsAt) {
    return false;
  }

  return new Date(trialEndsAt).getTime() > Date.now();
}

/**
 * Sync Ultaura subscription when a Stripe subscription is created/updated.
 *
 * Notes:
 * - We only flip `ultaura_accounts.status` to `active` once Stripe is `active` (or `trialing`).
 * - If a user is still within an active Ultaura trial, we avoid downgrading their account
 *   for incomplete/past_due Stripe states.
 */
export async function syncUltauraSubscription(
  client: SupabaseClient,
  subscription: Stripe.Subscription,
  organizationUid: string,
): Promise<void> {
  const match = getUltauraPlanFromSubscription(subscription);
  if (!match) {
    return;
  }

  const stripeStatus = mapStripeSubscriptionStatus(subscription.status);

  const { data: organization, error: organizationError } = await client
    .from('organizations')
    .select('id')
    .eq('uuid', organizationUid)
    .single();

  if (organizationError || !organization) {
    console.error('[Ultaura] Organization lookup failed', organizationError);
    return;
  }

  const { data: account, error: accountError } = await client
    .from('ultaura_accounts')
    .select('id, status, trial_ends_at, cycle_end')
    .eq('organization_id', organization.id)
    .maybeSingle();

  if (accountError) {
    console.error('[Ultaura] Account lookup failed', accountError);
    return;
  }

  if (!account) {
    console.error('[Ultaura] Missing ultaura account for organization', organizationUid);
    return;
  }

  const stripeCustomerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const currentPeriodStart =
    typeof subscription.current_period_start === 'number'
      ? new Date(subscription.current_period_start * 1000).toISOString()
      : null;
  const currentPeriodEnd =
    typeof subscription.current_period_end === 'number'
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

  const { error: subscriptionUpsertError } = await client
    .from('ultaura_subscriptions')
    .upsert(
      {
        account_id: account.id,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: subscription.id,
        plan_id: match.planId,
        billing_interval: match.billingInterval,
        status: stripeStatus,
        current_period_start: currentPeriodStart,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      { onConflict: 'stripe_subscription_id' },
    );

  if (subscriptionUpsertError) {
    console.error('[Ultaura] Subscription upsert failed', subscriptionUpsertError);
    return;
  }

  const subscriptionAllowsAccess = stripeStatus === 'active' || stripeStatus === 'trialing';
  const trialActive = isAccountTrialActive(account);

  if (subscriptionAllowsAccess) {
    const plan = PLANS[match.planId];
    const { error: accountUpdateError } = await client
      .from('ultaura_accounts')
      .update({
        status: 'active',
        plan_id: match.planId,
        minutes_included: plan.minutesIncluded,
        cycle_start: currentPeriodStart,
        cycle_end: currentPeriodEnd,
      })
      .eq('id', account.id);

    if (accountUpdateError) {
      console.error('[Ultaura] Account update failed', accountUpdateError);
    }

    return;
  }

  if (trialActive) {
    return;
  }

  const nextAccountStatus = stripeStatus === 'canceled' ? 'canceled' : 'past_due';
  const { error: accountUpdateError } = await client
    .from('ultaura_accounts')
    .update({ status: nextAccountStatus })
    .eq('id', account.id);

  if (accountUpdateError) {
    console.error('[Ultaura] Account status update failed', accountUpdateError);
  }
}

export async function handleUltauraSubscriptionDeleted(
  client: SupabaseClient,
  stripeSubscriptionId: string,
): Promise<void> {
  const { data: subscriptionRow, error: lookupError } = await client
    .from('ultaura_subscriptions')
    .select('account_id')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle();

  if (lookupError) {
    console.error('[Ultaura] Error fetching subscription for deletion', lookupError);
  }

  const { error } = await client
    .from('ultaura_subscriptions')
    .update({ status: 'canceled' })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[Ultaura] Error cancelling subscription:', error);
  }

  if (subscriptionRow?.account_id) {
    const { error: accountError } = await client
      .from('ultaura_accounts')
      .update({ status: 'canceled' })
      .eq('id', subscriptionRow.account_id);

    if (accountError) {
      console.error('[Ultaura] Error cancelling account:', accountError);
    }
  }
}

