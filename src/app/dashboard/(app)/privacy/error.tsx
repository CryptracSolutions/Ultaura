'use client';

import { useEffect } from 'react';
import AppHeader from '../components/AppHeader';
import Button from '~/core/ui/Button';
import { PageBody } from '~/core/ui/Page';
import initializeBrowserSentry from '~/core/sentry/initialize-browser-sentry';

export default function PrivacyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Privacy Center failed to load', error);
    void (async () => {
      try {
        await initializeBrowserSentry();
        const Sentry = await import('@sentry/react');
        Sentry.captureException(error, {
          tags: {
            area: 'privacy-center',
          },
        });
      } catch (sentryError) {
        console.error('Failed to report Privacy Center error to Sentry', sentryError);
      }
    })();
  }, [error]);

  return (
    <>
      <AppHeader
        title="Privacy Center"
        description="Manage consent, sharing, recording, and data exports"
      />
      <PageBody>
        <div className="py-8">
          <div className="max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              We couldn&apos;t load Privacy Center right now.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Please try again. Your saved privacy preferences were not changed.
            </p>
            <div className="mt-4">
              <Button type="button" variant="outline" onClick={reset}>
                Try again
              </Button>
            </div>
          </div>
        </div>
      </PageBody>
    </>
  );
}
