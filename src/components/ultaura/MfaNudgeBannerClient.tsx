'use client';

import { useState } from 'react';

import Link from 'next/link';
import { ShieldCheck, X } from 'lucide-react';

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
    <div className="relative rounded-xl border border-primary/30 bg-primary/10 p-4">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:pr-10">
        <div className="flex items-start gap-3 pr-8 sm:pr-0">
          <div className="mt-0.5 shrink-0 rounded-full bg-primary/20 p-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </div>

          <div>
            <div className="font-medium text-foreground">
              <Trans i18nKey={'profile:mfaNudgeHeading'} />
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              <Trans i18nKey={'profile:mfaNudgeDescription'} />
            </div>
          </div>
        </div>

        <Link
          href="/dashboard/settings/profile/authentication"
          className="inline-flex w-full items-center justify-center whitespace-nowrap rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors sm:w-auto"
        >
          <Trans i18nKey={'profile:mfaNudgeCta'} />
        </Link>
      </div>
    </div>
  );
}
