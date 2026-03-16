'use client';

import { useRouter } from 'next/navigation';
import { Phone } from 'lucide-react';
import type { LineRow } from '~/lib/ultaura/types';
import { HEALTH_LINE_STORAGE_KEY_PREFIX, buildHealthUrl } from '../lib/health-navigation';

interface HealthLineSelectorProps {
  lines: LineRow[];
  accountId: string;
}

export function HealthLineSelector({ lines, accountId }: HealthLineSelectorProps) {
  const router = useRouter();

  const handleSelectLine = (lineShortId: string) => {
    try {
      localStorage.setItem(`${HEALTH_LINE_STORAGE_KEY_PREFIX}${accountId}`, lineShortId);
    } catch {
      // localStorage may be unavailable; continue without it
    }

    router.push(buildHealthUrl('suggestions', lineShortId));
  };

  return (
    <div className="flex flex-col items-center py-12 px-4">
      <h2 className="text-xl font-semibold text-foreground">
        Select a line to view Health Profile
      </h2>

      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Choose the line whose health information you want to manage.
      </p>

      <div className="mt-8 w-full max-w-sm space-y-3">
        {lines.map((line) => (
          <button
            key={line.id}
            onClick={() => handleSelectLine(line.short_id)}
            className="flex w-full min-h-[56px] items-center space-x-4 rounded-lg border border-border bg-card px-4 py-3 text-left hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Phone className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {line.display_name}
              </p>
              {line.phone_e164 ? (
                <p className="text-xs text-muted-foreground">{line.phone_e164}</p>
              ) : null}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
