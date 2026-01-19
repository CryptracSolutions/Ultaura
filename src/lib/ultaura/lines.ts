'use server';

import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import getLogger from '~/core/logger';
import {
  CreateLineInputSchema,
  UpdateLineInputSchema,
  createError,
  ErrorCodes,
  type ActionResult,
} from '@ultaura/schemas';
import { getPlan, getUltauraAccountById, withTrialCheck } from './helpers';
import type { LineRow, UltauraAccountRow } from './types';
import { generateShortId, isShortId, isUUID } from './short-id';

const logger = getLogger();

export async function getLines(accountId: string): Promise<LineRow[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_lines')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error }, 'Failed to get lines');
    return [];
  }

  return data || [];
}

export async function getLine(lineId: string): Promise<LineRow | null> {
  const client = getSupabaseServerComponentClient();
  const normalizedId = lineId.trim();

  let query = client.from('ultaura_lines').select('*');

  if (isUUID(normalizedId)) {
    query = query.eq('id', normalizedId);
  } else if (isShortId(normalizedId)) {
    query = query.eq('short_id', normalizedId.toLowerCase());
  } else {
    logger.warn({ lineId }, 'Invalid line ID format');
    return null;
  }

  const { data, error } = await query.single();

  if (error) {
    if ((error as { code?: string } | null)?.code === 'PGRST116') {
      return null;
    }

    logger.error({ error, lineId }, 'Failed to get line');
    return null;
  }

  return data ?? null;
}

const createLineWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: unknown
): Promise<ActionResult<{ lineId: string; shortId: string }>> => {
  const parsed = CreateLineInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const {
    displayName,
    phoneE164,
    timezone,
    voicemailBehavior,
    preferredLanguageIso,
    seedInterests,
    seedAvoidTopics,
    defaultSharingTier,
  } = parsed.data;

  const existingLines = await getLines(account.id);
  const planId = account.status === 'trial'
    ? (account.trial_plan_id ?? account.plan_id ?? 'free_trial')
    : (account.plan_id || 'free_trial');
  const plan = await getPlan(planId);

  if (existingLines.length >= (plan?.lines_included || 1)) {
    return {
      success: false,
      error: createError(
        ErrorCodes.LINE_LIMIT_REACHED,
        'Line limit reached for your plan'
      ),
    };
  }

  const client = getSupabaseServerComponentClient();

  const { data: existingPhone } = await client
    .from('ultaura_lines')
    .select('id')
    .eq('phone_e164', phoneE164)
    .single();

  if (existingPhone) {
    return {
      success: false,
      error: createError(
        ErrorCodes.ALREADY_EXISTS,
        'This phone number is already registered'
      ),
    };
  }

  const lineId = crypto.randomUUID();
  let shortId = generateShortId(lineId);

  const { data: existingShortIds } = await client
    .from('ultaura_lines')
    .select('short_id')
    .eq('account_id', account.id)
    .like('short_id', `${shortId}%`);

  if (existingShortIds && existingShortIds.length > 0) {
    const usedSuffixes = existingShortIds.map((existing) => {
      const match = existing.short_id.match(/_(\d+)$/);
      return match ? Number.parseInt(match[1], 10) : 1;
    });
    const nextSuffix = Math.max(...usedSuffixes) + 1;
    shortId = `${shortId}_${nextSuffix}`;
  }

  const { data: line, error } = await client
    .from('ultaura_lines')
    .insert({
      id: lineId,
      short_id: shortId,
      account_id: account.id,
      display_name: displayName,
      phone_e164: phoneE164,
      timezone,
      status: 'paused',
      seed_interests: seedInterests || null,
      seed_avoid_topics: seedAvoidTopics || null,
      voicemail_behavior: voicemailBehavior,
      preferred_language_iso: preferredLanguageIso ?? null,
      preferred_language_bcp47: preferredLanguageIso ?? null,
    })
    .select('id, short_id')
    .single();

  if (error) {
    logger.error({ error }, 'Failed to create line');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to create line'),
    };
  }

  if (defaultSharingTier && account.user_type === 'family_managed') {
    const adminClient = getSupabaseServerActionClient({ admin: true });
    const { error: consentError } = await adminClient
      .from('ultaura_line_voice_consent')
      .update({
        sharing_tier: defaultSharingTier,
        updated_at: new Date().toISOString(),
      })
      .eq('line_id', line.id);

    if (consentError) {
      logger.error({ error: consentError, lineId: line.id }, 'Failed to set default sharing tier');
    }
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true, data: { lineId: line.id, shortId: line.short_id } };
});

