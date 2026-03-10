'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import EmailConfirmationWaiting from '~/app/auth/components/EmailConfirmationWaiting';
import useResendSignupConfirmation from '~/core/hooks/use-resend-signup-confirmation';

const RESEND_COOLDOWN_SECONDS = 60;

export default function PendingEmailConfirmation(props: {
  email: string;
  inviteCode?: string;
  nextPath?: string;
}) {
  const resendConfirmationMutation = useResendSignupConfirmation();
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const [resendCooldown, setResendCooldown] = useState(
    RESEND_COOLDOWN_SECONDS,
  );
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<Error | null>(null);

  const stopCooldown = useCallback(() => {
    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

  const startCooldown = useCallback(() => {
    stopCooldown();
    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    cooldownIntervalRef.current = setInterval(() => {
      setResendCooldown((current) => {
        if (current <= 1) {
          stopCooldown();
          return 0;
        }

        return current - 1;
      });
    }, 1000);
  }, [stopCooldown]);

  useEffect(() => {
    startCooldown();

    return () => {
      stopCooldown();
    };
  }, [startCooldown, stopCooldown]);

  const onResend = useCallback(async () => {
    if (
      resendCooldown > 0 ||
      resendConfirmationMutation.isMutating
    ) {
      return;
    }

    setResendSuccess(false);
    setResendError(null);

    try {
      await resendConfirmationMutation.trigger({
        email: props.email,
      });

      setResendSuccess(true);
      startCooldown();
    } catch (error) {
      setResendError(error as Error);
    }
  }, [
    props.email,
    resendConfirmationMutation,
    resendCooldown,
    startCooldown,
  ]);

  return (
    <EmailConfirmationWaiting
      email={props.email}
      inviteCode={props.inviteCode}
      nextPath={props.nextPath}
      resendCooldown={resendCooldown}
      resendSuccess={resendSuccess}
      resendError={resendError}
      isResending={resendConfirmationMutation.isMutating}
      onResend={onResend}
    />
  );
}
