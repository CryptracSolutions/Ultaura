import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getInternalApiSecret } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export function requireInternalSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let expectedSecret: string;

  try {
    expectedSecret = getInternalApiSecret();
  } catch (error) {
    logger.error({ error }, 'Internal API secret missing');
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const providedSecret = req.headers['x-webhook-secret'];
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const path = req.originalUrl;

  if (!providedSecret || typeof providedSecret !== 'string') {
    logger.warn({ ip, path }, 'Missing X-Webhook-Secret header');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const providedBuffer = Buffer.from(providedSecret, 'utf8');
  const expectedBuffer = Buffer.from(expectedSecret, 'utf8');

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    logger.warn({ ip, path }, 'Invalid X-Webhook-Secret header');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
