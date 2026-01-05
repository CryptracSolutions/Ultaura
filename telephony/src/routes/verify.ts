// Phone verification routes
// Uses Twilio Verify for SMS and voice verification

import { Router, Request, Response } from 'express';
import { logger } from '../server.js';
import { sendVerificationCode, checkVerificationCode } from '../utils/twilio.js';
import { redactPhone } from '../utils/redact.js';

export const verifyRouter = Router();

// In-memory rate limiter (MVP - replace with Redis for production)
const verificationAttempts: Map<string, { count: number; resetAt: number }> = new Map();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function rateLimitVerification(phoneNumber: string): boolean {
  const now = Date.now();
  const key = phoneNumber;
  const attempts = verificationAttempts.get(key);

  if (!attempts || now > attempts.resetAt) {
    verificationAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (attempts.count >= MAX_ATTEMPTS) {
    return false;
  }

  attempts.count++;
  return true;
}

// Send verification code
verifyRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const { lineId, phoneNumber, channel } = req.body;

    if (!phoneNumber || !channel) {
      res.status(400).json({ error: 'Missing phoneNumber or channel' });
      return;
    }

    if (!['sms', 'call'].includes(channel)) {
      res.status(400).json({ error: 'Channel must be sms or call' });
      return;
    }

    if (!rateLimitVerification(phoneNumber)) {
      logger.warn({ phoneNumber: redactPhone(phoneNumber) }, 'Rate limit exceeded for verification');
      res.status(429).json({ error: 'Too many verification attempts. Try again later.' });
      return;
    }

    const sid = await sendVerificationCode(phoneNumber, channel);

    logger.info({ phoneNumber: redactPhone(phoneNumber), channel, sid, lineId }, 'Verification code sent');

    res.json({ success: true, sid });
  } catch (error) {
    logger.error({ error }, 'Failed to send verification code');
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Check verification code
verifyRouter.post('/check', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      res.status(400).json({ error: 'Missing phoneNumber or code' });
      return;
    }

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
