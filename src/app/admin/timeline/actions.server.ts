'use server';

import { withAdminSession } from '~/core/generic/actions-utils';

import {
  writeAdminAuditLog,
  getCurrentAdminContext,
} from '~/lib/ultaura/admin/audit-log';

async function writeTimelineAuditLog(
  payload: Parameters<typeof writeAdminAuditLog>[1],
) {
  const admin = await getCurrentAdminContext();

  if (admin) {
    await writeAdminAuditLog(admin, payload);
  }
}

export const logTimelineRawView = withAdminSession(
  async (entryId: string, source: string) => {
    await writeTimelineAuditLog({
      action: 'timeline.view_raw',
      targetType: source,
      targetId: entryId,
    });
  },
);

export const logTimelineRedactionModeChanged = withAdminSession(
  async (mode: string, previousMode: string) => {
    await writeTimelineAuditLog({
      action: 'timeline.redaction_mode_changed',
      metadata: { mode, previousMode },
    });
  },
);
