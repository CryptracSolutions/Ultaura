import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '~/database.types';
import type { AlertDeliveryChannel } from './types';
import { issueNotificationRecipientUnsubscribeToken } from './notification-recipients';

type RecipientRow = Pick<
  Database['public']['Tables']['ultaura_notification_recipients']['Row'],
  | 'id'
  | 'email'
  | 'phone_e164'
  | 'delivery_channel'
  | 'sms_verified_at'
  | 'dashboard_access_granted_at'
>;

type AlertDeliveryRow = Pick<
  Database['public']['Tables']['ultaura_account_alert_delivery']['Row'],
  'delivery_channel'
>;

type AccountRow = Pick<
  Database['public']['Tables']['ultaura_accounts']['Row'],
  'id' | 'billing_email' | 'created_by_user_id'
>;

type AuthAdminUser = {
  user: {
    phone?: string | null;
    phone_confirmed_at?: string | null;
  } | null;
};

export type EmailDestination = {
  email: string;
  isPrimary: boolean;
  hasDashboardAccess: boolean;
  unsubscribeToken?: string;
};

export type SmsDestination = {
  phoneE164: string;
  source: 'owner' | 'recipient' | 'trusted_contact';
};

type ResolveFamilyDestinationArgs = {
  supabase: SupabaseClient<Database>;
  account: AccountRow;
  includeOwner: boolean;
  includeRecipients: boolean;
};

const SMS_OPTED_OUT_STATUS = 'opted_out';

function normalizeChannel(value: string | null | undefined): AlertDeliveryChannel {
  if (value === 'sms' || value === 'both') {
    return value;
  }

  return 'email';
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, '');
}

async function isPhoneSmsOptedOut(
  supabase: SupabaseClient<Database>,
  phoneE164: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('ultaura_sms_opt_outs')
    .select('phone_e164')
    .eq('phone_e164', phoneE164)
    .maybeSingle();

  return Boolean(data);
}

async function loadOwnerPhone(
  supabase: SupabaseClient<Database>,
  account: AccountRow,
): Promise<{ phone: string | null; verified: boolean }> {
  if (!account.created_by_user_id) {
    return { phone: null, verified: false };
  }

  try {
    const response = await supabase.auth.admin.getUserById(account.created_by_user_id);
    const authUser = response.data as AuthAdminUser;
    const phone = authUser.user?.phone?.trim() || null;
    const verified = Boolean(authUser.user?.phone_confirmed_at);

    return { phone, verified };
  } catch {
    return { phone: null, verified: false };
  }
}

async function loadOwnerDeliveryChannel(
  supabase: SupabaseClient<Database>,
  accountId: string,
): Promise<AlertDeliveryChannel> {
  const { data } = await supabase
    .from('ultaura_account_alert_delivery')
    .select('delivery_channel')
    .eq('account_id', accountId)
    .maybeSingle();

  return normalizeChannel((data as AlertDeliveryRow | null)?.delivery_channel);
}

export async function resolveFamilyAlertDestinations(
  args: ResolveFamilyDestinationArgs,
): Promise<{ emails: EmailDestination[]; sms: SmsDestination[] }> {
  const { supabase, account, includeOwner, includeRecipients } = args;
  const emailMap = new Map<string, EmailDestination>();
  const smsMap = new Map<string, SmsDestination>();

  if (includeOwner) {
    const ownerChannel = await loadOwnerDeliveryChannel(supabase, account.id);
    const ownerEmail = normalizeEmail(account.billing_email);

    if (ownerChannel === 'email' || ownerChannel === 'both') {
      emailMap.set(ownerEmail, {
        email: ownerEmail,
        isPrimary: true,
        hasDashboardAccess: true,
      });
    }

    if (ownerChannel === 'sms' || ownerChannel === 'both') {
      const ownerPhone = await loadOwnerPhone(supabase, account);
      if (ownerPhone.phone && ownerPhone.verified) {
        const optedOut = await isPhoneSmsOptedOut(supabase, ownerPhone.phone);
        if (!optedOut) {
          smsMap.set(normalizePhone(ownerPhone.phone), {
            phoneE164: ownerPhone.phone,
            source: 'owner',
          });
        }
      }
    }
  }

  if (includeRecipients) {
    const { data: recipientRows } = await supabase
      .from('ultaura_notification_recipients')
      .select(
        'id, email, phone_e164, delivery_channel, sms_verified_at, dashboard_access_granted_at',
      )
      .eq('account_id', account.id)
      .not('confirmed_at', 'is', null)
      .is('unsubscribed_at', null);

    for (const row of (recipientRows || []) as RecipientRow[]) {
      const channel = normalizeChannel(row.delivery_channel);
      const email = normalizeEmail(row.email);

      if (channel === 'email' || channel === 'both') {
        if (!emailMap.has(email)) {
          const tokenResult = await issueNotificationRecipientUnsubscribeToken(row.id, {
            client: supabase,
          });

          if (tokenResult.success) {
            emailMap.set(email, {
              email,
              isPrimary: false,
              unsubscribeToken: tokenResult.data.token,
              hasDashboardAccess: Boolean(row.dashboard_access_granted_at),
            });
          }
        }
      }

      if ((channel === 'sms' || channel === 'both') && row.phone_e164 && row.sms_verified_at) {
        const optedOut = await isPhoneSmsOptedOut(supabase, row.phone_e164);
        if (!optedOut) {
          const key = normalizePhone(row.phone_e164);
          if (!smsMap.has(key)) {
            smsMap.set(key, {
              phoneE164: row.phone_e164,
              source: 'recipient',
            });
          }
        }
      }
    }
  }

  return {
    emails: Array.from(emailMap.values()),
    sms: Array.from(smsMap.values()),
  };
}

