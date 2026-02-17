import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';

import { PageBody } from '~/core/ui/Page';
import { TextFieldInput, TextFieldLabel } from '~/core/ui/TextField';
import Button from '~/core/ui/Button';
import Alert from '~/core/ui/Alert';
import Heading from '~/core/ui/Heading';

import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import configuration from '~/configuration';
import getLogger from '~/core/logger';

import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

import {
  getStripeCustomer,
  getStripeSubscription,
  getStripeInvoices,
} from './stripe-queries';

import BillingResults from './components/BillingResults';

export const metadata = {
  title: `Billing Lookup | ${configuration.site.siteName}`,
};

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface BillingPageProps {
  searchParams: {
    email?: string;
    org?: string;
    account?: string;
    customer?: string;
    subscription?: string;
  };
}

interface DbSubscriptionRow {
  id: string;
  account_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan_id: string | null;
  billing_interval: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
}

/* ------------------------------------------------------------------ */
/*  Search resolution                                                 */
/* ------------------------------------------------------------------ */

type SearchType = 'email' | 'org' | 'account' | 'customer' | 'subscription';

function detectSearchType(
  params: BillingPageProps['searchParams'],
): { type: SearchType; query: string } | null {
  if (params.email?.trim()) return { type: 'email', query: params.email.trim() };
  if (params.org?.trim()) return { type: 'org', query: params.org.trim() };
  if (params.account?.trim())
    return { type: 'account', query: params.account.trim() };
  if (params.customer?.trim())
    return { type: 'customer', query: params.customer.trim() };
  if (params.subscription?.trim())
    return { type: 'subscription', query: params.subscription.trim() };
  return null;
}

async function resolveSubscription(
  searchType: SearchType,
  query: string,
): Promise<{ row: DbSubscriptionRow | null; error: string | null }> {
  const client = getSupabaseServerComponentClient({ admin: true });

  try {
    switch (searchType) {
      case 'email': {
        // email -> auth user -> org membership -> ultaura_accounts -> ultaura_subscriptions
        const { data: users, error: authError } =
          await client.auth.admin.listUsers({ perPage: 5 });

        if (authError) {
          return { row: null, error: `Auth lookup failed: ${authError.message}` };
        }

        const user = users.users.find(
          (u: { email?: string }) =>
            u.email?.toLowerCase() === query.toLowerCase(),
        );

        if (!user) {
          return { row: null, error: `No user found with email "${query}".` };
        }

        // Find org membership
        const { data: membership } = await client
          .from('memberships')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle();

        if (!membership) {
          return {
            row: null,
            error: `User "${query}" has no organization membership.`,
          };
        }

        // Find ultaura_accounts for this org
        const { data: account } = await client
          .from('ultaura_accounts')
          .select('id')
          .eq('organization_id', membership.organization_id)
          .limit(1)
          .maybeSingle();

        if (!account) {
          return {
            row: null,
            error: `No Ultaura account found for this user's organization.`,
          };
        }

        return fetchSubscriptionByAccountId(client, account.id);
      }

      case 'org': {
        const { data: account } = await client
          .from('ultaura_accounts')
          .select('id')
          .eq('organization_id', query)
          .limit(1)
          .maybeSingle();

        if (!account) {
          return {
            row: null,
            error: `No Ultaura account found for organization "${query}".`,
          };
        }

        return fetchSubscriptionByAccountId(client, account.id);
      }

      case 'account': {
        return fetchSubscriptionByAccountId(client, query);
      }

      case 'customer': {
        const { data: sub, error } = await client
          .from('ultaura_subscriptions')
          .select('*')
          .eq('stripe_customer_id', query)
          .limit(1)
          .maybeSingle();

        if (error) {
          return { row: null, error: `DB query failed: ${error.message}` };
        }

        if (!sub) {
          return {
            row: null,
            error: `No subscription found for customer "${query}".`,
          };
        }

        return { row: sub as DbSubscriptionRow, error: null };
      }

      case 'subscription': {
        const { data: sub, error } = await client
          .from('ultaura_subscriptions')
          .select('*')
          .eq('stripe_subscription_id', query)
          .limit(1)
          .maybeSingle();

        if (error) {
          return { row: null, error: `DB query failed: ${error.message}` };
        }

        if (!sub) {
          return {
            row: null,
            error: `No subscription found for subscription ID "${query}".`,
          };
        }

        return { row: sub as DbSubscriptionRow, error: null };
      }

      default:
        return { row: null, error: 'Unknown search type.' };
    }
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : 'Unexpected error during search.';
    return { row: null, error: msg };
  }
}

