import { Router, Request, Response } from 'express';
import {
  SetVoicePreferenceInputSchema,
  type SetVoicePreferenceInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const setVoicePreferenceRouter = Router();

setVoicePreferenceRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<SetVoicePreferenceInput>;
    const parsed = SetVoicePreferenceInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'set_voice_preference',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, voice } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (session.line_id !== lineId) {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_voice_preference',
        success: false,
        errorCode: 'unauthorized',
      }, { skipDebugLog: true });
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('ultaura_lines')
      .update({
        preferred_grok_voice: voice,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lineId);

    if (error) {
      logger.error({ error, lineId }, 'Failed to update preferred Grok voice');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'set_voice_preference',
        success: false,
        errorCode: 'update_failed',
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to update voice preference' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'set_voice_preference',
      success: true,
      voice,
    }, { skipDebugLog: true });

    res.json({ success: true, voice });
  } catch (error) {
    logger.error({ error }, 'Error updating preferred voice');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
