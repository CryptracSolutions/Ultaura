import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return { ...actual, cache: (fn: (...args: unknown[]) => unknown) => fn };
});
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
}));
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));
vi.mock('next/dist/client/components/redirect', () => ({
  isRedirectError: vi.fn(() => false),
  getURLFromRedirectError: vi.fn(() => '/'),
}));

import MembershipRole from '~/lib/organizations/types/membership-role';

type OrgEntry = {
  role: number;
  organization: {
    uuid: string;
    name: string;
  };
};

describe('organization selection helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  const entries: OrgEntry[] = [
    {
      role: MembershipRole.Viewer,
      organization: { uuid: 'viewer-1', name: 'Viewer Org' },
    },
    {
      role: MembershipRole.Member,
      organization: { uuid: 'member-1', name: 'Member Org' },
    },
  ];

  it('prefers non-viewer default over viewer cookie when cookie is not manually set', async () => {
    const { selectOrganizationMembership } = await import('~/lib/server/loaders/load-app-data');
    const selected = selectOrganizationMembership({
      organizations: entries,
      organizationCookie: 'viewer-1',
      hasManualSelection: false,
    });

    expect(selected?.organization.uuid).toBe('member-1');
  });

  it('respects viewer cookie when user manually selected it', async () => {
    const { selectOrganizationMembership } = await import('~/lib/server/loaders/load-app-data');
    const selected = selectOrganizationMembership({
      organizations: entries,
      organizationCookie: 'viewer-1',
      hasManualSelection: true,
    });

    expect(selected?.organization.uuid).toBe('viewer-1');
  });

  it('sorts deterministically by role, then org name, then uuid', async () => {
    const { sortOrganizationsForSelection } = await import('~/lib/server/loaders/load-app-data');
    const input: OrgEntry[] = [
      {
        role: MembershipRole.Member,
        organization: { uuid: 'b-uuid', name: 'Alpha' },
      },
      {
        role: MembershipRole.Member,
        organization: { uuid: 'a-uuid', name: 'Alpha' },
      },
      {
        role: MembershipRole.Admin,
        organization: { uuid: 'z-uuid', name: 'Zulu' },
      },
    ];

    const sorted = sortOrganizationsForSelection(input);

    expect(sorted.map((entry) => entry.organization.uuid)).toEqual([
      'z-uuid',
      'a-uuid',
      'b-uuid',
    ]);
  });
});
