// Ultaura Billing Service
// Handles Stripe subscription syncing and usage-based billing

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Stripe } from 'stripe';
import { PLANS, BILLING } from './constants';
import type { PlanId } from './types';

/**
 * Sync Ultaura subscription when a Stripe subscription is created/updated
 */
export async function syncUltauraSubscription(
  client: SupabaseClient,
  subscription: Stripe.Subscription,
  organizationUid: string,
): Promise<void> {
  // Get the price ID from the subscription
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) {
    console.error('[Ultaura] No price ID found in subscription');
    return;
  }

  // Check if this is an Ultaura plan by looking up the price ID
  const planId = getPlanIdFromPriceId(priceId);
  if (!planId) {
    // Not an Ultaura subscription, skip
    return;
  }

  const plan = PLANS[planId];

  // Get or create Ultaura account
  const { data: account, error: accountError } = await client
    .from('ultaura_accounts')
    .select('id')
    .eq('organization_id', organizationUid)
    .maybeSingle();

  if (accountError) {
    console.error('[Ultaura] Error fetching account:', accountError);
    throw accountError;
  }

  if (!account) {
    // Create account if it doesn't exist
    const { data: newAccount, error: createError } = await client
      .from('ultaura_accounts')
      .insert({
        organization_id: organizationUid,
        plan_id: planId,
        billing_status: 'active',
      })
      .select('id')
      .single();

    if (createError) {
      console.error('[Ultaura] Error creating account:', createError);
      throw createError;
    }

    await createUltauraSubscription(client, newAccount.id, subscription, planId, plan);
  } else {
    // Update or create subscription for existing account
    await upsertUltauraSubscription(client, account.id, subscription, planId, plan);
  }
}

/**
 * Create a new Ultaura subscription record
 */
async function createUltauraSubscription(
  client: SupabaseClient,
  accountId: string,
  stripeSubscription: Stripe.Subscription,
  planId: PlanId,
  plan: (typeof PLANS)[PlanId],
): Promise<void> {
  const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

  const { error } = await client.from('ultaura_subscriptions').insert({
    account_id: accountId,
    stripe_subscription_id: stripeSubscription.id,
    plan_id: planId,
    status: mapStripeStatus(stripeSubscription.status),
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    minutes_included: plan.minutes_included,
    minutes_used: 0,
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
  });

  if (error) {
    console.error('[Ultaura] Error creating subscription:', error);
    throw error;
  }
}

/**
 * Upsert Ultaura subscription (create or update)
 */
async function upsertUltauraSubscription(
  client: SupabaseClient,
  accountId: string,
  stripeSubscription: Stripe.Subscription,
  planId: PlanId,
  plan: (typeof PLANS)[PlanId],
): Promise<void> {
  const currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  const currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);

  // Check if subscription exists
  const { data: existingSub } = await client
    .from('ultaura_subscriptions')
    .select('id, current_period_start, minutes_used')
    .eq('stripe_subscription_id', stripeSubscription.id)
    .maybeSingle();

  if (existingSub) {
    // Check if this is a new billing period
    const existingPeriodStart = new Date(existingSub.current_period_start);
    const isNewPeriod = currentPeriodStart.getTime() > existingPeriodStart.getTime();

    const { error } = await client
      .from('ultaura_subscriptions')
      .update({
        plan_id: planId,
        status: mapStripeStatus(stripeSubscription.status),
        current_period_start: currentPeriodStart.toISOString(),
        current_period_end: currentPeriodEnd.toISOString(),
        minutes_included: plan.minutes_included,
        // Reset minutes used if new billing period
        minutes_used: isNewPeriod ? 0 : existingSub.minutes_used,
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      })
      .eq('id', existingSub.id);

    if (error) {
      console.error('[Ultaura] Error updating subscription:', error);
      throw error;
    }

    // Update account plan
    await client.from('ultaura_accounts').update({ plan_id: planId }).eq('id', accountId);
  } else {
    // Create new subscription
    await createUltauraSubscription(client, accountId, stripeSubscription, planId, plan);
  }
}

/**
 * Handle subscription deletion
 */
export async function handleUltauraSubscriptionDeleted(
  client: SupabaseClient,
  stripeSubscriptionId: string,
): Promise<void> {
  const { error } = await client
    .from('ultaura_subscriptions')
    .update({ status: 'cancelled' })
    .eq('stripe_subscription_id', stripeSubscriptionId);

  if (error) {
    console.error('[Ultaura] Error cancelling subscription:', error);
  }
}

/**
 * Report usage to Stripe for metered billing (overage minutes)
 */
export async function reportUsageToStripe(
  stripe: Stripe,
  subscriptionId: string,
  quantity: number,
): Promise<void> {
  // Get the subscription to find the metered usage item
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  // Find the metered price item (overage minutes)
  const meteredItem = subscription.items.data.find((item) => item.price.recurring?.usage_type === 'metered');

  if (!meteredItem) {
    console.warn('[Ultaura] No metered usage item found for subscription');
    return;
  }

  // Report usage
  await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
    quantity,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'set',
  });
}

/**
 * Get plan ID from Stripe price ID
 * This maps Stripe price IDs to Ultaura plan IDs
 */
function getPlanIdFromPriceId(priceId: string): PlanId | null {
  // These would be your actual Stripe price IDs from your Stripe dashboard
  // In production, store these in environment variables or database
  const priceToplanMap: Record<string, PlanId> = {
    // Monthly prices
    [process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID || 'price_care_monthly']: 'care',
    [process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID || 'price_comfort_monthly']: 'comfort',
    [process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID || 'price_family_monthly']: 'family',
    // Annual prices
    [process.env.STRIPE_ULTAURA_CARE_ANNUAL_PRICE_ID || 'price_care_annual']: 'care',
    [process.env.STRIPE_ULTAURA_COMFORT_ANNUAL_PRICE_ID || 'price_comfort_annual']: 'comfort',
    [process.env.STRIPE_ULTAURA_FAMILY_ANNUAL_PRICE_ID || 'price_family_annual']: 'family',
    // Pay as you go
    [process.env.STRIPE_ULTAURA_PAYG_PRICE_ID || 'price_payg']: 'payg',
  };

  return priceToplanMap[priceId] || null;
}

/**
 * Check if a price ID is for an Ultaura product
 */
export function isUltauraPriceId(priceId: string): boolean {
  return getPlanIdFromPriceId(priceId) !== null;
}

/**
 * Map Stripe subscription status to Ultaura status
 */
function mapStripeStatus(
  stripeStatus: Stripe.Subscription.Status,
): 'active' | 'cancelled' | 'past_due' | 'trialing' {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'canceled':
      return 'cancelled';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'trialing':
      return 'trialing';
    default:
      return 'active';
  }
}

/**
 * Calculate overage for an account and record usage
 */
export async function calculateAndRecordOverage(
  client: SupabaseClient,
  stripe: Stripe,
  accountId: string,
): Promise<{ overageMinutes: number; overageCost: number }> {
  // Get the active subscription
  const { data: subscription } = await client
    .from('ultaura_subscriptions')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'active')
    .single();

  if (!subscription) {
    return { overageMinutes: 0, overageCost: 0 };
  }

  const overageMinutes = Math.max(0, subscription.minutes_used - subscription.minutes_included);

  if (overageMinutes > 0 && subscription.stripe_subscription_id) {
    // Report to Stripe for metered billing
    await reportUsageToStripe(stripe, subscription.stripe_subscription_id, overageMinutes);
  }

  const overageCost = overageMinutes * (BILLING.OVERAGE_RATE_CENTS / 100);

  return { overageMinutes, overageCost };
}