export async function createLine(input: unknown): Promise<ActionResult<{ lineId: string; shortId: string }>> {
  const parsed = CreateLineInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const account = await getUltauraAccountById(parsed.data.accountId);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return createLineWithTrial(account, parsed.data);
}

const updateLineWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string; updates: Record<string, unknown> }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_lines')
    .update(input.updates)
    .eq('id', input.lineId);

  if (error) {
    logger.error({ error }, 'Failed to update line');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update line'),
    };
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true, data: undefined };
});

export async function updateLine(
  lineId: string,
  input: unknown
): Promise<ActionResult<void>> {
  const parsed = UpdateLineInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const client = getSupabaseServerComponentClient();

  const { data: line, error: lineError } = await client
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  const updates: Record<string, unknown> = {};

  if (parsed.data.displayName !== undefined) updates.display_name = parsed.data.displayName;
  if (parsed.data.timezone !== undefined) updates.timezone = parsed.data.timezone;
  if (parsed.data.quietHoursStart !== undefined) updates.quiet_hours_start = parsed.data.quietHoursStart;
  if (parsed.data.quietHoursEnd !== undefined) updates.quiet_hours_end = parsed.data.quietHoursEnd;
  if (parsed.data.doNotCall !== undefined) updates.do_not_call = parsed.data.doNotCall;
  if (parsed.data.inboundAllowed !== undefined) updates.inbound_allowed = parsed.data.inboundAllowed;
  if (parsed.data.seedInterests !== undefined) updates.seed_interests = parsed.data.seedInterests;
  if (parsed.data.seedAvoidTopics !== undefined) updates.seed_avoid_topics = parsed.data.seedAvoidTopics;
  if (parsed.data.allowVoiceReminderControl !== undefined) updates.allow_voice_reminder_control = parsed.data.allowVoiceReminderControl;
  if (parsed.data.allowVoiceScheduleControl !== undefined) updates.allow_voice_schedule_control = parsed.data.allowVoiceScheduleControl;
  if (parsed.data.voicemailBehavior !== undefined) updates.voicemail_behavior = parsed.data.voicemailBehavior;
  if (parsed.data.preferredLanguageIso !== undefined) {
    updates.preferred_language_iso = parsed.data.preferredLanguageIso;
    updates.preferred_language_bcp47 = parsed.data.preferredLanguageIso;
  }
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.birthYear !== undefined) updates.birth_year = parsed.data.birthYear;
  if (parsed.data.formativeDecade !== undefined) updates.formative_decade = parsed.data.formativeDecade;
  if (parsed.data.hometown !== undefined) updates.hometown = parsed.data.hometown;
  if (parsed.data.currentLocation !== undefined) updates.current_location = parsed.data.currentLocation;
  if (parsed.data.optimalCallTime !== undefined) updates.optimal_call_time = parsed.data.optimalCallTime;
  if (parsed.data.optimalCallTimeSource !== undefined) updates.optimal_call_time_source = parsed.data.optimalCallTimeSource;
  if (parsed.data.optimalCallDays !== undefined) updates.optimal_call_days = parsed.data.optimalCallDays;
  if (parsed.data.interruptionTolerance !== undefined) updates.interruption_tolerance = parsed.data.interruptionTolerance;
  if (parsed.data.fillerWordPatience !== undefined) updates.filler_word_patience = parsed.data.fillerWordPatience;
  if (parsed.data.silenceToleranceMs !== undefined) updates.silence_tolerance_ms = parsed.data.silenceToleranceMs;
  if (parsed.data.crosstalkRecoveryMode !== undefined) updates.crosstalk_recovery_mode = parsed.data.crosstalkRecoveryMode;

  return updateLineWithTrial(account, { lineId, updates });
}

const deleteLineWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_lines')
    .delete()
    .eq('id', input.lineId);

  if (error) {
    logger.error({ error }, 'Failed to delete line');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to delete line'),
    };
  }

  revalidatePath('/dashboard/lines', 'page');

  return { success: true, data: undefined };
});

export async function deleteLine(lineId: string): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const { data: line, error: lineError } = await client
    .from('ultaura_lines')
    .select('account_id')
    .eq('id', lineId)
    .single();

  if (lineError || !line) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Line not found'),
    };
  }

  const account = await getUltauraAccountById(line.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return deleteLineWithTrial(account, { lineId });
}
