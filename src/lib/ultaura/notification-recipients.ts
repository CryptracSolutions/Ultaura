'use server';

import { revalidatePath } from 'next/cache';
import getLogger from '~/core/logger';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/database.types';
import type { NotificationRecipient } from './types';
import sendEmail from '~/core/email/send-email';
import renderNotificationInviteEmail from '~/lib/emails/notification-invite';
import { getUserDataById } from '~/lib/server/queries';
import { buildNotificationRecipientToken, hashNotificationToken } from './notification-tokens';

const logger = getLogger();

function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');
}

async function resolveAccountContext(
  accountId: string,
  client?: SupabaseClient<Database>
): Promise<{
  accountName: string;
  lineName: string;
  inviterName: string;
}> {
  const clientInstance = client ?? getSupabaseServerComponentClient();
  const { data: account } = await clientInstance
    .from('ultaura_accounts')
    .select('name')
    .eq('id', accountId)
    .single();

  const { data: lines } = await clientInstance
    .from('ultaura_lines')
    .select('display_name, created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  const accountName = account?.name || 'Ultaura';
  const lineName = lines && lines.length === 1 ? lines[0].display_name : 'your loved one';

  const { data: user } = await clientInstance.auth.getUser();
  const userId = user.user?.id;
  let inviterName = 'Ultaura';

  if (userId) {
    const userRecord = await getUserDataById(clientInstance, userId).catch(() => null);
    inviterName = userRecord?.displayName?.trim() || accountName;
  }

  return { accountName, lineName, inviterName };
}

function mapRecipient(row: any): NotificationRecipient {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    email: row.email,
    phoneE164: row.phone_e164,
    relationship: row.relationship,
    isTrustedContact: row.is_trusted_contact,
    trustedContactId: row.trusted_contact_id,
    confirmedAt: row.confirmed_at,
    unsubscribedAt: row.unsubscribed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getNotificationRecipients(
  accountId: string
): Promise<NotificationRecipient[]> {
  const client = getSupabaseServerComponentClient();

  const { data, error } = await client
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error({ error, accountId }, 'Failed to fetch notification recipients');
    return [];
  }

  return (data || []).map(mapRecipient);
}

export async function inviteNotificationRecipient(
  accountId: string,
  input: {
    name: string;
    email: string;
    phoneE164?: string;
    relationship?: string;
    addAsTrustedContact?: boolean;
    allowReinvite?: boolean;
  },
  options: {
    client?: SupabaseClient<Database>;
  } = {}
): Promise<ActionResult<NotificationRecipient>> {
  const client = options.client ?? getSupabaseServerComponentClient();
  const email = input.email.trim().toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existing, error: existingError } = await client
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('account_id', accountId)
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    logger.error({ existingError, accountId }, 'Failed to check existing recipient');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to invite recipient') };
  }

  if (existing) {
    if (existing.confirmed_at && !existing.unsubscribed_at) {
      return {
        success: false,
        error: createError(ErrorCodes.ALREADY_EXISTS, 'This person is already receiving notifications'),
      };
    }

    if (existing.unsubscribed_at && !input.allowReinvite) {
      return {
        success: false,
        error: createError(ErrorCodes.INVALID_INPUT, 'Recipient previously unsubscribed', {
          reason: 'unsubscribed',
        }),
      };
    }

    const token = buildNotificationRecipientToken(existing.id);
    const tokenHash = hashNotificationToken(token);

    const { data: updated, error: updateError } = await client
      .from('ultaura_notification_recipients')
      .update({
        name: input.name,
        email,
        phone_e164: input.phoneE164 ?? null,
        relationship: input.relationship ?? null,
        is_trusted_contact: input.addAsTrustedContact ?? false,
        confirmation_token_hash: tokenHash,
        confirmation_token_expires_at: expiresAt,
        confirmed_at: null,
        unsubscribed_at: input.allowReinvite ? null : existing.unsubscribed_at,
        updated_at: now.toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      logger.error({ updateError, accountId }, 'Failed to update notification recipient');
      return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to invite recipient') };
    }

    await sendInviteEmail({
      recipientName: updated.name,
      recipientEmail: updated.email,
      accountId,
      token,
      client,
    });

    revalidatePath('/dashboard/privacy', 'page');
    return { success: true, data: mapRecipient(updated) };
  }

  const { data: inserted, error: insertError } = await client
    .from('ultaura_notification_recipients')
    .insert({
      account_id: accountId,
      name: input.name,
      email,
      phone_e164: input.phoneE164 ?? null,
      relationship: input.relationship ?? null,
      is_trusted_contact: input.addAsTrustedContact ?? false,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    logger.error({ insertError, accountId }, 'Failed to create notification recipient');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to invite recipient') };
  }

  const token = buildNotificationRecipientToken(inserted.id);
  const tokenHash = hashNotificationToken(token);

  const { data: updated, error: tokenError } = await client
    .from('ultaura_notification_recipients')
    .update({
      confirmation_token_hash: tokenHash,
      confirmation_token_expires_at: expiresAt,
      updated_at: now.toISOString(),
    })
    .eq('id', inserted.id)
    .select('*')
    .single();

  if (tokenError || !updated) {
    logger.error({ tokenError, accountId }, 'Failed to assign notification token');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to invite recipient') };
  }

  await sendInviteEmail({
    recipientName: updated.name,
    recipientEmail: updated.email,
    accountId,
    token,
    client,
  });

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: mapRecipient(updated) };
}

