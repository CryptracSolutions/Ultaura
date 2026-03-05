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
import requireSession from '~/lib/user/require-session';
import {
  generateNotificationConfirmationToken,
  generateNotificationUnsubscribeToken,
  hashNotificationToken,
} from './notification-tokens';
import { deleteViewerMembershipForRecipient } from './dashboard-sharing';

const logger = getLogger();
const MAX_NOTIFICATION_RECIPIENTS = 5;
const MAX_RECIPIENTS_ERROR_MESSAGE =
  'Maximum of 5 recipients reached. Remove one before inviting another.';
const RECIPIENT_LIMIT_TRIGGER_ERROR = 'Maximum of 5 notification recipients';
const INVITE_FAILED_ERROR_MESSAGE = 'Failed to invite recipient';
const TOKEN_INVALID_ERROR_MESSAGE = 'Invalid or expired token';
const TOKEN_ALREADY_USED_ERROR_MESSAGE = 'This link has already been used';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSUBSCRIBE_INVALID_ERROR_MESSAGE = 'This unsubscribe link is invalid or has expired.';

type InviteRollbackSnapshot = Pick<
  Database['public']['Tables']['ultaura_notification_recipients']['Row'],
  | 'name'
  | 'email'
  | 'phone_e164'
  | 'relationship'
  | 'is_trusted_contact'
  | 'confirmation_token_hash'
  | 'confirmation_token_expires_at'
  | 'unsubscribe_token_hash'
  | 'unsubscribe_token_expires_at'
  | 'confirmed_at'
  | 'unsubscribed_at'
  | 'updated_at'
>;

type InviteMutationContext = {
  accountId: string;
  recipientId: string;
  mutationType: 'insert' | 'update';
  rollbackSnapshot?: InviteRollbackSnapshot;
};

type InviteSendError = Error & {
  code: 'INVITE_SEND_FAILED';
  context: InviteMutationContext;
};

function createInviteSendError(context: InviteMutationContext): InviteSendError {
  const error = new Error('Failed to send invite email') as InviteSendError;
  error.name = 'NotificationInviteSendError';
  error.code = 'INVITE_SEND_FAILED';
  error.context = context;
  return error;
}

function isRecipientLimitError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes(RECIPIENT_LIMIT_TRIGGER_ERROR));
}

function createMaxRecipientsError() {
  return createError(ErrorCodes.INVALID_INPUT, MAX_RECIPIENTS_ERROR_MESSAGE);
}

function createInviteFailedError() {
  return createError(ErrorCodes.DATABASE_ERROR, INVITE_FAILED_ERROR_MESSAGE);
}

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
  const lineName = lines?.length === 1 ? lines[0].display_name : 'your loved one';

  const { data: user } = await clientInstance.auth.getUser();
  const userId = user.user?.id;
  let inviterName = 'Ultaura';

  if (userId) {
    const userRecord = await getUserDataById(clientInstance, userId).catch(() => null);
    inviterName = userRecord?.displayName?.trim() || accountName;
  }

  return { accountName, lineName, inviterName };
}

type NotificationRecipientRow =
  Database['public']['Tables']['ultaura_notification_recipients']['Row'];
type NotificationRecipientRowWithDashboardAccess = NotificationRecipientRow & {
  dashboard_access_granted_at?: string | null;
};

function normalizeRecipientName(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

  const { data: account, error: accountError } = await client
    .from('ultaura_accounts')
    .select('id')
    .eq('id', accountId)
    .eq('created_by_user_id', userId)
    .maybeSingle();

  if (accountError || !account) {
    return { success: false, error: createError(ErrorCodes.FORBIDDEN, 'Access denied') };
  }

  return { success: true, data: { userId } };
}

