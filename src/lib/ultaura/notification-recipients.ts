'use server';

import { revalidatePath } from 'next/cache';
import getLogger from '~/core/logger';
import getSupabaseServerComponentClient from '~/core/supabase/server-component-client';
import getSupabaseServerActionClient from '~/core/supabase/action-client';
import { createError, ErrorCodes, type ActionResult } from '@ultaura/schemas';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/database.types';
import type { AlertDeliveryChannel, NotificationRecipient } from './types';
import sendEmail from '~/core/email/send-email';
import {
  getNotificationsEmailSender,
  getSupportReplyToEmail,
} from '~/core/email/senders';
import renderNotificationInviteEmail from '~/lib/emails/notification-invite';
import renderRecipientSmsVerificationEmail from '~/lib/emails/recipient-sms-verification';
import { getUserDataById } from '~/lib/server/queries';
import requireSession from '~/lib/user/require-session';
import {
  generateNotificationConfirmationToken,
  generateNotificationUnsubscribeToken,
  hashNotificationToken,
} from './notification-tokens';
import { revokeDashboardAccess } from './dashboard-sharing';
import { issueRecipientSmsVerificationAccessToken } from './recipient-sms-verification';
import { getSiteUrl } from '~/lib/server/route-html';

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
  | 'delivery_channel'
  | 'relationship'
  | 'is_trusted_contact'
  | 'sms_verified_at'
  | 'sms_consent_acknowledged_at'
  | 'sms_verify_access_token_hash'
  | 'sms_verify_access_token_expires_at'
  | 'sms_verify_last_sent_at'
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

function isRecipientLimitError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes(RECIPIENT_LIMIT_TRIGGER_ERROR));
}

function createMaxRecipientsError() {
  return createError(ErrorCodes.INVALID_INPUT, MAX_RECIPIENTS_ERROR_MESSAGE);
}

function createInviteFailedError() {
  return createError(ErrorCodes.DATABASE_ERROR, INVITE_FAILED_ERROR_MESSAGE);
}

