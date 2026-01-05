import type { Stripe } from 'stripe';
import { NextResponse } from 'next/server';
import configuration from '~/configuration';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getStripeInstance from '~/core/stripe/get-stripe';
import sendEmail from '~/core/email/send-email';
import { BILLING, PLANS } from '~/lib/ultaura/constants';

const DEV_TELEPHONY_BACKEND_URL = 'http://localhost:3001';

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  care: process.env.STRIPE_ULTAURA_CARE_MONTHLY_PRICE_ID,
  comfort: process.env.STRIPE_ULTAURA_COMFORT_MONTHLY_PRICE_ID,
  family: process.env.STRIPE_ULTAURA_FAMILY_MONTHLY_PRICE_ID,
  payg: process.env.STRIPE_ULTAURA_PAYG_PRICE_ID,
};

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function getPlanDisplay(planId: string) {
  if (planId === 'payg') {
    return {
      name: 'Pay as you go',
      summary: `$0/month + ${formatCurrency(BILLING.OVERAGE_RATE_CENTS)} per minute`,
    };
  }

  const plan = PLANS[planId as keyof typeof PLANS];
  const minutes = plan?.minutesIncluded ?? 0;
  const price = plan?.monthlyPriceCents ?? 0;

  return {
    name: plan?.displayName ?? planId,
    summary: `${minutes.toLocaleString('en-US')} minutes/month for ${formatCurrency(price)}/month`,
  };
}

function getTelephonyBackendUrl(): string {
  const backendUrl = process.env.ULTAURA_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? '' : DEV_TELEPHONY_BACKEND_URL);

  if (!backendUrl) {
    throw new Error('ULTAURA_BACKEND_URL is required in production');
  }

  return backendUrl;
}

export async function POST(request: Request) {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get('x-webhook-secret');

  if (!expectedSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const accountId = body?.accountId as string | undefined;
  const planId = body?.planId as string | undefined;
  const phoneNumber = body?.phoneNumber as string | undefined;

  if (!accountId || !planId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!PLAN_PRICE_IDS[planId]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const client = getSupabaseServerComponentClient({ admin: true });
  const { data: account, error: accountError } = await client
    .from('ultaura_accounts')
    .select('organization_id, billing_email')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  if (!account.billing_email) {
    return NextResponse.json({ error: 'Missing billing email' }, { status: 400 });
  }

  const { data: organization, error: orgError } = await client
    .from('organizations')
    .select('uuid')
    .eq('id', account.organization_id)
    .single();

  if (orgError || !organization) {
    return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
  }

  const { data: orgSubscription, error: orgSubscriptionError } = await client
    .from('organizations_subscriptions')
    .select('customer_id')
    .eq('organization_id', account.organization_id)
    .maybeSingle();

  if (orgSubscriptionError) {
    return NextResponse.json(
      { error: 'Failed to fetch organization subscription' },
      { status: 500 },
    );
  }

  const customerId = orgSubscription?.customer_id;

  const returnBase =
    configuration.site.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const returnUrl = `${returnBase.replace(/\/$/, '')}/dashboard/settings/subscription`;

  const stripe = await getStripeInstance();
  const priceId = PLAN_PRICE_IDS[planId];

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: organization.uuid,
    success_url: `${returnUrl}?success=true&plan=${planId}`,
    cancel_url: `${returnUrl}?canceled=true`,
    subscription_data: {
      metadata: {
        organization_uid: organization.uuid,
        ultaura_plan_id: planId,
      },
    },
    metadata: {
      organization_uid: organization.uuid,
      ultaura_plan_id: planId,
    },
  };

  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    sessionParams.customer_email = account.billing_email;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);
  if (!session.url) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }

  const planDisplay = getPlanDisplay(planId);
  const emailFrom = process.env.EMAIL_SENDER;

  if (!emailFrom) {
    return NextResponse.json({ error: 'Missing EMAIL_SENDER configuration' }, { status: 500 });
  }

  const subject = `Complete your Ultaura plan upgrade`;
  const text = `You requested to upgrade to the ${planDisplay.name} plan.\n\nPlan details:\n${planDisplay.summary}\n\nComplete your upgrade here:\n${session.url}\n\nIf you did not request this, you can ignore this email.`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
      <p>You requested to upgrade to the <strong>${planDisplay.name}</strong> plan.</p>
      <p><strong>Plan details:</strong> ${planDisplay.summary}</p>
      <p><a href="${session.url}">Complete your upgrade</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    </div>
  `;

  await sendEmail({
    from: emailFrom,
    to: account.billing_email,
    subject,
    text,
    html,
  });

  // Send SMS if phone number provided
  if (phoneNumber && session.url) {
    const telephonyBaseUrl = getTelephonyBackendUrl();
    const smsBody = `Ultaura: Complete your ${planDisplay.name} upgrade: ${session.url}`;

    try {
      await fetch(`${telephonyBaseUrl}/internal/sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': expectedSecret,
        },
        body: JSON.stringify({
          to: phoneNumber,
          body: smsBody,
        }),
      });
    } catch (smsError) {
      // Log but don't fail - email was already sent successfully
      console.error('Failed to send upgrade SMS:', smsError);
    }
  }

  return NextResponse.json({ success: true });
}
