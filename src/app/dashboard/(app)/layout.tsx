import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import AppRouteShell from '~/app/dashboard/(app)/components/OrganizationScopeLayout';
import { UltauraErrorBoundary } from '~/components/ultaura/ErrorBoundary';
import { getUltauraAccount } from '~/lib/ultaura/accounts';

async function AppLayout({ children }: React.PropsWithChildren) {
  const data = await loadAppDataForUser();
  const account = data.organization
    ? await getUltauraAccount(data.organization.id)
    : null;

  return (
    <AppRouteShell data={data} ultauraAccountId={account?.id ?? null}>
      <UltauraErrorBoundary>{children}</UltauraErrorBoundary>
    </AppRouteShell>
  );
}

export default AppLayout;
