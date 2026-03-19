import AppHeader from '../components/AppHeader';
import { PageBody } from '~/core/ui/Page';

export default function HealthLoading() {
  return (
    <>
      <AppHeader
        title="Health Profile"
        description="Manage health information, medications, and medical documents"
      />
      <PageBody>
        <div className="py-6" role="status" aria-live="polite" aria-busy="true">
          <p className="text-sm font-medium text-foreground">Loading health profile...</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This usually takes a few seconds.
          </p>

          <div className="mt-6 space-y-3">
            <div className="h-16 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
            <div className="h-10 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
            <div className="h-32 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
            <div className="h-28 animate-pulse rounded-xl border border-border/60 bg-muted/30" />
          </div>
        </div>
      </PageBody>
    </>
  );
}
