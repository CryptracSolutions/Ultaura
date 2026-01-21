import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  StoreLifeChapterInputSchema,
  type StoreLifeChapterInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';
import { encryptLifeChapterNarrative } from '../../utils/life-chapter-crypto.js';
import { minimizeDerivedOptionalText, minimizeDerivedText } from '../../utils/derived-artifact-minimizer.js';

export const storeLifeChapterRouter = Router();

storeLifeChapterRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<StoreLifeChapterInput>;
    const parsed = StoreLifeChapterInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'store_life_chapter',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const {
      callSessionId,
      lineId,
      chapter_type,
      title,
      era_start_year,
      era_end_year,
      narrative_summary,
      key_people,
      emotional_tone,
    } = parsed.data;
    const minimizedTitle = minimizeDerivedText(title, 'label');
    const minimizedNarrative = minimizeDerivedText(narrative_summary, 'sentence');
    const minimizedKeyPeople = (key_people ?? [])
      .map((person) => minimizeDerivedOptionalText(person, 'label'))
      .filter((person): person is string => Boolean(person));

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (session.line_id !== lineId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const chapterId = crypto.randomUUID();
    const { ciphertext, iv, tag, alg, kid } = await encryptLifeChapterNarrative(
      session.account_id,
      lineId,
      chapterId,
      minimizedNarrative
    );

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('ultaura_life_chapters')
      .insert({
        id: chapterId,
        account_id: session.account_id,
        line_id: lineId,
        chapter_type,
        title: minimizedTitle,
        era_start_year: era_start_year ?? null,
        era_end_year: era_end_year ?? null,
        location: null,
        narrative_ciphertext: ciphertext,
        narrative_iv: iv,
        narrative_tag: tag,
        narrative_alg: alg,
        narrative_kid: kid,
        key_people: minimizedKeyPeople.length > 0 ? minimizedKeyPeople : null,
        emotional_tone: emotional_tone ?? null,
        updated_at: now,
        source: 'conversation',
      });

    if (error) {
      logger.error({ error, lineId }, 'Failed to store life chapter');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'store_life_chapter',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to store life chapter' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'store_life_chapter',
      success: true,
      chapterType: chapter_type,
    }, { skipDebugLog: true });

    res.json({ success: true, chapterId });
  } catch (error) {
    logger.error({ error }, 'Error storing life chapter');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
