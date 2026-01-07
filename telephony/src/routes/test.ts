import { Router, Request, Response } from 'express';
import { getGrokBridge } from '../websocket/grok-bridge-registry.js';
import { logger } from '../server.js';

const router = Router();

router.post('/simulate-failure', async (req: Request, res: Response) => {
  const { callSessionId } = req.body as { callSessionId?: string };

  if (!callSessionId) {
    res.status(400).json({ error: 'callSessionId required' });
    return;
  }

  const bridge = getGrokBridge(callSessionId);
  if (!bridge) {
    res.status(404).json({ error: 'No active call session found' });
    return;
  }

  logger.info({ callSessionId }, 'Simulating Grok failure for testing');

  bridge.forceClose();

  res.json({ success: true, message: 'Failure simulated' });
});

export default router;
