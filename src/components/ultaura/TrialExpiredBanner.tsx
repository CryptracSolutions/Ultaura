import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';

export function TrialExpiredBanner(props: { trialPlanName?: string }) {
  const planLabel = props.trialPlanName ? `${props.trialPlanName} ` : '';

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-destructive/20 p-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="font-medium text-foreground">
              Your {planLabel}trial has ended
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Subscribe to continue making calls and managing your lines.
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Choose a Plan
        </Link>
      </div>
    </div>
  );
}

