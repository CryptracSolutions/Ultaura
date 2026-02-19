'use server';

import { revalidatePath } from 'next/cache';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { withAdminSession } from '~/core/generic/actions-utils';
import { MEMBERSHIPS_TABLE } from '~/lib/db-tables';
import MembershipRole from '~/lib/organizations/types/membership-role';
import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

const getClient = () => getSupabaseServerActionClient({ admin: true });

export const adminTransferOwnership = withAdminSession(
  async (formData: FormData) => {
    const orgId = formData.get('orgId') as string;
    const newOwnerMembershipId = Number(formData.get('newOwnerMembershipId'));

    if (!orgId || !newOwnerMembershipId) {
      throw new Error('Missing required fields: orgId and newOwnerMembershipId');
    }

    const client = getClient();

    // Verify the new owner is an existing member
    const { data: newOwnerMembership, error: fetchError } = await client
      .from(MEMBERSHIPS_TABLE)
      .select('id, role, user_id, organization_id')
      .eq('id', newOwnerMembershipId)
      .single();

    if (fetchError || !newOwnerMembership) {
      throw new Error('New owner membership not found');
    }

    if (newOwnerMembership.role === MembershipRole.Owner) {
      throw new Error('This member is already the owner');
    }

    const organizationId = newOwnerMembership.organization_id;

    // Find the current owner
    const { data: currentOwnerMembership, error: ownerError } = await client
      .from(MEMBERSHIPS_TABLE)
      .select('id, user_id')
      .eq('organization_id', organizationId)
      .eq('role', MembershipRole.Owner)
      .single();

    if (ownerError || !currentOwnerMembership) {
      throw new Error('Current owner not found');
    }

    // Demote current owner to Admin
    const { error: demoteError } = await client
      .from(MEMBERSHIPS_TABLE)
      .update({ role: MembershipRole.Admin })
      .eq('id', currentOwnerMembership.id);

    if (demoteError) {
      throw new Error(`Failed to demote current owner: ${demoteError.message}`);
    }

    // Promote new owner
    const { error: promoteError } = await client
      .from(MEMBERSHIPS_TABLE)
      .update({ role: MembershipRole.Owner })
      .eq('id', newOwnerMembershipId);

    if (promoteError) {
      // Attempt to rollback the demotion
      await client
        .from(MEMBERSHIPS_TABLE)
        .update({ role: MembershipRole.Owner })
        .eq('id', currentOwnerMembership.id);

      throw new Error(
        `Failed to promote new owner: ${promoteError.message}`,
      );
    }

    const admin = await getCurrentAdminContext();

    if (admin) {
      await writeAdminAuditLog(admin, {
        action: 'transfer_ownership',
        targetType: 'organization',
        targetId: orgId,
        metadata: {
          previousOwnerId: currentOwnerMembership.user_id,
          newOwnerId: newOwnerMembership.user_id,
          previousOwnerMembershipId: currentOwnerMembership.id,
          newOwnerMembershipId,
        },
      });
    }

    revalidatePath(`/admin/organizations/${orgId}`, 'page');
  },
);

export const adminAddMember = withAdminSession(async (formData: FormData) => {
  const orgUid = formData.get('orgUid') as string;
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const role = Number(formData.get('role'));

  if (!orgUid || !email) {
    throw new Error('Missing required fields: orgUid and email');
  }

  if (role === MembershipRole.Owner) {
    throw new Error('Cannot add a member as Owner. Use transfer ownership instead.');
  }

  const validRole =
    role === MembershipRole.Admin ? MembershipRole.Admin : MembershipRole.Member;

  const client = getClient();

  // Look up the organization by UUID to get the numeric ID
  const { data: org, error: orgError } = await client
    .from('organizations')
    .select('id')
    .eq('uuid', orgUid)
    .single();

  if (orgError || !org) {
    throw new Error('Organization not found');
  }

  // Look up the auth user by email
  const { data: usersData, error: listError } =
    await client.auth.admin.listUsers({ perPage: 1000 });

  if (listError) {
    throw new Error('Failed to look up users');
  }

  const authUser = usersData.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (!authUser) {
    throw new Error(`No user found with email: ${email}`);
  }

  // Check if already a member
  const { data: existingMembership } = await client
    .from(MEMBERSHIPS_TABLE)
    .select('id')
    .eq('organization_id', org.id)
    .eq('user_id', authUser.id)
    .is('code', null)
    .maybeSingle();

  if (existingMembership) {
    throw new Error('This user is already a member of this organization');
  }

  // Insert membership
  const { error: insertError } = await client.from(MEMBERSHIPS_TABLE).insert({
    organization_id: org.id,
    user_id: authUser.id,
    role: validRole,
  });

  if (insertError) {
    throw new Error(`Failed to add member: ${insertError.message}`);
  }

  const admin = await getCurrentAdminContext();

  if (admin) {
    await writeAdminAuditLog(admin, {
      action: 'add_member',
      targetType: 'organization',
      targetId: orgUid,
      metadata: {
        addedUserId: authUser.id,
        addedEmail: email,
        role: validRole,
      },
    });
  }

  revalidatePath(`/admin/organizations/${orgUid}`, 'page');
});

