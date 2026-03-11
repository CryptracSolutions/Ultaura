import { redirect } from 'next/navigation';
import { AlertCircle, Check, Lock } from 'lucide-react';

import Button from '~/core/ui/Button';
import Logo from '~/core/ui/Logo';
import { confirmNotificationRecipient } from '~/lib/ultaura/notification-recipients';

export const metadata = {
  title: 'Confirm Family Updates',
};

type ConfirmPageProps = {
  params: {
    token: string;
  };
  searchParams?: {
    status?: string;
    message?: string;
    accountName?: string;
  };
};

function buildConfirmPagePath(
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

  return `/ultaura/confirm/${encodeURIComponent(token)}${query ? `?${query}` : ''}`;
}

export default function ConfirmFamilyUpdatesPage({
  params,
  searchParams,
}: ConfirmPageProps) {
  async function confirmUpdatesAction() {
    'use server';

    let result: Awaited<ReturnType<typeof confirmNotificationRecipient>>;

    try {
      result = await confirmNotificationRecipient(params.token);
    } catch {
      redirect(
        buildConfirmPagePath(params.token, {
          status: 'error',
          message: 'Please try again later.',
        }),
      );
    }

    if (!result.success) {
      redirect(
        buildConfirmPagePath(params.token, {
          status: 'error',
          message:
            result.error.message || 'This confirmation link is invalid or expired.',
        }),
      );
    }

    if (result.data.smsVerificationToken) {
      redirect(
        `/ultaura/alerts/verify-phone/${encodeURIComponent(result.data.smsVerificationToken)}`
      );
    }

    redirect(
      buildConfirmPagePath(params.token, {
        status: 'success',
        accountName: result.data.accountName,
      }),
    );
  }

  const status = searchParams?.status ?? 'pending';
  const isSuccess = status === 'success';
  const isError = status === 'error';

  const icon = isError ? (
    <AlertCircle className="h-6 w-6" aria-hidden="true" />
  ) : isSuccess ? (
    <Check className="h-6 w-6" aria-hidden="true" />
  ) : (
    <Lock className="h-6 w-6" aria-hidden="true" />
  );

  const title = isSuccess
    ? 'You are confirmed'
    : isError
      ? 'Confirmation failed'
      : 'Confirm family updates';

  const body = isSuccess
    ? `You will now receive family updates from ${searchParams?.accountName || 'Ultaura'}.`
    : isError
      ? searchParams?.message || 'This confirmation link is invalid or expired.'
      : 'Confirm that you want to receive weekly summaries and family alert updates from Ultaura.';

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
          {icon}
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            {body}
            {isSuccess ? ' You can close this page.' : ''}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:justify-center">
          {isSuccess ? null : isError ? null : (
            <form action={confirmUpdatesAction}>
              <Button type="submit" variant="default">
                Confirm updates
              </Button>
            </form>
          )}

          <Button href="/" variant="outline">
            Go to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
