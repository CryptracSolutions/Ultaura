import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import AppRouteShell from '~/app/dashboard/(app)/components/OrganizationScopeLayout';
import { UltauraErrorBoundary } from '~/components/ultaura/ErrorBoundary';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getDocsIndex } from '~/lib/search/docs-index';
import MembershipRole from '~/lib/organizations/types/membership-role';
import { isHealthFeatureEnabled } from '~/lib/ultaura/health/entitlements';
import { HealthFeatureFlagProvider } from '~/lib/contexts/health-feature-flag';
import { getViewerContext } from '~/lib/ultaura/dashboard-sharing';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';

type AppDataWithOrganizations = Awaited<ReturnType<typeof loadAppDataForUser>> & {
  allOrganizations?: Array<{
    organization: NonNullable<
      Awaited<ReturnType<typeof loadAppDataForUser>>['organization']
    >;
    role: number;
  }>;
};

async function AppLayout({ children }: React.PropsWithChildren) {
  const data = await loadAppDataForUser();
  const account = data.organization
    ? await getUltauraAccount(data.organization.id)
    : null;
  const docsIndex = getDocsIndex();
  const isViewer = Number(data.role) === Number(MembershipRole.Viewer);
  const allOrganizations =
    (data as AppDataWithOrganizations).allOrganizations ??
    (data.organization
      ? [{ organization: data.organization, role: Number(data.role) }]
      : []);

  let accountHolderName: string | null = null;
  let seniorName: string | null = null;
  let assignedLineIds: string[] = [];

  if (isViewer && account) {
    try {
      const adminClient = getSupabaseServerComponentClient({ admin: true });
      const viewerContext = await getViewerContext(adminClient, account.id, data.auth.user.id);
      accountHolderName = viewerContext.accountHolderName;
      seniorName = viewerContext.seniorName;
      assignedLineIds = viewerContext.assignedLineIds;
    } catch {
      accountHolderName = null;
      seniorName = null;
      assignedLineIds = [];
    }
  }

  const healthEnabled = await isHealthFeatureEnabled();

  return (
    <HealthFeatureFlagProvider enabled={healthEnabled}>
      <AppRouteShell
        data={data}
        ultauraAccountId={account?.id ?? null}
        docsIndex={docsIndex}
        isViewer={isViewer}
        accountHolderName={accountHolderName}
        seniorName={seniorName}
        assignedLineIds={assignedLineIds}
        allOrganizations={allOrganizations}
      >
        <UltauraErrorBoundary>{children}</UltauraErrorBoundary>
      </AppRouteShell>
    </HealthFeatureFlagProvider>
  );
}

export default AppLayout;