async function fetchSubscriptionByAccountId(
  client: ReturnType<typeof getSupabaseServerComponentClient>,
  accountId: string,
): Promise<{ row: DbSubscriptionRow | null; error: string | null }> {
  const { data: sub, error } = await client
    .from('ultaura_subscriptions')
    .select('*')
    .eq('account_id', accountId)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { row: null, error: `DB query failed: ${error.message}` };
  }

  if (!sub) {
    return {
      row: null,
      error: `No subscription found for account "${accountId}".`,
    };
  }

  return { row: sub as DbSubscriptionRow, error: null };
}

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */

async function BillingPage({ searchParams }: BillingPageProps) {
  const logger = getLogger();
  const search = detectSearchType(searchParams);

  // Audit log the page view (non-blocking)
  getCurrentAdminContext().then((admin) =>
    admin
      ? writeAdminAuditLog(admin, {
          action: 'admin.view.billing',
          targetType: 'page',
        })
      : undefined,
  ).catch(() => {});

  let dbSubscription: DbSubscriptionRow | null = null;
  let searchError: string | null = null;

  // Stripe data (fetched only when we have the right IDs)
  let stripeCustomer: Awaited<ReturnType<typeof getStripeCustomer>> = null;
  let stripeSubscription: Awaited<ReturnType<typeof getStripeSubscription>> =
    null;
  let stripeInvoices: Awaited<ReturnType<typeof getStripeInvoices>> = [];
  let stripeCustomerError: string | undefined;
  let stripeSubscriptionError: string | undefined;
  let stripeInvoicesError: string | undefined;

  if (search) {
    // Resolve DB subscription
    const result = await resolveSubscription(search.type, search.query);
    dbSubscription = result.row;
    searchError = result.error;

    // Audit log the lookup
    try {
      const admin = await getCurrentAdminContext();

      if (admin) {
        await writeAdminAuditLog(admin, {
          action: 'stripe.lookup',
          targetType: 'subscription',
          targetId: dbSubscription?.stripe_subscription_id ?? undefined,
          metadata: {
            searchType: search.type,
            searchQuery: search.query,
          },
        });
      }
    } catch {
      // Audit log failure should not break the page
    }

    // Fetch Stripe data if we have IDs
    if (dbSubscription?.stripe_customer_id) {
      try {
        stripeCustomer = await getStripeCustomer(
          dbSubscription.stripe_customer_id,
        );

        if (!stripeCustomer) {
          stripeCustomerError = `Customer "${dbSubscription.stripe_customer_id}" not found in Stripe.`;
        }
      } catch (err) {
        logger.error({ err }, 'Stripe customer fetch failed');
        stripeCustomerError =
          err instanceof Error
            ? err.message
            : 'Failed to fetch Stripe customer.';
      }
    }

    if (dbSubscription?.stripe_subscription_id) {
      try {
        stripeSubscription = await getStripeSubscription(
          dbSubscription.stripe_subscription_id,
        );

        if (!stripeSubscription) {
          stripeSubscriptionError = `Subscription "${dbSubscription.stripe_subscription_id}" not found in Stripe.`;
        }
      } catch (err) {
        logger.error({ err }, 'Stripe subscription fetch failed');
        stripeSubscriptionError =
          err instanceof Error
            ? err.message
            : 'Failed to fetch Stripe subscription.';
      }
    }

    if (dbSubscription?.stripe_customer_id) {
      try {
        stripeInvoices = await getStripeInvoices(
          dbSubscription.stripe_customer_id,
          5,
        );
      } catch (err) {
        logger.error({ err }, 'Stripe invoices fetch failed');
        stripeInvoicesError =
          err instanceof Error
            ? err.message
            : 'Failed to fetch Stripe invoices.';
      }
    }
  }

  return (
    <div className={'flex flex-1 flex-col'}>
      <AdminHeader>Billing Lookup</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-6 pb-12'}>
          <p className={'text-sm text-muted-foreground'}>
            Look up a subscription by email, organization UUID, account ID,
            Stripe customer ID, or Stripe subscription ID.
          </p>

          {/* ---- Search form ---- */}
          <div
            className={
              'rounded-lg border border-border bg-background p-5 space-y-4'
            }
          >
            <Heading type={5}>Search</Heading>

            <form method={'GET'} className={'space-y-4'}>
              <div className={'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'}>
                <div className={'flex flex-col space-y-1'}>
                  <TextFieldLabel>Email</TextFieldLabel>
                  <TextFieldInput
                    name={'email'}
                    defaultValue={searchParams.email ?? ''}
                    placeholder={'user@example.com'}
                  />
                </div>

                <div className={'flex flex-col space-y-1'}>
                  <TextFieldLabel>Organization UUID</TextFieldLabel>
                  <TextFieldInput
                    name={'org'}
                    defaultValue={searchParams.org ?? ''}
                    placeholder={'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'}
                  />
                </div>

                <div className={'flex flex-col space-y-1'}>
                  <TextFieldLabel>Account ID</TextFieldLabel>
                  <TextFieldInput
                    name={'account'}
                    defaultValue={searchParams.account ?? ''}
                    placeholder={'Account UUID'}
                  />
                </div>

                <div className={'flex flex-col space-y-1'}>
                  <TextFieldLabel>Stripe Customer ID</TextFieldLabel>
                  <TextFieldInput
                    name={'customer'}
                    defaultValue={searchParams.customer ?? ''}
                    placeholder={'cus_...'}
                  />
                </div>

                <div className={'flex flex-col space-y-1'}>
                  <TextFieldLabel>Stripe Subscription ID</TextFieldLabel>
                  <TextFieldInput
                    name={'subscription'}
                    defaultValue={searchParams.subscription ?? ''}
                    placeholder={'sub_...'}
                  />
                </div>
              </div>

              <div>
                <Button type={'submit'} variant={'default'}>
                  <MagnifyingGlassIcon className={'h-4 w-4'} />
                  <span>Look Up</span>
                </Button>
              </div>
            </form>
          </div>

          {/* ---- Error ---- */}
          {searchError && (
            <Alert type={'error'}>
              <Alert.Heading>Lookup Error</Alert.Heading>
              {searchError}
            </Alert>
          )}

          {/* ---- No search performed ---- */}
          {!search && (
            <div
              className={
                'rounded-lg border border-border bg-background p-8 text-center text-muted-foreground'
              }
            >
              <MagnifyingGlassIcon
                className={'mx-auto h-10 w-10 mb-3 opacity-40'}
              />
              <p className={'text-sm'}>
                Enter a search term above to look up billing data.
              </p>
            </div>
          )}

          {/* ---- Results ---- */}
          {dbSubscription && (
            <BillingResults
              dbSubscription={dbSubscription}
              stripeCustomer={stripeCustomer}
              stripeSubscription={stripeSubscription}
              stripeInvoices={stripeInvoices}
              stripeCustomerError={stripeCustomerError}
              stripeSubscriptionError={stripeSubscriptionError}
              stripeInvoicesError={stripeInvoicesError}
            />
          )}
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(BillingPage);