function mapRecipient(row: NotificationRecipientRow): NotificationRecipient {
  const rowWithDashboardAccess = row as NotificationRecipientRowWithDashboardAccess;

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
    dashboardAccessGrantedAt: rowWithDashboardAccess.dashboard_access_granted_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getActiveRecipientCount(
  accountId: string,
  client: SupabaseClient<Database>
): Promise<{ count: number | null; error: boolean }> {
  const { count, error } = await client
    .from('ultaura_notification_recipients')
    .select('id', { head: true, count: 'exact' })
    .eq('account_id', accountId)
    .is('unsubscribed_at', null);

  if (error) {
    logger.error({ error, accountId }, 'Failed to count active recipients');
    return { count: null, error: true };
  }

  return { count: count ?? 0, error: false };
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
  const client = options.client ?? getSupabaseServerActionClient();
  const auth = await requireAccountOwner(client, accountId);
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  const name = normalizeRecipientName(input.name);
  const email = input.email.trim().toLowerCase();
  if (!name || name.length > 120) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        'Name is required and must be 120 characters or fewer'
      ),
    };
  }
  if (!email || email.length > 254 || !EMAIL_REGEX.test(email)) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        'Enter a valid email address'
      ),
    };
  }
  const nowIso = new Date().toISOString();

  const { data: existing, error: existingError } = await client
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('account_id', accountId)
    .eq('email', email)
    .maybeSingle();

  if (existingError) {
    logger.error({ existingError, accountId }, 'Failed to check existing recipient');
    return { success: false, error: createInviteFailedError() };
  }

  let inviteContext: InviteMutationContext | null = null;

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

    if (existing.unsubscribed_at && input.allowReinvite) {
      const { count, error: countError } = await getActiveRecipientCount(
        accountId,
        client
      );
      if (countError) {
        return { success: false, error: createInviteFailedError() };
      }
      if ((count ?? 0) >= MAX_NOTIFICATION_RECIPIENTS) {
        return {
          success: false,
          error: createMaxRecipientsError(),
        };
      }
    }

    const tokenState = generateNotificationConfirmationToken({ ttlDays: 7 });

    const rollbackSnapshot: InviteRollbackSnapshot = {
      name: existing.name,
      email: existing.email,
      phone_e164: existing.phone_e164,
      relationship: existing.relationship,
      is_trusted_contact: existing.is_trusted_contact,
      confirmation_token_hash: existing.confirmation_token_hash,
      confirmation_token_expires_at: existing.confirmation_token_expires_at,
      unsubscribe_token_hash: existing.unsubscribe_token_hash,
      unsubscribe_token_expires_at: existing.unsubscribe_token_expires_at,
      confirmed_at: existing.confirmed_at,
      unsubscribed_at: existing.unsubscribed_at,
      updated_at: existing.updated_at,
    };

    const { data: updated, error: updateError } = await client
      .from('ultaura_notification_recipients')
      .update({
        name,
        email,
        phone_e164: input.phoneE164 ?? null,
        relationship: input.relationship ?? null,
        is_trusted_contact: input.addAsTrustedContact ?? false,
        confirmation_token_hash: tokenState.tokenHash,
        confirmation_token_expires_at: tokenState.expiresAt,
        unsubscribe_token_hash: input.allowReinvite ? null : existing.unsubscribe_token_hash,
        unsubscribe_token_expires_at: input.allowReinvite
          ? null
          : existing.unsubscribe_token_expires_at,
        confirmed_at: null,
        unsubscribed_at: input.allowReinvite ? null : existing.unsubscribed_at,
        updated_at: nowIso,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (updateError || !updated) {
      if (isRecipientLimitError(updateError)) {
        return {
          success: false,
          error: createMaxRecipientsError(),
        };
      }
      logger.error({ updateError, accountId }, 'Failed to update notification recipient');
      return { success: false, error: createInviteFailedError() };
    }

    inviteContext = {
      accountId,
      recipientId: updated.id,
      mutationType: 'update',
      rollbackSnapshot,
    };

    try {
      await sendInviteEmail({
        recipientName: updated.name,
        recipientEmail: updated.email,
        accountId,
        token: tokenState.token,
        client,
      });
    } catch (error) {
      throw createInviteSendError(inviteContext);
    }

    revalidatePath('/dashboard/privacy', 'page');
    return { success: true, data: mapRecipient(updated) };
  }

  const { count: activeRecipientCount, error: countError } =
    await getActiveRecipientCount(accountId, client);
  if (countError) {
    return { success: false, error: createInviteFailedError() };
  }
  if ((activeRecipientCount ?? 0) >= MAX_NOTIFICATION_RECIPIENTS) {
    return {
      success: false,
      error: createMaxRecipientsError(),
    };
  }

  const { data: inserted, error: insertError } = await client
    .from('ultaura_notification_recipients')
    .insert({
      account_id: accountId,
      name,
      email,
      phone_e164: input.phoneE164 ?? null,
      relationship: input.relationship ?? null,
      is_trusted_contact: input.addAsTrustedContact ?? false,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    if (isRecipientLimitError(insertError)) {
      return {
        success: false,
        error: createMaxRecipientsError(),
      };
    }
    logger.error({ insertError, accountId }, 'Failed to create notification recipient');
    return { success: false, error: createInviteFailedError() };
  }

  const tokenState = generateNotificationConfirmationToken({ ttlDays: 7 });

  const { data: updated, error: tokenError } = await client
    .from('ultaura_notification_recipients')
    .update({
      confirmation_token_hash: tokenState.tokenHash,
      confirmation_token_expires_at: tokenState.expiresAt,
      updated_at: nowIso,
    })
    .eq('id', inserted.id)
    .select('*')
    .single();

  if (tokenError || !updated) {
    logger.error({ tokenError, accountId }, 'Failed to assign notification token');
    return { success: false, error: createInviteFailedError() };
  }

  inviteContext = {
    accountId,
    recipientId: updated.id,
    mutationType: 'insert',
  };

  try {
    await sendInviteEmail({
      recipientName: updated.name,
      recipientEmail: updated.email,
      accountId,
      token: tokenState.token,
      client,
    });
  } catch (error) {
    throw createInviteSendError(inviteContext);
  }

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: mapRecipient(updated) };
}

