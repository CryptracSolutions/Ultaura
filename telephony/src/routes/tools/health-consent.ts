import { Router, Request, Response } from 'express';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { updateHealthConsentState } from '../../services/health-consent-voice.js';
import { getGrokBridge } from '../../websocket/grok-bridge-registry.js';

export const healthConsentRouter = Router();

healthConsentRouter.post('/grant_health_consent', async (req: Request, res: Response) => {
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
        tool: 'grant_health_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = skipPersist
      ? { is_test_call: true, is_preview_mode: session.is_preview_mode }
      : null;

    const updated = await updateHealthConsentState(
      lineId,
      session.account_id,
      callSessionId,
      'granted',
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'grant_health_consent',
        success: false,
        errorCode: 'db_write_failed',
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to record consent' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'grant_health_consent',
      success: true,
      resultingConsentStatus: 'granted',
      effectiveScope: 'next_call',
    }, { skipDebugLog: true });

    logger.info({ lineId, callSessionId }, 'Health consent granted via voice');

    res.json({
      success: true,
      resultingConsentStatus: 'granted',
      effectiveScope: 'next_call',
      canUseHealthInCurrentCall: false,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to grant health consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

healthConsentRouter.post('/deny_health_consent', async (req: Request, res: Response) => {
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
        tool: 'deny_health_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = skipPersist
      ? { is_test_call: true, is_preview_mode: session.is_preview_mode }
      : null;

    const updated = await updateHealthConsentState(
      lineId,
      session.account_id,
      callSessionId,
      'denied',
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'deny_health_consent',
        success: false,
        errorCode: 'db_write_failed',
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to record consent' });
      return;
    }

    const bridge = getGrokBridge(callSessionId);
    bridge?.disableHealthForSession();

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'deny_health_consent',
      success: true,
      resultingConsentStatus: 'denied',
      effectiveScope: 'current_call_shutdown',
    }, { skipDebugLog: true });

    logger.info({ lineId, callSessionId }, 'Health consent denied via voice');

    res.json({
      success: true,
      resultingConsentStatus: 'denied',
      effectiveScope: 'current_call_shutdown',
      canUseHealthInCurrentCall: false,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to deny health consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});

healthConsentRouter.post('/revoke_health_consent', async (req: Request, res: Response) => {
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
        tool: 'revoke_health_consent',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const skipPersist = session.is_test_call || session.is_preview_mode;
    const auditMetadata = skipPersist
      ? { is_test_call: true, is_preview_mode: session.is_preview_mode }
      : null;

    const updated = await updateHealthConsentState(
      lineId,
      session.account_id,
      callSessionId,
      'revoked',
      { skipPersist, auditMetadata }
    );

    if (!updated && !skipPersist) {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'revoke_health_consent',
        success: false,
        errorCode: 'db_write_failed',
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to record consent' });
      return;
    }

    const bridge = getGrokBridge(callSessionId);
    bridge?.disableHealthForSession();

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'revoke_health_consent',
      success: true,
      resultingConsentStatus: 'revoked',
      effectiveScope: 'current_call_shutdown',
    }, { skipDebugLog: true });

    logger.info({ lineId, callSessionId }, 'Health consent revoked via voice');

    res.json({
      success: true,
      resultingConsentStatus: 'revoked',
      effectiveScope: 'current_call_shutdown',
      canUseHealthInCurrentCall: false,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke health consent');
    res.status(500).json({ success: false, error: 'Failed to record consent' });
  }
});
