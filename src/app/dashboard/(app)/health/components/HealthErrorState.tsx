'use client';

import { AlertTriangle } from 'lucide-react';

interface HealthErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function HealthErrorState({
  message = 'Something went wrong while loading this section.',
  onRetry,
}: HealthErrorStateProps) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start space-x-3">
        <AlertTriangle
          className="h-5 w-5 shrink-0 text-destructive mt-0.5"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-medium text-destructive">
            Unable to load
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>

          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-[44px] items-center rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
