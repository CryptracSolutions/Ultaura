'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircleIcon } from '@heroicons/react/24/outline';

import Trans from '~/core/ui/Trans';
import Spinner from '~/core/ui/Spinner';

const REDIRECT_DELAY_MS = 3000;
const REDIRECT_SECONDS = REDIRECT_DELAY_MS / 1000;

export default function ConfirmedInterstitial({ next }: { next: string }) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [secondsRemaining, setSecondsRemaining] = useState(REDIRECT_SECONDS);

  useEffect(() => {
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
  }, [router, next]);

  return (
    <div className="flex flex-col items-center space-y-4 py-8 text-center">
      {prefersReducedMotion ? (
        <CheckCircleIcon className="h-16 w-16 text-green-500" />
      ) : (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        >
          <CheckCircleIcon className="h-16 w-16 text-green-500" />
        </motion.div>
      )}

      <h2
        className="text-xl font-semibold text-green-600 dark:text-green-400"
        aria-live="assertive"
      >
        <Trans i18nKey="auth:confirmationVerified" />
      </h2>

      <div className="flex items-center gap-2 text-sm">
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
  );
}
