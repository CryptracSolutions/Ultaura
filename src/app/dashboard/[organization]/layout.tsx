import loadAppData from '~/lib/server/loaders/load-app-data';
import AppRouteShell from '~/app/dashboard/[organization]/components/OrganizationScopeLayout';
import { UltauraErrorBoundary } from '~/components/ultaura/ErrorBoundary';

async function AppLayout({
  children,
  params,
}: React.PropsWithChildren<{
  params: {
    organization: string;
  };
}>) {
  const data = await loadAppData(params.organization);

  return (
    <AppRouteShell data={data}>
      <UltauraErrorBoundary>{children}</UltauraErrorBoundary>
    </AppRouteShell>
  );
}

export default AppLayout;
