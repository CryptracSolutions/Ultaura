export type RetentionPeriod = '30_days' | '90_days' | '365_days' | 'indefinite';
export type VoiceConsentStatus = 'pending' | 'granted' | 'denied';
export type ConsentAuditAction =
  | 'granted'
  | 'revoked'
  | 'updated'
  | 'voice_consent_given'
  | 'voice_consent_denied'
  | 'retention_changed'
  | 'recording_toggled'
  | 'summarization_toggled'
  | 'vendor_acknowledged'
  | 'data_export_requested'
  | 'data_deletion_requested';

export interface AccountPrivacySettings {
  id: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  recordingEnabled: boolean;
  aiSummarizationEnabled: boolean;
  retentionPeriod: RetentionPeriod;
  vendorDisclosureAcknowledgedAt: string | null;
  vendorDisclosureAcknowledgedBy: string | null;
}

export interface LineVoiceConsent {
  id: string;
  lineId: string;
  accountId: string;
  createdAt: string;
  updatedAt: string;
  memoryConsent: VoiceConsentStatus;
  memoryConsentAt: string | null;
  memoryConsentCallSessionId: string | null;
  lastConsentPromptAt: string | null;
}

export interface ConsentAuditEntry {
  id: string;
  createdAt: string;
  accountId: string;
  lineId: string | null;
  actorUserId: string | null;
  actorType: 'payer' | 'line_voice' | 'system';
  action: ConsentAuditAction;
  consentType: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  callSessionId: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DataExportRequest {
  id: string;
  accountId: string;
  requestedBy: string;
  createdAt: string;
  format: 'json' | 'csv';
  includeMemories: boolean;
  includeCallMetadata: boolean;
  includeReminders: boolean;
  status: 'pending' | 'processing' | 'ready' | 'expired' | 'failed';
  processedAt: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  fileSizeBytes: number | null;
  errorMessage: string | null;
}
