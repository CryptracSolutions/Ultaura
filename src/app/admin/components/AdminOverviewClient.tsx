'use client';

import {
  usePathname,
  useSearchParams,
  type ReadonlyURLSearchParams,
} from 'next/navigation';
import {
  BeakerIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  ChartBarIcon,
  ClockIcon,
  CreditCardIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PhoneArrowUpRightIcon,
  PhoneIcon,
  SignalIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import NavigationItem from '~/core/ui/Navigation/NavigationItem';
import NavigationMenu from '~/core/ui/Navigation/NavigationMenu';
import AdminPlanChart from '~/app/admin/components/AdminPlanChart';
import AdminStatCard from '~/app/admin/components/AdminStatCard';
import {
  formatCurrency,
  formatDuration,
  formatNumber,
  formatPercent,
} from '~/lib/ultaura/format';

export interface AdminDashboardData {
  usersCount: number;
  organizationsCount: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  mrr: number;
  arr: number;

  overagePaygRevenueCents: number;
  monthlySubscribers: number;
  annualSubscribers: number;
  pendingCancellations: number;
  planDistribution: { plan_id: string; account_count: number }[];

  minutesUsedThisMonth: number;
  minutesAllottedThisMonth: number;
  activeLines: number;
  totalLines: number;
  callsThisMonth: number;
  callsAnsweredThisMonth: number;
  avgCallDurationSeconds: number;

  twilioCostsCents: number;
  modelCostsCents: number;
}

type TabValue = 'overview' | 'revenue' | 'usage' | 'costs';

const TABS: Array<{ value: TabValue; label: string }> = [
  { value: 'overview', label: 'Overview' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'usage', label: 'Usage' },
  { value: 'costs', label: 'Costs' },
];

export default function AdminOverviewClient({ data }: { data: AdminDashboardData }) {
  const pathname = usePathname() ?? '/admin';
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const activeTab: TabValue = isTabValue(tabParam) ? tabParam : 'overview';
  const addMobileBottomPadding =
    activeTab === 'overview' || activeTab === 'revenue' || activeTab === 'usage';
  const hasCallsThisMonth = data.callsThisMonth > 0;
  const totalSubscribers = data.monthlySubscribers + data.annualSubscribers;

  const answerRate =
    hasCallsThisMonth ? data.callsAnsweredThisMonth / data.callsThisMonth : null;
  const avgCallDuration =
    hasCallsThisMonth && data.avgCallDurationSeconds > 0
      ? formatDuration(data.avgCallDurationSeconds)
      : 'N/A';

  return (
    <div>
      <NavigationMenu bordered scrollable>
        {TABS.map((tab) => (
          <NavigationItem
            key={tab.value}
            active={tab.value === activeTab}
            scroll={false}
            link={{ path: buildTabPath(pathname, searchParams, tab.value), label: tab.label }}
          />
        ))}
      </NavigationMenu>

      <div className={addMobileBottomPadding ? 'mt-4 pb-6 sm:pb-0' : 'mt-4'}>
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminStatCard icon={BanknotesIcon} label="MRR" value={formatCurrency(data.mrr)} />
            <AdminStatCard icon={CurrencyDollarIcon} label="ARR" value={formatCurrency(data.arr)} />
            <AdminStatCard icon={UsersIcon} label="Users" value={formatNumber(data.usersCount)} />
            <AdminStatCard
              icon={BuildingOffice2Icon}
              label="Organizations"
              value={formatNumber(data.organizationsCount)}
            />
            <AdminStatCard
              icon={CreditCardIcon}
              label="Paying Customers"
              value={formatNumber(data.activeSubscriptions)}
            />
            <AdminStatCard
              icon={BeakerIcon}
              label="Trials"
              value={formatNumber(data.trialSubscriptions)}
            />
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <AdminStatCard
                icon={CurrencyDollarIcon}
                label="Overage/PAYG Revenue"
                value={formatCurrency(data.overagePaygRevenueCents)}
              />
              <AdminStatCard
                icon={UserGroupIcon}
                label="Subscribers"
                value={formatNumber(totalSubscribers)}
                subtext={`${formatNumber(data.monthlySubscribers)} monthly · ${formatNumber(data.annualSubscribers)} annual`}
              />
              <AdminStatCard
                icon={ExclamationTriangleIcon}
                label="Pending Cancellations"
                value={formatNumber(data.pendingCancellations)}
                subtext="will cancel at period end"
              />
            </div>
            <AdminPlanChart data={data.planDistribution} />
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AdminStatCard
              icon={ClockIcon}
              label="Minutes Used This Month"
              value={formatNumber(data.minutesUsedThisMonth)}
            />
            <AdminStatCard
              icon={ChartBarIcon}
              label="Minutes Allotted"
              value={formatNumber(data.minutesAllottedThisMonth)}
            />
            <AdminStatCard
              icon={PhoneIcon}
              label="Active Lines"
              value={formatNumber(data.activeLines)}
              subtext={`${formatNumber(data.totalLines)} total lines`}
            />
            <AdminStatCard
              icon={PhoneArrowUpRightIcon}
              label="Total Calls"
              value={formatNumber(data.callsThisMonth)}
            />
            <AdminStatCard
              icon={SignalIcon}
              label="Call Answer Rate"
              value={answerRate === null ? 'N/A' : formatPercent(answerRate)}
              subtext={
                hasCallsThisMonth
                  ? `${formatNumber(data.callsAnsweredThisMonth)} answered of ${formatNumber(data.callsThisMonth)}`
                  : 'No calls this month'
              }
            />
            <AdminStatCard
              icon={ClockIcon}
              label="Avg Call Duration"
              value={avgCallDuration}
            />
          </div>
        )}

        {activeTab === 'costs' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AdminStatCard
              icon={PhoneIcon}
              label="Twilio Costs This Month"
              value={formatCurrency(data.twilioCostsCents)}
            />
            <AdminStatCard
              icon={CurrencyDollarIcon}
              label="AI Model Costs This Month"
              value={formatCurrency(data.modelCostsCents)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function isTabValue(value: string | null): value is TabValue {
  return value === 'overview' || value === 'revenue' || value === 'usage' || value === 'costs';
}

function buildTabPath(
  pathname: string,
  searchParams: ReadonlyURLSearchParams,
  tab: TabValue,
) {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab);
  const query = params.toString();

  return query ? `${pathname}?${query}` : pathname;
}
