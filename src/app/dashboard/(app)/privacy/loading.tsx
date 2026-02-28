import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

export default function PrivacyLoading() {
  return (
    <>
      <AppHeader
        title="Privacy Center"
        description="Manage consent, sharing, recording, and data exports"
      />
      <PageBody>
        <div className="py-8" role="status" aria-live="polite" aria-busy="true">
          <p className="text-sm font-medium text-foreground">Loading privacy settings...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This usually takes a few seconds.
          </p>

          <div className="mt-6 space-y-3">
            <div className="h-20 animate-pulse rounded-lg border border-border/60 bg-muted/30" />
            <div className="h-28 animate-pulse rounded-lg border border-border/60 bg-muted/30" />
            <div className="h-24 animate-pulse rounded-lg border border-border/60 bg-muted/30" />
          </div>
        </div>
      </PageBody>
    </>
  );
}
