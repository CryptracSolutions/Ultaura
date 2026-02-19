import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface SearchResultUser {
  id: string;
  email: string | undefined;
  phone: string | undefined;
  createdAt: string;
  lastSignInAt: string | undefined;
  isBanned: boolean;
  organizations: Array<{
    id: number;
    uuid: string;
    name: string;
    role: number;
  }>;
  accounts: Array<{
    id: string;
    name: string;
    status: string;
    planId: string | null;
    organizationId: number;
  }>;
  lines: Array<{
    id: string;
    displayName: string;
    phoneE164: string;
    status: string;
    accountId: string;
  }>;
}

interface AuthUserInput {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
  last_sign_in_at?: string;
  banned_until?: string;
}

interface MembershipRow {
  user_id: string;
  role: number;
  organization: {
    id: number;
    uuid: string;
    name: string;
  };
}

interface AccountRow {
  id: string;
  name: string;
  status: string;
  plan_id: string | null;
  organization_id: number;
}

interface LineRow {
  id: string;
  display_name: string;
  phone_e164: string;
  status: string;
  account_id: string;
}

interface AuthUserLike {
  id: string;
  email?: string;
  phone?: string;
  created_at: string;
  last_sign_in_at?: string;
  banned_until?: string;
}

const AUTH_LIST_USERS_PER_PAGE = 200;
const AUTH_LIST_USERS_MAX_PAGES = 500;

function toAuthUserInput(user: AuthUserLike): AuthUserInput {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    banned_until: user.banned_until,
  };
}

async function listAllAuthUsers(
  client: SupabaseClient,
): Promise<AuthUserInput[]> {
  const authUsers: AuthUserInput[] = [];
  let reachedEnd = false;

  for (let page = 1; page <= AUTH_LIST_USERS_MAX_PAGES; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: AUTH_LIST_USERS_PER_PAGE,
    });

    if (error) {
      throw error;
    }

    const pageUsers = data.users.map((user) => toAuthUserInput(user));
    authUsers.push(...pageUsers);

    const total = typeof data.total === 'number' ? data.total : undefined;

    if (
      pageUsers.length < AUTH_LIST_USERS_PER_PAGE ||
      (total !== undefined && authUsers.length >= total)
    ) {
      reachedEnd = true;
      break;
    }
  }

  if (!reachedEnd) {
    throw new Error(
      `Auth user search exceeded ${AUTH_LIST_USERS_MAX_PAGES} pages.`,
    );
  }

  return authUsers;
}

function getNormalizedPhoneVariants(query: string): string[] {
  const digits = query.replace(/\D/g, '');
  if (!digits) {
    return [];
  }

  const variants = new Set<string>();

  variants.add(digits);
  variants.add(`+${digits}`);

  if (digits.length === 10) {
    variants.add(`1${digits}`);
    variants.add(`+1${digits}`);
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    variants.add(digits.slice(1));
    variants.add(`+${digits}`);
  }

  if (digits.startsWith('00') && digits.length > 2) {
    variants.add(digits.slice(2));
    variants.add(`+${digits.slice(2)}`);
  }

  return Array.from(variants);
}

async function resolveUsersByAccountIds(
  client: SupabaseClient,
  accountIds: string[],
): Promise<SearchResultUser[]> {
  if (accountIds.length === 0) {
    return [];
  }

  const { data: matchingAccounts } = await client
    .from('ultaura_accounts')
    .select('organization_id')
    .in('id', accountIds);

  if (!matchingAccounts || matchingAccounts.length === 0) {
    return [];
  }

  const orgIds = Array.from(
    new Set(
      matchingAccounts.map(
        (account: { organization_id: number }) => account.organization_id,
      ),
    ),
  );

  const { data: membershipData } = await client
    .from('memberships')
    .select('user_id')
    .in('organization_id', orgIds);

  if (!membershipData || membershipData.length === 0) {
    return [];
  }

  const userIds: string[] = Array.from(
    new Set<string>(
      membershipData.map((membership: { user_id: string }) => membership.user_id),
    ),
  );

  const authUsers = await Promise.all(
    userIds.map(async (uid: string) => {
      const { data } = await client.auth.admin.getUserById(uid);
      return data?.user;
    }),
  );

  const validUsers = authUsers.filter(Boolean) as AuthUserInput[];
  return enrichUsers(client, validUsers);
}

/**
 * Enrich a list of auth users with their org memberships, accounts, and lines.
 */
