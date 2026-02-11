export const dynamic = 'force-dynamic';

import type { Stripe } from 'stripe';
import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

import getLogger from '~/core/logger';
import getStripeInstance from '~/core/stripe/get-stripe';
import getSupabaseRouteHandlerClient from '~/core/supabase/route-handler-client';
import { syncUltauraSubscription } from '~/lib/ultaura/billing';

const logger = getLogger();
const DEFAULT_BACKFILL_DAYS = 7;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_PAGES_PER_RUN = 200;
const INTERNAL_SECRET_HEADER = 'x-webhook-secret';
const CHECKPOINT_SETTING_KEY = 'onboarding_reconcile_checkpoint';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const requestSchema = z.object({
  checkpoint: z.string().min(1).optional(),
  backfillDays: z.coerce.number().int().min(1).max(30).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
});

export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  const expectedSecret = process.env.ULTAURA_INTERNAL_API_SECRET;
  const providedSecret = request.headers.get(INTERNAL_SECRET_HEADER);

  if (!expectedSecret) {
    logger.error('ULTAURA_INTERNAL_API_SECRET is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = requestSchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request parameters' },
      { status: 400 },
    );
  }

  const requestCheckpoint = parsed.data.checkpoint?.trim() || null;
  const backfillDays = parsed.data.backfillDays ?? DEFAULT_BACKFILL_DAYS;
  const limit = parsed.data.limit ?? DEFAULT_LIMIT;
  const createdGte = Math.floor(
    (Date.now() - backfillDays * 24 * 60 * 60 * 1000) / 1000,
  );

  const stripe = await getStripeInstance();
  const adminClient = getSupabaseRouteHandlerClient({ admin: true });
  const persistedCheckpoint = requestCheckpoint
    ? null
    : await getPersistedCheckpoint(adminClient);
  const effectiveCheckpoint = requestCheckpoint ?? persistedCheckpoint;

  let processed = 0;
  let synced = 0;
  let unresolved = 0;
  let metadataUpdated = 0;
  let linkedByAuthUser = 0;
  let linkedByEmailFallback = 0;
  let skipped = 0;
  let nextStartingAfter: string | undefined;
  let hasMorePages = true;
  let reachedCheckpointBoundary = false;
  let pageCount = 0;
  let latestSeenSessionId: string | null = null;

  while (
    hasMorePages &&
    !reachedCheckpointBoundary &&
    pageCount < MAX_PAGES_PER_RUN
  ) {
    pageCount += 1;

    const listParams: Stripe.Checkout.SessionListParams = {
      limit,
      created: {
        gte: createdGte,
      },
      ...(nextStartingAfter ? { starting_after: nextStartingAfter } : {}),
    };

    const sessions = await stripe.checkout.sessions.list(listParams);

    if (!latestSeenSessionId) {
      latestSeenSessionId = sessions.data[0]?.id ?? null;
    }

    if (sessions.data.length === 0) {
      hasMorePages = false;
      break;
    }

    for (const session of sessions.data) {
      if (effectiveCheckpoint && session.id === effectiveCheckpoint) {
        reachedCheckpointBoundary = true;
        break;
      }

      if (!isOnboardingCheckoutSession(session) || session.mode !== 'subscription') {
        continue;
      }

      processed += 1;

      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription?.id;

      if (!subscriptionId) {
        skipped += 1;
        continue;
      }

      try {
        let subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const resolved = await resolveOrganizationUid({
          adminClient,
          session,
          subscription,
        });

        if (!resolved.organizationUid) {
          unresolved += 1;

          if (isOlderThanSevenDays(session.created)) {
            logger.error(
              {
                sessionId: session.id,
                subscriptionId,
                sessionCreatedAt: toIsoFromUnix(session.created),
                issue: 'unresolved_onboarding_subscription_over_7_days',
              },
              'Manual intervention required: unresolved onboarding subscription is older than 7 days',
            );
          }

          continue;
        }

        if (resolved.strategy === 'auth_user_id') {
          linkedByAuthUser += 1;
        } else if (resolved.strategy === 'email_fallback') {
          linkedByEmailFallback += 1;
        }

        if (subscription.metadata?.organization_uid !== resolved.organizationUid) {
          subscription = await stripe.subscriptions.update(subscription.id, {
            metadata: {
              ...(subscription.metadata ?? {}),
              organization_uid: resolved.organizationUid,
            },
          });
          metadataUpdated += 1;
        }

        await syncUltauraSubscription(
          adminClient,
          subscription,
          resolved.organizationUid,
        );
        synced += 1;
      } catch (error) {
        logger.warn(
          {
            error,
            sessionId: session.id,
            subscriptionId,
          },
          'Failed to reconcile onboarding checkout session',
        );
      }
    }

    if (reachedCheckpointBoundary) {
      hasMorePages = false;
      break;
    }

    if (!sessions.has_more) {
      hasMorePages = false;
      break;
    }

    nextStartingAfter = sessions.data.at(-1)?.id;

    if (!nextStartingAfter) {
      hasMorePages = false;
      break;
    }
  }

  if (pageCount >= MAX_PAGES_PER_RUN && hasMorePages) {
    logger.warn(
      {
        pageCount,
        maxPages: MAX_PAGES_PER_RUN,
      },
      'Reached max onboarding reconciliation pages for one run; stopping safely',
    );
  }

  const nextCheckpoint = latestSeenSessionId ?? effectiveCheckpoint ?? null;
  const persisted = await persistCheckpoint(adminClient, nextCheckpoint);

  if (!persisted) {
    return NextResponse.json(
      { error: 'Failed to persist onboarding reconciliation checkpoint' },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    processed,
    synced,
    unresolved,
    metadataUpdated,
    linkedByAuthUser,
    linkedByEmailFallback,
    skipped,
    checkpoint: nextCheckpoint,
    checkpointSource: requestCheckpoint ? 'request' : 'system_setting',
    hasMore: hasMorePages,
    reachedCheckpointBoundary,
    pagesProcessed: pageCount,
    backfillDays,
  });
}

