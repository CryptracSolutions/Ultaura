import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import AppRouteShell from '~/app/dashboard/(app)/components/OrganizationScopeLayout';
import { UltauraErrorBoundary } from '~/components/ultaura/ErrorBoundary';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getDocsIndex } from '~/lib/search/docs-index';

async function AppLayout({ children }: React.PropsWithChildren) {
  const data = await loadAppDataForUser();
  const account = data.organization
    ? await getUltauraAccount(data.organization.id)
    : null;
  const docsIndex = getDocsIndex();

  return (
    <AppRouteShell
      data={data}
      ultauraAccountId={account?.id ?? null}
      docsIndex={docsIndex}
    >
      <UltauraErrorBoundary>{children}</UltauraErrorBoundary>
    </AppRouteShell>
  );
}

export default AppLayout;