export async function rollbackNotificationInviteMutation(
  context: InviteMutationContext,
  options: {
    client?: SupabaseClient<Database>;
  } = {}
): Promise<ActionResult<void>> {
  const client = options.client ?? getSupabaseServerActionClient({ admin: true });

  if (context.mutationType === 'insert') {
    const { error } = await client
      .from('ultaura_notification_recipients')
      .delete()
      .eq('id', context.recipientId)
      .eq('account_id', context.accountId);

    if (error) {
      logger.error({ error, context }, 'Failed to rollback inserted notification recipient');
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to rollback invite state'),
      };
    }

    return { success: true, data: undefined };
  }

  if (!context.rollbackSnapshot) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Missing rollback snapshot'),
    };
  }

  const { error } = await client
    .from('ultaura_notification_recipients')
    .update(context.rollbackSnapshot)
    .eq('id', context.recipientId)
    .eq('account_id', context.accountId);

  if (error) {
    logger.error({ error, context }, 'Failed to rollback updated notification recipient');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to rollback invite state'),
    };
  }

  return { success: true, data: undefined };
}

export async function removeNotificationRecipient(
  recipientId: string
): Promise<ActionResult<void>> {
  const client = getSupabaseServerActionClient();
  const { data: recipient, error: lookupError } = await client
    .from('ultaura_notification_recipients')
    .select('id, account_id, email')
    .eq('id', recipientId)
    .maybeSingle();

  if (lookupError) {
    logger.error({ lookupError, recipientId }, 'Failed to verify recipient ownership');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove recipient') };
  }

  if (!recipient) {
    return { success: false, error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found') };
  }

  const auth = await requireAccountOwner(client, recipient.account_id);
  if (!auth.success) {
    return { success: false, error: createError(ErrorCodes.FORBIDDEN, 'Failed to remove recipient') };
  }

  if (recipient.email) {
    const membershipCleanup = await deleteViewerMembershipForRecipient(
      recipient.account_id,
      recipient.email
    );

    if (!membershipCleanup.success) {
      logger.error(
        {
          recipientId,
          accountId: recipient.account_id,
          recipientEmail: recipient.email,
          cleanupError: membershipCleanup.error,
        },
        'Failed membership cleanup while removing notification recipient'
      );
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove recipient dashboard access'),
      };
    }
  }

  const { error } = await client
    .from('ultaura_notification_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('account_id', recipient.account_id);

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
  const unsubscribeTokenState = generateNotificationUnsubscribeToken({ ttlDays: 14 });
  const nowIso = new Date().toISOString();

  const { data: existing, error: existingError } = await adminClient
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('confirmation_token_hash', tokenHash)
    .maybeSingle();

  if (existingError || !existing) {
    return { success: false, error: createError(ErrorCodes.INVALID_INPUT, TOKEN_INVALID_ERROR_MESSAGE) };
  }

  if (
    !existing.confirmation_token_expires_at ||
    new Date(existing.confirmation_token_expires_at).getTime() <= Date.now()
  ) {
    return { success: false, error: createError(ErrorCodes.INVALID_INPUT, TOKEN_INVALID_ERROR_MESSAGE) };
  }

  if (existing.confirmed_at) {
    return {
      success: false,
      error: createError(ErrorCodes.ALREADY_EXISTS, TOKEN_ALREADY_USED_ERROR_MESSAGE),
    };
  }

  const { data: recipient, error } = await adminClient
    .from('ultaura_notification_recipients')
    .update({
      confirmed_at: nowIso,
      confirmation_token_hash: null,
      confirmation_token_expires_at: null,
      unsubscribe_token_hash: unsubscribeTokenState.tokenHash,
      unsubscribe_token_expires_at: unsubscribeTokenState.expiresAt,
      updated_at: nowIso,
    })
    .eq('id', existing.id)
    .eq('confirmation_token_hash', tokenHash)
    .gt('confirmation_token_expires_at', nowIso)
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
  const nowIso = new Date().toISOString();

  const { data: existing, error: existingError } = await adminClient
    .from('ultaura_notification_recipients')
    .select('id, unsubscribe_token_expires_at, unsubscribed_at')
    .eq('unsubscribe_token_hash', tokenHash)
    .maybeSingle();

  if (existingError || !existing) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, UNSUBSCRIBE_INVALID_ERROR_MESSAGE),
    };
  }

  if (
    !existing.unsubscribe_token_expires_at ||
    new Date(existing.unsubscribe_token_expires_at).getTime() <= Date.now()
  ) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, UNSUBSCRIBE_INVALID_ERROR_MESSAGE),
    };
  }

  if (existing.unsubscribed_at) {
    return { success: true, data: undefined };
  }

  const { data: updated, error } = await adminClient
    .from('ultaura_notification_recipients')
    .update({
      unsubscribed_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', existing.id)
    .eq('unsubscribe_token_hash', tokenHash)
    .is('unsubscribed_at', null)
    .gt('unsubscribe_token_expires_at', nowIso)
    .select('id')
    .maybeSingle();

  if (error) {
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to unsubscribe') };
  }

  if (!updated) {
    const { data: retryExisting, error: retryError } = await adminClient
      .from('ultaura_notification_recipients')
      .select('id, unsubscribed_at')
      .eq('unsubscribe_token_hash', tokenHash)
      .maybeSingle();

    if (!retryError && retryExisting?.unsubscribed_at) {
      return { success: true, data: undefined };
    }

    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, UNSUBSCRIBE_INVALID_ERROR_MESSAGE),
    };
  }

  return { success: true, data: undefined };
}

