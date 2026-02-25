'use client';

import { useCallback, useEffect, useState } from 'react';

import Badge from '~/core/ui/Badge';
import Button from '~/core/ui/Button';
import AdminStatCard from '~/app/admin/components/AdminStatCard';

const AUTO_REFRESH_MS = process.env.NODE_ENV === 'development' ? 120_000 : 60_000;

type CryptoHealthPayload = {
  ok?: boolean;
  status?: string;
  reason?: string;
  code?: string;
  message?: string;
  accountId?: string;
  checkedAt?: string;
  error?: string;
};

function formatCheckedAt(value?: string): string {
  if (!value) return 'Not checked yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown timestamp';
  return date.toLocaleString();
}

function statusView(statusCode: number | null, payload: CryptoHealthPayload | null, loading: boolean) {
  if (loading && !payload) {
    return {
      label: 'Checking',
      color: 'info' as const,
      detail: 'Running crypto health check...',
    };
  }

  if (statusCode === 200 && payload?.ok) {
    return {
      label: 'Healthy',
      color: 'success' as const,
      detail: payload.status === 'skipped'
        ? 'No key rows available yet (skipped).'
        : 'Current key can decrypt the checked account DEK.',
    };
  }

  if (statusCode === 503) {
    return {
      label: 'Warning',
      color: 'warn' as const,
      detail: payload?.message || 'Crypto validation failed.',
    };
  }

  return {
    label: 'Auth/Config issue',
    color: 'error' as const,
    detail: payload?.message || payload?.error || 'Could not validate crypto health.',
  };
}

export default function AdminCryptoHealthCard() {
  const [payload, setPayload] = useState<CryptoHealthPayload | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/crypto-health', {
        method: 'GET',
        cache: 'no-store',
      });
      const nextPayload = await response.json().catch(() => ({}));
      setPayload(nextPayload);
      setStatusCode(response.status);
    } catch {
      setPayload({
        ok: false,
        code: 'REQUEST_FAILED',
        message: 'Failed to reach health check endpoint.',
        checkedAt: new Date().toISOString(),
      });
      setStatusCode(500);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth();

    const intervalId = window.setInterval(() => {
      void fetchHealth();
    }, AUTO_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchHealth]);

  const view = statusView(statusCode, payload, loading);

  return (
    <AdminStatCard label="Crypto Health">
      <div className={'flex items-center justify-between gap-3'}>
        <Button size={'sm'} variant={'outline'} onClick={() => void fetchHealth()} loading={loading}>
          Refresh
        </Button>

        <Badge color={view.color} size={'small'}>
          <span>{view.label}</span>
        </Badge>
      </div>

      <div className={'mt-2.5 flex flex-col gap-1.5'}>
        <p className={'text-sm text-muted-foreground'}>{view.detail}</p>

        <div className={'flex flex-col gap-1 text-xs text-muted-foreground'}>
          <span>Code: {payload?.code || 'N/A'}</span>
          <span>Account: {payload?.accountId || 'N/A'}</span>
          <span>Last checked: {formatCheckedAt(payload?.checkedAt)}</span>
        </div>
      </div>
    </AdminStatCard>
  );
}
