'use server';

import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';

import type { Database } from '~/database.types';
import getLogger from '~/core/logger';
import sendEmail from '~/core/email/send-email';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import requireSession from '~/lib/user/require-session';
import MembershipRole from '~/lib/organizations/types/membership-role';
import renderDashboardAccessInviteEmail from '~/lib/emails/dashboard-access-invite';
import renderDashboardAccessGrantedEmail from '~/lib/emails/dashboard-access-granted';

const logger = getLogger();
const VIEWER_ROLE = MembershipRole.Viewer;

type RecipientRow = Database['public']['Tables']['ultaura_notification_recipients']['Row'];
type RecipientRowWithDashboardAccess = RecipientRow & {
  dashboard_access_granted_at?: string | null;
};
type MembershipUpsertResult = {
  createdMembershipId: number | null;
  inviteCode: string | null;
  isExistingUser: boolean;
  existingRoleAccess: boolean;
};

function getSiteUrl(): string {
  const siteUrl =
    process.env.NODE_ENV !== 'production'
      ? process.env.SITE_URL || 'http://localhost:3000'
      : process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return siteUrl.replace(/\/$/, '');
}

function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

async function sendDashboardSharingEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
  accountId: string;
  recipientId: string;
}): Promise<void> {
  const emailFrom = process.env.EMAIL_SENDER?.trim();

  if (!emailFrom) {
    if (isProductionEnvironment()) {
      throw new Error('Missing EMAIL_SENDER configuration');
    }

    logger.warn(
      {
        accountId: params.accountId,
        recipientId: params.recipientId,
      },
      'Skipping dashboard-sharing email in non-production because EMAIL_SENDER is not configured',
    );
    return;
  }

  try {
    await sendEmail({
      from: emailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
  } catch (error) {
    if (isProductionEnvironment()) {
      throw error;
    }

    logger.warn(
      {
        accountId: params.accountId,
        recipientId: params.recipientId,
        error,
        reason: error instanceof Error ? error.message : String(error),
      },
      'Failed to send dashboard-sharing email in non-production; continuing grant flow',
    );
  }
}

async function requireAccountOwner(
  accountId: string,
): Promise<ActionResult<{ userId: string; canManageDashboardSharing: boolean }>> {
  const client = getSupabaseServerActionClient();
  const session = await requireSession(client).catch(() => null);
  const userId = session?.user?.id;

  if (!userId) {
    return {
      success: false,
      error: createError(ErrorCodes.UNAUTHORIZED, 'Unauthorized'),
    };
  }

  const { data: account, error } = await client
    .from('ultaura_accounts')
    .select('id, user_type, sharing_enabled')
    .eq('id', accountId)
    .eq('created_by_user_id', userId)
    .maybeSingle();

  if (error || !account) {
    return {
      success: false,
      error: createError(ErrorCodes.FORBIDDEN, 'Access denied'),
    };
  }

  const userType = account.user_type as 'self' | 'family_managed' | null;
  const canManageDashboardSharing =
    userType === 'family_managed' ||
    (userType === 'self' && Boolean(account.sharing_enabled));

  return { success: true, data: { userId, canManageDashboardSharing } };
}

async function resolveAccountAndRecipientContext(
  adminClient: SupabaseClient<Database>,
  accountId: string,
  recipient: RecipientRow,
) {
  const [{ data: account }, { data: lines }] = await Promise.all([
    adminClient
      .from('ultaura_accounts')
      .select('name, organization_id, created_by_user_id')
      .eq('id', accountId)
      .single(),
    adminClient
      .from('ultaura_lines')
      .select('display_name, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true }),
  ]);

  let inviterName = account?.name || 'Ultaura';

  if (account?.created_by_user_id) {
    const { data: userRow } = await adminClient
      .from('users')
      .select('display_name')
      .eq('id', account.created_by_user_id)
      .maybeSingle();

    inviterName = userRow?.display_name?.trim() || inviterName;
  }

  const seniorName = lines?.length === 1 ? (lines[0]?.display_name ?? null) : null;

  return {
    accountName: account?.name || 'Ultaura',
    organizationId: account?.organization_id,
    inviterName,
    seniorName: seniorName || 'your loved one',
    recipientName: recipient.name,
    recipientEmail: recipient.email,
  };
}

async function getAuthUserIdByEmail(adminClient: SupabaseClient<Database>, email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();

  const { data, error } = await adminClient.rpc(
    'get_auth_user_id_by_email' as never,
    { lookup_email: normalizedEmail } as never,
  );

  if (error) {
    logger.error({ error, email: normalizedEmail }, 'Failed to look up auth user by email');
    return null;
  }

  return data ?? null;
}

async function createOrEnsureViewerMembership(params: {
  adminClient: SupabaseClient<Database>;
  organizationId: number;
  recipientEmail: string;
  authUserId: string | null;
}): Promise<MembershipUpsertResult> {
  const normalizedEmail = params.recipientEmail.trim().toLowerCase();

  if (params.authUserId) {
    const { data: membership } = await params.adminClient
      .from('memberships')
      .select('id, role')
      .eq('organization_id', params.organizationId)
      .eq('user_id', params.authUserId)
      .maybeSingle();

    if (membership && Number(membership.role) >= Number(MembershipRole.Member)) {
      return {
        createdMembershipId: null,
        inviteCode: null,
        isExistingUser: true,
        existingRoleAccess: true,
      };
    }

    if (membership && Number(membership.role) === Number(VIEWER_ROLE)) {
      return {
        createdMembershipId: null,
        inviteCode: null,
        isExistingUser: true,
        existingRoleAccess: false,
      };
    }

    const { data: inserted, error } = await params.adminClient
      .from('memberships')
      .insert({
        organization_id: params.organizationId,
        user_id: params.authUserId,
        role: VIEWER_ROLE,
      } as never)
      .select('id')
      .maybeSingle();

    if (error && error.code !== '23505') {
      throw error;
    }

    return {
      createdMembershipId: inserted?.id ?? null,
      inviteCode: null,
      isExistingUser: true,
      existingRoleAccess: false,
    };
  }

  const { data: existingPending } = await params.adminClient
    .from('memberships')
    .select('id, code')
    .eq('organization_id', params.organizationId)
    .eq('invited_email', normalizedEmail)
    .eq('role', VIEWER_ROLE)
    .not('code', 'is', null)
    .maybeSingle();

  if (existingPending?.id) {
    return {
      createdMembershipId: null,
      inviteCode: existingPending.code,
      isExistingUser: false,
      existingRoleAccess: false,
    };
  }

  const inviteCode = nanoid(36);
  const { data: pendingMembership, error } = await params.adminClient
    .from('memberships')
    .insert({
      organization_id: params.organizationId,
      invited_email: normalizedEmail,
      role: VIEWER_ROLE,
      code: inviteCode,
    } as never)
    .select('id, code')
    .single();

  if (error) {
    throw error;
  }

  return {
    createdMembershipId: pendingMembership.id,
    inviteCode: pendingMembership.code,
    isExistingUser: false,
    existingRoleAccess: false,
  };
}

async function rollbackGrant(params: {
  adminClient: SupabaseClient<Database>;
  accountId: string;
  recipientId: string;
  membershipId: number | null;
  inviteCode: string | null;
}) {
  await params.adminClient
    .from('ultaura_notification_recipients')
    .update({ dashboard_access_granted_at: null } as never)
    .eq('id', params.recipientId)
    .eq('account_id', params.accountId);

  if (params.membershipId) {
    await params.adminClient
      .from('memberships')
      .delete()
      .eq('id', params.membershipId);
  }

  if (params.inviteCode) {
    await params.adminClient
      .from('memberships')
      .delete()
      .eq('organization_id', await getOrganizationIdForAccount(params.adminClient, params.accountId))
      .eq('role', VIEWER_ROLE)
      .eq('code', params.inviteCode);
  }
}

async function getOrganizationIdForAccount(adminClient: SupabaseClient<Database>, accountId: string): Promise<number> {
  const { data: account, error } = await adminClient
    .from('ultaura_accounts')
    .select('organization_id')
    .eq('id', accountId)
    .single();

  if (error || !account) {
    throw new Error('Account organization not found');
  }

  return account.organization_id;
}

function grantSuccess(isExistingUser: boolean): ActionResult<{ isExistingUser: boolean }> {
  return { success: true, data: { isExistingUser } };
}

export async function grantDashboardAccess(
  accountId: string,
  recipientId: string,
): Promise<ActionResult<{ isExistingUser: boolean }>> {
  const owner = await requireAccountOwner(accountId);

  if (!owner.success) {
    return { success: false, error: owner.error };
  }

  if (!owner.data.canManageDashboardSharing) {
    return {
      success: false,
      error: createError(
        ErrorCodes.FORBIDDEN,
        'Dashboard sharing is disabled for this account.',
      ),
    };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const { data: recipient, error: recipientError } = await adminClient
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('id', recipientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (recipientError || !recipient) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found'),
    };
  }

  if (!recipient.confirmed_at) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        'Recipient must confirm their email before receiving dashboard access.',
      ),
    };
  }

  const recipientWithDashboardAccess = recipient as RecipientRowWithDashboardAccess;

  if (recipientWithDashboardAccess.dashboard_access_granted_at) {
    const existingUser = Boolean(await getAuthUserIdByEmail(adminClient, recipient.email));
    return grantSuccess(existingUser);
  }

  const nowIso = new Date().toISOString();
  const { error: grantTimestampError } = await adminClient
    .from('ultaura_notification_recipients')
    .update({ dashboard_access_granted_at: nowIso } as never)
    .eq('id', recipient.id)
    .eq('account_id', accountId);

  if (grantTimestampError) {
    logger.error({ grantTimestampError, accountId, recipientId }, 'Failed to set dashboard access timestamp');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to grant dashboard access'),
    };
  }

  let rollbackMembershipId: number | null = null;
  let rollbackInviteCode: string | null = null;

  try {
    const context = await resolveAccountAndRecipientContext(adminClient, accountId, recipient);

    if (!context.organizationId) {
      throw new Error('Organization not found for account');
    }

    const authUserId = await getAuthUserIdByEmail(adminClient, recipient.email);
    const membership = await createOrEnsureViewerMembership({
      adminClient,
      organizationId: context.organizationId,
      recipientEmail: recipient.email,
      authUserId,
    });
    rollbackMembershipId = membership.createdMembershipId;
    rollbackInviteCode = membership.createdMembershipId ? membership.inviteCode : null;

    if (membership.existingRoleAccess) {
      revalidatePath('/dashboard/privacy', 'page');
      return grantSuccess(true);
    }

    const siteUrl = getSiteUrl();
    const emailSubject = `You now have dashboard access to ${context.seniorName}`;

    if (membership.isExistingUser) {
      const loginLink = `${siteUrl}/auth/sign-in?next=/dashboard`;
      const { html, text } = renderDashboardAccessGrantedEmail({
        recipientName: context.recipientName,
        accountName: context.accountName,
        seniorName: context.seniorName,
        inviterName: context.inviterName,
        loginLink,
        baseUrl: siteUrl,
      });

      await sendDashboardSharingEmail({
        to: context.recipientEmail,
        subject: emailSubject,
        html,
        text,
        accountId,
        recipientId,
      });

      revalidatePath('/dashboard/privacy', 'page');
      return grantSuccess(true);
    }

    if (!membership.inviteCode) {
      throw new Error('Failed to create invite code for viewer membership');
    }

    const signupLink = `${siteUrl}/auth/sign-up?inviteCode=${encodeURIComponent(membership.inviteCode)}&next=/dashboard`;
    const { html, text } = renderDashboardAccessInviteEmail({
      recipientName: context.recipientName,
      accountName: context.accountName,
      seniorName: context.seniorName,
      inviterName: context.inviterName,
      signupLink,
      baseUrl: siteUrl,
    });

    await sendDashboardSharingEmail({
      to: context.recipientEmail,
      subject: emailSubject,
      html,
      text,
      accountId,
      recipientId,
    });

    revalidatePath('/dashboard/privacy', 'page');

    return grantSuccess(false);
  } catch (error) {
    logger.error(
      {
        error,
        accountId,
        recipientId,
        reason: error instanceof Error ? error.message : String(error),
      },
      'Failed grantDashboardAccess flow',
    );

    await rollbackGrant({
      adminClient,
      accountId,
      recipientId,
      membershipId: rollbackMembershipId,
      inviteCode: rollbackInviteCode,
    });

    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to grant dashboard access'),
    };
  }
}

