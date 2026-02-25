import AdminHeader from '~/app/admin/components/AdminHeader';
import AdminGuard from '~/app/admin/components/AdminGuard';
import AdminOverviewClient, {
  type AdminDashboardData,
} from '~/app/admin/components/AdminOverviewClient';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

import configuration from '~/configuration';
import { PageBody } from '~/core/ui/Page';
import Alert, { AlertHeading } from '~/core/ui/Alert';
import getLogger from '~/core/logger';
import { PLANS } from '~/lib/ultaura/constants';

export const metadata = {
  title: `Admin | ${configuration.site.siteName}`,
};

async function AdminPage() {
  const { data, errors } = await loadData();

  return (
    <div className={'flex flex-col flex-1'}>
      <AdminHeader description="Platform overview and system health">Admin</AdminHeader>

      <PageBody>
        <div className={'flex flex-col space-y-4'}>
          {errors.length > 0 && (
            <Alert type={'error'}>
              <AlertHeading>Dashboard Data Errors</AlertHeading>
              <ul className={'list-disc pl-4 text-sm'}>
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}

          <AdminOverviewClient data={data} />
        </div>
      </PageBody>
    </div>
  );
}

export default AdminGuard(AdminPage);

type RpcStats = {
  overage_payg_revenue_cents?: number | null;
  monthly_subscribers?: number | null;
  annual_subscribers?: number | null;
  pending_cancellations?: number | null;
  plan_distribution?: Array<{ plan_id?: string | null; account_count?: number | null }> | null;
  minutes_used_this_month?: number | null;
  minutes_allotted?: number | null;
  active_lines?: number | null;
  total_lines?: number | null;
  calls_this_month?: number | null;
  calls_answered_this_month?: number | null;
  avg_call_duration_seconds?: number | null;
  twilio_costs_cents?: number | null;
  model_costs_cents?: number | null;
};

type AdminRpcClient = ReturnType<typeof getSupabaseServerComponentClient> & {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function isKnownPlanId(planId: string): planId is keyof typeof PLANS {
  return planId in PLANS;
}

function normalizePlanDistribution(value: unknown): AdminDashboardData['planDistribution'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isObject)
    .map((item) => ({
      plan_id: typeof item.plan_id === 'string' ? item.plan_id : 'unknown',
      account_count: toNumber(item.account_count),
    }));
}

function mapPlatformStats(stats: unknown): Pick<
  AdminDashboardData,
  | 'overagePaygRevenueCents'
  | 'monthlySubscribers'
  | 'annualSubscribers'
  | 'pendingCancellations'
  | 'planDistribution'
  | 'minutesUsedThisMonth'
  | 'minutesAllottedThisMonth'
  | 'activeLines'
  | 'totalLines'
  | 'callsThisMonth'
  | 'callsAnsweredThisMonth'
  | 'avgCallDurationSeconds'
  | 'twilioCostsCents'
  | 'modelCostsCents'
> {
  const row = isObject(stats) ? (stats as RpcStats) : null;

  return {
    overagePaygRevenueCents: toNumber(row?.overage_payg_revenue_cents),
    monthlySubscribers: toNumber(row?.monthly_subscribers),
    annualSubscribers: toNumber(row?.annual_subscribers),
    pendingCancellations: toNumber(row?.pending_cancellations),
    planDistribution: normalizePlanDistribution(row?.plan_distribution),
    minutesUsedThisMonth: toNumber(row?.minutes_used_this_month),
    minutesAllottedThisMonth: toNumber(row?.minutes_allotted),
    activeLines: toNumber(row?.active_lines),
    totalLines: toNumber(row?.total_lines),
    callsThisMonth: toNumber(row?.calls_this_month),
    callsAnsweredThisMonth: toNumber(row?.calls_answered_this_month),
    avgCallDurationSeconds: toNumber(row?.avg_call_duration_seconds),
    twilioCostsCents: toNumber(row?.twilio_costs_cents),
    modelCostsCents: toNumber(row?.model_costs_cents),
  };
}

function computeMrrCents(
  activeSubs: Array<{ plan_id: string | null; billing_interval: string | null }> | null,
) {
  let mrr = 0;

  for (const subscription of activeSubs ?? []) {
    if (!subscription.plan_id || !isKnownPlanId(subscription.plan_id)) {
      continue;
    }

    const plan = PLANS[subscription.plan_id];

    if (subscription.billing_interval === 'month') {
      mrr += plan.monthlyPriceCents;
    } else if (subscription.billing_interval === 'year') {
      mrr += Math.round(plan.annualPriceCents / 12);
    }
  }

  return mrr;
}

async function loadData(): Promise<{ data: AdminDashboardData; errors: string[] }> {
  const client = getSupabaseServerComponentClient({ admin: true });
  const logger = getLogger();
  const errors: string[] = [];

  const [usersResult, orgsResult, activeResult, trialResult, statsResult] = await Promise.all([
    client.from('users').select('*', { count: 'exact', head: true }),
    client.from('organizations').select('*', { count: 'exact', head: true }),
    client
      .from('ultaura_subscriptions')
      .select('plan_id, billing_interval', { count: 'exact' })
      .eq('status', 'active'),
    client
      .from('ultaura_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'trialing'),
    (client as AdminRpcClient).rpc('get_admin_platform_stats'),
  ]);

  if (usersResult.error) {
    logger.error({ error: usersResult.error }, 'Admin: failed to count users');
    errors.push(`Users count failed: ${usersResult.error.message}`);
  }

  if (orgsResult.error) {
    logger.error(
      { error: orgsResult.error },
      'Admin: failed to count organizations',
    );
    errors.push(`Organizations count failed: ${orgsResult.error.message}`);
  }

  if (activeResult.error) {
    logger.error(
      { error: activeResult.error },
      'Admin: failed to load active subscriptions',
    );
    errors.push(`Active subscriptions query failed: ${activeResult.error.message}`);
  }

  if (trialResult.error) {
    logger.error(
      { error: trialResult.error },
      'Admin: failed to count trial subscriptions',
    );
    errors.push(`Trial subscriptions count failed: ${trialResult.error.message}`);
  }

  if (statsResult.error) {
    logger.error(
      { error: statsResult.error },
      'Admin: failed to load platform stats',
    );
    errors.push(`Platform stats failed: ${statsResult.error.message}`);
  }

  const mrrCents = computeMrrCents(activeResult.error ? null : activeResult.data);
  const arrCents = mrrCents * 12;
  const platformStats = mapPlatformStats(statsResult.error ? null : statsResult.data);

  return {
    data: {
      usersCount: usersResult.count ?? 0,
      organizationsCount: orgsResult.count ?? 0,
      activeSubscriptions: activeResult.count ?? 0,
      trialSubscriptions: trialResult.count ?? 0,
      mrr: mrrCents,
      arr: arrCents,
      ...platformStats,
    },
    errors,
  };
}
