import { redirect } from 'next/navigation';
import { AlertCircle, Check, Lock } from 'lucide-react';

import Button from '~/core/ui/Button';
import Logo from '~/core/ui/Logo';
import {
  checkRecipientSmsVerification,
  lookupRecipientBySmsVerificationToken,
  startRecipientSmsVerification,
} from '~/lib/ultaura/recipient-sms-verification';

export const metadata = {
  title: 'Verify Phone for Alerts',
};

type VerifyPageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    status?: string;
    message?: string;
  };
};

function buildVerifyPhonePath(
  token: string,
  params?: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return `/ultaura/alerts/verify-phone/${encodeURIComponent(token)}${query ? `?${query}` : ''}`;
}

export default async function VerifyRecipientPhonePage({
  params,
  searchParams,
}: VerifyPageProps) {
  const contextResult = await lookupRecipientBySmsVerificationToken(params.token);

  if (!contextResult.success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex justify-center">
          <Logo
            className="h-10"
            showWordmark
            wordmarkClassName="text-2xl font-semibold leading-none text-primary"
          />
        </div>
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm text-center space-y-5">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <AlertCircle className="h-6 w-6" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">
              Verification link expired
            </h1>
            <p className="text-sm text-muted-foreground">
              This verification link is invalid or has expired. Ask the account holder to resend a new verification link.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
            <Button href="/" variant="outline">
              Go to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const context = contextResult.data;
  const autoSendResult = await startRecipientSmsVerification(params.token, {
    mode: 'auto',
  });

  const status = searchParams?.status ?? (context.smsVerifiedAt ? 'verified' : 'pending');
  const isVerified = status === 'verified' || Boolean(context.smsVerifiedAt);
  const statusMessage =
    searchParams?.message ??
    (autoSendResult.success
      ? autoSendResult.data.sent
        ? `We sent a verification code to ${context.phoneMasked}.`
        : autoSendResult.data.cooldownRemainingSeconds
          ? `Please wait ${autoSendResult.data.cooldownRemainingSeconds} seconds before requesting another code.`
          : undefined
      : autoSendResult.error.message);

  async function resendCodeAction() {
    'use server';

    const result = await startRecipientSmsVerification(params.token, {
      mode: 'resend',
    });

    redirect(
      buildVerifyPhonePath(params.token, {
        status: 'pending',
        message: result.success
          ? result.data.sent
            ? `A new code was sent to ${result.data.phoneMasked}.`
            : result.data.cooldownRemainingSeconds
              ? `Please wait ${result.data.cooldownRemainingSeconds} seconds before requesting another code.`
              : 'Please wait a moment before requesting another code.'
          : result.error.message || 'Failed to resend code. Please try again.',
      }),
    );
  }

  async function verifyCodeAction(formData: FormData) {
    'use server';
    const code = String(formData.get('verificationCode') ?? '').trim();
    const result = await checkRecipientSmsVerification(params.token, code);

    if (!result.success) {
      redirect(
        buildVerifyPhonePath(params.token, {
          status: 'pending',
          message: result.error.message || 'Invalid verification code',
        }),
      );
    }

    redirect(
      buildVerifyPhonePath(params.token, {
        status: 'verified',
        message: `Phone verified. You can now receive SMS alerts at ${context.phoneMasked}.`,
      }),
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-10">
      <div className="mb-8 flex justify-center">
        <Logo
          className="h-10"
          showWordmark
          wordmarkClassName="text-2xl font-semibold leading-none text-primary"
        />
      </div>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 shadow-sm text-center space-y-5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          {isVerified ? (
            <Check className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Lock className="h-6 w-6" aria-hidden="true" />
          )}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {isVerified ? 'Phone verified' : 'Verify your phone'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVerified
              ? `SMS alerts are now enabled for ${context.phoneMasked}.`
              : `Enter the code sent to ${context.phoneMasked} to enable SMS alerts.`}
          </p>
          {statusMessage ? (
            <p className="text-sm text-muted-foreground">{statusMessage}</p>
          ) : null}
        </div>

        {isVerified ? (
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
            <Button href="/" variant="outline">
              Go to Home
            </Button>
          </div>
        ) : (
          <>
            <form action={verifyCodeAction} className="space-y-3 text-left">
              <label
                htmlFor="verification-code"
                className="block text-sm font-medium text-foreground"
              >
                Verification code
              </label>
              <input
                id="verification-code"
                name="verificationCode"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={10}
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
                placeholder="Enter code"
              />
              <Button type="submit" variant="default" className="w-full">
                Verify phone
              </Button>
            </form>

            <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
              <form action={resendCodeAction}>
                <Button type="submit" variant="outline">
                  Resend code
                </Button>
              </form>
              <Button href="/" variant="ghost">
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
