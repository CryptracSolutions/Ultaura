import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../../server.js';
import { sendVerificationCode, checkVerificationCode } from '../../utils/twilio.js';
import { redactPhone } from '../../utils/redact.js';
import { requireInternalSecret } from '../../middleware/auth.js';
import { verifyRateLimiter } from '../../middleware/rate-limiter.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { recordVerificationSpend } from '../../services/anomaly-alerts.js';

export const internalRecipientVerifyRouter = Router();

internalRecipientVerifyRouter.use(requireInternalSecret);

interface RecipientVerifySendRequest {
  recipientId: string;
  phoneNumber: string;
  channel: 'sms';
  accountId: string;
}

interface RecipientVerifyCheckRequest {
  recipientId: string;
  phoneNumber: string;
  code: string;
  accountId: string;
}

function isValidE164(phoneNumber: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

async function validateRecipientVerifySend(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { recipientId, phoneNumber, channel, accountId } = req.body as RecipientVerifySendRequest;

  if (!recipientId || !phoneNumber || !channel || !accountId) {
    res.status(400).json({ error: 'Missing recipientId, phoneNumber, channel, or accountId' });
    return;
  }

  if (channel !== 'sms') {
    res.status(400).json({ error: 'Channel must be sms' });
    return;
  }

  if (!isValidE164(phoneNumber)) {
    res.status(400).json({ error: 'Invalid phone number format. Use E.164 format.' });
    return;
  }

  const supabase = getSupabaseClient();
  const { data: recipient, error } = await supabase
    .from('ultaura_notification_recipients')
    .select('account_id, phone_e164, unsubscribed_at')
    .eq('id', recipientId)
    .maybeSingle();

  if (error) {
    logger.error({ error, recipientId }, 'Failed to validate recipient account for verification');
    res.status(500).json({ error: 'Failed to validate recipient' });
    return;
  }

  if (
    !recipient ||
    recipient.account_id !== accountId ||
    recipient.phone_e164 !== phoneNumber ||
    recipient.unsubscribed_at
  ) {
    res.status(403).json({ error: 'Recipient mismatch' });
    return;
  }

  next();
}

async function validateRecipientVerifyCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { recipientId, phoneNumber, code, accountId } = req.body as RecipientVerifyCheckRequest;

  if (!recipientId || !phoneNumber || !code || !accountId) {
    res.status(400).json({ error: 'Missing recipientId, phoneNumber, code, or accountId' });
    return;
  }

  if (!isValidE164(phoneNumber)) {
    res.status(400).json({ error: 'Invalid phone number format. Use E.164 format.' });
    return;
  }

  const supabase = getSupabaseClient();
  const { data: recipient, error } = await supabase
    .from('ultaura_notification_recipients')
    .select('account_id, phone_e164, unsubscribed_at')
    .eq('id', recipientId)
    .maybeSingle();

  if (error) {
    logger.error({ error, recipientId }, 'Failed to validate recipient for verification check');
    res.status(500).json({ error: 'Failed to validate recipient' });
    return;
  }

  if (
    !recipient ||
    recipient.account_id !== accountId ||
    recipient.phone_e164 !== phoneNumber ||
    recipient.unsubscribed_at
  ) {
    res.status(403).json({ error: 'Recipient mismatch' });
    return;
  }

  next();
}

internalRecipientVerifyRouter.post(
  '/recipient-verify/send',
  validateRecipientVerifySend,
  verifyRateLimiter('send'),
  async (req: Request, res: Response) => {
    try {
      const { recipientId, phoneNumber, accountId } = req.body as RecipientVerifySendRequest;

      const sid = await sendVerificationCode(phoneNumber, 'sms');

      logger.info(
        { recipientId, phoneNumber: redactPhone(phoneNumber), channel: 'sms', sid },
        'Recipient verification code sent'
      );

      await recordVerificationSpend({
        accountId,
        phoneNumber,
        ipAddress: req.ip,
        amountUsd: 0.05,
      });

      res.json({ success: true, sid });
    } catch (error) {
      logger.error({ error }, 'Failed to send recipient verification code');
      res.status(500).json({ error: 'Failed to send verification code' });
    }
  }
);

internalRecipientVerifyRouter.post(
  '/recipient-verify/check',
  validateRecipientVerifyCheck,
  verifyRateLimiter('check'),
  async (req: Request, res: Response) => {
    try {
      const { recipientId, phoneNumber, code } = req.body as RecipientVerifyCheckRequest;

      const verified = await checkVerificationCode(phoneNumber, code);

      logger.info(
        { recipientId, phoneNumber: redactPhone(phoneNumber), verified },
        'Recipient verification check completed'
      );

      if (verified) {
        res.json({ success: true, verified: true });
      } else {
        res.status(400).json({ error: 'Invalid verification code', verified: false });
      }
    } catch (error) {
      logger.error({ error }, 'Failed to check recipient verification code');
      res.status(500).json({ error: 'Verification check failed' });
    }
  }
);
