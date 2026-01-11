import { Router, Request, Response } from 'express';
import { requireInternalSecret } from '../../middleware/auth.js';
import { processExportRequest } from '../../services/exports.js';

export const internalExportsRouter = Router();

internalExportsRouter.use(requireInternalSecret);

internalExportsRouter.post('/exports/process', async (req: Request, res: Response) => {
  try {
    const { exportRequestId } = req.body as {
      exportRequestId?: string;
    };

    if (!exportRequestId) {
      res.status(400).json({ error: 'Missing exportRequestId' });
      return;
    }

    const result = await processExportRequest(exportRequestId);
    if (!result.success) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
});
