'use server';

import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import type { Database } from '~/database.types';
import requireSession from '~/lib/user/require-session';
import type { AccountAlertDeliveryRow, AlertDeliveryChannel } from './types';

export interface AccountAlertDelivery {
  accountId: string;
  deliveryChannel: AlertDeliveryChannel;
  smsConsentAcknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type AuthUserResponse = {
  user: {
    phone?: string | null;
    phone_confirmed_at?: string | null;
  } | null;
};

function mapAccountAlertDelivery(row: AccountAlertDeliveryRow): AccountAlertDelivery {
  return {
    accountId: row.account_id,
    deliveryChannel: row.delivery_channel as AlertDeliveryChannel,
    smsConsentAcknowledgedAt: row.sms_consent_acknowledged_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeDeliveryChannel(value?: AlertDeliveryChannel): AlertDeliveryChannel {
  if (value === 'sms' || value === 'both') {
    return value;
  }
  return 'email';
}

async function requireAccountOwner(
  client: SupabaseClient<Database>,
  accountId: string
): Promise<ActionResult<{ userId: string }>> {
  const session = await requireSession(client).catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: createError(ErrorCodes.UNAUTHORIZED, 'Unauthorized') };
  }

  const { data: account, error } = await client
    .from('ultaura_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('created_by_user_id', userId)
    .maybeSingle();

  if (error || !account) {
    return { success: false, error: createError(ErrorCodes.FORBIDDEN, 'Access denied') };
  }

  return { success: true, data: { userId } };
}

export async function getAccountAlertDelivery(
  accountId: string
): Promise<ActionResult<AccountAlertDelivery>> {
  const client = getSupabaseServerActionClient();
  const auth = await requireAccountOwner(client, accountId);
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  const { data: existing, error } = await client
    .from('ultaura_account_alert_delivery')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to load account alert delivery'),
    };
  }

  if (existing) {
    return { success: true, data: mapAccountAlertDelivery(existing) };
  }

  const { data: created, error: createErrorResult } = await client
    .from('ultaura_account_alert_delivery')
    .insert({
      account_id: accountId,
      delivery_channel: 'email',
    })
    .select('*')
    .single();

  if (createErrorResult || !created) {
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to initialize account alert delivery'),
    };
  }

  return { success: true, data: mapAccountAlertDelivery(created) };
}

export async function updateAccountAlertDelivery(
  accountId: string,
  input: {
    deliveryChannel?: AlertDeliveryChannel;
    smsConsentAcknowledgedAt?: string | null;
  }
): Promise<ActionResult<AccountAlertDelivery>> {
  const client = getSupabaseServerActionClient();
  const auth = await requireAccountOwner(client, accountId);
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  const nextDeliveryChannel = normalizeDeliveryChannel(input.deliveryChannel);
  const requiresSms = nextDeliveryChannel === 'sms' || nextDeliveryChannel === 'both';
  let existingConsentTimestamp: string | null = null;

  if (requiresSms) {
    const { data: authUserResult, error: authUserError } = await client.auth.getUser();
    const authUser = authUserResult as AuthUserResponse;
    const ownerPhone = authUser.user?.phone?.trim() || null;
    const ownerPhoneVerified = Boolean(authUser.user?.phone_confirmed_at);

    if (authUserError || !ownerPhone || !ownerPhoneVerified) {
      return {
        success: false,
        error: createError(
          ErrorCodes.INVALID_INPUT,
          'A verified account phone is required for SMS alerts',
        ),
      };
    }

    const { data: existing } = await client
      .from('ultaura_account_alert_delivery')
      .select('sms_consent_acknowledged_at')
      .eq('account_id', accountId)
      .maybeSingle();

    existingConsentTimestamp = existing?.sms_consent_acknowledged_at ?? null;
    const nextConsentTimestamp =
      input.smsConsentAcknowledgedAt ?? existingConsentTimestamp;

    if (!nextConsentTimestamp) {
      return {
        success: false,
        error: createError(
          ErrorCodes.INVALID_INPUT,
          'SMS consent is required for SMS alerts',
        ),
      };
    }
  }

  const upsertPayload: Database['public']['Tables']['ultaura_account_alert_delivery']['Insert'] = {
    account_id: accountId,
    updated_at: new Date().toISOString(),
  };

  if (input.deliveryChannel !== undefined) {
    upsertPayload.delivery_channel = nextDeliveryChannel;
  }

  if (input.smsConsentAcknowledgedAt !== undefined) {
    upsertPayload.sms_consent_acknowledged_at = input.smsConsentAcknowledgedAt;
  } else if (requiresSms && existingConsentTimestamp) {
    upsertPayload.sms_consent_acknowledged_at = existingConsentTimestamp;
  }

  const { data, error } = await client
    .from('ultaura_account_alert_delivery')
    .upsert(upsertPayload, { onConflict: 'account_id' })
    .select('*')
    .single();

  if (error || !data) {
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update account alert delivery'),
    };
  }

  return { success: true, data: mapAccountAlertDelivery(data) };
}
