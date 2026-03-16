import type {
  HealthCondition,
  HealthMedication,
  HealthObservation,
  HealthDocument,
  HealthSuggestion,
  HealthConsentStatus,
  StoredConditionPayload,
  StoredMedicationPayload,
  StoredObservationPayload,
  StoredDocumentPayload,
  StoredHealthSuggestionPayload,
} from '@ultaura/types';

// ---------------------------------------------------------------------------
// Consent row mapper
// ---------------------------------------------------------------------------

export type HealthConsentRow = {
  line_id: string;
  account_id: string;
  health_consent: string;
  health_consent_requested_at: string | null;
  health_first_consent_requested_at: string | null;
  health_last_prompted_at: string | null;
  health_last_prompt_call_session_id: string | null;
  self_explanation_requested_at: string | null;
  self_explanation_last_prompted_at: string | null;
  self_explanation_last_prompt_call_session_id: string | null;
  health_consent_at: string | null;
  health_consent_call_session_id: string | null;
  created_at: string;
  updated_at: string;
};

export type MappedHealthConsentState = {
  lineId: string;
  accountId: string;
  consentStatus: HealthConsentStatus;
  consentRequestedAt: string | null;
  firstConsentRequestedAt: string | null;
  lastPromptedAt: string | null;
  lastPromptCallSessionId: string | null;
  selfExplanationRequestedAt: string | null;
  selfExplanationLastPromptedAt: string | null;
  selfExplanationLastPromptCallSessionId: string | null;
  consentAt: string | null;
  consentCallSessionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function mapHealthConsentRow(row: HealthConsentRow): MappedHealthConsentState {
  return {
    lineId: row.line_id,
    accountId: row.account_id,
    consentStatus: row.health_consent as HealthConsentStatus,
    consentRequestedAt: row.health_consent_requested_at,
    firstConsentRequestedAt: row.health_first_consent_requested_at,
    lastPromptedAt: row.health_last_prompted_at,
    lastPromptCallSessionId: row.health_last_prompt_call_session_id,
    selfExplanationRequestedAt: row.self_explanation_requested_at,
    selfExplanationLastPromptedAt: row.self_explanation_last_prompted_at,
    selfExplanationLastPromptCallSessionId: row.self_explanation_last_prompt_call_session_id,
    consentAt: row.health_consent_at,
    consentCallSessionId: row.health_consent_call_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Condition row mapper
// ---------------------------------------------------------------------------

type HealthConditionRow = {
  id: string;
  line_id: string;
  account_id: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export function mapHealthConditionRow(
  row: HealthConditionRow,
  decryptedPayload: StoredConditionPayload
): HealthCondition {
  return {
    id: row.id,
    lineId: row.line_id,
    status: row.status as HealthCondition['status'],
    name: decryptedPayload.name,
    standardizedId: decryptedPayload.standardizedId,
    diagnosedOnsetDate: decryptedPayload.diagnosedOnsetDate,
    stageSeverity: decryptedPayload.stageSeverity,
    treatingClinician: decryptedPayload.treatingClinician,
    notes: decryptedPayload.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Medication row mapper
// ---------------------------------------------------------------------------

type HealthMedicationRow = {
  id: string;
  line_id: string;
  account_id: string;
  status: string;
  linked_condition_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mapHealthMedicationRow(
  row: HealthMedicationRow,
  decryptedPayload: StoredMedicationPayload
): HealthMedication {
  return {
    id: row.id,
    lineId: row.line_id,
    status: row.status as HealthMedication['status'],
    name: decryptedPayload.name,
    standardizedId: decryptedPayload.standardizedId,
    dosage: decryptedPayload.dosage,
    frequency: decryptedPayload.frequency,
    timesOfDay: decryptedPayload.timesOfDay,
    prescribedBy: decryptedPayload.prescribedBy,
    startDate: decryptedPayload.startDate,
    endDate: decryptedPayload.endDate,
    linkedConditionId: row.linked_condition_id,
    linkedReason: decryptedPayload.linkedReason,
    notes: decryptedPayload.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Observation row mapper
// ---------------------------------------------------------------------------

type HealthObservationRow = {
  id: string;
  line_id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
};

export function mapHealthObservationRow(
  row: HealthObservationRow,
  decryptedPayload: StoredObservationPayload
): HealthObservation {
  return {
    id: row.id,
    lineId: row.line_id,
    text: decryptedPayload.text,
    category: decryptedPayload.category,
    observedDate: decryptedPayload.observedDate,
    concernLevel: decryptedPayload.concernLevel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Document row mapper
// ---------------------------------------------------------------------------

type HealthDocumentRow = {
  id: string;
  line_id: string;
  account_id: string;
  mime_type: string;
  file_extension: string;
  file_size_bytes: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export function mapHealthDocumentRow(
  row: HealthDocumentRow,
  decryptedPayload: StoredDocumentPayload
): HealthDocument {
  return {
    id: row.id,
    lineId: row.line_id,
    title: decryptedPayload.title,
    category: decryptedPayload.category,
    documentDate: decryptedPayload.documentDate,
    notes: decryptedPayload.notes,
    mimeType: row.mime_type,
    fileExtension: row.file_extension,
    fileSizeBytes: row.file_size_bytes,
    status: row.status as HealthDocument['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Suggestion row mapper
// ---------------------------------------------------------------------------

type HealthSuggestionRow = {
  id: string;
  line_id: string;
  suggestion_type: string;
  suggestion_mode: string;
  status: string;
  similar_item_id: string | null;
  source_call_started_at: string | null;
  reviewed_at: string | null;
};

export function mapHealthSuggestionRow(
  row: HealthSuggestionRow,
  decryptedPayload: StoredHealthSuggestionPayload
): HealthSuggestion {
  return {
    id: row.id,
    lineId: row.line_id,
    suggestionType: row.suggestion_type as HealthSuggestion['suggestionType'],
    suggestionMode: row.suggestion_mode as HealthSuggestion['suggestionMode'],
    status: row.status as HealthSuggestion['status'],
    normalizedName: decryptedPayload.normalizedName,
    confidenceLabel: decryptedPayload.confidenceLabel,
    summaryParaphrase: decryptedPayload.summaryParaphrase,
    proposedFields: decryptedPayload.proposedFields,
    similarItemId: row.similar_item_id,
    similarItemWarning: decryptedPayload.similarItemWarning,
    sourceCallStartedAt: row.source_call_started_at,
    reviewedAt: row.reviewed_at,
  };
}