export async function issueNotificationRecipientUnsubscribeToken(
  recipientId: string,
  options: {
    client?: SupabaseClient<Database>;
    ttlDays?: number;
  } = {}
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  const client = options.client ?? getSupabaseServerActionClient({ admin: true });
  const tokenState = generateNotificationUnsubscribeToken({
    ttlDays: options.ttlDays ?? 14,
  });
  const nowIso = new Date().toISOString();

  const { data: updated, error } = await client
    .from('ultaura_notification_recipients')
    .update({
      unsubscribe_token_hash: tokenState.tokenHash,
      unsubscribe_token_expires_at: tokenState.expiresAt,
      updated_at: nowIso,
    })
    .eq('id', recipientId)
    .is('unsubscribed_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error({ error, recipientId }, 'Failed to persist unsubscribe token');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to issue unsubscribe token'),
    };
  }

  if (!updated) {
    return {
      success: false,
      error: createError(
        ErrorCodes.INVALID_INPUT,
        'Recipient not found or already unsubscribed'
      ),
    };
  }

  return {
    success: true,
    data: {
      token: tokenState.token,
      expiresAt: tokenState.expiresAt,
    },
  };
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
  recipient: NotificationRecipientRow
): Promise<void> {
  const phoneE164 = recipient.phone_e164;
  if (!phoneE164) {
    return;
  }

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
      phone_e164: phoneE164,
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

  const nowIso = new Date().toISOString();

  const { error: linkBackError } = await adminClient
    .from('ultaura_notification_recipients')
    .update({ trusted_contact_id: trustedContact.id, updated_at: nowIso })
    .eq('id', recipient.id);

  if (linkBackError) {
    logger.error(
      { error: linkBackError, recipientId: recipient.id, trustedContactId: trustedContact.id },
      'Failed to link recipient to trusted contact'
    );
    return;
  }

  const { data: existingConsent, error: existingConsentError } = await adminClient
    .from('ultaura_consents')
    .select('id')
    .eq('line_id', targetLine.id)
    .eq('type', 'trusted_contact_notify')
    .eq('granted', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (existingConsentError) {
    logger.error(
      { error: existingConsentError, recipientId: recipient.id, lineId: targetLine.id },
      'Failed to verify existing trusted contact consent'
    );
    return;
  }

  if (!existingConsent) {
    const { error: consentInsertError } = await adminClient.from('ultaura_consents').insert({
      account_id: recipient.account_id,
      line_id: targetLine.id,
      type: 'trusted_contact_notify',
      granted: true,
      granted_by: 'payer_ack',
      evidence: {
        source: 'notification_invite',
        timestamp: nowIso,
        contactName: recipient.name,
      },
    });

    if (consentInsertError) {
      logger.error(
        { error: consentInsertError, recipientId: recipient.id, lineId: targetLine.id },
        'Failed to grant trusted contact consent from recipient confirmation'
      );
      return;
    }
  }
}
