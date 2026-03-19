'use server';

import { revalidatePath } from 'next/cache';
import {
  acknowledgeHealthDisclaimer,
} from './account-state';
import {
  requestHealthConsentRePrompt,
  grantHealthConsentSelf,
  revokeHealthConsentSelf,
} from './consent';
import { emitDisclaimerAcknowledged } from './analytics';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { requireHealthLineAccess } from './access';
import {
  getConditions,
  createCondition,
  editCondition,
  deleteCondition,
  changeConditionStatus,
} from './conditions';
import { getHealthItemHistory } from './history';
import {
  getMedications,
  createMedication,
  editMedication,
  deleteMedication,
  changeMedicationStatus,
} from './medications';
import {
  getObservations,
  createObservation,
  editObservation,
  deleteObservation,
} from './observations';
import {
  getDocuments,
  editDocumentMetadata,
  deleteDocument,
  type DocumentMetadataInput,
} from './documents';
import {
  createHealthReminder,
  getHealthRemindersForMedication,
  resumeHealthReminder,
  pauseHealthReminder,
  cancelSingleHealthReminder,
} from './reminders';
import {
  getPendingSuggestions,
  getPendingSuggestionCount,
  approveSuggestionAsNew,
  approveSuggestionAsUpdate,
  dismissSuggestion,
} from './suggestions';
import type {
  HealthCondition,
  HealthConditionStatus,
  HealthMedication,
  HealthMedicationStatus,
  HealthObservation,
  HealthDocument,
  HealthSuggestion,
  ApproximateDate,
} from '@ultaura/types';
import type { ConditionFormInput, ObservationFormInput } from '@ultaura/schemas';

async function getActorUserId(): Promise<string | null> {
  const client = getSupabaseServerActionClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

export async function acknowledgeHealthDisclaimerAction(
  accountId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return { success: false, error: 'Not authenticated' };
  }

  const result = await acknowledgeHealthDisclaimer(accountId, actorUserId);
  if (result.success) {
    emitDisclaimerAcknowledged(accountId);
    revalidatePath('/dashboard/health');
  }
  return result;
}

export async function requestHealthConsentRePromptAction(
  lineId: string,
): Promise<
  | { success: true }
  | { success: false; code: string; message: string }
> {
  const actorUserId = await getActorUserId();
  if (!actorUserId) {
    return { success: false, code: 'access_denied', message: 'Not authenticated' };
  }

  const result = await requestHealthConsentRePrompt(lineId);
  if (result.success) {
    revalidatePath('/dashboard/health');
  }
  return result;
}

export async function grantHealthConsentSelfAction(
  lineId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  const result = await grantHealthConsentSelf(lineId);
  if (result.success) {
    revalidatePath('/dashboard/health');
  }
  return result;
}

export async function revokeHealthConsentSelfAction(
  lineId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  const result = await revokeHealthConsentSelf(lineId);
  if (result.success) {
    revalidatePath('/dashboard/health');
  }
  return result;
}

// ---------------------------------------------------------------------------
// Conditions actions
// ---------------------------------------------------------------------------

export async function getConditionsAction(
  lineId: string,
): Promise<{ success: true; conditions: HealthCondition[] } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const conditions = await getConditions(lineId, undefined, access.context.accountId);
    return { success: true, conditions };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load conditions' };
  }
}

export async function createConditionAction(
  lineId: string,
  formData: ConditionFormInput,
): Promise<{ success: true; condition: HealthCondition } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    const condition = await createCondition(accountId, lineId, actorUserId, formData);
    revalidatePath('/dashboard/health');
    return { success: true, condition };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create condition' };
  }
}

export async function editConditionAction(
  conditionId: string,
  lineId: string,
  formData: ConditionFormInput,
): Promise<{ success: true; condition: HealthCondition } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    const condition = await editCondition(conditionId, lineId, accountId, actorUserId, formData);
    revalidatePath('/dashboard/health');
    return { success: true, condition };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update condition' };
  }
}

export async function deleteConditionAction(
  conditionId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    await deleteCondition(conditionId, lineId, accountId, actorUserId);
    revalidatePath('/dashboard/health');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete condition' };
  }
}

export async function changeConditionStatusAction(
  conditionId: string,
  lineId: string,
  status: HealthConditionStatus,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    await changeConditionStatus(conditionId, lineId, accountId, actorUserId, status);
    revalidatePath('/dashboard/health');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update condition status' };
  }
}

// ---------------------------------------------------------------------------
// History action (shared)
// ---------------------------------------------------------------------------

export async function getHealthItemHistoryAction(
  lineId: string,
  itemKind?: 'condition' | 'medication' | 'document' | 'observation' | 'suggestion',
  itemId?: string,
): Promise<
  | { success: true; entries: Awaited<ReturnType<typeof getHealthItemHistory>> }
  | { success: false; error: string }
> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const entries = await getHealthItemHistory(lineId, itemKind, itemId, 50, access.context.accountId);
    return { success: true, entries };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load history' };
  }
}

// --- Medication actions ---

export interface MedicationFormInput {
  name: string;
  standardizedId: { system: string; code: string } | null;
  status: HealthMedicationStatus;
  dosage: string | null;
  frequency: string | null;
  timesOfDay: string[];
  prescribedBy: string | null;
  startDate: ApproximateDate | null;
  endDate: ApproximateDate | null;
  linkedConditionId: string | null;
  linkedReason: string | null;
  notes: string | null;
}

export async function getMedicationsAction(
  lineId: string,
  filter?: { status?: HealthMedicationStatus },
): Promise<{ success: true; medications: HealthMedication[] } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const medications = await getMedications(lineId, filter, access.context.accountId);
    return { success: true, medications };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load medications' };
  }
}