export const adminChangeMemberRole = withAdminSession(
  async (formData: FormData) => {
    const membershipId = Number(formData.get('membershipId'));
    const newRole = Number(formData.get('newRole'));
    const orgUid = formData.get('orgUid') as string;

    if (!membershipId || isNaN(newRole)) {
      throw new Error('Missing required fields');
    }

    if (newRole === MembershipRole.Owner) {
      throw new Error(
        'Cannot set role to Owner directly. Use transfer ownership instead.',
      );
    }

    const validRole =
      newRole === MembershipRole.Admin
        ? MembershipRole.Admin
        : MembershipRole.Member;

    const client = getClient();

    // Make sure we're not changing the owner's role
    const { data: membership, error: fetchError } = await client
      .from(MEMBERSHIPS_TABLE)
      .select('id, role, user_id')
      .eq('id', membershipId)
      .single();

    if (fetchError || !membership) {
      throw new Error('Membership not found');
    }

    if (membership.role === MembershipRole.Owner) {
      throw new Error(
        'Cannot change the role of the organization owner. Use transfer ownership instead.',
      );
    }

    const { error: updateError } = await client
      .from(MEMBERSHIPS_TABLE)
      .update({ role: validRole })
      .eq('id', membershipId);

    if (updateError) {
      throw new Error(`Failed to update role: ${updateError.message}`);
    }

    const admin = await getCurrentAdminContext();

    if (admin) {
      await writeAdminAuditLog(admin, {
        action: 'change_member_role',
        targetType: 'membership',
        targetId: String(membershipId),
        metadata: {
          userId: membership.user_id,
          previousRole: membership.role,
          newRole: validRole,
          orgUid,
        },
      });
    }

    if (orgUid) {
      revalidatePath(`/admin/organizations/${orgUid}`, 'page');
    }
  },
);

export const adminRemoveMember = withAdminSession(
  async (formData: FormData) => {
    const membershipId = Number(formData.get('membershipId'));
    const orgUid = formData.get('orgUid') as string;

    if (!membershipId) {
      throw new Error('Missing required field: membershipId');
    }

    const client = getClient();

    // Fetch membership to ensure it exists and is not the owner
    const { data: membership, error: fetchError } = await client
      .from(MEMBERSHIPS_TABLE)
      .select('id, role, user_id')
      .eq('id', membershipId)
      .single();

    if (fetchError || !membership) {
      throw new Error('Membership not found');
    }

    if (membership.role === MembershipRole.Owner) {
      throw new Error(
        'Cannot remove the organization owner. Transfer ownership first.',
      );
    }

    const { error: deleteError } = await client
      .from(MEMBERSHIPS_TABLE)
      .delete()
      .eq('id', membershipId);

    if (deleteError) {
      throw new Error(`Failed to remove member: ${deleteError.message}`);
    }

    const admin = await getCurrentAdminContext();

    if (admin) {
      await writeAdminAuditLog(admin, {
        action: 'remove_member',
        targetType: 'membership',
        targetId: String(membershipId),
        metadata: {
          userId: membership.user_id,
          role: membership.role,
          orgUid,
        },
      });
    }

    if (orgUid) {
      revalidatePath(`/admin/organizations/${orgUid}`, 'page');
    }
  },
);
