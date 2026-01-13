'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import type { MilestoneRow, UltauraAccountRow } from './types';

const logger = getLogger();

const MilestoneTypeSchema = z.enum([
  'birthday',
  'anniversary',
  'memorial',
  'achievement',
  'holiday',
  'custom',
]);

const CreateMilestoneInputSchema = z.object({
  title: z.string().min(1).max(120),
  milestoneType: MilestoneTypeSchema,
  dateMonth: z.number().int().min(1).max(12),
  dateDay: z.number().int().min(1).max(31),
  dateYear: z.number().int().optional(),
  relatedPersonName: z.string().optional(),
  isRecurring: z.boolean().optional(),
});

const UpdateMilestoneInputSchema = CreateMilestoneInputSchema.partial();

export async function getMilestones(lineId: string): Promise<MilestoneRow[]> {
  const client = getSupabaseServerComponentClient();
  const { data, error } = await client
    .from('ultaura_milestones')
    .select('*')
    .eq('line_id', lineId)
    .order('date_month', { ascending: true })
    .order('date_day', { ascending: true });

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch milestones');
    return [];
  }

  return data ?? [];
}

const createMilestoneWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: { lineId: string; lineShortId: string; milestone: unknown }
): Promise<ActionResult<MilestoneRow>> => {
  const parsed = CreateMilestoneInputSchema.safeParse(input.milestone);
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
  const now = new Date().toISOString();

  const { data, error } = await client
    .from('ultaura_milestones')
    .insert({
      account_id: account.id,
      line_id: input.lineId,
      milestone_type: parsed.data.milestoneType,
      title: parsed.data.title.trim(),
      date_month: parsed.data.dateMonth,
      date_day: parsed.data.dateDay,
      date_year: parsed.data.dateYear ?? null,
      related_person_name: parsed.data.relatedPersonName ?? null,
      is_recurring: parsed.data.isRecurring ?? true,
      source: 'family_input',
      privacy_scope: 'shareable_with_payer',
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !data) {
    logger.error({ error, lineId: input.lineId }, 'Failed to create milestone');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to create milestone'),
    };
  }

  revalidatePath(`/dashboard/lines/${input.lineShortId}/milestones`, 'page');
  return { success: true, data };
});

export async function createMilestone(
  lineId: string,
  milestone: unknown
): Promise<ActionResult<MilestoneRow>> {
  const line = await getLine(lineId);
  if (!line) {
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

  return createMilestoneWithTrial(account, {
    lineId: line.id,
    lineShortId: line.short_id,
    milestone,
  });
}

const updateMilestoneWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { milestoneId: string; lineShortId: string; updates: unknown }
): Promise<ActionResult<void>> => {
  const parsed = UpdateMilestoneInputSchema.safeParse(input.updates);
  if (!parsed.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        parsed.error.issues[0]?.message || 'Invalid input'
      ),
    };
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title?.trim();
  if (parsed.data.milestoneType !== undefined) updates.milestone_type = parsed.data.milestoneType;
  if (parsed.data.dateMonth !== undefined) updates.date_month = parsed.data.dateMonth;
  if (parsed.data.dateDay !== undefined) updates.date_day = parsed.data.dateDay;
  if (parsed.data.dateYear !== undefined) updates.date_year = parsed.data.dateYear ?? null;
  if (parsed.data.relatedPersonName !== undefined) {
    updates.related_person_name = parsed.data.relatedPersonName ?? null;
  }
  if (parsed.data.isRecurring !== undefined) updates.is_recurring = parsed.data.isRecurring;

  if (Object.keys(updates).length === 0) {
    return { success: true, data: undefined };
  }

  updates.updated_at = new Date().toISOString();

  const client = getSupabaseServerComponentClient();
  const { error } = await client
    .from('ultaura_milestones')
    .update(updates)
    .eq('id', input.milestoneId);

  if (error) {
    logger.error({ error, milestoneId: input.milestoneId }, 'Failed to update milestone');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update milestone'),
    };
  }

  revalidatePath(`/dashboard/lines/${input.lineShortId}/milestones`, 'page');
  return { success: true, data: undefined };
});

export async function updateMilestone(
  milestoneId: string,
  updates: unknown,
  lineShortId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();
  const { data: milestone, error } = await client
    .from('ultaura_milestones')
    .select('line_id')
    .eq('id', milestoneId)
    .single();

  if (error || !milestone?.line_id) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Milestone not found'),
    };
  }

  const line = await getLine(milestone.line_id);
  if (!line) {
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

  return updateMilestoneWithTrial(account, {
    milestoneId,
    lineShortId: lineShortId || line.short_id,
    updates,
  });
}

const deleteMilestoneWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { milestoneId: string; lineShortId: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();
  const { error } = await client
    .from('ultaura_milestones')
    .delete()
    .eq('id', input.milestoneId);

  if (error) {
    logger.error({ error, milestoneId: input.milestoneId }, 'Failed to delete milestone');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to delete milestone'),
    };
  }

  revalidatePath(`/dashboard/lines/${input.lineShortId}/milestones`, 'page');
  return { success: true, data: undefined };
});

export async function deleteMilestone(
  milestoneId: string,
  lineShortId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();
  const { data, error } = await client
    .from('ultaura_milestones')
    .select('line_id')
    .eq('id', milestoneId)
    .single();

  if (error || !data?.line_id) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Milestone not found'),
    };
  }

  const line = await getLine(data.line_id);
  if (!line) {
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

  return deleteMilestoneWithTrial(account, {
    milestoneId,
    lineShortId: lineShortId || line.short_id,
  });
}
