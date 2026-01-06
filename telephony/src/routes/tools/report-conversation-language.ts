import { Router, Request, Response } from 'express';
import { normalizeLanguageCode } from '@ultaura/prompts';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getGrokBridge } from '../../websocket/grok-bridge-registry.js';

export const reportConversationLanguageRouter = Router();

reportConversationLanguageRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, languageCode, language_code } = req.body as {
      callSessionId?: string;
      languageCode?: string;
      language_code?: string;
    };

    if (!callSessionId) {
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    const rawCode = languageCode || language_code;
    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'report_conversation_language',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (!rawCode) {
      await recordFailure('missing_language_code');
      res.status(400).json({ success: false, error: 'Missing required fields' });
      return;
    }

    const normalizedCode = normalizeLanguageCode(rawCode);
    const grokBridge = getGrokBridge(callSessionId);

    if (grokBridge) {
      grokBridge.setDetectedLanguage(normalizedCode);
    } else {
      logger.warn({ callSessionId }, 'Grok bridge not found for language report');
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'report_conversation_language',
      success: true,
      languageCode: normalizedCode,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      languageCode: normalizedCode,
      message: `Language detected: ${normalizedCode}`,
    });
  } catch (error) {
    logger.error({ error }, 'Error reporting conversation language');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
