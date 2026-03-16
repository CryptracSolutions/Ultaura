// ---------------------------------------------------------------------------
// 8.1 Core Shared Types
// ---------------------------------------------------------------------------

export type HealthConsentStatus = 'not_requested' | 'granted' | 'denied' | 'revoked';

export type ApproximateDatePrecision = 'year' | 'month' | 'day';

export type ApproximateDateValue =
  | `${number}${number}${number}${number}`
  | `${number}${number}${number}${number}-${number}${number}`
  | `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

export type ApproximateDate = {
  precision: ApproximateDatePrecision;
  value: ApproximateDateValue; // YYYY | YYYY-MM | YYYY-MM-DD
};

// Compile-time shape is intentionally broad; runtime schema/calendar validation is authoritative.

export type HealthTabValue =
  | 'suggestions'
  | 'conditions'
  | 'medications'
  | 'documents'
  | 'observations';

export type HealthConditionStatus = 'active' | 'monitoring' | 'resolved';
export type HealthMedicationStatus = 'current' | 'as_needed' | 'discontinued';
export type HealthSuggestionStatus = 'pending' | 'approved' | 'dismissed';
export type HealthSuggestionType = 'condition' | 'medication';
export type HealthSuggestionMode = 'new' | 'update';

export type HealthObservationCategory =
  | 'memory'
  | 'mood_emotional'
  | 'physical_mobility'
  | 'nutrition_eating'
  | 'sleep'
  | 'social_engagement'
  | 'medication_compliance'
  | 'general_other';

export type HealthObservationConcern =
  | 'note'
  | 'mild_concern'
  | 'significant_concern';

export type HealthDocumentCategory =
  | 'lab_results'
  | 'discharge_summary'
  | 'prescription'
  | 'insurance'
  | 'imaging_scans'
  | 'doctors_notes'
  | 'other';

export type HealthAutocompleteProvider =
  | 'icd10cm_clinical_tables'
  | 'rxterms_rxnorm'
  | 'plain_text_fallback';

// ---------------------------------------------------------------------------
// 8.2 Dashboard Entity Shapes
// ---------------------------------------------------------------------------

export interface HealthCondition {
  id: string;
  lineId: string;
  status: HealthConditionStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthMedication {
  id: string;
  lineId: string;
  status: HealthMedicationStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[]; // canonical HH:MM 24-hour strings
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthDocument {
  id: string;
  lineId: string;
  title: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  notes: string | null;
  mimeType: string;
  fileExtension: string;
  fileSizeBytes: number;
  status: 'uploading' | 'active' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface HealthObservation {
  id: string;
  lineId: string;
  text: string;
  category: HealthObservationCategory | null;
  observedDate: string | null;
  concernLevel: HealthObservationConcern | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// 8.3 Suggestion Contracts
// ---------------------------------------------------------------------------

export type ConditionSuggestionProposedFields = {
  standardizedId: { system: string; code: string } | null;
  status?: 'active' | 'monitoring' | 'resolved';
  diagnosedOnsetDate?: ApproximateDate | null;
};

export type MedicationSuggestionProposedFields = {
  standardizedId: { system: string; code: string } | null;
  status?: 'current' | 'as_needed' | 'discontinued';
  dosage?: string | null;
  frequency?: string | null;
  timesOfDay?: string[]; // canonical HH:MM 24-hour strings
  startDate?: ApproximateDate | null;
  endDate?: ApproximateDate | null;
};

export interface HealthSuggestion {
  id: string;
  lineId: string;
  suggestionType: HealthSuggestionType;
  suggestionMode: HealthSuggestionMode;
  status: HealthSuggestionStatus;
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields:
    | ConditionSuggestionProposedFields
    | MedicationSuggestionProposedFields;
  similarItemId: string | null;
  similarItemWarning: boolean;
  sourceCallStartedAt: string | null;
  reviewedAt: string | null;
}

// ---------------------------------------------------------------------------
// 8.4 Telephony Health Context Contract
// ---------------------------------------------------------------------------

export type TelephonyPendingHealthNotice =
  | {
      id: string;
      noticeType: 'consent_change';
      spokenText: string;
      spokenLanguage: string | null;
      consentStatus: 'granted' | 'denied' | 'revoked';
    }
  | {
      id: string;
      noticeType: 'major_profile_change';
      spokenText: string;
      spokenLanguage: string | null;
      changeTypes: HealthMajorProfileChangeType[];
    };

export interface TelephonyHealthContext {
  schemaVersion: 'health-context-v1';
  lineId: string;
  consentStatus: HealthConsentStatus;
  canUseHealthInCall: boolean;
  familyManagedConsentPrompt: {
    hasOutstandingOwnerRequest: boolean;
    requestedAt: string | null;
    lastPromptedAt: string | null;
  } | null;
  selfManagedExplanationPrompt: {
    hasOutstandingOwnerRequest: boolean;
    requestedAt: string | null;
    lastPromptedAt: string | null;
  } | null;
  conditions: Array<{
    name: string;
    status: 'active' | 'monitoring';
  }>;
  medications: Array<{
    name: string;
    status: 'current' | 'as_needed';
    timesOfDay: string[];
  }>;
  observations: Array<{
    ownerSafeSummary: string;
    category: HealthObservationCategory | null;
    concernLevel: HealthObservationConcern | null;
    observedDate: string | null;
  }>;
  pendingNotices: TelephonyPendingHealthNotice[];
}

// ---------------------------------------------------------------------------
// 8.5 Suggestion Candidate Contract
// ---------------------------------------------------------------------------

export interface QueueHealthSuggestionCandidateInput {
  lineId: string;
  callSessionId: string;
  suggestionType: 'condition' | 'medication';
  suggestionMode: 'new' | 'update';
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields:
    | ConditionSuggestionProposedFields
    | MedicationSuggestionProposedFields;
}

// ---------------------------------------------------------------------------
// 8.6 Telephony Privacy and Consent Tool Contracts
// ---------------------------------------------------------------------------

export type HealthSpokenConsentToolName =
  | 'grant_health_consent'
  | 'deny_health_consent'
  | 'revoke_health_consent';

export interface HealthSpokenConsentToolInput {
  lineId: string;
  callSessionId: string;
}

export interface MarkHealthDisclosurePrivateInput {
  lineId: string;
  callSessionId: string;
}

export type HealthSpokenConsentToolResult = {
  success: true;
  resultingConsentStatus: 'granted' | 'denied' | 'revoked';
  effectiveScope: 'next_call' | 'current_call_shutdown';
  canUseHealthInCurrentCall: boolean;
};

export type MarkHealthDisclosurePrivateResult = {
  success: true;
  suppressionScope: 'current_call_health_adjacency';
  affectedCallSessionId: string;
};

// ---------------------------------------------------------------------------
// 8.7 Health Reminder Classification Contract
// ---------------------------------------------------------------------------

export type ReminderSourceContext = 'general' | 'health_profile';

export type ReminderPauseSource =
  | 'manual'
  | 'health_manual_resume_required'
  | 'health_consent_not_requested'
  | 'health_consent_denied'
  | 'health_consent_revoked'
  | 'health_plan_ineligible';

// ---------------------------------------------------------------------------
// History and Snapshot Types
// ---------------------------------------------------------------------------

export type HealthHistoryChange<Field extends string, Value> = {
  field: Field;
  before: Value | null;
  after: Value | null;
};

export type HealthConditionHistorySnapshot = {
  name: string;
  status: HealthConditionStatus;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
};

export type HealthMedicationHistorySnapshot = {
  name: string;
  status: HealthMedicationStatus;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[];
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  prescribedBy: string | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
};

export type HealthObservationHistorySnapshot = {
  text: string;
  category: HealthObservationCategory | null;
  concernLevel: HealthObservationConcern | null;
  observedDate: string | null;
};

export type HealthDocumentHistorySnapshot = {
  title: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  notes: string | null;
  originalFilename: string | null;
};

export type HealthConditionHistoryChange =
  | HealthHistoryChange<'name', string>
  | HealthHistoryChange<'status', HealthConditionStatus>
  | HealthHistoryChange<'diagnosedOnsetDate', ApproximateDate>
  | HealthHistoryChange<'stageSeverity', string>
  | HealthHistoryChange<'treatingClinician', string>
  | HealthHistoryChange<'notes', string>;

export type HealthMedicationHistoryChange =
  | HealthHistoryChange<'name', string>
  | HealthHistoryChange<'status', HealthMedicationStatus>
  | HealthHistoryChange<'dosage', string>
  | HealthHistoryChange<'frequency', string>
  | HealthHistoryChange<'timesOfDay', string[]>
  | HealthHistoryChange<'startDate', ApproximateDate>
  | HealthHistoryChange<'endDate', ApproximateDate>
  | HealthHistoryChange<'prescribedBy', string>
  | HealthHistoryChange<'linkedConditionId', string>
  | HealthHistoryChange<'linkedReason', string>
  | HealthHistoryChange<'notes', string>;

export type HealthObservationHistoryChange =
  | HealthHistoryChange<'text', string>
  | HealthHistoryChange<'category', HealthObservationCategory>
  | HealthHistoryChange<'concernLevel', HealthObservationConcern>
  | HealthHistoryChange<'observedDate', string>;

export type HealthDocumentHistoryChange =
  | HealthHistoryChange<'title', string>
  | HealthHistoryChange<'category', HealthDocumentCategory>
  | HealthHistoryChange<'documentDate', string>
  | HealthHistoryChange<'notes', string>
  | HealthHistoryChange<'originalFilename', string>;

export type HealthHistoryPayload =
  | { itemKind: 'condition'; action: 'created' | 'deleted'; snapshot: HealthConditionHistorySnapshot }
  | { itemKind: 'condition'; action: 'edited'; summaryLabel: string; changes: HealthConditionHistoryChange[] }
  | { itemKind: 'medication'; action: 'created' | 'deleted'; snapshot: HealthMedicationHistorySnapshot }
  | { itemKind: 'medication'; action: 'edited'; summaryLabel: string; changes: HealthMedicationHistoryChange[] }
  | { itemKind: 'observation'; action: 'created' | 'deleted'; snapshot: HealthObservationHistorySnapshot }
  | { itemKind: 'observation'; action: 'edited'; summaryLabel: string; changes: HealthObservationHistoryChange[] }
  | { itemKind: 'document'; action: 'created' | 'deleted'; snapshot: HealthDocumentHistorySnapshot }
  | { itemKind: 'document'; action: 'edited'; summaryLabel: string; changes: HealthDocumentHistoryChange[] }
  | { itemKind: 'suggestion'; action: 'suggestion_approved' | 'suggestion_dismissed' | 'system_stale_dismissed'; suggestionType: HealthSuggestionType; normalizedName: string; resultingItemId: string | null };

// `system_stale_dismissed` is preserved for history/export correctness but should render as a dismissed/stale system outcome, not a separate primary owner-facing status.

export type HealthMajorProfileChangeType =
  | 'condition_added'
  | 'condition_status_changed'
  | 'medication_added'
  | 'medication_status_changed'
  | 'medication_schedule_changed';

export type HealthCallNoticePayload =
  | { noticeType: 'consent_change'; consentStatus: 'granted' | 'denied' | 'revoked' }
  | { noticeType: 'major_profile_change'; changeTypes: HealthMajorProfileChangeType[] };

export type HealthConsentHistoryPayload =
  | { eventType: 'owner_request'; requestedAt: string }
  | { eventType: 'spoken_prompt'; promptedAt: string; callSessionId: string }
  | { eventType: 'spoken_decision'; consentStatus: 'granted' | 'denied' | 'revoked'; callSessionId: string }
  | { eventType: 'self_service_decision'; consentStatus: 'granted' | 'revoked'; actedAt: string };

export interface HealthAutocompleteOption {
  provider: Exclude<HealthAutocompleteProvider, 'plain_text_fallback'>;
  label: string;
  normalizedName: string;
  standardizedId: { system: string; code: string };
}

// ---------------------------------------------------------------------------
// Stored Payload Types (for encrypted DB columns)
// ---------------------------------------------------------------------------

export type StoredConditionPayload = {
  name: string;
  standardizedId: { system: string; code: string } | null;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
};

export type StoredMedicationPayload = {
  name: string;
  standardizedId: { system: string; code: string } | null;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[]; // canonical HH:MM 24-hour strings
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedReason: string | null;
  notes: string | null;
};

export type StoredHealthSuggestionPayload = {
  normalizedName: string;
  confidenceLabel: 'high' | 'medium';
  summaryParaphrase: string;
  proposedFields:
    | ConditionSuggestionProposedFields
    | MedicationSuggestionProposedFields;
  similarItemWarning: boolean;
};

export type StoredObservationPayload = {
  text: string;
  category: HealthObservationCategory | null;
  observedDate: string | null; // defaults to today's date in the line timezone on create when omitted
  concernLevel: HealthObservationConcern | null;
};

export type StoredDocumentPayload = {
  title: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  notes: string | null;
  originalFilename: string;
};

// ---------------------------------------------------------------------------
// Export Types
// ---------------------------------------------------------------------------

export type HealthExportScopeSnapshot = {
  requestedFormat: 'json' | 'csv';
  visibilityScope: 'standard_account' | 'health_owner_only';
  healthInclusionMode: 'automatic_when_present';
  includesHealthProfile: boolean;
  includesDocumentFiles: boolean;
  deliveredArtifactFormat: 'zip' | 'requested_format_native';
};

export interface HealthExportDownloadDescriptor {
  requestId: string;
  visibilityScope: 'standard_account' | 'health_owner_only';
  authenticatedDownloadPath: string | null;
  artifactExtension: 'zip' | null;
  artifactContentType: string | null;
}

export interface HealthExportConditionRow {
  conditionId: string;
  lineId: string;
  status: HealthConditionStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  diagnosedOnsetDate: ApproximateDate | null;
  stageSeverity: string | null;
  treatingClinician: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportMedicationRow {
  medicationId: string;
  lineId: string;
  status: HealthMedicationStatus;
  name: string;
  standardizedId: { system: string; code: string } | null;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[];
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportObservationRow {
  observationId: string;
  lineId: string;
  text: string;
  category: HealthObservationCategory | null;
  observedDate: string | null;
  concernLevel: HealthObservationConcern | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportHistoryRow {
  createdAt: string;
  lineId: string;
  itemKind: 'condition' | 'medication' | 'document' | 'observation' | 'suggestion';
  itemId: string | null;
  action: 'created' | 'edited' | 'deleted' | 'suggestion_approved' | 'suggestion_dismissed' | 'system_stale_dismissed';
  actorType: 'owner' | 'system' | 'telephony';
  actorUserId: string | null;
  payload: HealthHistoryPayload;
}

export interface HealthExportDocumentRow {
  documentId: string;
  lineId: string;
  title: string;
  notes: string | null;
  originalFilename: string;
  exportedFilename: string;
  mimeType: string;
  category: HealthDocumentCategory | null;
  documentDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HealthExportManifest {
  schemaVersion: 'health-profile-export-v1';
  requestId: string;
  requestedFormat: 'json' | 'csv';
  exportedAt: string;
  conditions: HealthExportConditionRow[];
  medications: HealthExportMedicationRow[];
  observations: HealthExportObservationRow[];
  history: HealthExportHistoryRow[];
  documents: HealthExportDocumentRow[];
}

export interface HealthExportBundlePayload {
  schemaVersion: 'health-export-bundle-v1';
  requestId: string;
  manifest: HealthExportManifest;
  documentFiles: Array<{
    documentId: string;
    exportedFilename: string; // collision-safe: documentId__sanitizedOriginalFilename
    internalBytePath: string; // app-internal relative POST path that streams decrypted bytes; never a filesystem path or signed URL
    originalFilename: string;
    mimeType: string;
  }>;
}

export interface HealthDocumentAccessTokenDescriptor {
  token: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Error Types
// ---------------------------------------------------------------------------

export type HealthActionErrorCode =
  | 'health_owner_only'
  | 'health_locked'
  | 'health_feature_disabled'
  | 'health_context_unavailable'
  | 'health_consent_not_granted'
  | 'health_cooldown'
  | 'invalid_line'
  | 'health_export_invalidated'
  | 'document_access_denied'
  | 'document_access_token_expired'
  | 'document_file_type_not_supported'
  | 'document_file_too_large'
  | 'health_general_reminder_link_forbidden'
  | 'health_reminder_resume_limit_exceeded'
  | 'partial_reminder_update';

export type HealthActionError = {
  success: false;
  code: HealthActionErrorCode;
  message: string;
};

// ---------------------------------------------------------------------------
// Queue Result
// ---------------------------------------------------------------------------

export type QueueHealthSuggestionCandidateResult = {
  schemaVersion: 'health-suggestions-v1';
  success: true;
  action: 'queued' | 'noop_duplicate' | 'noop_blocked' | 'no_update_target';
};
