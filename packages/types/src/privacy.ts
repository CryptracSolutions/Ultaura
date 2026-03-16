export type RetentionPeriod = '30_days' | '90_days' | '365_days' | 'indefinite';
export type VoiceConsentStatus = 'pending' | 'granted' | 'denied';
export type SharingTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
export type ConsentAuditAction =
  | 'granted'
  | 'revoked'
  | 'updated'
  | 'voice_consent_given'
  | 'voice_consent_denied'
  | 'recording_consent_updated'
  | 'recording_reenable_requested'
  | 'sharing_consent_updated'
  | 'sharing_reprompt_requested'
  | 'sharing_enabled_by_self_user'
  | 'insights_enabled_changed'
  | 'pause_mode_changed'
  | 'insights_reprompt_requested'
  | 'onboarding_completed'
  | 'consent_incomplete_retry'
  | 'memory_hard_deleted'
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
  recordingConsent: VoiceConsentStatus;
  recordingConsentAt: string | null;
  recordingConsentCallSessionId: string | null;
  recordingPreferencePermanent: boolean;
  recordingReenableRequestedAt: string | null;
  recordingReenableDeclineCount: number;
  recordingReenableBlockedAt: string | null;
  sharingConsent: VoiceConsentStatus;
  sharingTier: SharingTier;
  sharingConsentAt: string | null;
  sharingConsentCallSessionId: string | null;
  sharingLastPromptAt: string | null;
  sharingRePromptRequestedAt: string | null;
  insightsRepromptRequestedAt: string | null;
  onboardingCompletedAt: string | null;
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
  // Health Profile export extensions
  visibilityScope?: 'standard_account' | 'health_owner_only';
  includesHealthProfile?: boolean;
  requestedScopeSnapshot?: Record<string, unknown>;
  artifactStoragePath?: string | null;
  artifactExtension?: string | null;
  artifactContentType?: string | null;
  invalidatedAt?: string | null;
}
