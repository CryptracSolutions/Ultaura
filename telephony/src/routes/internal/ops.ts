import { Router, Request, Response } from 'express';
import { requireInternalSecret } from '../../middleware/auth.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { logger } from '../../utils/logger.js';
import { registry } from '../../utils/metrics.js';
import { getActiveCallCount, getActiveCallSessionIds } from '../../services/active-calls.js';
import { getActiveBridgeCount } from '../../websocket/grok-bridge-registry.js';

export const internalOpsRouter = Router();

internalOpsRouter.use(requireInternalSecret);

internalOpsRouter.get('/metrics', async (_req: Request, res: Response) => {
  try {
    res.set('Content-Type', registry.contentType);
    res.send(await registry.metrics());
  } catch (error) {
    logger.error({ error }, 'Failed to serve metrics');
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

internalOpsRouter.get('/scheduler-status', async (_req: Request, res: Response) => {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('ultaura_scheduler_leases')
      .select('id, held_by, acquired_at, expires_at, heartbeat_at')
      .order('id', { ascending: true });

    if (error) {
      logger.error({ error }, 'Failed to fetch scheduler leases');
      res.status(500).json({ error: 'Failed to fetch scheduler status' });
      return;
    }

    const leases: Record<string, {
      held: boolean;
      heldBy: string | null;
      acquiredAt: string | null;
      expiresAt: string | null;
      heartbeatAt: string | null;
    }> = {};

    (data || []).forEach((lease) => {
      leases[lease.id] = {
        held: Boolean(lease.held_by),
        heldBy: lease.held_by ?? null,
        acquiredAt: lease.acquired_at ?? null,
        expiresAt: lease.expires_at ?? null,
        heartbeatAt: lease.heartbeat_at ?? null,
      };
    });

    res.json({
      workerId: process.env.HOSTNAME || 'local',
      leases,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to handle scheduler status request');
    res.status(500).json({ error: 'Failed to fetch scheduler status' });
  }
});

internalOpsRouter.get('/active-calls', (_req: Request, res: Response) => {
  res.json({
    count: getActiveCallCount(),
    callSessionIds: getActiveCallSessionIds(),
  });
});

internalOpsRouter.get('/handoff-stats', (_req: Request, res: Response) => {
  res.json({
    activeBridges: getActiveBridgeCount(),
    activeCalls: getActiveCallCount(),
  });
});
