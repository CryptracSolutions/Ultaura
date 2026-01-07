// Phone verification routes
// Uses Twilio Verify for SMS and voice verification

import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../server.js';
import { sendVerificationCode, checkVerificationCode } from '../utils/twilio.js';
import { redactPhone } from '../utils/redact.js';
import { requireInternalSecret } from '../middleware/auth.js';
import { verifyRateLimiter } from '../middleware/rate-limiter.js';
import { getSupabaseClient } from '../utils/supabase.js';
import { recordVerificationSpend } from '../services/anomaly-alerts.js';

export const verifyRouter = Router();

verifyRouter.use(requireInternalSecret);

interface VerifySendRequest {
  lineId: string;
  phoneNumber: string;
  channel: 'sms' | 'call';
  accountId: string;
}

interface VerifyCheckRequest {
  phoneNumber: string;
  code: string;
  accountId: string;
}

function isValidE164(phoneNumber: string): boolean {
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
}

async function validateVerifySend(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { lineId, phoneNumber, channel, accountId } = req.body as VerifySendRequest;

  if (!lineId || !phoneNumber || !channel || !accountId) {
    res.status(400).json({ error: 'Missing lineId, phoneNumber, channel, or accountId' });
    return;
  }

  if (!['sms', 'call'].includes(channel)) {
    res.status(400).json({ error: 'Channel must be sms or call' });
    return;
  }

  if (!isValidE164(phoneNumber)) {
    res.status(400).json({ error: 'Invalid phone number format. Use E.164 format.' });
    return;
  }

  const supabase = getSupabaseClient();
  const { data: line, error } = await supabase
    .from('ultaura_lines')
    .select('account_id, phone_e164')
    .eq('id', lineId)
    .maybeSingle();

  if (error) {
    logger.error({ error, lineId }, 'Failed to validate line account for verification');
    res.status(500).json({ error: 'Failed to validate line' });
    return;
  }

  if (!line || line.account_id !== accountId || line.phone_e164 !== phoneNumber) {
    res.status(403).json({ error: 'Account mismatch' });
    return;
  }

  next();
}

async function validateVerifyCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
  const { phoneNumber, code, accountId } = req.body as VerifyCheckRequest;

  if (!phoneNumber || !code || !accountId) {
    res.status(400).json({ error: 'Missing phoneNumber, code, or accountId' });
    return;
  }

  if (!isValidE164(phoneNumber)) {
    res.status(400).json({ error: 'Invalid phone number format. Use E.164 format.' });
    return;
  }

  const supabase = getSupabaseClient();
  const { data: line, error } = await supabase
    .from('ultaura_lines')
    .select('account_id')
    .eq('phone_e164', phoneNumber)
    .maybeSingle();

  if (error) {
    logger.error({ error, phoneNumber: redactPhone(phoneNumber) }, 'Failed to validate phone ownership');
    res.status(500).json({ error: 'Failed to validate phone number' });
    return;
  }

  if (!line || line.account_id !== accountId) {
    res.status(403).json({ error: 'Account mismatch' });
    return;
  }

  next();
}

// Send verification code
verifyRouter.post('/send', validateVerifySend, verifyRateLimiter('send'), async (req: Request, res: Response) => {
  try {
    const { lineId, phoneNumber, channel, accountId } = req.body as VerifySendRequest;

    const sid = await sendVerificationCode(phoneNumber, channel);

    logger.info({ phoneNumber: redactPhone(phoneNumber), channel, sid, lineId }, 'Verification code sent');

    await recordVerificationSpend({
      accountId,
      phoneNumber,
      ipAddress: req.ip,
      amountUsd: 0.05,
    });

    res.json({ success: true, sid });
  } catch (error) {
    logger.error({ error }, 'Failed to send verification code');
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Check verification code
verifyRouter.post('/check', validateVerifyCheck, verifyRateLimiter('check'), async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body as VerifyCheckRequest;

    const verified = await checkVerificationCode(phoneNumber, code);

    if (verified) {
      res.json({ success: true, verified: true });
    } else {
      res.status(400).json({ error: 'Invalid verification code', verified: false });
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check verification code');
    res.status(500).json({ error: 'Verification check failed' });
  }
});
