'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import getLogger from '~/core/logger';

import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { withAdminSession } from '~/core/generic/actions-utils';
import deleteOrganization from '~/lib/server/organizations/delete-organization';
import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

const getClient = () => getSupabaseServerActionClient({ admin: true });

export const deleteOrganizationAction = withAdminSession(
  async ({ id }: { id: number }) => {
    const logger = getLogger();
    const client = getClient();
    const admin = await getCurrentAdminContext();

    logger.info({ id }, `Admin requested to delete Organization`);

    if (admin) {
      await writeAdminAuditLog(admin, {
        action: 'org.delete',
        targetType: 'organization',
        targetId: String(id),
      });
    }

    await deleteOrganization(client, {
      organizationId: id,
    });

    revalidatePath('/admin/organizations', 'page');

    logger.info({ id }, `Organization account deleted`);

    redirect('/admin/organizations');
  },
);
