import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { recordOptOut } from '../../services/line-lookup.js';
import { getCallSession, recordCallEvent } from '../../services/call-session.js';

export const optOutRouter = Router();

optOutRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, source = 'voice' } = req.body;

    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    // Record the opt-out
    await recordOptOut(session.account_id, lineId, callSessionId, source as 'voice');

    // Record event
    await recordCallEvent(callSessionId, 'state_change', {
      event: 'opt_out',
      source,
    }, { skipDebugLog: true });

    logger.info({ callSessionId, lineId, source }, 'Voice opt-out recorded');

    res.json({
      success: true,
      message: 'Opt-out recorded. The user will no longer receive outbound calls.',
    });
  } catch (error) {
    logger.error({ error }, 'Error processing opt-out');
    res.status(500).json({ error: 'Failed to process opt-out' });
  }
});
