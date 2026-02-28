'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import { getDataExportRequests } from '~/lib/ultaura/privacy';
import type { DataExportRequest } from '~/lib/ultaura/types';

export interface UseExportPollingOptions {
  accountId: string;
  initialExports: DataExportRequest[];
  pollIntervalMs?: number;
  maxAttempts?: number;
}

export interface UseExportPollingResult {
  exports: DataExportRequest[];
  setExports: Dispatch<SetStateAction<DataExportRequest[]>>;
  exportInProgress: boolean;
  exportPollingTimedOut: boolean;
  refreshExports: () => Promise<DataExportRequest[]>;
}

const IN_PROGRESS_EXPORT_STATUSES: DataExportRequest['status'][] = [
  'pending',
  'processing',
];

export function hasInProgressExport(exports: DataExportRequest[]): boolean {
  return exports.some((request) =>
    IN_PROGRESS_EXPORT_STATUSES.includes(request.status),
  );
}

export function shouldSkipPollingTick({
  inFlight,
  timedOut,
}: {
  inFlight: boolean;
  timedOut: boolean;
}): boolean {
  return inFlight || timedOut;
}

export function getNextPollingAttemptState({
  attempts,
  maxAttempts,
}: {
  attempts: number;
  maxAttempts: number;
}): { attempts: number; timedOut: boolean } {
  const nextAttempts = attempts + 1;
  return {
    attempts: nextAttempts,
    timedOut: nextAttempts >= maxAttempts,
  };
}

export function useExportPolling({
  accountId,
  initialExports,
  pollIntervalMs = 10_000,
  maxAttempts = 90,
}: UseExportPollingOptions): UseExportPollingResult {
  const [exports, setExports] = useState<DataExportRequest[]>(initialExports);
  const [exportPollingTimedOut, setExportPollingTimedOut] = useState(false);
  const attemptsRef = useRef(0);
  const inFlightRef = useRef(false);

  useEffect(() => {
    setExports(initialExports);
  }, [initialExports]);

  const exportInProgress = hasInProgressExport(exports);

  const refreshExports = useCallback(async (): Promise<DataExportRequest[]> => {
    const refreshed = await getDataExportRequests(accountId);
    setExports(refreshed);
    return refreshed;
  }, [accountId]);

  useEffect(() => {
    if (!exportInProgress) {
      attemptsRef.current = 0;
      inFlightRef.current = false;
      setExportPollingTimedOut(false);
      return;
    }

    let cancelled = false;

    const intervalId = window.setInterval(async () => {
      if (
        shouldSkipPollingTick({
          inFlight: inFlightRef.current,
          timedOut: exportPollingTimedOut,
        })
      ) {
        return;
      }

      inFlightRef.current = true;
      try {
        const refreshed = await getDataExportRequests(accountId);
        if (cancelled) {
          return;
        }

        setExports(refreshed);
        const nextAttempt = getNextPollingAttemptState({
          attempts: attemptsRef.current,
          maxAttempts,
        });
        attemptsRef.current = nextAttempt.attempts;
        if (nextAttempt.timedOut) {
          setExportPollingTimedOut(true);
        }
      } catch {
        // Keep current state; next interval will retry.
      } finally {
        inFlightRef.current = false;
      }
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    accountId,
    exportInProgress,
    exportPollingTimedOut,
    maxAttempts,
    pollIntervalMs,
  ]);

  return {
    exports,
    setExports,
    exportInProgress,
    exportPollingTimedOut,
    refreshExports,
  };
}
