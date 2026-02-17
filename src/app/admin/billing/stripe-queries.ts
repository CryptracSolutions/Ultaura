import 'server-only';

import type Stripe from 'stripe';
import getStripeInstance from '~/core/stripe/get-stripe';

/* ------------------------------------------------------------------ */
/*  Safe types — only fields we want to expose in the admin UI        */
/* ------------------------------------------------------------------ */

export interface SafeStripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  livemode: boolean;
  created: number;
}

export interface SafeStripeSubscription {
  id: string;
  status: string;
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  trialEnd: number | null;
  livemode: boolean;
  items: Array<{
    priceId: string;
    productName: string | null;
    unitAmount: number | null;
    currency: string;
    interval: string;
  }>;
  defaultPaymentMethod: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
}

export interface SafeStripeInvoice {
  id: string;
  status: string | null;
  amountDue: number;
  amountPaid: number;
  currency: string;
  created: number;
  hostedInvoiceUrl: string | null;
  nextPaymentAttempt: number | null;
}

/* ------------------------------------------------------------------ */
/*  Stripe dashboard deep-link helper                                 */
/* ------------------------------------------------------------------ */

export function stripeUrl(
  type: 'customers' | 'subscriptions' | 'invoices',
  id: string,
  livemode: boolean,
): string {
  const base = 'https://dashboard.stripe.com';
  const prefix = livemode ? '' : '/test';
  return `${base}${prefix}/${type}/${id}`;
}

/* ------------------------------------------------------------------ */
/*  Customer                                                          */
/* ------------------------------------------------------------------ */

export async function getStripeCustomer(
  customerId: string,
): Promise<SafeStripeCustomer | null> {
  try {
    const stripe = await getStripeInstance();
    const customer = await stripe.customers.retrieve(customerId);

    if (customer.deleted) {
      return null;
    }

    return {
      id: customer.id,
      email: customer.email ?? null,
      name: customer.name ?? null,
      livemode: customer.livemode,
      created: customer.created,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Subscription                                                      */
/* ------------------------------------------------------------------ */

export async function getStripeSubscription(
  subscriptionId: string,
): Promise<SafeStripeSubscription | null> {
  try {
    const stripe = await getStripeInstance();
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product', 'default_payment_method'],
    });

    const items = sub.items.data.map((item: Stripe.SubscriptionItem) => {
      const price = item.price;
      const product =
        price.product && typeof price.product === 'object' && !('deleted' in price.product && price.product.deleted)
          ? (price.product as { name?: string | null })
          : null;

      return {
        priceId: price.id,
        productName: product?.name ?? null,
        unitAmount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? 'one_time',
      };
    });

    let defaultPaymentMethod: SafeStripeSubscription['defaultPaymentMethod'] =
      null;

    if (
      sub.default_payment_method &&
      typeof sub.default_payment_method === 'object' &&
      'card' in sub.default_payment_method &&
      sub.default_payment_method.card
    ) {
      const card = sub.default_payment_method.card;
      defaultPaymentMethod = {
        brand: card.brand ?? 'unknown',
        last4: card.last4 ?? '????',
        expMonth: card.exp_month ?? 0,
        expYear: card.exp_year ?? 0,
      };
    }

    return {
      id: sub.id,
      status: sub.status,
      currentPeriodStart: sub.current_period_start,
      currentPeriodEnd: sub.current_period_end,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      cancelAt: sub.cancel_at,
      trialEnd: sub.trial_end,
      livemode: sub.livemode,
      items,
      defaultPaymentMethod,
    };
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Invoices                                                          */
/* ------------------------------------------------------------------ */

export async function getStripeInvoices(
  customerId: string,
  limit = 5,
): Promise<SafeStripeInvoice[]> {
  try {
    const stripe = await getStripeInstance();
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });

    return invoices.data.map((inv: Stripe.Invoice) => ({
      id: inv.id,
      status: inv.status ?? null,
      amountDue: inv.amount_due,
      amountPaid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      nextPaymentAttempt: inv.next_payment_attempt ?? null,
    }));
  } catch {
    return [];
  }
}