async function resolveOrganizationUid(params: {
  adminClient: ReturnType<typeof getSupabaseRouteHandlerClient>;
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
      params.adminClient,
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
      params.adminClient,
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

function isOnboardingCheckoutSession(session: Stripe.Checkout.Session) {
  const metadata = session.metadata ?? {};

  return (
    metadata.checkout_flow === 'onboarding' ||
    typeof metadata.onboarding_state_token === 'string'
  );
}

function getAuthUserIdFromCheckout(
  session: Stripe.Checkout.Session,
  subscription: Stripe.Subscription,
) {
  return (
    session.metadata?.auth_user_id ||
    subscription.metadata?.auth_user_id ||
    session.client_reference_id ||
    null
  );
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

async function getOrganizationUidForAuthUser(
  adminClient: ReturnType<typeof getSupabaseRouteHandlerClient>,
  authUserId: string,
) {
  const { data } = await adminClient
    .from('memberships')
    .select('created_at, organization:organizations!inner(uuid)')
    .eq('user_id', authUserId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.organization as { uuid?: string } | null)?.uuid ?? null;
}

async function getOrganizationUidByBillingEmail(
  adminClient: ReturnType<typeof getSupabaseRouteHandlerClient>,
  email: string,
) {
  const { data } = await adminClient
    .from('ultaura_accounts')
    .select('created_at, organization:organizations!inner(uuid)')
    .eq('billing_email', email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.organization as { uuid?: string } | null)?.uuid ?? null;
}

async function getPersistedCheckpoint(
  adminClient: ReturnType<typeof getSupabaseRouteHandlerClient>,
) {
  const { data, error } = await adminClient
    .from('ultaura_system_settings')
    .select('value')
    .eq('key', CHECKPOINT_SETTING_KEY)
    .maybeSingle();

  if (error) {
    logger.warn(
      {
        error,
        key: CHECKPOINT_SETTING_KEY,
      },
      'Failed to load persisted onboarding reconciliation checkpoint; continuing without one',
    );

    return null;
  }

  const value = data?.value as { checkpoint?: unknown } | null;
  const checkpoint = value?.checkpoint;

  return typeof checkpoint === 'string' && checkpoint.trim() ? checkpoint : null;
}

async function persistCheckpoint(
  adminClient: ReturnType<typeof getSupabaseRouteHandlerClient>,
  checkpoint: string | null,
) {
  const timestamp = new Date().toISOString();

  const { error } = await adminClient
    .from('ultaura_system_settings')
    .upsert(
      {
        key: CHECKPOINT_SETTING_KEY,
        value: {
          checkpoint,
          updated_at: timestamp,
        },
        updated_at: timestamp,
      },
      { onConflict: 'key' },
    );

  if (error) {
    logger.error(
      {
        error,
        key: CHECKPOINT_SETTING_KEY,
      },
      'Failed to persist onboarding reconciliation checkpoint',
    );
    return false;
  }

  return true;
}

function isOlderThanSevenDays(unixTimestampSeconds: number) {
  return Date.now() - unixTimestampSeconds * 1000 > SEVEN_DAYS_MS;
}

function toIsoFromUnix(unixTimestampSeconds: number) {
  return new Date(unixTimestampSeconds * 1000).toISOString();
}
