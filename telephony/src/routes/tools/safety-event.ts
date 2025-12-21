import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { recordSafetyEvent } from '../../services/call-session.js';

export const safetyEventRouter = Router();

safetyEventRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, accountId, tier, signals, actionTaken } = req.body;

    await recordSafetyEvent({
      accountId,
      lineId,
      callSessionId,
      tier,
      signals: { description: signals },
      actionTaken,
    });

    // For high-tier events, we could notify trusted contacts here
    if (tier === 'high') {
      logger.warn({ callSessionId, lineId, tier, actionTaken }, 'HIGH SAFETY TIER EVENT');
      // TODO: Notify trusted contacts if consent exists
    }

    res.json({ success: true, message: 'Safety concern logged' });
  } catch (error) {
    logger.error({ error }, 'Error logging safety event');
    res.status(500).json({ error: 'Failed to log safety event' });
  }
});
