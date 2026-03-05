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
