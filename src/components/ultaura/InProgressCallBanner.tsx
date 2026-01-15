'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { DateTime } from 'luxon';
import useSupabase from '~/core/hooks/use-supabase';
import { getCallTypeLabel } from '~/lib/ultaura/call-utils';
import type { CallSessionRow } from '~/lib/ultaura/types';

interface ActiveCall extends Pick<
  CallSessionRow,
  'id' | 'line_id' | 'status' | 'connected_at' | 'created_at' | 'direction' | 'is_reminder_call' | 'is_test_call' | 'scheduler_idempotency_key'
> {
  lineName: string | null;
}

const ACTIVE_STATUSES: Array<CallSessionRow['status']> = ['in_progress'];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function InProgressCallBanner({ accountId }: { accountId: string }) {
  const supabase = useSupabase();
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [realtimeReady, setRealtimeReady] = useState(true);

  const fetchActiveCall = useCallback(async () => {
    const { data } = await supabase
      .from('ultaura_call_sessions')
      .select(`
        id,
        line_id,
        status,
        connected_at,
        created_at,
        direction,
        is_reminder_call,
        is_test_call,
        scheduler_idempotency_key,
        ultaura_lines (display_name)
      `)
      .eq('account_id', accountId)
      .in('status', ACTIVE_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1);

    const record = data?.[0] as (CallSessionRow & { ultaura_lines?: { display_name?: string } | null }) | undefined;
    if (!record) {
      setActiveCall(null);
      return;
    }

    setActiveCall({
      id: record.id,
      line_id: record.line_id,
      status: record.status,
      connected_at: record.connected_at,
      created_at: record.created_at,
      direction: record.direction,
      is_reminder_call: record.is_reminder_call,
      is_test_call: record.is_test_call,
      scheduler_idempotency_key: record.scheduler_idempotency_key,
      lineName: record.ultaura_lines?.display_name ?? null,
    });
  }, [accountId, supabase]);

  useEffect(() => {
    fetchActiveCall().catch(() => undefined);

    const channel = supabase
      .channel('call_sessions_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ultaura_call_sessions',
        filter: `account_id=eq.${accountId}`,
      }, () => {
        fetchActiveCall().catch(() => undefined);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeReady(true);
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeReady(false);
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, fetchActiveCall, supabase]);

  useEffect(() => {
    if (realtimeReady) return;
    const interval = setInterval(() => {
      fetchActiveCall().catch(() => undefined);
    }, 10_000);

    return () => clearInterval(interval);
  }, [fetchActiveCall, realtimeReady]);

  useEffect(() => {
    if (!activeCall?.connected_at) {
      setDurationSeconds(0);
      return;
    }

    const connectedAt = new Date(activeCall.connected_at).getTime();
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000));
      setDurationSeconds(seconds);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeCall?.connected_at]);

  const callTypeLabel = useMemo(() => {
    if (!activeCall) return '';
    return getCallTypeLabel(activeCall);
  }, [activeCall]);

  if (!activeCall) return null;

  const statusLabel = activeCall.connected_at
    ? `Connected ${formatDuration(durationSeconds)}`
    : 'In progress';

  const lineLabel = activeCall.lineName ?? 'Line';

  return (
    <div className="sticky top-0 lg:top-12 z-20">
      <div className="mx-container mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
            <PhoneCall className="h-4 w-4" />
            <span className="font-medium">Active call</span>
          </div>
          <div className="text-sm text-amber-900/80">
            {lineLabel} &middot; {callTypeLabel} &middot; {statusLabel}
          </div>
        </div>
        {activeCall.connected_at ? (
          <div className="mt-1 text-xs text-amber-900/70">
            Started {DateTime.fromISO(activeCall.connected_at).toLocaleString(DateTime.TIME_SIMPLE)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