export async function createMedicationAction(
  lineId: string,
  formData: MedicationFormInput,
): Promise<{ success: true; medication: HealthMedication } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await createMedication(accountId, lineId, actorUserId, formData);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true, medication: result.medication };
}

export async function editMedicationAction(
  medicationId: string,
  lineId: string,
  formData: Partial<MedicationFormInput>,
): Promise<{ success: true; medication: HealthMedication } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await editMedication(medicationId, lineId, accountId, actorUserId, formData);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true, medication: result.medication };
}

export async function deleteMedicationAction(
  medicationId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await deleteMedication(medicationId, lineId, accountId, actorUserId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

export async function changeMedicationStatusAction(
  medicationId: string,
  lineId: string,
  status: HealthMedicationStatus,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await changeMedicationStatus(medicationId, lineId, accountId, actorUserId, status);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

// --- Suggestion actions ---

export async function getPendingSuggestionsAction(
  lineId: string,
  filter?: { type?: 'condition' | 'medication' },
): Promise<{ success: true; suggestions: HealthSuggestion[] } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const suggestions = await getPendingSuggestions(lineId, filter, access.context.accountId);
    return { success: true, suggestions };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load suggestions' };
  }
}

export async function getPendingSuggestionCountAction(
  lineId: string,
): Promise<
  | { success: true; total: number; conditions: number; medications: number }
  | { success: false; error: string }
> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const counts = await getPendingSuggestionCount(lineId);
    return { success: true, ...counts };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load suggestion counts' };
  }
}

export async function approveSuggestionAsNewAction(
  suggestionId: string,
  lineId: string,
): Promise<{ success: true; resultingItemId: string } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await approveSuggestionAsNew(suggestionId, lineId, accountId, actorUserId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true, resultingItemId: result.resultingItemId };
}

export async function approveSuggestionAsUpdateAction(
  suggestionId: string,
  lineId: string,
  targetItemId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await approveSuggestionAsUpdate(suggestionId, lineId, accountId, actorUserId, targetItemId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

export async function dismissSuggestionAction(
  suggestionId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await dismissSuggestion(suggestionId, lineId, accountId, actorUserId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

// ---------------------------------------------------------------------------
// Observation actions
// ---------------------------------------------------------------------------

export async function getObservationsAction(
  lineId: string,
): Promise<{ success: true; observations: HealthObservation[] } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const observations = await getObservations(lineId, access.context.accountId);
    return { success: true, observations };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load observations' };
  }
}

export async function createObservationAction(
  lineId: string,
  input: ObservationFormInput,
): Promise<{ success: true; observation: HealthObservation } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    const observation = await createObservation(accountId, lineId, actorUserId, input);
    revalidatePath('/dashboard/health');
    return { success: true, observation };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create observation' };
  }
}

export async function editObservationAction(
  observationId: string,
  lineId: string,
  input: ObservationFormInput,
): Promise<{ success: true; observation: HealthObservation } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    const observation = await editObservation(observationId, lineId, accountId, actorUserId, input);
    revalidatePath('/dashboard/health');
    return { success: true, observation };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update observation' };
  }
}

export async function deleteObservationAction(
  observationId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    await deleteObservation(observationId, lineId, accountId, actorUserId);
    revalidatePath('/dashboard/health');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete observation' };
  }
}

// --- Reminder actions ---

export async function createHealthReminderAction(
  medicationId: string,
  lineId: string,
  timeOfDay: string,
  label?: string,
): Promise<{ success: true; reminderId: string } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await createHealthReminder({ medicationId, lineId, accountId, actorUserId, timeOfDay, label });
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true, reminderId: result.reminderId };
}

export async function getHealthRemindersForMedicationAction(
  medicationId: string,
  lineId: string,
): Promise<{ success: true; reminders: Awaited<ReturnType<typeof getHealthRemindersForMedication>> } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const reminders = await getHealthRemindersForMedication(medicationId, lineId);
    return { success: true, reminders };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load reminders' };
  }
}

export async function resumeHealthReminderAction(
  reminderId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await resumeHealthReminder(reminderId, lineId, accountId, actorUserId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

export async function pauseHealthReminderAction(
  reminderId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await pauseHealthReminder(reminderId, lineId, accountId, actorUserId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

export async function cancelHealthReminderAction(
  reminderId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  const result = await cancelSingleHealthReminder(reminderId, lineId, accountId, actorUserId);
  if (!result.success) {
    return { success: false, error: result.message };
  }

  revalidatePath('/dashboard/health');
  return { success: true };
}

// --- Document actions ---

export { type DocumentMetadataInput };

export async function getDocumentsAction(
  lineId: string,
): Promise<{ success: true; documents: HealthDocument[] } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  try {
    const documents = await getDocuments(lineId, access.context.accountId);
    return { success: true, documents };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load documents' };
  }
}

export async function editDocumentMetadataAction(
  documentId: string,
  lineId: string,
  input: DocumentMetadataInput,
): Promise<{ success: true; document: HealthDocument } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    const document = await editDocumentMetadata(documentId, lineId, accountId, actorUserId, input);
    revalidatePath('/dashboard/health');
    return { success: true, document };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update document' };
  }
}

export async function deleteDocumentAction(
  documentId: string,
  lineId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const access = await requireHealthLineAccess(lineId);
  if (!access.ok) {
    return { success: false, error: access.error };
  }

  const { accountId, actorUserId } = access.context;

  try {
    await deleteDocument(documentId, lineId, accountId, actorUserId);
    revalidatePath('/dashboard/health');
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete document' };
  }
}
