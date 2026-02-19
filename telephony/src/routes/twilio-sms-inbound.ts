import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { redactPhone } from '../utils/redact.js';
import { sendSms, validateTwilioSignature } from '../utils/twilio.js';
import { logTelephonyEvent } from '../services/telephony-event-log.js';

export const twilioSmsInboundRouter = Router();

const STOP_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'end', 'quit']);
const START_KEYWORDS = new Set(['start', 'subscribe', 'unstop']);
const EMPTY_TWIML_RESPONSE =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

type TelephonyEventSeverity = 'info' | 'warn' | 'error';

interface TwilioSmsWebhook {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
}

function toLogPayload(body: unknown): Record<string, unknown> {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }

  return { body };
}

async function safeLogSmsEvent(opts: {
  accountId?: string;
  lineId?: string;
  providerId?: string;
  payload: Record<string, unknown>;
  severity: TelephonyEventSeverity;
}): Promise<void> {
  try {
    await logTelephonyEvent({
      accountId: opts.accountId,
      lineId: opts.lineId,
      providerId: opts.providerId,
      eventType: 'twilio.sms.inbound.webhook',
      payload: opts.payload,
      severity: opts.severity,
    });
  } catch (error) {
    logger.warn({ error }, 'Failed to enqueue inbound SMS telephony event log');
  }
}

async function resolveLineContextByPhone(
  phoneE164: string | undefined,
): Promise<{ accountId?: string; lineId?: string }> {
  if (!phoneE164) {
    return {};
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('ultaura_lines')
    .select('id, account_id')
    .eq('phone_e164', phoneE164)
    .maybeSingle();

  if (error) {
    if (error.code !== 'PGRST116') {
      logger.warn({ error, phone: redactPhone(phoneE164) }, 'Failed to resolve line context for inbound SMS');
    }
    return {};
  }

  if (!data) {
    return {};
  }

  return {
    accountId: data.account_id ?? undefined,
    lineId: data.id ?? undefined,
  };
}

function validateTwilioWebhook(req: Request, res: Response, next: () => void) {
  if (process.env.SKIP_TWILIO_SIGNATURE_VALIDATION === 'true') {
    logger.warn('Twilio signature validation skipped (development mode)');
    next();
    return;
  }

  const signature = req.headers['x-twilio-signature'] as string;

  if (!signature) {
    logger.warn('Missing Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const url = `${protocol}://${host}${req.originalUrl}`;

  const isValid = validateTwilioSignature(url, req.body, signature);

  if (!isValid) {
    logger.warn({ url }, 'Invalid Twilio signature');
    res.status(403).send('Forbidden');
    return;
  }

  next();
}

twilioSmsInboundRouter.use(validateTwilioWebhook);

twilioSmsInboundRouter.post('/inbound', async (req: Request, res: Response) => {
  const payload = toLogPayload(req.body);
  let accountId: string | undefined;
  let lineId: string | undefined;
  let providerId: string | undefined;
  let eventSeverity: TelephonyEventSeverity = 'info';
  try {
    const { From: from, Body: body, MessageSid: messageSid } = req.body as TwilioSmsWebhook;
    const normalizedBody = (body || '').trim().toLowerCase();
    providerId = messageSid;
    ({ accountId, lineId } = await resolveLineContextByPhone(from));

    logger.info({ from: redactPhone(from), messageSid, body: normalizedBody }, 'Inbound SMS received');

    if (STOP_KEYWORDS.has(normalizedBody)) {
      await handleSmsOptOut(from, normalizedBody);

      const dashboardUrl = process.env.ULTAURA_DASHBOARD_URL || 'https://ultaura.com';
      await sendSms({
        to: from,
        body: `Unsubscribed from Ultaura SMS. Manage preferences at ${dashboardUrl}/settings. Reply START to re-subscribe.`,
        skipOptOutCheck: true,
      });

      logger.info({ from: redactPhone(from) }, 'SMS opt-out processed');
    } else if (START_KEYWORDS.has(normalizedBody)) {
      await handleSmsOptIn(from);

      await sendSms({
        to: from,
        body: 'You have been re-subscribed to Ultaura SMS notifications.',
        skipOptOutCheck: true,
      });

      logger.info({ from: redactPhone(from) }, 'SMS opt-in processed');
    }

    res.type('text/xml').send(EMPTY_TWIML_RESPONSE);
  } catch (error) {
    eventSeverity = 'error';
    logger.error({ error }, 'Error processing inbound SMS');
    res.status(500).send('Internal Server Error');
  } finally {
    void safeLogSmsEvent({
      accountId,
      lineId,
      providerId,
      payload,
      severity: eventSeverity,
    });
  }
});

async function handleSmsOptOut(phoneE164: string, keyword: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('ultaura_sms_opt_outs')
    .upsert({
      phone_e164: phoneE164,
      source: 'sms_keyword',
      keyword: keyword.toUpperCase(),
    }, {
      onConflict: 'phone_e164',
    });
}

async function handleSmsOptIn(phoneE164: string): Promise<void> {
  const supabase = getSupabaseClient();

  await supabase
    .from('ultaura_sms_opt_outs')
    .delete()
    .eq('phone_e164', phoneE164);
}
