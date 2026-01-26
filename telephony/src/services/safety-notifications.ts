import { logger } from '../utils/logger.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { sendSms } from '../utils/twilio.js';
import { getInternalApiSecret } from '../utils/env.js';
import { enforceRateLimit } from './rate-limiter.js';
import {
  incrementNotificationsBlocked,
  incrementNotificationsSent,
} from './safety-metrics.js';

function getAppBaseUrl(): string {
  return (
    process.env.ULTAURA_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

function mapActionToDescription(action: string): string {
  switch (action) {
    case 'suggested_988':
      return 'We suggested calling the 988 crisis line';
    case 'suggested_911':
      return 'We suggested calling 911';
    default:
      return 'We provided support during the call';
  }
}

export async function notifyTrustedContacts(options: {
  accountId: string;
  callSessionId: string;
  lineId: string;
  tier: 'high';
  actionTaken: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  const { accountId, callSessionId, lineId, tier, actionTaken } = options;

  try {
    const { data: consent } = await supabase
      .from('ultaura_consents')
      .select('granted')
      .eq('line_id', lineId)
      .eq('type', 'trusted_contact_notify')
      .eq('granted', true)
      .is('revoked_at', null)
      .maybeSingle();

    if (!consent) {
      incrementNotificationsBlocked('no_consent');
      logger.info({ lineId }, 'No trusted contact consent found, skipping notification');
      return;
    }

    const { data: contacts } = await supabase
      .from('ultaura_trusted_contacts')
      .select('id, name, phone_e164, notify_on')
      .eq('line_id', lineId)
      .eq('enabled', true);

    if (!contacts || contacts.length === 0) {
      incrementNotificationsBlocked('no_contacts');
      logger.info({ lineId }, 'No enabled trusted contacts found');
      return;
    }

    const contactsToNotify = contacts.filter(
      (c) => c.notify_on && Array.isArray(c.notify_on) && c.notify_on.includes('high')
    );

    if (contactsToNotify.length === 0) {
      incrementNotificationsBlocked('no_contacts');
      logger.info({ lineId }, 'No contacts configured for high-tier notifications');
      return;
    }

    const { data: line } = await supabase
      .from('ultaura_lines')
      .select('display_name')
      .eq('id', lineId)
      .single();

    const lovedOneName = line?.display_name || 'Your loved one';
    let skippedCount = 0;

    for (const contact of contactsToNotify) {
      try {
        const rateLimitResult = await enforceRateLimit({
          action: 'sms',
          accountId,
          callSessionId,
          phoneNumber: contact.phone_e164,
        });

        if (!rateLimitResult.allowed) {
          incrementNotificationsBlocked('rate_limited');
          skippedCount++;
          logger.warn(
            { accountId, contactId: contact.id, limit: rateLimitResult.limitType },
            'SMS rate limit exceeded, skipping trusted contact notification'
          );
          continue;
        }

        const message = `Ultaura safety alert: ${lovedOneName} may need support. Action taken: ${actionTaken === 'suggested_988'
          ? 'Suggested calling 988 crisis line'
          : actionTaken === 'suggested_911'
            ? 'Suggested calling 911'
            : 'Provided support'
        }. Please check in with them.`;

        await sendSms({
          to: contact.phone_e164,
          body: message,
        });

        incrementNotificationsSent('sms', 'high');
        logger.info(
          { contactId: contact.id, lineId, tier },
          'Notified trusted contact of safety event'
        );
      } catch (smsError) {
        skippedCount++;
        logger.error(
          { error: smsError, contactId: contact.id, lineId },
          'Failed to send SMS to trusted contact'
        );
      }
    }

    if (skippedCount > 0) {
      logger.warn(
        { accountId, lineId, skippedCount },
        'Trusted contact notifications skipped'
      );
    }
  } catch (error) {
    logger.error({ error, lineId }, 'Error notifying trusted contacts');
  }
}

export async function notifyPayerSafetyEmail(options: {
  accountId: string;
  lineId: string;
  tier: 'high';
  actionTaken: string;
}): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: account } = await supabase
    .from('ultaura_accounts')
    .select('billing_email')
    .eq('id', options.accountId)
    .single();

  if (!account?.billing_email) {
    logger.warn({ accountId: options.accountId }, 'No billing email for safety alert');
    return;
  }

  const rateLimitResult = await enforceRateLimit({
    action: 'email',
    accountId: options.accountId,
  });

  if (!rateLimitResult.allowed) {
    incrementNotificationsBlocked('rate_limited');
    logger.warn(
      { accountId: options.accountId, limit: rateLimitResult.limitType },
      'Email rate limit exceeded, skipping safety notification'
    );
    return;
  }

  const actionDescription = mapActionToDescription(options.actionTaken);

  try {
    const response = await fetch(`${getAppBaseUrl()}/api/telephony/safety-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify({
        accountId: options.accountId,
        lineId: options.lineId,
        severity: options.tier,
        actionTaken: actionDescription,
        dashboardUrl: `${getAppBaseUrl()}/dashboard/alerts`,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      logger.error(
        { status: response.status, body, accountId: options.accountId },
        'Safety alert email failed'
      );
      return;
    }

    incrementNotificationsSent('email', 'high');
  } catch (error) {
    logger.error({ error, accountId: options.accountId }, 'Failed to send safety email to payer');
  }
}
