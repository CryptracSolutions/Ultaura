'use server';

import { headers } from 'next/headers';
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

export async function getDashboardUserId(): Promise<string | undefined> {
  try {
    const client = getSupabaseServerComponentClient();
    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
      return undefined;
    }
    return data.user.id;
  } catch {
    return undefined;
  }
}

function getRequestMetadata(): { ipAddress?: string; userAgent?: string } {
  try {
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || headersList.get('x-real-ip') || undefined;
    const userAgent = headersList.get('user-agent') || undefined;
    return { ipAddress, userAgent };
  } catch {
    return { ipAddress: undefined, userAgent: undefined };
  }
}

export async function getTrustedContacts(lineId: string) {
  const client = getSupabaseServerComponentClient();
  const { data } = await client
    .from('ultaura_trusted_contacts')
    .select('id, account_id, line_id, name, relationship, phone_e164, notify_on, enabled, created_at')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function getMyLinkedContact(
  lineId: string
): Promise<{ id: string; name: string; relationship: string | null } | null> {
  const userId = await getDashboardUserId();
  if (!userId) {
    return null;
  }

  const client = getSupabaseServerComponentClient();
  const { data, error } = await client
    .from('ultaura_trusted_contacts')
    .select('id, name, relationship')
    .eq('line_id', lineId)
    .eq('user_id', userId)
    .eq('enabled', true)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    name: data.name,
    relationship: data.relationship,
  };
}

export async function linkUserToTrustedContact(
  contactId: string
): Promise<ActionResult<void>> {
  const userId = await getDashboardUserId();
  if (!userId) {
    return {
      success: false,
      error: createError(ErrorCodes.UNAUTHORIZED, 'You must be signed in'),
    };
  }

  const client = getSupabaseServerComponentClient();

  // Fetch first so RLS-filtered rows resolve to NOT_FOUND instead of silent no-op updates.
  const { data: targetContact, error: targetContactError } = await client
    .from('ultaura_trusted_contacts')
    .select('id, account_id, line_id, enabled')
    .eq('id', contactId)
    .maybeSingle();

  if (targetContactError) {
    logger.error({ error: targetContactError, contactId }, 'Failed to fetch trusted contact for linking');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to link trusted contact'),
    };
  }

  if (!targetContact) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Trusted contact not found'),
    };
  }

  const account = await getUltauraAccountById(targetContact.account_id);
  if (!account) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Trusted contact not found'),
    };
  }

  if (!targetContact.enabled) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Trusted contact not found'),
    };
  }

  const { error: clearExistingError } = await client
    .from('ultaura_trusted_contacts')
    .update({ user_id: null })
    .eq('line_id', targetContact.line_id)
    .eq('user_id', userId)
    .neq('id', targetContact.id);

  if (clearExistingError) {
    logger.error(
      { error: clearExistingError, contactId, lineId: targetContact.line_id, userId },
      'Failed to clear existing trusted contact link'
    );
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to link trusted contact'),
    };
  }

  const { data: updatedTarget, error: updateTargetError } = await client
    .from('ultaura_trusted_contacts')
    .update({ user_id: userId })
    .eq('id', targetContact.id)
    .select('id')
    .maybeSingle();

  if (updateTargetError) {
    logger.error(
      { error: updateTargetError, contactId, lineId: targetContact.line_id, userId },
      'Failed to link trusted contact'
    );
    return {
      success: false,
      error: createError(
        updateTargetError.code === '23505' ? ErrorCodes.INVALID_INPUT : ErrorCodes.DATABASE_ERROR,
        updateTargetError.code === '23505'
          ? 'Unable to link this trusted contact right now. Please try again.'
          : 'Failed to link trusted contact'
      ),
    };
  }

  if (!updatedTarget) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Trusted contact not found'),
    };
  }

  return { success: true, data: undefined };
}

const addTrustedContactWithTrial = withTrialCheck(async (
  account: UltauraAccountRow,
  input: {
    lineId: string;
    lineShortId: string;
    contact: unknown;
    consentEvidence: {
      timestamp: string;
      ipAddress?: string;
      userAgent?: string;
      dashboardUserId?: string;
      contactName: string;
    };
  }
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

  const { data: existingConsent } = await client
    .from('ultaura_consents')
    .select('id')
    .eq('line_id', input.lineId)
    .eq('type', 'trusted_contact_notify')
    .eq('granted', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (!existingConsent) {
    const { error: consentError } = await client.from('ultaura_consents').insert({
      account_id: account.id,
      line_id: input.lineId,
      type: 'trusted_contact_notify',
      granted: true,
      granted_by: 'payer_ack',
      evidence: input.consentEvidence,
    });

    if (consentError) {
      logger.warn({ error: consentError, lineId: input.lineId }, 'Failed to create trusted contact consent');
    }
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

  const parsed = CreateTrustedContactInputSchema.safeParse(input);
  const contactName = parsed.success ? parsed.data.name : 'Unknown';
  const { ipAddress, userAgent } = getRequestMetadata();
  const dashboardUserId = await getDashboardUserId();

  return addTrustedContactWithTrial(account, {
    lineId,
    lineShortId: line.short_id,
    contact: input,
    consentEvidence: {
      timestamp: new Date().toISOString(),
      ipAddress,
      userAgent,
      dashboardUserId,
      contactName,
    },
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