export async function removeNotificationRecipient(
  recipientId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerComponentClient();

  const { error } = await client
    .from('ultaura_notification_recipients')
    .delete()
    .eq('id', recipientId);

  if (error) {
    logger.error({ error, recipientId }, 'Failed to delete notification recipient');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove recipient') };
  }

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: undefined };
}

export async function confirmNotificationRecipient(
  token: string
): Promise<ActionResult<{ accountName: string }>> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const tokenHash = hashNotificationToken(token);

  const { data: recipient, error } = await adminClient
    .from('ultaura_notification_recipients')
    .update({ confirmed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('confirmation_token_hash', tokenHash)
    .gt('confirmation_token_expires_at', new Date().toISOString())
    .is('confirmed_at', null)
    .select('*')
    .single();

  if (error || !recipient) {
    return { success: false, error: createError(ErrorCodes.INVALID_INPUT, 'Invalid or expired token') };
  }

  const { data: account } = await adminClient
    .from('ultaura_accounts')
    .select('name')
    .eq('id', recipient.account_id)
    .single();

  if (recipient.is_trusted_contact && !recipient.trusted_contact_id && recipient.phone_e164) {
    await createTrustedContactFromRecipient(adminClient, recipient);
  }

  return { success: true, data: { accountName: account?.name ?? 'Ultaura' } };
}

export async function unsubscribeNotificationRecipient(
  token: string
): Promise<ActionResult<void>> {
  const adminClient = getSupabaseServerActionClient({ admin: true });
  const tokenHash = hashNotificationToken(token);

  const { error } = await adminClient
    .from('ultaura_notification_recipients')
    .update({ unsubscribed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('confirmation_token_hash', tokenHash);

  if (error) {
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to unsubscribe') };
  }

  return { success: true, data: undefined };
}

async function sendInviteEmail(options: {
  recipientName: string;
  recipientEmail: string;
  accountId: string;
  token: string;
  client?: SupabaseClient<Database>;
}) {
  const emailFrom = process.env.EMAIL_SENDER;
  if (!emailFrom) {
    throw new Error('Missing EMAIL_SENDER configuration');
  }

  const { accountName, lineName, inviterName } = await resolveAccountContext(
    options.accountId,
    options.client
  );
  const confirmLink = `${getSiteUrl()}/api/ultaura/confirm/${options.token}`;
  const subject = `You've been invited to receive updates from ${accountName}`;

  const { html, text } = renderNotificationInviteEmail({
    recipientName: options.recipientName,
    accountName,
    lineName,
    inviterName,
    confirmLink,
  });

  await sendEmail({
    from: emailFrom,
    to: options.recipientEmail,
    subject,
    html,
    text,
  });
}

async function createTrustedContactFromRecipient(
  adminClient: ReturnType<typeof getSupabaseServerActionClient>,
  recipient: any
): Promise<void> {
  const { data: lines } = await adminClient
    .from('ultaura_lines')
    .select('id, phone_verified_at, created_at')
    .eq('account_id', recipient.account_id)
    .order('created_at', { ascending: true });

  if (!lines || lines.length === 0) {
    return;
  }

  const targetLine = lines.find((line) => line.phone_verified_at) ?? lines[0];

  const { data: trustedContact, error } = await adminClient
    .from('ultaura_trusted_contacts')
    .insert({
      account_id: recipient.account_id,
      line_id: targetLine.id,
      name: recipient.name,
      phone_e164: recipient.phone_e164,
      relationship: recipient.relationship ?? null,
      notify_on: ['medium', 'high'],
      enabled: true,
    })
    .select('id')
    .single();

  if (error || !trustedContact) {
    logger.error({ error, recipientId: recipient.id }, 'Failed to create trusted contact from recipient');
    return;
  }

  await adminClient
    .from('ultaura_notification_recipients')
    .update({ trusted_contact_id: trustedContact.id, updated_at: new Date().toISOString() })
    .eq('id', recipient.id);

  const { data: existingConsent } = await adminClient
    .from('ultaura_consents')
    .select('id')
    .eq('line_id', targetLine.id)
    .eq('type', 'trusted_contact_notify')
    .eq('granted', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (!existingConsent) {
    await adminClient.from('ultaura_consents').insert({
      account_id: recipient.account_id,
      line_id: targetLine.id,
      type: 'trusted_contact_notify',
      granted: true,
      granted_by: 'payer_ack',
      evidence: {
        source: 'notification_invite',
        timestamp: new Date().toISOString(),
        contactName: recipient.name,
      },
    });
  }
}
