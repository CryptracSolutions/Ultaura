'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import type { Session } from '@supabase/supabase-js';
import {
  EnvelopeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

import Trans from '~/core/ui/Trans';
import If from '~/core/ui/If';
import Alert from '~/core/ui/Alert';
import Button from '~/core/ui/Button';
import useSupabase from '~/core/hooks/use-supabase';
import configuration from '~/configuration';

type ConfirmationStatus = 'waiting' | 'verified' | 'timeout';

const TIMEOUT_MS = 300_000; // 5 minutes
const POLL_INTERVAL_MS = 4_000;
const EMAIL_CONFIRMATION_STATE_KEY = 'ultaura.email-confirmation.pending';

interface EmailConfirmationWaitingProps {
  email: string;
  inviteCode?: string;
  nextPath?: string;
  resendCooldown: number;
  resendSuccess: boolean;
  resendError: Error | null;
  isResending: boolean;
  onResend: () => void;
}

export default function EmailConfirmationWaiting({
  email,
  inviteCode,
  nextPath,
  resendCooldown,
  resendSuccess,
  resendError,
  isResending,
  onResend,
}: EmailConfirmationWaitingProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const continuePath = getContinuePath({ inviteCode, nextPath });
  const continueToApp = useCallback(() => {
    clearPendingEmailConfirmationState();
    router.replace(continuePath);
  }, [continuePath, router]);

  const [status, setStatus] = useState<ConfirmationStatus>('waiting');
  const statusRef = useRef<ConfirmationStatus>('waiting');
  const sessionFingerprintRef = useRef('');
  const hasBaselineSessionFingerprintRef = useRef(false);

  const safeSetStatus = (next: ConfirmationStatus) => {
    // Don't overwrite 'verified' with 'timeout'
    if (statusRef.current === 'verified') return;
    statusRef.current = next;
    setStatus(next);
  };

  // Session detection: listener + polling
  useEffect(() => {
    if (status !== 'waiting') return;

    let active = true;

    const checkConfirmedUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active || !user) {
          return;
        }

        const isSameEmail =
          normalizeEmail(user.email) === normalizeEmail(email);

        if (isSameEmail && user.email_confirmed_at) {
          safeSetStatus('verified');
        }
      } catch {
        // Keep waiting on transient auth client errors.
      }
    };

    const handleSessionFingerprint = (session: Session | null | undefined) => {
      const nextFingerprint = getSessionFingerprint(session);

      if (!hasBaselineSessionFingerprintRef.current) {
        hasBaselineSessionFingerprintRef.current = true;
        sessionFingerprintRef.current = nextFingerprint;
        return;
      }

      if (nextFingerprint === sessionFingerprintRef.current) {
        return;
      }

      sessionFingerprintRef.current = nextFingerprint;
      void checkConfirmedUser();
    };

    const syncSessionFingerprint = async (mode: 'initialize' | 'observe') => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) {
          return;
        }

        if (mode === 'initialize') {
          hasBaselineSessionFingerprintRef.current = true;
          sessionFingerprintRef.current = getSessionFingerprint(session);
          return;
        }

        handleSessionFingerprint(session);
      } catch {
        // Keep waiting on transient auth client errors.
      }
    };

    // Primary: auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionFingerprint(session);
    });

    void syncSessionFingerprint('initialize');

    // Fallback: poll every 4s
    const pollInterval = setInterval(() => {
      void syncSessionFingerprint('observe');
    }, POLL_INTERVAL_MS);

    // Timeout after 5 minutes
    const timeoutId = setTimeout(() => {
      safeSetStatus('timeout');
    }, TIMEOUT_MS);

    return () => {
      active = false;
      subscription.unsubscribe();
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [email, status, supabase.auth]);

  if (status === 'verified') {
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
        <Button onClick={continueToApp}>
          <Trans i18nKey="auth:confirmationContinueToApp" />
        </Button>
      </div>
    );
  }

  if (status === 'timeout') {
    return (
      <div className="flex flex-col items-center space-y-4 py-8 text-center">
        <ExclamationCircleIcon className="h-16 w-16 text-yellow-500" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          <Trans i18nKey="auth:confirmationTimeoutHeading" />
        </h2>
        <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
          <Trans i18nKey="auth:confirmationTimeoutBody" />
        </p>
        <ResendButton
          resendCooldown={resendCooldown}
          isResending={isResending}
          onResend={onResend}
        />
        <ResendAlerts
          resendSuccess={resendSuccess}
          resendError={resendError}
        />
      </div>
    );
  }

  // status === 'waiting'
  return (
    <div className="flex flex-col items-center space-y-4 py-8 text-center">
      {prefersReducedMotion ? (
        <EnvelopeIcon className="h-16 w-16 text-primary" />
      ) : (
        <motion.div
          animate={{
            y: [0, -6, 0],
            rotate: [0, 2, -2, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <EnvelopeIcon className="h-16 w-16 text-primary" />
        </motion.div>
      )}

      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        <Trans i18nKey="auth:confirmationWaitingHeading" />
      </h2>

      <p className="max-w-sm text-sm text-gray-600 dark:text-gray-300">
        <Trans
          i18nKey="auth:confirmationWaitingBody"
          values={{ email }}
          components={{ strong: <strong /> }}
        />
      </p>

      <p
        className="text-xs text-gray-400 dark:text-gray-500"
        aria-live="polite"
      >
        <Trans i18nKey="auth:confirmationWaitingPolling" />
      </p>

      <ResendButton
        resendCooldown={resendCooldown}
        isResending={isResending}
        onResend={onResend}
      />

      <ResendAlerts resendSuccess={resendSuccess} resendError={resendError} />
    </div>
  );
}

function clearPendingEmailConfirmationState() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(EMAIL_CONFIRMATION_STATE_KEY);
}

function normalizeEmail(email: Maybe<string>) {
  return email?.trim().toLowerCase() ?? '';
}

function getContinuePath(params: { inviteCode?: string; nextPath?: string }) {
  const safeNext = getSafeNextPath(params.nextPath);
  const searchParams = new URLSearchParams();
  searchParams.set('next', safeNext);

  if (params.inviteCode) {
    searchParams.set('inviteCode', params.inviteCode);
  }

  return `/auth/confirmed?${searchParams.toString()}`;
}

function getSafeNextPath(value?: string) {
  if (!value) {
    return configuration.paths.onboarding;
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return configuration.paths.onboarding;
  }

  return value;
}

function getSessionFingerprint(session: Session | null | undefined) {
  if (!session) {
    return 'anon';
  }

  return [
    session.user?.id ?? '',
    session.expires_at ?? '',
    session.access_token ?? '',
    session.refresh_token ?? '',
  ].join('|');
}

function ResendButton({
  resendCooldown,
  isResending,
  onResend,
}: {
  resendCooldown: number;
  isResending: boolean;
  onResend: () => void;
}) {
  return (
    <Button
      onClick={onResend}
      loading={isResending}
      disabled={resendCooldown > 0}
      variant="outline"
    >
      {isResending ? (
        <Trans i18nKey="auth:signupResendingEmail" />
      ) : resendCooldown > 0 ? (
        <Trans
          i18nKey="auth:signupResendCooldown"
          values={{ seconds: resendCooldown }}
        />
      ) : (
        <Trans i18nKey="auth:signupResendEmail" />
      )}
    </Button>
  );
}

function ResendAlerts({
  resendSuccess,
  resendError,
}: {
  resendSuccess: boolean;
  resendError: Error | null;
}) {
  return (
    <>
      <If condition={resendSuccess}>
        <Alert type="success">
          <Trans i18nKey="auth:signupResendSuccess" />
        </Alert>
      </If>
      <If condition={resendError}>
        <Alert type="error">
          <Trans i18nKey="auth:signupResendError" />
        </Alert>
      </If>
    </>
  );
}
