import { logger } from '../utils/logger.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { getInternalApiSecret } from '../utils/env.js';

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
  logger.debug(
    { accountId: options.accountId, lineId: options.lineId, callSessionId: options.callSessionId },
    'Trusted-contact safety notification is orchestrated by the app safety route',
  );
}

export async function notifyPayerSafetyEmail(options: {
  accountId: string;
  lineId: string;
  callSessionId?: string;
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
        callSessionId: options.callSessionId,
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
  } catch (error) {
    logger.error({ error, accountId: options.accountId }, 'Failed to send safety email to payer');
  }
}
