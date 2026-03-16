import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  LogHealthMentionInputSchema,
  type LogHealthMentionInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { encryptHealthMentionSummary } from '../../utils/health-mention-crypto.js';
import { minimizeDerivedText } from '../../utils/derived-artifact-minimizer.js';
import { isHealthSuppressionActive } from '../../services/health-privacy-state.js';

export const logHealthMentionRouter = Router();

logHealthMentionRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<LogHealthMentionInput>;
    const parsed = LogHealthMentionInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'log_health_mention',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, category, summary, severity } = parsed.data;
    const minimizedSummary = minimizeDerivedText(summary, 'sentence');

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (session.line_id !== lineId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const mentionId = crypto.randomUUID();
    const { ciphertext, iv, tag, alg, kid } = await encryptHealthMentionSummary(
      session.account_id,
      lineId,
      callSessionId,
      mentionId,
      minimizedSummary
    );

    const triggersAlert = severity === 'concerning';
    const suppressionActive = await isHealthSuppressionActive(callSessionId);

    const supabase = getSupabaseClient();
    const insertData: Record<string, unknown> = {
      id: mentionId,
      account_id: session.account_id,
      line_id: lineId,
      call_session_id: callSessionId,
      mention_ciphertext: ciphertext,
      mention_iv: iv,
      mention_tag: tag,
      mention_alg: alg,
      mention_kid: kid,
      category,
      severity: severity ?? null,
      triggers_alert: triggersAlert,
    };

    if (suppressionActive) {
      insertData.suppressed_at = new Date().toISOString();
      insertData.suppression_reason = 'owner_private_disclosure';
      insertData.suppressed_by_call_session_id = callSessionId;
    }

    const { error } = await supabase
      .from('ultaura_health_mentions')
      .insert(insertData);

    if (error) {
      logger.error({ error, lineId }, 'Failed to log health mention');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'log_health_mention',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to log health mention' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'log_health_mention',
      success: true,
      category,
      severity: severity ?? null,
      triggersAlert,
    }, { skipDebugLog: true });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error logging health mention');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
