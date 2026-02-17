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

export async function logTimelineRedactionModeChanged(
  mode: string,
  previousMode: string,
) {
  const admin = await getCurrentAdminContext();

  if (admin) {
    await writeAdminAuditLog(admin, {
      action: 'timeline.redaction_mode_changed',
      metadata: { mode, previousMode },
    });
  }
}
