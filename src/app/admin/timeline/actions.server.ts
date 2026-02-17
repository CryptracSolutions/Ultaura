'use server';

import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

export async function logTimelineRawView(entryId: string, source: string) {
  const admin = await getCurrentAdminContext();

  if (admin) {
    await writeAdminAuditLog(admin, {
      action: 'timeline.view_raw',
      targetType: source,
      targetId: entryId,
    });
  }
}
