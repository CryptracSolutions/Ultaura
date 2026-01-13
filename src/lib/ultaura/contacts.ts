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

async function getDashboardUserId(): Promise<string | undefined> {
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
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false });
  return data || [];
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
