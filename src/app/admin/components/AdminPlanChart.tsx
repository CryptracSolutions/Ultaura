'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';

import AdminStatCard from '~/app/admin/components/AdminStatCard';
import { PLANS } from '~/lib/ultaura/constants';
import { formatNumber } from '~/lib/ultaura/format';

export interface AdminPlanChartDatum {
  plan_id: string;
  account_count: number;
}

interface AdminPlanChartProps {
  data: AdminPlanChartDatum[];
}

function getPlanLabel(planId: string) {
  if (planId in PLANS) {
    return PLANS[planId as keyof typeof PLANS].displayName;
  }

  return planId;
}

export default function AdminPlanChart({ data }: AdminPlanChartProps) {
  const chartData = data
    .map((datum) => ({
      ...datum,
      planLabel: getPlanLabel(datum.plan_id),
      account_count: Number(datum.account_count) || 0,
    }))
    .sort((a, b) => b.account_count - a.account_count);
  const maxCount = Math.max(
    1,
    ...chartData.map((datum) => Number(datum.account_count) || 0),
  );

  return (
    <AdminStatCard
      label="Users per Plan"
      subtext="All trial + active accounts across the platform"
    >
      {chartData.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          No plan distribution data available yet.
        </div>
      ) : (
        <div className="mt-4 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 12, bottom: 0, left: 12 }}
            >
              <CartesianGrid
                stroke="var(--border)"
                strokeOpacity={0.5}
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                domain={[0, maxCount]}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => formatNumber(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="planLabel"
                width={110}
                tickMargin={14}
                tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Bar
                dataKey="account_count"
                fill="var(--chart-1)"
                radius={[0, 8, 8, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </AdminStatCard>
  );
}
