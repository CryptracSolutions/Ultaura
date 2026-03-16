import Link from 'next/link';
import { Lock } from 'lucide-react';

export function HealthLockedState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
      </div>

      <h2 className="mt-5 text-xl font-semibold text-foreground">
        Health Profile is not available on your plan
      </h2>

      <p className="mt-3 max-w-md text-sm text-muted-foreground">
        Health Profile is available on Comfort, Family, and Usage Based plans.
        Upgrade to track conditions, medications, documents, and observations
        for your loved one.
      </p>

      <Link
        href="/dashboard/settings/subscription"
        className="mt-6 inline-flex min-h-[44px] items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        View plans
      </Link>
    </div>
  );
}
