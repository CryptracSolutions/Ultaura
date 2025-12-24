import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import AppRouteShell from '~/app/dashboard/(app)/components/OrganizationScopeLayout';
import { UltauraErrorBoundary } from '~/components/ultaura/ErrorBoundary';

async function AppLayout({ children }: React.PropsWithChildren) {
  const data = await loadAppDataForUser();

  return (
    <AppRouteShell data={data}>
      <UltauraErrorBoundary>{children}</UltauraErrorBoundary>
    </AppRouteShell>
  );
}

export default AppLayout;