export async function deleteViewerMembershipForRecipient(
  accountId: string,
  recipientEmail: string,
): Promise<ActionResult<{ deletedCount: number }>> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const organizationId = await getOrganizationIdForAccount(adminClient, accountId).catch((error) => {
    logger.error({ error, accountId }, 'Failed to resolve organization for membership cleanup');
    return null;
  });

  if (!organizationId) {
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to resolve organization for membership cleanup'),
    };
  }

  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const { data: authUserId, error: authLookupError } = await adminClient.rpc(
    'get_auth_user_id_by_email' as never,
    { lookup_email: normalizedEmail } as never,
  );

  if (authLookupError) {
    logger.error(
      { error: authLookupError, accountId, recipientEmail: normalizedEmail },
      'Failed auth user lookup during membership cleanup',
    );
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to resolve dashboard access membership'),
    };
  }

  const { data: emailDeletedRows, error: emailDeleteError } = await adminClient
    .from('memberships')
    .delete()
    .eq('organization_id', organizationId)
    .eq('role', VIEWER_ROLE)
    .eq('invited_email', normalizedEmail)
    .select('id');

  if (emailDeleteError) {
    logger.error(
      { error: emailDeleteError, accountId, recipientEmail: normalizedEmail, organizationId },
      'Failed membership cleanup for invited_email',
    );
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove dashboard access membership'),
    };
  }

  let deletedByUserIdCount = 0;

  if (authUserId) {
    const { data: userDeletedRows, error: userDeleteError } = await adminClient
      .from('memberships')
      .delete()
      .eq('organization_id', organizationId)
      .eq('role', VIEWER_ROLE)
      .eq('user_id', authUserId)
      .select('id');

    if (userDeleteError) {
      logger.error(
        { error: userDeleteError, accountId, recipientEmail: normalizedEmail, organizationId, authUserId },
        'Failed membership cleanup for user_id',
      );
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove dashboard access membership'),
      };
    }

    deletedByUserIdCount = userDeletedRows?.length ?? 0;
  }

  const { data: remainingInvites, error: remainingInvitesError } = await adminClient
    .from('memberships')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('role', VIEWER_ROLE)
    .eq('invited_email', normalizedEmail)
    .limit(1);

  if (remainingInvitesError) {
    logger.error(
      { error: remainingInvitesError, accountId, recipientEmail: normalizedEmail, organizationId },
      'Failed to verify invited_email membership cleanup',
    );
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to verify dashboard access membership cleanup'),
    };
  }

  let remainingUserMemberships = 0;
  if (authUserId) {
    const { data: remainingByUser, error: remainingByUserError } = await adminClient
      .from('memberships')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('role', VIEWER_ROLE)
      .eq('user_id', authUserId)
      .limit(1);

    if (remainingByUserError) {
      logger.error(
        { error: remainingByUserError, accountId, recipientEmail: normalizedEmail, organizationId, authUserId },
        'Failed to verify user_id membership cleanup',
      );
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to verify dashboard access membership cleanup'),
      };
    }

    remainingUserMemberships = remainingByUser?.length ?? 0;
  }

  if ((remainingInvites?.length ?? 0) > 0 || remainingUserMemberships > 0) {
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Dashboard access membership still exists after cleanup'),
    };
  }

  return {
    success: true,
    data: {
      deletedCount: (emailDeletedRows?.length ?? 0) + deletedByUserIdCount,
    },
  };
}

