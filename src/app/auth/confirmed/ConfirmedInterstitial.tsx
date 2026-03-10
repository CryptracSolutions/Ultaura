'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

import Trans from '~/core/ui/Trans';
import Spinner from '~/core/ui/Spinner';

const REDIRECT_DELAY_MS = 3000;
const REDIRECT_SECONDS = REDIRECT_DELAY_MS / 1000;

export default function ConfirmedInterstitial({
  next,
  autoRedirect = true,
}: {
  next: string;
  autoRedirect?: boolean;
}) {
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!autoRedirect) {
      return;
    }

    const redirectTimeout = setTimeout(() => {
      router.replace(next);
    }, REDIRECT_DELAY_MS);

    const countdownInterval = setInterval(() => {
      setSecondsRemaining((current) => Math.max(1, current - 1));
    }, 1000);

    return () => {
      clearTimeout(redirectTimeout);
      clearInterval(countdownInterval);
    };
  }, [autoRedirect, router, next]);

  // Auto-redirect: render as a fixed overlay so the parent shell's entrance
  // animation doesn't interfere with this transient 3-second interstitial.
  if (autoRedirect) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4 text-center">
          <CheckCircleIcon className="h-16 w-16 text-green-500" />

          <h2
            className="text-xl font-semibold text-green-600 dark:text-green-400"
            aria-live="assertive"
          >
            <Trans i18nKey="auth:confirmationVerified" />
          </h2>

          <div className="flex min-h-5 items-center gap-2 text-sm">
            <Spinner className="h-4 w-4 fill-primary text-primary/25 dark:fill-primary dark:text-primary/25" />
            <p
              className="text-gray-500 dark:text-gray-400"
              aria-live="polite"
            >
              <Trans
                i18nKey="auth:confirmationRedirectingCountdown"
                values={{ seconds: secondsRemaining }}
              />
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4 py-8 text-center">
      <CheckCircleIcon className="h-16 w-16 text-green-500" />

      <h2
        className="text-xl font-semibold text-green-600 dark:text-green-400"
        aria-live="assertive"
      >
        <Trans i18nKey="auth:confirmationVerified" />
      </h2>

      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        onClick={() => router.replace(next)}
      >
        <Trans i18nKey="auth:confirmationContinueToApp" />
      </button>
    </div>
  );
}
