import 'server-only';

import crypto from 'crypto';
import getLogger from '~/core/logger';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { encryptReminderMessage } from '~/lib/ultaura/reminder-crypto';
import { encodeBytea } from '~/lib/ultaura/bytea';
import { logReminderEvent } from '~/lib/ultaura/reminder-events';
import { TELEPHONY } from '~/lib/ultaura/constants';
import type { HealthConsentStatus } from '@ultaura/types';
import type { Database } from '~/database.types';

const logger = getLogger();

type PauseSource = Database['public']['Enums']['ultaura_reminder_pause_source'];

const HEALTH_REMINDER_LIMIT = 20;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function consentStatusToPauseSource(
  status: HealthConsentStatus,
): PauseSource | null {
  if (status === 'not_requested') return 'health_consent_not_requested';
  if (status === 'denied') return 'health_consent_denied';
  if (status === 'revoked') return 'health_consent_revoked';
  return null;
}

function consentSources(): PauseSource[] {
  return [
    'health_consent_not_requested',
    'health_consent_denied',
    'health_consent_revoked',
  ];
}

// ---------------------------------------------------------------------------
// createHealthReminder
// ---------------------------------------------------------------------------

export async function createHealthReminder(params: {
  medicationId: string;
  lineId: string;
  accountId: string;
  actorUserId: string;
  timeOfDay: string;
  label?: string;
}): Promise<
  | { success: true; reminderId: string }
  | { success: false; code: string; message: string }
> {
  const { medicationId, lineId, accountId, actorUserId, timeOfDay, label } = params;

  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Validate medication belongs to this line and account
  const { data: medication, error: medError } = await adminClient
    .from('ultaura_health_medications')
    .select('id, line_id, account_id')
    .eq('id', medicationId)
    .eq('line_id', lineId)
    .eq('account_id', accountId)
    .is('deleted_at', null)
    .single();

  if (medError || !medication) {
    return { success: false, code: 'medication_not_found', message: 'Medication not found on this line' };
  }

  // Get the line for timezone
  const { data: line, error: lineError } = await adminClient
    .from('ultaura_lines')
    .select('id, timezone, created_at')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return { success: false, code: 'line_not_found', message: 'Line not found' };
  }

  const timezone = (line.timezone as string | null) || TELEPHONY.DEFAULT_TIMEZONE;

  // Read consent state to determine initial pause_sources
  const { data: consentRow } = await adminClient
    .from('ultaura_health_line_consent')
    .select('health_consent')
    .eq('line_id', lineId)
    .maybeSingle();

  const consentStatus = (consentRow?.health_consent ?? 'not_requested') as HealthConsentStatus;

  const initialPauseSources: PauseSource[] = ['health_manual_resume_required'];
  const consentPauseSource = consentStatusToPauseSource(consentStatus);
  if (consentPauseSource) {
    initialPauseSources.push(consentPauseSource);
  }

  // Generate a reminder ID ahead of time for AAD
  const reminderId = crypto.randomUUID();
  const messageText = label?.trim() || `Medication reminder`;

  // Encrypt the label as message
  let encryptedMessage;
  try {
    encryptedMessage = await encryptReminderMessage(
      adminClient,
      accountId,
      lineId,
      reminderId,
      messageText,
      line.created_at,
    );
  } catch (err) {
    logger.error({ err, reminderId }, 'Failed to encrypt health reminder message');
    return { success: false, code: 'encrypt_failed', message: 'Failed to encrypt reminder' };
  }

  // Health reminders are recurring daily at the specified time_of_day.
  // due_at is set to today at that time; the scheduler uses time_of_day for recurrence.
  const now = new Date();
  const [hours, minutes] = timeOfDay.split(':').map(Number);
  const dueAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours ?? 0, minutes ?? 0, 0));
  // If the time has already passed today, push to tomorrow
  if (dueAt.getTime() <= now.getTime()) {
    dueAt.setUTCDate(dueAt.getUTCDate() + 1);
  }

  const { data: insertedReminder, error: insertError } = await adminClient
    .from('ultaura_reminders')
    .insert({
      id: reminderId,
      account_id: accountId,
      line_id: lineId,
      source_context: 'health_profile',
      delivery_method: 'outbound_call',
      status: 'scheduled',
      time_of_day: timeOfDay,
      timezone,
      due_at: dueAt.toISOString(),
      is_recurring: true,
      rrule: 'FREQ=DAILY',
      is_paused: initialPauseSources.length > 0,
      pause_sources: initialPauseSources,
      paused_at: initialPauseSources.length > 0 ? new Date().toISOString() : null,
      message: null,
      message_ciphertext: encodeBytea(encryptedMessage.ciphertext),
      message_iv: encodeBytea(encryptedMessage.iv),
      message_tag: encodeBytea(encryptedMessage.tag),
      message_alg: encryptedMessage.alg,
      message_kid: encryptedMessage.kid,
      privacy_scope: 'line_only',
    })
    .select('id')
    .single();

  if (insertError || !insertedReminder) {
    logger.error({ insertError, reminderId }, 'Failed to insert health reminder');
    return { success: false, code: 'insert_failed', message: insertError?.message ?? 'Failed to create reminder' };
  }

  // Create the link row
  const { error: linkError } = await adminClient
    .from('ultaura_health_medication_reminders')
    .insert({
      medication_id: medicationId,
      reminder_id: reminderId,
      line_id: lineId,
      account_id: accountId,
    });

  if (linkError) {
    logger.error({ linkError, reminderId, medicationId }, 'Failed to create health reminder link');
    // Clean up the orphaned reminder
    await adminClient.from('ultaura_reminders').delete().eq('id', reminderId);
    return { success: false, code: 'link_failed', message: 'Failed to link reminder to medication' };
  }

  await logReminderEvent({
    accountId,
    reminderId,
    lineId,
    eventType: 'health_link_created',
    triggeredBy: 'dashboard',
    metadata: { medicationId, actorUserId, timeOfDay, initialPauseSources },
  });

  return { success: true, reminderId };
}

