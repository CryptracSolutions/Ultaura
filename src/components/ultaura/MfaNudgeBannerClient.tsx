'use client';

import { useState } from 'react';

import Link from 'next/link';
import { ArrowRight, ShieldCheck, X } from 'lucide-react';

import { setCookie } from '~/core/generic/cookies';
import Trans from '~/core/ui/Trans';

export function MfaNudgeBannerClient() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  const handleDismiss = () => {
    const now = new Date();

    setCookie('mfa-nudge-dismissed', now.toISOString(), {
      path: '/dashboard',
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      sameSite: 'lax',
    });

    setVisible(false);
  };

  return (
    <div className="rounded-xl border border-border bg-primary/10 py-2.5 px-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-3">
          <div className="shrink-0 p-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground text-sm">
              <Trans i18nKey={'profile:mfaNudgeHeading'} />
            </div>

            <div className="text-xs text-muted-foreground">
              <Trans i18nKey={'profile:mfaNudgeDescription'} />
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 pl-10 sm:pl-0 sm:ml-auto">
          <Link
            href="/dashboard/settings/profile/authentication"
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary transition-colors hover:text-primary/80"
          >
            <Trans i18nKey={'profile:mfaNudgeCta'} />
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <button
            onClick={handleDismiss}
            className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
