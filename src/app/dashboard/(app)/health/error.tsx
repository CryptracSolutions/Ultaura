'use client';

import { useEffect } from 'react';
import AppHeader from '../components/AppHeader';
import Button from '~/core/ui/Button';
import { PageBody } from '~/core/ui/Page';
import initializeBrowserSentry from '~/core/sentry/initialize-browser-sentry';

export default function HealthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Health Profile failed to load', error);

    void (async () => {
      try {
        await initializeBrowserSentry();
        const Sentry = await import('@sentry/react');
        Sentry.captureException(error, {
          tags: { area: 'health-profile' },
        });
      } catch (sentryError) {
        console.error('Failed to report Health Profile error to Sentry', sentryError);
      }
    })();
  }, [error]);

  return (
    <>
      <AppHeader
        title="Health Profile"
        description="Manage health information and call context for your loved one"
      />
      <PageBody>
        <div className="py-8">
          <div className="max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm font-medium text-destructive">
              We couldn&apos;t load Health Profile right now.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Please try again. Your saved health data was not changed.
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