async function enrichUsers(
  client: SupabaseClient,
  authUsers: AuthUserInput[],
): Promise<SearchResultUser[]> {
  if (authUsers.length === 0) return [];

  const userIds = authUsers.map((u: AuthUserInput) => u.id);

  // Fetch memberships with organizations
  const { data: rawMemberships } = await client
    .from('memberships')
    .select<string, MembershipRow>(
      `
      user_id,
      role,
      organization:organization_id!inner (
        id,
        uuid,
        name
      )
    `,
    )
    .in('user_id', userIds);

  const memberships: MembershipRow[] = rawMemberships ?? [];

  // Collect organization IDs from memberships
  const orgIds = new Set<number>();
  for (const m of memberships) {
    if (m.organization?.id) orgIds.add(m.organization.id);
  }

  // Fetch accounts under those organizations
  let accounts: AccountRow[] = [];

  if (orgIds.size > 0) {
    const { data } = await client
      .from('ultaura_accounts')
      .select('id, name, status, plan_id, organization_id')
      .in('organization_id', Array.from(orgIds));
    accounts = (data as AccountRow[] | null) ?? [];
  }

  // Fetch lines under those accounts
  const accountIds = accounts.map((a: AccountRow) => a.id);
  let lines: LineRow[] = [];

  if (accountIds.length > 0) {
    const { data } = await client
      .from('ultaura_lines')
      .select('id, display_name, phone_e164, status, account_id')
      .in('account_id', accountIds);
    lines = (data as LineRow[] | null) ?? [];
  }

  return authUsers.map((authUser: AuthUserInput) => {
    const userMemberships = memberships.filter(
      (m: MembershipRow) => m.user_id === authUser.id,
    );

    const userOrgIds = new Set<number>(
      userMemberships.map((m: MembershipRow) => m.organization?.id),
    );

    const userAccounts = accounts.filter((a: AccountRow) =>
      userOrgIds.has(a.organization_id),
    );
    const userAccountIds = new Set<string>(
      userAccounts.map((a: AccountRow) => a.id),
    );
    const userLines = lines.filter((l: LineRow) =>
      userAccountIds.has(l.account_id),
    );

    return {
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone,
      createdAt: authUser.created_at,
      lastSignInAt: authUser.last_sign_in_at,
      isBanned: Boolean(
        authUser.banned_until && authUser.banned_until !== 'none',
      ),
      organizations: userMemberships.map((m: MembershipRow) => ({
        id: m.organization.id,
        uuid: m.organization.uuid,
        name: m.organization.name,
        role: m.role,
      })),
      accounts: userAccounts.map((a: AccountRow) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        planId: a.plan_id,
        organizationId: a.organization_id,
      })),
      lines: userLines.map((l: LineRow) => ({
        id: l.id,
        displayName: l.display_name,
        phoneE164: l.phone_e164,
        status: l.status,
        accountId: l.account_id,
      })),
    };
  });
}

/**
 * Search users by email (partial, case-insensitive).
 * Uses the auth admin API to list users and filters by email.
 */
export async function searchByEmail(
  client: SupabaseClient,
  query: string,
): Promise<SearchResultUser[]> {
  const lowerQuery = query.toLowerCase();
  const authUsers = await listAllAuthUsers(client);

  const matching = authUsers.filter(
    (u) => u.email && u.email.toLowerCase().includes(lowerQuery),
  );

  return enrichUsers(client, matching);
}

/**
 * Search users by phone number (partial match on ultaura_lines.phone_e164),
 * then reverse-join to find the associated users.
 */
export async function searchByPhone(
  client: SupabaseClient,
  query: string,
): Promise<SearchResultUser[]> {
  const variants = getNormalizedPhoneVariants(query);
  if (variants.length === 0) return [];

  const variantFilters = variants.map(
    (value) => `phone_e164.ilike.%${value}%`,
  );

  let linesQuery = client.from('ultaura_lines').select('account_id');

  linesQuery =
    variantFilters.length === 1
      ? linesQuery.ilike('phone_e164', `%${variants[0]}%`)
      : linesQuery.or(variantFilters.join(','));

  // Find lines matching the phone number
  const { data: matchingLines, error: linesError } = await linesQuery;

  if (linesError) throw linesError;
  if (!matchingLines || matchingLines.length === 0) return [];

  const accountIds = Array.from(
    new Set(
      matchingLines.map(
        (l: { account_id: string }) => l.account_id,
      ),
    ),
  );
  return resolveUsersByAccountIds(client, accountIds);
}

/**
 * Search by user ID (exact lookup).
 */
export async function searchByUid(
  client: SupabaseClient,
  query: string,
): Promise<SearchResultUser[]> {
  const { data, error } = await client.auth.admin.getUserById(query.trim());

  if (error || !data?.user) return [];

  const user = data.user;

  return enrichUsers(client, [
    {
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      banned_until:
        'banned_until' in user ? (user.banned_until as string) : undefined,
    },
  ]);
}

/**
 * Search by line phone number (exact E.164 match).
 */
export async function searchByLinePhone(
  client: SupabaseClient,
  query: string,
): Promise<SearchResultUser[]> {
  const normalizedPhones = getNormalizedPhoneVariants(query).filter((value) =>
    value.startsWith('+'),
  );
  if (normalizedPhones.length === 0) return [];

  const { data: matchingLines, error: linesError } = await client
    .from('ultaura_lines')
    .select('account_id')
    .in('phone_e164', normalizedPhones);

  if (linesError) throw linesError;
  if (!matchingLines || matchingLines.length === 0) return [];

  const accountIds = Array.from(
    new Set(
      matchingLines.map(
        (l: { account_id: string }) => l.account_id,
      ),
    ),
  );
  return resolveUsersByAccountIds(client, accountIds);
}
