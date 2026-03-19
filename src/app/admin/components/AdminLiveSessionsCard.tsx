'use client';

import { useCallback, useEffect, useState } from 'react';
import AdminStatCard from '~/app/admin/components/AdminStatCard';
import Badge from '~/core/ui/Badge';
import { PhoneIcon } from '@heroicons/react/24/outline';

const AUTO_REFRESH_MS =
  process.env.NODE_ENV === 'development' ? 60_000 : 30_000;

interface LiveSessionsData {
  activeSessions: number | null;
  handoffsToday: number;
  successfulHandoffsToday: number;
  avgHandoffDurationMs: number | null;
  checkedAt: string;
}

export default function AdminLiveSessionsCard() {
  const [data, setData] = useState<LiveSessionsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/live-sessions', {
        cache: 'no-store',
      });
      if (response.ok) {
        const json = await response.json();
        setData(json);
      }
    } catch {
      // Silently fail — card will show stale data or loading state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const interval = window.setInterval(() => { void fetchData(); }, AUTO_REFRESH_MS);
    return () => window.clearInterval(interval);
  }, [fetchData]);

  const activeCalls = data?.activeSessions ?? 0;

  let handoffSubtext = 'No handoffs today';
  if (data && data.handoffsToday > 0) {
    const avgSuffix = data.avgHandoffDurationMs
      ? ` · avg ${(data.avgHandoffDurationMs / 1000).toFixed(1)}s`
      : '';
    handoffSubtext = `${data.successfulHandoffsToday}/${data.handoffsToday} handoffs today${avgSuffix}`;
  }

  return (
    <AdminStatCard
      icon={PhoneIcon}
      label="Live Calls"
      value={loading ? '—' : String(activeCalls)}
      subtext={loading ? 'Loading...' : handoffSubtext}
      headerRight={
        activeCalls > 0 ? (
          <Badge color="success" size="small">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </Badge>
        ) : null
      }
    />
  );
}
