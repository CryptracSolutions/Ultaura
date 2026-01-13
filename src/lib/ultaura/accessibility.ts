'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import type { AccessibilitySettingsRow, UltauraAccountRow } from './types';

const logger = getLogger();

const UpdateAccessibilityInputSchema = z.object({
  hearingMode: z.enum(['normal', 'enhanced_clarity', 'slow_pace']).optional(),
  speechRate: z.number().min(0.7).max(1.3).optional(),
  cognitiveMode: z.enum(['normal', 'supportive', 'high_support']).optional(),
  contextWindowCalls: z.number().int().min(1).max(20).optional(),
}).partial();

export async function getAccessibilitySettings(
  lineId: string
): Promise<AccessibilitySettingsRow | null> {
  const line = await getLine(lineId);
  if (!line) {
    return null;
  }

  const client = getSupabaseServerComponentClient();
  const { data, error } = await client
    .from('ultaura_accessibility_settings')
    .select('*')
    .eq('line_id', line.id)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to fetch accessibility settings');
    return null;
  }

  return data ?? null;
}

const updateAccessibilitySettingsWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { lineId: string; lineShortId: string; updates: unknown }
): Promise<ActionResult<void>> => {
  const parsed = UpdateAccessibilityInputSchema.safeParse(input.updates);
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
  if (parsed.data.hearingMode !== undefined) updates.hearing_mode = parsed.data.hearingMode;
  if (parsed.data.speechRate !== undefined) updates.speech_rate = parsed.data.speechRate;
  if (parsed.data.cognitiveMode !== undefined) updates.cognitive_mode = parsed.data.cognitiveMode;
  if (parsed.data.contextWindowCalls !== undefined) {
    updates.context_window_calls = parsed.data.contextWindowCalls;
  }

  if (Object.keys(updates).length === 0) {
    return { success: true, data: undefined };
  }

  updates.updated_at = new Date().toISOString();

  const client = getSupabaseServerComponentClient();
  const { error } = await client
    .from('ultaura_accessibility_settings')
    .upsert({ line_id: input.lineId, ...updates }, { onConflict: 'line_id' });

  if (error) {
    logger.error({ error, lineId: input.lineId }, 'Failed to update accessibility settings');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update accessibility settings'),
    };
  }

  revalidatePath(`/dashboard/lines/${input.lineShortId}/settings`, 'page');
  return { success: true, data: undefined };
});

export async function updateAccessibilitySettings(
  lineId: string,
  updates: unknown
): Promise<ActionResult<void>> {
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

  return updateAccessibilitySettingsWithTrial(account, {
    lineId: line.id,
    lineShortId: line.short_id,
    updates,
  });
}