export async function revokeDashboardAccess(
  accountId: string,
  recipientId: string,
): Promise<ActionResult<void>> {
  const owner = await requireAccountOwner(accountId);

  if (!owner.success) {
    return { success: false, error: owner.error };
  }

  const adminClient = getSupabaseServerActionClient({ admin: true });
  const { data: recipient, error: recipientError } = await adminClient
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('id', recipientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (recipientError || !recipient) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found'),
    };
  }

  const { error } = await adminClient
    .from('ultaura_notification_recipients')
    .update({ dashboard_access_granted_at: null } as never)
    .eq('id', recipientId)
    .eq('account_id', accountId);

  if (error) {
    logger.error({ error, accountId, recipientId }, 'Failed to revoke dashboard access timestamp');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to revoke dashboard access'),
    };
  }

  const membershipCleanup = await deleteViewerMembershipForRecipient(accountId, recipient.email);

  if (!membershipCleanup.success) {
    logger.error(
      { accountId, recipientId, recipientEmail: recipient.email, cleanupError: membershipCleanup.error },
      'Membership cleanup failed while revoking dashboard access',
    );

    const previousGrantedAt =
      (recipient as RecipientRowWithDashboardAccess).dashboard_access_granted_at ?? null;
    if (previousGrantedAt) {
      const { error: rollbackError } = await adminClient
        .from('ultaura_notification_recipients')
        .update({ dashboard_access_granted_at: previousGrantedAt } as never)
        .eq('id', recipientId)
        .eq('account_id', accountId);

      if (rollbackError) {
        logger.error(
          { error: rollbackError, accountId, recipientId },
          'Failed to rollback dashboard access timestamp after membership cleanup failure',
        );
      }
    }

    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to revoke dashboard access'),
    };
  }

  revalidatePath('/dashboard/privacy', 'page');

  return {
    success: true,
    data: undefined,
  };
}

export async function getViewerContext(
  adminClient: SupabaseClient<Database>,
  accountId: string,
  userId: string,
): Promise<{ accountHolderName: string; seniorName: string | null }> {
  const [{ data: account }, { data: lines }] = await Promise.all([
    adminClient
      .from('ultaura_accounts')
      .select('created_by_user_id, name')
      .eq('id', accountId)
      .single(),
    adminClient
      .from('ultaura_lines')
      .select('display_name, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true }),
  ]);

  let accountHolderName = account?.name || 'Account holder';

  if (account?.created_by_user_id && account.created_by_user_id !== userId) {
    const { data: holder } = await adminClient
      .from('users')
      .select('display_name')
      .eq('id', account.created_by_user_id)
      .maybeSingle();

    accountHolderName = holder?.display_name?.trim() || accountHolderName;
  }

  const seniorName = lines?.length === 1 ? lines[0]?.display_name ?? null : null;

  return { accountHolderName, seniorName };
}
