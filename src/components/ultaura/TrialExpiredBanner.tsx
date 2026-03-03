import Link from 'next/link';
import { AlertTriangle, ArrowRight } from 'lucide-react';

import Trans from '~/core/ui/Trans';

export function TrialExpiredBanner(_props?: { trialPlanName?: string }) {
  return (
    <div className="rounded-xl border border-border bg-destructive/10 py-2.5 px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 p-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground text-sm">
              <Trans i18nKey={'profile:trialExpiredHeading'} />
            </div>
            <div className="text-xs text-muted-foreground">
              <Trans i18nKey={'profile:trialExpiredDescription'} />
            </div>
          </div>
        </div>

        <div className="pl-10 sm:pl-0 sm:ml-auto">
          <Link
            href="/dashboard/settings/subscription"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-black transition-colors hover:text-black/80 dark:text-white dark:hover:text-white/80"
          >
            <Trans i18nKey={'profile:trialExpiredCta'} />
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
