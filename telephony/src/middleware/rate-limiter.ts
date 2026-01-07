import { Request, Response, NextFunction } from 'express';
import { checkAnomalyThresholds } from '../services/anomaly-alerts.js';
import { enforceRateLimit, isVerificationDisabled } from '../services/rate-limiter.js';

function getRequestIp(req: Request): string {
  const headerIp = req.ip || req.socket.remoteAddress || 'unknown';
  return headerIp.split(',')[0]?.trim() || 'unknown';
}

export function verifyRateLimiter(action: 'send' | 'check') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = getRequestIp(req);
    const { phoneNumber, accountId } = req.body as {
      phoneNumber?: string;
      accountId?: string;
    };

    if (await isVerificationDisabled()) {
      res.status(503).json({
        error: 'Verification temporarily disabled',
        code: 'VERIFICATION_DISABLED',
      });
      return;
    }

    const result = await enforceRateLimit({
      phoneNumber,
      ipAddress: ip,
      accountId,
      action: action === 'send' ? 'verify_send' : 'verify_check',
    });

    await checkAnomalyThresholds({
      action: action === 'send' ? 'verify_send' : 'verify_check',
      wasAllowed: result.allowed,
      limitType: result.limitType,
      ipAddress: ip,
      phoneNumber,
      accountId,
      retryAfter: result.retryAfter,
    });

    if (!result.allowed) {
      res
        .status(429)
        .set('Retry-After', String(result.retryAfter))
        .json({
          error: 'Too many requests',
          retryAfter: result.retryAfter,
          limitType: result.limitType,
        });
      return;
    }

    next();
  };
}