// ---------------------------------------------------------------------------
// getHealthRemindersForMedication
// ---------------------------------------------------------------------------

export type HealthLinkedReminder = {
  linkId: string;
  reminderId: string;
  timeOfDay: string | null;
  status: string;
  isActive: boolean;
  pauseSources: PauseSource[];
  createdAt: string;
};

export async function getHealthRemindersForMedication(
  medicationId: string,
  lineId: string,
): Promise<HealthLinkedReminder[]> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data, error } = await adminClient
    .from('ultaura_health_medication_reminders')
    .select(`
      id,
      reminder_id,
      created_at,
      ultaura_reminders!inner(
        id,
        status,
        time_of_day,
        pause_sources,
        is_paused
      )
    `)
    .eq('medication_id', medicationId)
    .eq('line_id', lineId)
    .is('deleted_at', null);

  if (error) {
    logger.error({ error, medicationId, lineId }, 'Failed to get health reminders for medication');
    return [];
  }

  return (data ?? []).map((row) => {
    const reminder = row.ultaura_reminders as {
      id: string;
      status: string;
      time_of_day: string | null;
      pause_sources: PauseSource[];
      is_paused: boolean;
    };
    return {
      linkId: row.id,
      reminderId: row.reminder_id,
      timeOfDay: reminder.time_of_day,
      status: reminder.status,
      isActive: reminder.status === 'scheduled' && !reminder.is_paused,
      pauseSources: reminder.pause_sources ?? [],
      createdAt: row.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// resumeHealthReminder
// ---------------------------------------------------------------------------

export async function resumeHealthReminder(
  reminderId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<
  | { success: true }
  | { success: false; code: string; message: string }
> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Lock the row for update via DB-level SELECT FOR UPDATE (spec Section 7.12)
  const { data: locked, error: fetchError } = await adminClient
    .rpc('lock_reminder_for_update', { p_reminder_id: reminderId });

  const reminder = Array.isArray(locked) ? locked[0] : locked;

  if (fetchError || !reminder || reminder.line_id !== lineId || reminder.account_id !== accountId) {
    return { success: false, code: 'not_found', message: 'Reminder not found' };
  }

  if (reminder.status === 'canceled') {
    return { success: false, code: 'already_canceled', message: 'Cannot resume a canceled reminder' };
  }

  const currentSources = (reminder.pause_sources ?? []) as PauseSource[];
  const newSources = currentSources.filter((s) => s !== 'health_manual_resume_required');
  const stillPaused = newSources.length > 0;

  // Check active reminder count if this resume would make it active
  if (!stillPaused) {
    const { count } = await adminClient
      .from('ultaura_reminders')
      .select('id', { count: 'exact', head: true })
      .eq('line_id', lineId)
      .eq('status', 'scheduled')
      .eq('is_paused', false);

    if ((count ?? 0) >= HEALTH_REMINDER_LIMIT) {
      return {
        success: false,
        code: 'health_reminder_resume_limit_exceeded',
        message: 'Active reminder limit reached. Cancel another reminder first.',
      };
    }
  }

  const resumeUpdate: Record<string, unknown> = {
    pause_sources: newSources,
    is_paused: stillPaused,
  };
  if (!stillPaused) {
    resumeUpdate.paused_at = null;
  }

  const { error: updateError } = await adminClient
    .from('ultaura_reminders')
    .update(resumeUpdate)
    .eq('id', reminderId)
    .eq('line_id', lineId);

  if (updateError) {
    logger.error({ updateError, reminderId }, 'Failed to resume health reminder');
    return { success: false, code: 'update_failed', message: updateError.message };
  }

  await logReminderEvent({
    accountId,
    reminderId,
    lineId,
    eventType: 'health_link_resumed',
    triggeredBy: 'dashboard',
    metadata: { actorUserId, removedSource: 'health_manual_resume_required', remainingSources: newSources },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// cancelHealthReminders
// ---------------------------------------------------------------------------

export async function cancelHealthReminders(
  medicationId: string,
  lineId: string,
  accountId: string,
  reason: 'deleted' | 'discontinued',
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Find all active link rows for this medication
  const { data: links, error: linksError } = await adminClient
    .from('ultaura_health_medication_reminders')
    .select('id, reminder_id')
    .eq('medication_id', medicationId)
    .eq('line_id', lineId)
    .is('deleted_at', null);

  if (linksError || !links || links.length === 0) {
    return;
  }

  const reminderIds = links.map((l) => l.reminder_id);
  const now = new Date().toISOString();

  // Cancel each reminder
  const { error: cancelError } = await adminClient
    .from('ultaura_reminders')
    .update({ status: 'canceled' })
    .in('id', reminderIds)
    .eq('line_id', lineId);

  if (cancelError) {
    logger.error({ cancelError, medicationId }, 'Failed to cancel health reminders');
  }

  // Soft-delete link rows
  const { error: softDeleteError } = await adminClient
    .from('ultaura_health_medication_reminders')
    .update({ deleted_at: now })
    .eq('medication_id', medicationId)
    .eq('line_id', lineId)
    .is('deleted_at', null);

  if (softDeleteError) {
    logger.error({ softDeleteError, medicationId }, 'Failed to soft-delete health reminder links');
  }

  // Log cancel events for each reminder
  for (const link of links) {
    await logReminderEvent({
      accountId,
      reminderId: link.reminder_id,
      lineId,
      eventType: 'health_link_canceled',
      triggeredBy: 'system',
      metadata: { medicationId, reason },
    });
  }
}

// ---------------------------------------------------------------------------
// cancelSingleHealthReminder
// ---------------------------------------------------------------------------

export async function cancelSingleHealthReminder(
  reminderId: string,
  lineId: string,
  accountId: string,
  actorUserId: string,
): Promise<{ success: true } | { success: false; code: string; message: string }> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { error: cancelError } = await adminClient
    .from('ultaura_reminders')
    .update({ status: 'canceled' })
    .eq('id', reminderId)
    .eq('line_id', lineId)
    .eq('account_id', accountId);

  if (cancelError) {
    return { success: false, code: 'cancel_failed', message: cancelError.message };
  }

  // Soft-delete the link row
  await adminClient
    .from('ultaura_health_medication_reminders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('reminder_id', reminderId)
    .eq('line_id', lineId)
    .is('deleted_at', null);

  await logReminderEvent({
    accountId,
    reminderId,
    lineId,
    eventType: 'health_link_canceled',
    triggeredBy: 'dashboard',
    metadata: { actorUserId, reason: 'manual_cancel' },
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// pauseHealthRemindersForConsentChange
// ---------------------------------------------------------------------------

export async function pauseHealthRemindersForConsentChange(
  lineId: string,
  accountId: string,
  newConsent: HealthConsentStatus,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  // Get all active health reminder link rows for this line
  const { data: links, error } = await adminClient
    .from('ultaura_health_medication_reminders')
    .select('reminder_id')
    .eq('line_id', lineId)
    .is('deleted_at', null);

  if (error || !links || links.length === 0) return;

  const reminderIds = links.map((l) => l.reminder_id);

  // Fetch current pause_sources for each reminder
  const { data: reminders, error: fetchError } = await adminClient
    .from('ultaura_reminders')
    .select('id, pause_sources')
    .in('id', reminderIds)
    .not('status', 'eq', 'canceled');

  if (fetchError || !reminders || reminders.length === 0) return;

  const ALL_CONSENT_SOURCES = consentSources();

  for (const reminder of reminders) {
    const current = (reminder.pause_sources ?? []) as PauseSource[];

    let updated: PauseSource[];
    if (newConsent === 'granted') {
      // Remove all consent-related sources, add health_manual_resume_required
      updated = current.filter((s) => !ALL_CONSENT_SOURCES.includes(s));
      if (!updated.includes('health_manual_resume_required')) {
        updated.push('health_manual_resume_required');
      }
    } else {
      // Remove all consent sources, add the new one
      updated = current.filter((s) => !ALL_CONSENT_SOURCES.includes(s));
      const newSource = consentStatusToPauseSource(newConsent);
      if (newSource && !updated.includes(newSource)) {
        updated.push(newSource);
      }
    }

    const isNowPaused = updated.length > 0;

    await adminClient
      .from('ultaura_reminders')
      .update({
        pause_sources: updated,
        is_paused: isNowPaused,
        paused_at: isNowPaused ? new Date().toISOString() : null,
      })
      .eq('id', reminder.id);

    await logReminderEvent({
      accountId,
      reminderId: reminder.id,
      lineId,
      eventType: 'health_link_paused',
      triggeredBy: 'system',
      metadata: { reason: 'consent_change', newConsent, updatedSources: updated },
    });
  }
}

// ---------------------------------------------------------------------------
// pauseHealthRemindersForPlanChange
// ---------------------------------------------------------------------------

export async function pauseHealthRemindersForPlanChange(
  lineId: string,
  accountId: string,
  planEligible: boolean,
): Promise<void> {
  const adminClient = getSupabaseServerActionClient({ admin: true });

  const { data: links, error } = await adminClient
    .from('ultaura_health_medication_reminders')
    .select('reminder_id')
    .eq('line_id', lineId)
    .is('deleted_at', null);

  if (error || !links || links.length === 0) return;

  const reminderIds = links.map((l) => l.reminder_id);

  const { data: reminders, error: fetchError } = await adminClient
    .from('ultaura_reminders')
    .select('id, pause_sources')
    .in('id', reminderIds)
    .not('status', 'eq', 'canceled');

  if (fetchError || !reminders || reminders.length === 0) return;

  for (const reminder of reminders) {
    const current = (reminder.pause_sources ?? []) as PauseSource[];

    let updated: PauseSource[];
    if (!planEligible) {
      updated = current.filter((s) => s !== 'health_plan_ineligible');
      updated.push('health_plan_ineligible');
    } else {
      // Becoming eligible: remove plan_ineligible, add manual_resume_required
      updated = current.filter((s) => s !== 'health_plan_ineligible');
      if (!updated.includes('health_manual_resume_required')) {
        updated.push('health_manual_resume_required');
      }
    }

    const isNowPaused = updated.length > 0;

    await adminClient
      .from('ultaura_reminders')
      .update({
        pause_sources: updated,
        is_paused: isNowPaused,
        paused_at: isNowPaused ? new Date().toISOString() : null,
      })
      .eq('id', reminder.id);

    await logReminderEvent({
      accountId,
      reminderId: reminder.id,
      lineId,
      eventType: 'health_link_paused',
      triggeredBy: 'system',
      metadata: { reason: 'plan_change', planEligible, updatedSources: updated },
    });
  }
}
