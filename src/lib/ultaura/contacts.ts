'use server';

import { revalidatePath } from 'next/cache';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getLogger from '~/core/logger';
import {
  CreateTrustedContactInputSchema,
  createError,
  ErrorCodes,
  type ActionResult,
} from '@ultaura/schemas';
import { getLine } from './lines';
import { getUltauraAccountById, withTrialCheck } from './helpers';
import type { UltauraAccountRow } from './types';

const logger = getLogger();

export async function getTrustedContacts(lineId: string) {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });
  return data || [];
}

const addTrustedContactWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: { lineId: string; lineShortId: string; contact: unknown }
): Promise<ActionResult<void>> => {
  const parsed = CreateTrustedContactInputSchema.safeParse(input.contact);
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

  const { error } = await client.from('ultaura_trusted_contacts').insert({
    account_id: account.id,
    line_id: input.lineId,
    name: parsed.data.name,
    phone_e164: parsed.data.phoneE164,
    relationship: parsed.data.relationship,
    notify_on: parsed.data.notifyOn || ['medium', 'high'],
    enabled: true,
  });

  if (error) {
    logger.error({ error }, 'Failed to add trusted contact');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, error.message || 'Failed to add contact'),
    };
  }

  revalidatePath(`/dashboard/lines/${input.lineShortId}/contacts`);
  return { success: true, data: undefined };
});

export async function addTrustedContact(
  lineId: string,
  input: unknown
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

  return addTrustedContactWithTrial(account, {
    lineId,
    lineShortId: line.short_id,
    contact: input,
  });
}

const removeTrustedContactWithTrial = withTrialCheck(async (
  _account: UltauraAccountRow,
  input: { contactId: string; lineShortId: string }
): Promise<ActionResult<void>> => {
  const client = getSupabaseServerComponentClient();
  await client.from('ultaura_trusted_contacts').delete().eq('id', input.contactId);

  revalidatePath(`/dashboard/lines/${input.lineShortId}/contacts`);

  return { success: true, data: undefined };
});

export async function removeTrustedContact(
  contactId: string,
  lineShortId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('account_id')
    .eq('id', contactId)
    .single();

  if (!data?.account_id) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Contact not found'),
    };
  }

  const account = await getUltauraAccountById(data.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Account not found'),
    };
  }

  return removeTrustedContactWithTrial(account, { contactId, lineShortId });
}
