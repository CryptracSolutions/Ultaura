import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { redactPhone } from '../utils/redact.js';
import { sendSms, validateTwilioSignature } from '../utils/twilio.js';

export const twilioSmsInboundRouter = Router();

const STOP_KEYWORDS = new Set(['stop', 'unsubscribe', 'cancel', 'end', 'quit']);
const START_KEYWORDS = new Set(['start', 'subscribe', 'unstop']);

interface TwilioSmsWebhook {
  From: string;
  To: string;
  Body: string;
  MessageSid: string;
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
  try {
    const { From: from, Body: body, MessageSid: messageSid } = req.body as TwilioSmsWebhook;
    const normalizedBody = (body || '').trim().toLowerCase();

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

    res.type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (error) {
    logger.error({ error }, 'Error processing inbound SMS');
    res.status(500).send('Internal Server Error');
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