type TrustedContactRow = {
  id: string;
  phone_e164: string;
  notify_on: string[] | null;
};

export async function appendTrustedContactSmsDestinations(args: {
  supabase: SupabaseClient<Database>;
  lineId: string;
  sms: SmsDestination[];
}): Promise<SmsDestination[]> {
  const { supabase, lineId, sms } = args;
  const smsMap = new Map<string, SmsDestination>(
    sms.map((item) => [normalizePhone(item.phoneE164), item]),
  );

  const { data: consent } = await supabase
    .from('ultaura_consents')
    .select('granted')
    .eq('line_id', lineId)
    .eq('type', 'trusted_contact_notify')
    .eq('granted', true)
    .is('revoked_at', null)
    .maybeSingle();

  if (!consent) {
    return Array.from(smsMap.values());
  }

  const { data: contacts } = await supabase
    .from('ultaura_trusted_contacts')
    .select('id, phone_e164, notify_on')
    .eq('line_id', lineId)
    .eq('enabled', true);

  for (const contact of (contacts || []) as TrustedContactRow[]) {
    if (!contact.phone_e164) {
      continue;
    }

    if (!Array.isArray(contact.notify_on) || !contact.notify_on.includes('high')) {
      continue;
    }

    const optedOut = await isPhoneSmsOptedOut(supabase, contact.phone_e164);
    if (optedOut) {
      continue;
    }

    const key = normalizePhone(contact.phone_e164);
    if (!smsMap.has(key)) {
      smsMap.set(key, {
        phoneE164: contact.phone_e164,
        source: 'trusted_contact',
      });
    }
  }

  return Array.from(smsMap.values());
}

type AlertSmsRequest = {
  accountId: string;
  lineId: string;
  callSessionId?: string;
  phoneNumber: string;
  body: string;
  notificationType: string;
};

type AlertSmsResult =
  | { status: 'sent'; messageSid: string }
  | { status: 'opted_out' }
  | { status: 'rate_limited'; limitType?: string | null }
  | { status: 'failed'; error?: string };

function getTelephonyBaseUrl(): string {
  const base =
    process.env.ULTAURA_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001');

  if (!base) {
    throw new Error('ULTAURA_BACKEND_URL is required in production');
  }

  return base.replace(/\/$/, '');
}

function getInternalApiSecret(): string {
  const secret = process.env.ULTAURA_INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error('Missing ULTAURA_INTERNAL_API_SECRET');
  }

  return secret;
}

export async function sendAlertSms(
  payload: AlertSmsRequest,
): Promise<AlertSmsResult> {
  try {
    const response = await fetch(`${getTelephonyBaseUrl()}/internal/alert-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': getInternalApiSecret(),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return { status: 'failed', error: 'request_failed' };
    }

    const body = (await response.json().catch(() => null)) as
      | ({
          status?: AlertSmsResult['status'];
          messageSid?: string;
          limitType?: string | null;
          error?: string;
        } | null);

    if (body?.status === SMS_OPTED_OUT_STATUS) {
      return { status: 'opted_out' };
    }

    if (body?.status === 'rate_limited') {
      return { status: 'rate_limited', limitType: body.limitType ?? null };
    }

    if (body?.status === 'sent' && body.messageSid) {
      return { status: 'sent', messageSid: body.messageSid };
    }
  } catch {
    return { status: 'failed', error: 'request_failed' };
  }

  return { status: 'failed', error: 'request_failed' };
}
