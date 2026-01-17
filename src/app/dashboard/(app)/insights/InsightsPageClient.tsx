'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/core/ui/Select';
import type { InsightsDashboard, LineStatus } from '~/lib/ultaura/types';
import { InsightsSummary } from './components/InsightsSummary';
import { CallMetrics } from './components/CallMetrics';
import { MoodTrend } from './components/MoodTrend';
import { TopicsChart } from './components/TopicsChart';
import { ConcernsList } from './components/ConcernsList';
import { RetentionInsightsCard } from './components/RetentionInsightsCard';
import { CallActivityList } from '../lines/[lineId]/components/CallActivityList';

interface LineOption {
  id: string;
  short_id: string;
  display_name: string;
  status: LineStatus;
  insights_enabled: boolean;
  phone_verified_at: string | null;
}

interface InsightsPageClientProps {
  lines: LineOption[];
  selectedLineId: string | null;
  dashboard: InsightsDashboard | null;
}

const STATUS_LABELS: Record<LineStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  disabled: 'Disabled',
};

const SHARING_TIER_LABELS: Record<string, string> = {
  tier_1: 'Basic Updates & Safety',
  tier_2: 'Wellness Check',
  tier_3: 'Full Summary',
  tier_4: 'Complete Visibility',
};

export function InsightsPageClient({
  lines,
  selectedLineId,
  dashboard,
}: InsightsPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedLine = lines.find((line) => line.id === selectedLineId) ?? lines[0];

  if (!selectedLine) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="text-muted-foreground">No lines available.</p>
      </div>
    );
  }

  const handleLineChange = (lineId: string) => {
    const line = lines.find((item) => item.id === lineId);
    if (!line) return;

    const params = new URLSearchParams(searchParams?.toString());
    if (line.short_id) {
      params.set('line', line.short_id);
    } else {
      params.delete('line');
    }

    const query = params.toString();
    router.push(`/dashboard/insights${query ? `?${query}` : ''}`);
  };

  const renderLineLabel = (line: LineOption) => {
    const badges = [
      line.status !== 'active' ? STATUS_LABELS[line.status] : null,
      line.insights_enabled ? null : 'Insights off',
    ]
      .filter(Boolean)
      .join(', ');

    return `${line.display_name}${badges ? ` (${badges})` : ''}`;
  };

  const callActivityDates = dashboard ? dashboard.callActivity.map((entry) => entry.date) : [];
  const isFamilyManaged = dashboard?.userType === 'family_managed';
  const effectiveTier = isFamilyManaged
    ? (dashboard?.sharingConsent === 'granted' ? dashboard?.sharingTier : 'tier_1')
    : null;
  const allowMood = !isFamilyManaged || effectiveTier !== 'tier_1';
  const allowTopics = !isFamilyManaged || effectiveTier === 'tier_3' || effectiveTier === 'tier_4';
  const allowConcerns = !isFamilyManaged || effectiveTier === 'tier_4';
  const showEngagement = allowMood && Boolean(dashboard?.summary.engagementNote);
  const showLimitedNotice = isFamilyManaged && effectiveTier === 'tier_1';
  const sharingStatusLabel = effectiveTier ? SHARING_TIER_LABELS[effectiveTier] : null;
  const canViewDetailedInsights = dashboard?.userType === 'self';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xs">
          <label className="text-xs text-muted-foreground block mb-1">Line</label>
          <Select value={selectedLine.id} onValueChange={handleLineChange}>
            <SelectTrigger className="w-full py-2.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lines.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {renderLineLabel(line)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground sm:items-end">
          <span>Last 30 days</span>
          {canViewDetailedInsights && selectedLine?.short_id ? (
            <Link
              href={`/dashboard/lines/${selectedLine.short_id}/insights`}
              className="text-xs text-primary hover:underline"
            >
              View detailed insights
            </Link>
          ) : null}
        </div>
      </div>

      {!dashboard && (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="text-muted-foreground">Insights are not available for this line yet.</p>
        </div>
      )}

      {dashboard && (
        <>
          {!dashboard.insightsEnabled && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm text-foreground">
                Insights are disabled for this line. Historical insights remain visible.
              </p>
              <Link
                href={`/dashboard/lines/${dashboard.lineShortId}/settings`}
                className="text-sm text-primary hover:underline"
              >
                Enable insights in Line Settings
              </Link>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              These insights are generated by AI based on conversation patterns and are not
              medical, clinical, or professional advice. Ultaura is not an emergency service. If
              you believe there is immediate danger, contact local emergency services (911 in the
              US).
            </p>
          </div>

          {isFamilyManaged && sharingStatusLabel && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <div className="text-sm font-medium text-foreground">Sharing level</div>
              <p className="text-sm text-muted-foreground mt-1">
                {sharingStatusLabel}
                {dashboard?.sharingConsent !== 'granted'
                  ? ` (not enabled by ${dashboard.lineName})`
                  : ''}
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <InsightsSummary summary={dashboard.summary} showMood={allowMood} />
            <CallMetrics activity={dashboard.callActivity} />
          </div>

          <RetentionInsightsCard retention={dashboard.retention} />

          {allowMood && (
            <div className={showEngagement ? 'grid gap-6 lg:grid-cols-2' : 'grid gap-6'}>
              {showEngagement && (
                <div className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground">Engagement Trend</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Engagement has been {dashboard.summary.engagementNote}.
                  </p>
                </div>
              )}
              <MoodTrend
                moodTrend={dashboard.moodTrend}
                dateRange={callActivityDates}
                timezone={dashboard.timezone}
                className={showEngagement ? undefined : 'lg:col-span-2'}
              />
            </div>
          )}

          {showLimitedNotice && (
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm text-muted-foreground">
                Detailed insights require {SHARING_TIER_LABELS.tier_2} sharing level or higher.{' '}
                {dashboard.lineName} controls sharing preferences during calls.
              </p>
            </div>
          )}

          {allowTopics && <TopicsChart topics={dashboard.topics} />}

          {allowConcerns && <ConcernsList concerns={dashboard.concerns} />}

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="font-semibold text-foreground mb-6">Call History</h2>
            <CallActivityList sessions={dashboard.callHistory} />
          </div>
        </>
      )}
    </div>
  );
}