async function resolveAccountContext(
  accountId: string,
  client?: SupabaseClient<Database>,
  lineIds?: string[],
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

  const accountName = account?.name || 'Ultaura';

  let lineName = 'your loved one';

  if (lineIds && lineIds.length > 0) {
    const { data: lines } = await clientInstance
      .from('ultaura_lines')
      .select('display_name')
      .in('id', lineIds)
      .order('created_at', { ascending: true });

    const names = (lines || []).map((l) => l.display_name).filter(Boolean);
    if (names.length === 1) {
      lineName = names[0];
    } else if (names.length === 2) {
      lineName = `${names[0]} and ${names[1]}`;
    } else if (names.length > 2) {
      lineName = `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
    }
  } else {
    const { data: lines } = await clientInstance
      .from('ultaura_lines')
      .select('display_name, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: true });

    lineName =
      lines?.length === 1
        ? lines[0].display_name
        : lines && lines.length > 1
          ? 'your loved ones'
          : 'your loved one';
  }

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
  dashboard_access_membership_id?: number | null;
  dashboard_access_user_id?: string | null;
  dashboard_access_invited_email?: string | null;
};

type NotificationRecipientRowWithSmsOptOut = NotificationRecipientRowWithDashboardAccess & {
  sms_opted_out?: boolean;
};

function normalizeRecipientName(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
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

function mapRecipient(
  row: NotificationRecipientRow,
  assignedLineIds: string[] = [],
): NotificationRecipient {
  const rowWithDashboardAccess = row as NotificationRecipientRowWithSmsOptOut;

  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    email: row.email,
    phoneE164: row.phone_e164,
    deliveryChannel: row.delivery_channel as AlertDeliveryChannel,
    smsVerifiedAt: row.sms_verified_at,
    smsConsentAcknowledgedAt: row.sms_consent_acknowledged_at,
    smsOptedOut: Boolean(rowWithDashboardAccess.sms_opted_out),
    relationship: row.relationship,
    isTrustedContact: row.is_trusted_contact,
    trustedContactId: row.trusted_contact_id,
    confirmedAt: row.confirmed_at,
    unsubscribedAt: row.unsubscribed_at,
    dashboardAccessGrantedAt: rowWithDashboardAccess.dashboard_access_granted_at ?? null,
    assignedLineIds,
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

  const rows = data || [];
  const phones = Array.from(
    new Set(rows.map((row) => row.phone_e164).filter((value): value is string => Boolean(value))),
  );

  const optedOutPhones = new Set<string>();
  if (phones.length > 0) {
    const { data: optOutRows, error: optOutError } = await client
      .from('ultaura_sms_opt_outs')
      .select('phone_e164')
      .in('phone_e164', phones);

    if (optOutError) {
      logger.error({ error: optOutError, accountId }, 'Failed to fetch recipient SMS opt-out states');
    } else {
      for (const row of optOutRows || []) {
        if (row.phone_e164) {
          optedOutPhones.add(row.phone_e164);
        }
      }
    }
  }

  // Load line assignments
  const recipientIds = rows.map((r) => r.id);
  const assignmentsByRecipient = new Map<string, string[]>();

  if (recipientIds.length > 0) {
    const { data: assignmentRows } = await client
      .from('ultaura_recipient_line_assignments')
      .select('recipient_id, line_id')
      .in('recipient_id', recipientIds);

    for (const row of assignmentRows || []) {
      const existing = assignmentsByRecipient.get(row.recipient_id) || [];
      existing.push(row.line_id);
      assignmentsByRecipient.set(row.recipient_id, existing);
    }
  }

  return rows.map((row) =>
    mapRecipient(
      { ...row, sms_opted_out: Boolean(row.phone_e164 && optedOutPhones.has(row.phone_e164)) } as NotificationRecipientRow,
      assignmentsByRecipient.get(row.id) || [],
    ),
  );
}

export async function updateRecipientLineAssignments(
  recipientId: string,
  lineIds: string[],
): Promise<ActionResult<{ assignedLineIds: string[] }>> {
  const client = getSupabaseServerActionClient();

  const { data: recipient, error: lookupError } = await client
    .from('ultaura_notification_recipients')
    .select('id, account_id')
    .eq('id', recipientId)
    .maybeSingle();

  if (lookupError || !recipient) {
    return { success: false, error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found') };
  }

  const auth = await requireAccountOwner(client, recipient.account_id);
  if (!auth.success) return { success: false, error: auth.error };

  if (lineIds.length === 0) {
    return { success: false, error: createError(ErrorCodes.INVALID_INPUT, 'At least one line must be selected') };
  }

  // Validate all lineIds belong to this account
  const { data: validLines } = await client
    .from('ultaura_lines')
    .select('id')
    .eq('account_id', recipient.account_id)
    .in('id', lineIds);

  const validLineIds = new Set((validLines || []).map((l) => l.id));
  if (lineIds.some((id) => !validLineIds.has(id))) {
    return { success: false, error: createError(ErrorCodes.INVALID_INPUT, 'One or more lines do not belong to this account') };
  }

  // Delete existing, insert new (safe because orphan trigger is on ultaura_lines, NOT the junction table)
  const adminClient = getSupabaseServerActionClient({ admin: true });

  await adminClient
    .from('ultaura_recipient_line_assignments')
    .delete()
    .eq('recipient_id', recipientId);

  const { error: insertError } = await adminClient
    .from('ultaura_recipient_line_assignments')
    .insert(lineIds.map((lineId) => ({ recipient_id: recipientId, line_id: lineId })));

  if (insertError) {
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update line assignments') };
  }

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: { assignedLineIds: lineIds } };
}

export async function inviteNotificationRecipient(
  accountId: string,
  input: {
    name: string;
    email: string;
    phoneE164?: string;
    deliveryChannel?: AlertDeliveryChannel;
    smsConsentAcknowledgedAt?: string | null;
    relationship?: string;
    addAsTrustedContact?: boolean;
    allowReinvite?: boolean;
    lineIds?: string[];
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

  if (!input.lineIds || input.lineIds.length === 0) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'At least one line must be selected'),
    };
  }

  // Validate all lineIds belong to this account (prevents cross-account injection via admin client)
  const { data: validLines } = await client
    .from('ultaura_lines')
    .select('id')
    .eq('account_id', accountId)
    .in('id', input.lineIds);

  const validLineIds = new Set((validLines || []).map((l) => l.id));
  if (input.lineIds.some((id) => !validLineIds.has(id))) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'One or more lines do not belong to this account'),
    };
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
  const deliveryChannel = normalizeDeliveryChannel(input.deliveryChannel);
  const phoneE164 = input.phoneE164 ?? null;
  const smsConsentAcknowledgedAt = input.smsConsentAcknowledgedAt ?? null;

  if ((deliveryChannel === 'sms' || deliveryChannel === 'both') && !phoneE164) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Phone number is required for SMS alerts'),
    };
  }

  if ((deliveryChannel === 'sms' || deliveryChannel === 'both') && !smsConsentAcknowledgedAt) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'SMS consent is required for SMS alerts'),
    };
  }

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
      delivery_channel: existing.delivery_channel,
      relationship: existing.relationship,
      is_trusted_contact: existing.is_trusted_contact,
      sms_verified_at: existing.sms_verified_at,
      sms_consent_acknowledged_at: existing.sms_consent_acknowledged_at,
      sms_verify_access_token_hash: existing.sms_verify_access_token_hash,
      sms_verify_access_token_expires_at: existing.sms_verify_access_token_expires_at,
      sms_verify_last_sent_at: existing.sms_verify_last_sent_at,
      confirmation_token_hash: existing.confirmation_token_hash,
      confirmation_token_expires_at: existing.confirmation_token_expires_at,
      unsubscribe_token_hash: existing.unsubscribe_token_hash,
      unsubscribe_token_expires_at: existing.unsubscribe_token_expires_at,
      confirmed_at: existing.confirmed_at,
      unsubscribed_at: existing.unsubscribed_at,
      updated_at: existing.updated_at,
    };

    const phoneChanged = (existing.phone_e164 ?? null) !== phoneE164;
    const deliveryChannelChanged = existing.delivery_channel !== deliveryChannel;
    const shouldResetSmsVerification = phoneChanged || deliveryChannelChanged;

    const { data: updated, error: updateError } = await client
      .from('ultaura_notification_recipients')
      .update({
        name,
        email,
        phone_e164: phoneE164,
        delivery_channel: deliveryChannel,
        relationship: input.relationship ?? null,
        is_trusted_contact: input.addAsTrustedContact ?? false,
        sms_consent_acknowledged_at: smsConsentAcknowledgedAt,
        sms_verified_at: shouldResetSmsVerification ? null : existing.sms_verified_at,
        sms_verify_access_token_hash: shouldResetSmsVerification
          ? null
          : existing.sms_verify_access_token_hash,
        sms_verify_access_token_expires_at: shouldResetSmsVerification
          ? null
          : existing.sms_verify_access_token_expires_at,
        sms_verify_last_sent_at: shouldResetSmsVerification
          ? null
          : existing.sms_verify_last_sent_at,
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

    // Replace line assignments
    if (input.lineIds && input.lineIds.length > 0) {
      const adminClient = getSupabaseServerActionClient({ admin: true });
      await adminClient.from('ultaura_recipient_line_assignments').delete().eq('recipient_id', existing.id);
      const { error: assignmentError } = await adminClient
        .from('ultaura_recipient_line_assignments')
        .insert(input.lineIds.map((lineId) => ({ recipient_id: existing.id, line_id: lineId })));

      if (assignmentError) {
        logger.error({ error: assignmentError, recipientId: existing.id }, 'Failed to create line assignments for reinvited recipient');
      }
    }

    try {
      await sendInviteEmail({
        recipientName: updated.name,
        recipientEmail: updated.email,
        accountId,
        token: tokenState.token,
        deliveryChannel,
        client,
        lineIds: input.lineIds,
      });
    } catch (error) {
      const rollbackResult = await rollbackNotificationInviteMutation(
        inviteContext,
        { client },
      );

      if (!rollbackResult.success) {
        logger.error(
          { rollbackError: rollbackResult.error, context: inviteContext },
          'Failed to rollback recipient update after invite email failure',
        );
      }

      logger.error(
        { error, recipientId: updated.id, accountId },
        'Failed to send invite email for existing recipient',
      );
      return {
        success: false,
        error: createError(
          ErrorCodes.EXTERNAL_SERVICE_ERROR,
          'We could not send the invite email. Please try again.',
        ),
      };
    }

    revalidatePath('/dashboard/privacy', 'page');
    return { success: true, data: mapRecipient(updated, input.lineIds ?? []) };
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
      phone_e164: phoneE164,
      delivery_channel: deliveryChannel,
      sms_consent_acknowledged_at: smsConsentAcknowledgedAt,
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

  // Create line assignments
  if (input.lineIds && input.lineIds.length > 0) {
    const adminClient = getSupabaseServerActionClient({ admin: true });
    const { error: assignmentError } = await adminClient
      .from('ultaura_recipient_line_assignments')
      .insert(input.lineIds.map((lineId) => ({ recipient_id: inserted.id, line_id: lineId })));

    if (assignmentError) {
      logger.error({ error: assignmentError, recipientId: inserted.id }, 'Failed to create line assignments for new recipient');
      await client.from('ultaura_notification_recipients').delete().eq('id', inserted.id);
      return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to assign lines') };
    }
  }

  try {
    await sendInviteEmail({
      recipientName: updated.name,
      recipientEmail: updated.email,
      accountId,
      token: tokenState.token,
      deliveryChannel,
      client,
      lineIds: input.lineIds,
    });
  } catch (error) {
    const rollbackResult = await rollbackNotificationInviteMutation(
      inviteContext,
      { client },
    );

    if (!rollbackResult.success) {
      logger.error(
        { rollbackError: rollbackResult.error, context: inviteContext },
        'Failed to rollback new recipient after invite email failure',
      );
    }

    logger.error(
      { error, recipientId: updated.id, accountId },
      'Failed to send invite email for new recipient',
    );
    return {
      success: false,
      error: createError(
        ErrorCodes.EXTERNAL_SERVICE_ERROR,
        'We could not send the invite email. Please try again.',
      ),
    };
  }

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: mapRecipient(updated, input.lineIds ?? []) };
}

async function sendRecipientSmsVerificationEmail(options: {
  recipientName: string;
  recipientEmail: string;
  accountId: string;
  verificationToken: string;
  client?: SupabaseClient<Database>;
}) {
  const emailFrom = getNotificationsEmailSender();
  const replyTo = getSupportReplyToEmail();
  const { accountName, inviterName } = await resolveAccountContext(
    options.accountId,
    options.client,
  );
  const siteUrl = getSiteUrl();
  const verifyLink = `${siteUrl}/ultaura/alerts/verify-phone/${options.verificationToken}`;
  const subject = `Verify your phone for Ultaura SMS alerts`;
  const { html, text } = renderRecipientSmsVerificationEmail({
    recipientName: options.recipientName,
    accountName,
    inviterName,
    verificationLink: verifyLink,
    baseUrl: siteUrl,
  });

  await sendEmail({
    from: emailFrom,
    to: options.recipientEmail,
    subject,
    html,
    text,
    replyTo,
  });
}

async function issueAndSendRecipientSmsVerificationLink(options: {
  recipient: NotificationRecipientRow;
  client: SupabaseClient<Database>;
}): Promise<ActionResult<void>> {
  const tokenResult = await issueRecipientSmsVerificationAccessToken(options.recipient.id, {
    client: options.client,
  });
  if (!tokenResult.success) {
    return { success: false, error: tokenResult.error };
  }

  try {
    await sendRecipientSmsVerificationEmail({
      recipientName: options.recipient.name,
      recipientEmail: options.recipient.email,
      accountId: options.recipient.account_id,
      verificationToken: tokenResult.data.token,
      client: options.client,
    });
  } catch (error) {
    logger.error(
      { error, recipientId: options.recipient.id },
      'Failed to send recipient SMS verification email',
    );
    return {
      success: false,
      error: createError(ErrorCodes.EXTERNAL_SERVICE_ERROR, 'Failed to send verification email'),
    };
  }

  return { success: true, data: undefined };
}

export async function updateNotificationRecipientDelivery(
  recipientId: string,
  input: {
    deliveryChannel: AlertDeliveryChannel;
    smsConsentAcknowledgedAt?: string | null;
  },
): Promise<ActionResult<NotificationRecipient>> {
  const client = getSupabaseServerActionClient();
  const { data: existing, error: lookupError } = await client
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('id', recipientId)
    .maybeSingle();

  if (lookupError) {
    logger.error({ error: lookupError, recipientId }, 'Failed to load notification recipient');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to load recipient'),
    };
  }

  if (!existing) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found'),
    };
  }

  const auth = await requireAccountOwner(client, existing.account_id);
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  const deliveryChannel = normalizeDeliveryChannel(input.deliveryChannel);
  const requiresSms = deliveryChannel === 'sms' || deliveryChannel === 'both';
  const nowIso = new Date().toISOString();

  if (requiresSms && !existing.phone_e164) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Phone number is required for SMS alerts'),
    };
  }

  const smsConsentAcknowledgedAt =
    requiresSms
      ? input.smsConsentAcknowledgedAt ?? existing.sms_consent_acknowledged_at ?? null
      : null;

  if (requiresSms && !smsConsentAcknowledgedAt) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'SMS consent is required for SMS alerts'),
    };
  }

  const shouldResetSmsVerification =
    requiresSms && existing.delivery_channel === 'email';

  const { data: updated, error: updateError } = await client
    .from('ultaura_notification_recipients')
    .update({
      delivery_channel: deliveryChannel,
      sms_consent_acknowledged_at: smsConsentAcknowledgedAt,
      sms_verified_at: requiresSms
        ? shouldResetSmsVerification
          ? null
          : existing.sms_verified_at
        : null,
      sms_verify_access_token_hash: requiresSms
        ? shouldResetSmsVerification
          ? null
          : existing.sms_verify_access_token_hash
        : null,
      sms_verify_access_token_expires_at: requiresSms
        ? shouldResetSmsVerification
          ? null
          : existing.sms_verify_access_token_expires_at
        : null,
      sms_verify_last_sent_at: requiresSms
        ? shouldResetSmsVerification
          ? null
          : existing.sms_verify_last_sent_at
        : null,
      updated_at: nowIso,
    })
    .eq('id', recipientId)
    .select('*')
    .single();

  if (updateError || !updated) {
    logger.error({ error: updateError, recipientId }, 'Failed to update notification recipient delivery');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to update recipient delivery'),
    };
  }

  if (
    updated.confirmed_at &&
    requiresSms &&
    !updated.sms_verified_at &&
    updated.phone_e164 &&
    shouldResetSmsVerification
  ) {
    const sendResult = await issueAndSendRecipientSmsVerificationLink({
      recipient: updated,
      client,
    });
    if (!sendResult.success) {
      await client
        .from('ultaura_notification_recipients')
        .update({
          delivery_channel: existing.delivery_channel,
          sms_consent_acknowledged_at: existing.sms_consent_acknowledged_at,
          sms_verified_at: existing.sms_verified_at,
          sms_verify_access_token_hash: existing.sms_verify_access_token_hash,
          sms_verify_access_token_expires_at:
            existing.sms_verify_access_token_expires_at,
          sms_verify_last_sent_at: existing.sms_verify_last_sent_at,
          updated_at: existing.updated_at,
        })
        .eq('id', recipientId);

      return { success: false, error: sendResult.error };
    }
  }

  // Load current line assignments so the returned object has accurate assignedLineIds
  const { data: currentAssignments } = await client
    .from('ultaura_recipient_line_assignments')
    .select('line_id')
    .eq('recipient_id', recipientId);
  const currentLineIds = (currentAssignments || []).map((r) => r.line_id);

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: mapRecipient(updated, currentLineIds) };
}

export async function resendRecipientSmsVerificationLink(
  recipientId: string,
): Promise<ActionResult<void>> {
  const client = getSupabaseServerActionClient();
  const { data: recipient, error: lookupError } = await client
    .from('ultaura_notification_recipients')
    .select('*')
    .eq('id', recipientId)
    .maybeSingle();

  if (lookupError) {
    logger.error({ error: lookupError, recipientId }, 'Failed to load recipient for SMS verification resend');
    return {
      success: false,
      error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to load recipient'),
    };
  }

  if (!recipient) {
    return {
      success: false,
      error: createError(ErrorCodes.NOT_FOUND, 'Recipient not found'),
    };
  }

  const auth = await requireAccountOwner(client, recipient.account_id);
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  if (!recipient.confirmed_at) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Recipient must confirm their invite first'),
    };
  }

  if (recipient.unsubscribed_at) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Recipient has unsubscribed'),
    };
  }

  if (recipient.delivery_channel !== 'sms' && recipient.delivery_channel !== 'both') {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Recipient is not configured for SMS alerts'),
    };
  }

  if (!recipient.phone_e164) {
    return {
      success: false,
      error: createError(ErrorCodes.INVALID_INPUT, 'Recipient is missing a phone number'),
    };
  }

  if (recipient.sms_verified_at) {
    return { success: true, data: undefined };
  }

  const sendResult = await issueAndSendRecipientSmsVerificationLink({
    recipient,
    client,
  });
  if (!sendResult.success) {
    return { success: false, error: sendResult.error };
  }

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: undefined };
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
    .select('*')
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

  const recipientWithSharing = recipient as NotificationRecipientRowWithDashboardAccess;
  if (recipientWithSharing.dashboard_access_granted_at) {
    const revokeResult = await revokeDashboardAccess(recipient.account_id, recipientId);
    if (!revokeResult.success) {
      logger.error(
        {
          recipientId,
          accountId: recipient.account_id,
          cleanupError: revokeResult.error,
        },
        'Failed to revoke dashboard access before removing notification recipient'
      );
      return {
        success: false,
        error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove recipient dashboard access'),
      };
    }
  }

  const { data: deletedRecipient, error } = await client
    .from('ultaura_notification_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('account_id', recipient.account_id)
    .is('dashboard_access_granted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    logger.error({ error, recipientId }, 'Failed to delete notification recipient');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove recipient') };
  }

  if (!deletedRecipient) {
    logger.error({ recipientId, accountId: recipient.account_id }, 'Recipient removal lost delete race');
    return { success: false, error: createError(ErrorCodes.DATABASE_ERROR, 'Failed to remove recipient') };
  }

  revalidatePath('/dashboard/privacy', 'page');
  return { success: true, data: undefined };
}

export async function confirmNotificationRecipient(
  token: string
): Promise<ActionResult<{ accountName: string; smsVerificationToken: string | null }>> {
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

  const shouldIssueSmsVerificationToken =
    (recipient.delivery_channel === 'sms' || recipient.delivery_channel === 'both') &&
    Boolean(recipient.phone_e164);

  if (!shouldIssueSmsVerificationToken) {
    return {
      success: true,
      data: {
        accountName: account?.name ?? 'Ultaura',
        smsVerificationToken: null,
      },
    };
  }

  const tokenResult = await issueRecipientSmsVerificationAccessToken(recipient.id, {
    client: adminClient,
  });
  if (!tokenResult.success) {
    return {
      success: false,
      error: createError(
        ErrorCodes.DATABASE_ERROR,
        'Failed to prepare phone verification'
      ),
    };
  }

  return {
    success: true,
    data: {
      accountName: account?.name ?? 'Ultaura',
      smsVerificationToken: tokenResult.data.token,
    },
  };
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
  deliveryChannel: AlertDeliveryChannel;
  client?: SupabaseClient<Database>;
  lineIds?: string[];
}) {
  const emailFrom = getNotificationsEmailSender();
  const replyTo = getSupportReplyToEmail();

  const { accountName, lineName, inviterName } = await resolveAccountContext(
    options.accountId,
    options.client,
    options.lineIds,
  );
  const siteUrl = getSiteUrl();
  const confirmLink = `${siteUrl}/api/ultaura/confirm/${options.token}`;
  const subject = `You've been invited to receive updates from ${accountName}`;

  const { html, text } = renderNotificationInviteEmail({
    recipientName: options.recipientName,
    accountName,
    lineName,
    inviterName,
    confirmLink,
    deliveryChannel: options.deliveryChannel,
    baseUrl: siteUrl,
  });

  await sendEmail({
    from: emailFrom,
    to: options.recipientEmail,
    subject,
    html,
    text,
    replyTo,
  });
}
