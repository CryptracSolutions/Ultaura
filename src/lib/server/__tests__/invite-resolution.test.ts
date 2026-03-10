import { beforeEach, describe, expect, it, vi } from 'vitest';

import MembershipRole from '~/lib/organizations/types/membership-role';

const getInviteMembershipForResolutionMock = vi.fn();
const acceptInviteToOrganizationMock = vi.fn();
const getOrganizationByIdMock = vi.fn();
const cookieSetMock = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    set: cookieSetMock,
  }),
}));

vi.mock('~/lib/memberships/queries', () => ({
  getInviteMembershipForResolution: getInviteMembershipForResolutionMock,
}));

vi.mock('~/lib/memberships/mutations', () => ({
  acceptInviteToOrganization: acceptInviteToOrganizationMock,
}));

vi.mock('~/lib/organizations/database/queries', () => ({
  getOrganizationById: getOrganizationByIdMock,
}));

function createClient(params?: { onboarded?: boolean; authEmail?: string | null }) {
  const onboarded = params?.onboarded ?? false;
  const authEmail = params?.authEmail ?? null;

  const usersSelectBuilder: any = {
    eq: vi.fn(() => usersSelectBuilder),
    maybeSingle: vi.fn(async () => ({ data: { onboarded }, error: null })),
  };
  const usersUpdateBuilder: any = {
    eq: vi.fn(async () => ({ error: null })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => usersSelectBuilder),
          update: vi.fn(() => usersUpdateBuilder),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({
          data: {
            user: authEmail ? { email: authEmail } : null,
          },
        })),
      },
    },
  } as any;
}

describe('invite-resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrganizationByIdMock.mockResolvedValue({
      data: {
        uuid: 'org-22',
      },
    });
  });

  it('returns accepted for already-linked viewer membership and routes to dashboard', async () => {
    getInviteMembershipForResolutionMock.mockResolvedValue({
      data: {
        id: 1,
        role: MembershipRole.Viewer,
        code: 'code-1',
        invitedEmail: 'viewer@example.com',
        organizationId: 22,
        userId: 'user-1',
        organization: {
          id: 22,
          uuid: 'org-22',
        },
      },
      error: null,
    });

    const { resolveInvite } = await import('~/lib/memberships/invite-resolution');
    const result = await resolveInvite({
      client: createClient({ onboarded: false }),
      code: 'code-1',
      userId: 'user-1',
      userEmail: 'viewer@example.com',
    });

    expect(result.status).toBe('accepted');
    expect(result.destination).toBe('/dashboard');
    expect(result.needsOnboarding).toBe(false);
    expect(cookieSetMock).toHaveBeenCalledOnce();
    expect(acceptInviteToOrganizationMock).not.toHaveBeenCalled();
  });

  it('returns wrong_account when invite email does not match user email', async () => {
    getInviteMembershipForResolutionMock.mockResolvedValue({
      data: {
        id: 2,
        role: MembershipRole.Viewer,
        code: 'code-2',
        invitedEmail: 'invited@example.com',
        organizationId: 23,
        userId: null,
        organization: {
          id: 23,
          uuid: 'org-23',
        },
      },
      error: null,
    });

    const { resolveInvite } = await import('~/lib/memberships/invite-resolution');
    const result = await resolveInvite({
      client: createClient(),
      code: 'code-2',
      userId: 'user-2',
      userEmail: 'other@example.com',
    });

    expect(result.status).toBe('wrong_account');
    expect(result.destination).toBe('/dashboard');
    expect(acceptInviteToOrganizationMock).not.toHaveBeenCalled();
  });

  it('accepts unresolved member invite and routes non-onboarded users to onboarding', async () => {
    getInviteMembershipForResolutionMock.mockResolvedValue({
      data: {
        id: 3,
        role: MembershipRole.Member,
        code: 'code-3',
        invitedEmail: 'member@example.com',
        organizationId: 24,
        userId: null,
        organization: {
          id: 24,
          uuid: 'org-24',
        },
      },
      error: null,
    });

    acceptInviteToOrganizationMock.mockResolvedValue({
      data: { membership: 33, organization: 24 },
      error: null,
    });

    const client = createClient({ onboarded: false });
    const { resolveInvite } = await import('~/lib/memberships/invite-resolution');
    const result = await resolveInvite({
      client,
      code: 'code-3',
      userId: 'user-3',
      userEmail: 'member@example.com',
    });

    expect(result.status).toBe('accepted');
    expect(result.membershipId).toBe(33);
    expect(result.destination).toBe('/onboarding');
    expect(result.needsOnboarding).toBe(true);
    expect(acceptInviteToOrganizationMock).toHaveBeenCalledOnce();
    expect(client.from).toHaveBeenCalledWith('users');
  });

  it('returns invalid when invite lookup is empty', async () => {
    getInviteMembershipForResolutionMock.mockResolvedValue({
      data: null,
      error: null,
    });

    const { resolveInvite } = await import('~/lib/memberships/invite-resolution');
    const result = await resolveInvite({
      client: createClient(),
      code: 'missing',
      userId: 'user-4',
      userEmail: 'missing@example.com',
    });

    expect(result.status).toBe('invalid');
    expect(result.destination).toBe('/dashboard');
  });
});
