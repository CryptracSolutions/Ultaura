'use client';

import { useEffect, useState } from 'react';

const DEFAULT_TICK_MS = 60_000;

export function useCurrentTimeMs(tickMs: number = DEFAULT_TICK_MS): number {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), tickMs);

    return () => window.clearInterval(timer);
  }, [tickMs]);

  return nowMs;
}
