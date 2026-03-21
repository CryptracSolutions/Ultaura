import { redirect } from 'next/navigation';

import MembershipRole from '~/lib/organizations/types/membership-role';

export function isViewerRole(role: number | MembershipRole | null | undefined): boolean {
  return Number(role) === Number(MembershipRole.Viewer);
}

export function redirectViewerAway(
  role: number | MembershipRole | null | undefined,
  redirectTo = '/dashboard',
): void {
  if (isViewerRole(role)) {
    redirect(redirectTo);
  }
}

/**
 * Loads the line IDs a viewer is assigned to.
 * Returns undefined if the user is not a viewer, or if context cannot be loaded.
 */
export async function getViewerLineIds(options: {
  isViewer: boolean;
  accountId: string;
  userId: string;
}): Promise<string[] | undefined> {
  if (!options.isViewer) return undefined;

  try {
    const [{ getViewerContext }, { default: getSupabaseServerComponentClient }] = await Promise.all([
      import('~/lib/ultaura/dashboard-sharing'),
      import('~/core/supabase/server-component-client'),
    ]);
    const adminClient = getSupabaseServerComponentClient({ admin: true });
    const ctx = await getViewerContext(adminClient, options.accountId, options.userId);
    return ctx.assignedLineIds;
  } catch {
    return undefined;
  }
}
