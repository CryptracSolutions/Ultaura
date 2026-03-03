import type { ConsentAuditEntry, DataExportRequest } from '~/lib/ultaura/types';

export function getSafeDownloadUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export const AUDIT_ACTION_LABELS: Record<ConsentAuditEntry['action'], string> =
  {
    granted: 'Consent granted',
    revoked: 'Consent revoked',
    updated: 'Consent updated',
    voice_consent_given: 'Voice consent granted',
    voice_consent_denied: 'Voice consent declined',
    recording_consent_updated: 'Recording preference updated',
    recording_reenable_requested: 'Recording re-enable requested',
    sharing_consent_updated: 'Sharing preference updated',
    sharing_reprompt_requested: 'Sharing re-prompt requested',
    sharing_enabled_by_self_user: 'Family sharing enabled by account owner',
    insights_enabled_changed: 'Insights sharing setting changed',
    pause_mode_changed: 'Pause mode changed',
    insights_reprompt_requested: 'Insights preference re-prompt requested',
    onboarding_completed: 'Consent onboarding completed',
    consent_incomplete_retry: 'Consent follow-up requested',
    memory_hard_deleted: 'Stored memory deleted',
    retention_changed: 'Retention setting changed',
    recording_toggled: 'Call recording setting changed',
    summarization_toggled: 'AI memory setting changed',
    vendor_acknowledged: 'Vendor disclosure acknowledged',
    data_export_requested: 'Data export requested',
    data_deletion_requested: 'Privacy data deletion requested',
  };

export function formatAction(value: string): string {
  return (
    AUDIT_ACTION_LABELS[value as ConsentAuditEntry['action']] ??
    value.replace(/_/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase())
  );
}

export function formatActor(value: ConsentAuditEntry['actorType']): string {
  switch (value) {
    case 'payer':
      return 'Account owner';
    case 'line_voice':
      return 'Call recipient';
    case 'system':
      return 'System';
    default:
      return value;
  }
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined) return '--';
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  return JSON.stringify(value);
}

const EXPORT_STATUS_LABELS: Record<DataExportRequest['status'], string> = {
  pending: 'Pending',
  processing: 'Processing',
  ready: 'Ready',
  expired: 'Expired',
  failed: 'Failed',
};

export function formatStatusLabel(status: DataExportRequest['status']): string {
  return EXPORT_STATUS_LABELS[status] ?? status;
}

const EXPORT_STATUS_COLORS: Record<DataExportRequest['status'], string> = {
  pending: 'bg-info/10 text-info',
  processing: 'bg-info/10 text-info',
  ready: 'bg-success/10 text-success',
  expired: 'bg-warning/10 text-warning',
  failed: 'bg-destructive/10 text-destructive',
};

export function statusToColor(status: DataExportRequest['status']): string {
  return EXPORT_STATUS_COLORS[status] ?? 'bg-muted text-muted-foreground';
}
