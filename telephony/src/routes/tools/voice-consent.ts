import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { updateLineVoiceConsent } from '../../services/privacy.js';

export const voiceConsentRouter = Router();

voiceConsentRouter.post('/grant_memory_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'grant_memory_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await updateLineVoiceConsent(lineId, session.account_id, callSessionId, {
      memoryConsent: 'granted',
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'grant_memory_consent',
      success: true,
    }, { skipDebugLog: true });

    logger.info({ lineId, callSessionId }, 'Memory consent granted via voice');

    res.json({
      success: true,
      message: 'Memory consent recorded. You can now remember things the user shares.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to grant memory consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

voiceConsentRouter.post('/deny_memory_consent', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId } = req.body as {
      callSessionId?: string;
      lineId?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'deny_memory_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    await updateLineVoiceConsent(lineId, session.account_id, callSessionId, {
      memoryConsent: 'denied',
    });

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'deny_memory_consent',
      success: true,
    }, { skipDebugLog: true });

    logger.info({ lineId, callSessionId }, 'Memory consent denied via voice');

    res.json({
      success: true,
      message: 'Noted. Conversations will not be remembered for personalization.',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to deny memory consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});
