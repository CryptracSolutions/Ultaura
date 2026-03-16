import { HeartPulse } from 'lucide-react';
import Link from 'next/link';
import { buildHealthUrl } from '../lib/health-navigation';

interface HealthEmptyStateProps {
  lineId: string;
}

export function HealthEmptyState({ lineId }: HealthEmptyStateProps) {
  return (
    <div className="flex flex-col items-center py-12 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
        <HeartPulse className="h-7 w-7 text-primary" aria-hidden="true" />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-foreground">
        No health information yet
      </h3>

      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Start by adding conditions, then medications and observations.
        Ultaura will use this context to provide more thoughtful companionship.
      </p>

      <div className="mt-8 grid w-full max-w-sm gap-3">
        <Link
          href={buildHealthUrl('conditions', lineId)}
          className="flex min-h-[52px] items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted transition-colors"
        >
          <span className="text-sm font-medium text-foreground">
            1. Add conditions
          </span>
          <span className="text-xs text-muted-foreground">Start here</span>
        </Link>

        <Link
          href={buildHealthUrl('medications', lineId)}
          className="flex min-h-[52px] items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted transition-colors"
        >
          <span className="text-sm font-medium text-foreground">
            2. Add medications
          </span>
          <span className="text-xs text-muted-foreground">Then this</span>
        </Link>

        <Link
          href={buildHealthUrl('documents', lineId)}
          className="flex min-h-[52px] items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted transition-colors"
        >
          <span className="text-sm font-medium text-foreground">
            3. Upload documents
          </span>
          <span className="text-xs text-muted-foreground">Optional</span>
        </Link>

        <Link
          href={buildHealthUrl('observations', lineId)}
          className="flex min-h-[52px] items-center justify-between rounded-lg border border-border bg-card px-4 py-3 hover:bg-muted transition-colors"
        >
          <span className="text-sm font-medium text-foreground">
            4. Record observations
          </span>
          <span className="text-xs text-muted-foreground">Ongoing</span>
        </Link>
      </div>
    </div>
  );
}
