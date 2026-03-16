import { loadAppDataForUser } from '~/lib/server/loaders/load-app-data';
import AppRouteShell from '~/app/dashboard/(app)/components/OrganizationScopeLayout';
import { UltauraErrorBoundary } from '~/components/ultaura/ErrorBoundary';
import { getUltauraAccount } from '~/lib/ultaura/accounts';
import { getDocsIndex } from '~/lib/search/docs-index';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import MembershipRole from '~/lib/organizations/types/membership-role';
import { isHealthFeatureEnabled } from '~/lib/ultaura/health/entitlements';
import { HealthFeatureFlagProvider } from '~/lib/contexts/health-feature-flag';

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

  if (isViewer && account) {
    try {
      const adminClient = getSupabaseServerComponentClient({ admin: true });
      const dashboardSharingModule = await import('~/lib/ultaura/dashboard-sharing');
      const getViewerContext = dashboardSharingModule.getViewerContext as
        | ((client: unknown, accountId: string, userId: string) => Promise<{
          accountHolderName: string;
          seniorName: string | null;
        }>)
        | undefined;

      if (getViewerContext) {
        const viewerContext = await getViewerContext(
          adminClient,
          account.id,
          data.auth.user.id,
        );
        accountHolderName = viewerContext.accountHolderName;
        seniorName = viewerContext.seniorName;
      }
    } catch {
      accountHolderName = null;
      seniorName = null;
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
        allOrganizations={allOrganizations}
      >
        <UltauraErrorBoundary>{children}</UltauraErrorBoundary>
      </AppRouteShell>
    </HealthFeatureFlagProvider>
  );
}

export default AppLayout;
