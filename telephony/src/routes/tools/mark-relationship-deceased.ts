import { Router, Request, Response } from 'express';
import {
  MarkRelationshipDeceasedInputSchema,
  type MarkRelationshipDeceasedInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const markRelationshipDeceasedRouter = Router();

const DEFAULT_RELATION_TYPE = 'unknown';
const DEFAULT_RELATION_ROLE = 'relationship';

markRelationshipDeceasedRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<MarkRelationshipDeceasedInput>;
    const parsed = MarkRelationshipDeceasedInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'mark_relationship_deceased',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, name, passed_at, grief_sensitivity } = parsed.data;

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ success: false, error: 'Call session not found' });
      return;
    }

    if (session.line_id !== lineId) {
      res.status(403).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const trimmedName = name.trim();

    const { data: existing, error: existingError } = await supabase
      .from('ultaura_relationships')
      .select('*')
      .eq('line_id', lineId)
      .ilike('name', trimmedName)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      logger.error({ error: existingError, lineId }, 'Failed to fetch relationship');
    }

    let relationshipId = existing?.id;

    if (!existing) {
      const { data, error } = await supabase
        .from('ultaura_relationships')
        .insert({
          account_id: session.account_id,
          line_id: lineId,
          name: trimmedName,
          relation_type: DEFAULT_RELATION_TYPE,
          relation_role: DEFAULT_RELATION_ROLE,
          is_deceased: true,
          passed_at: passed_at ?? null,
          death_mentioned_at: now,
          grief_sensitivity: grief_sensitivity ?? null,
          updated_at: now,
        })
        .select('id')
        .single();

      if (error || !data) {
        logger.error({ error, lineId }, 'Failed to create deceased relationship');
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'mark_relationship_deceased',
          success: false,
        }, { skipDebugLog: true });
        res.status(500).json({ success: false, error: 'Failed to mark relationship' });
        return;
      }

      relationshipId = data.id;
    } else {
      const { error } = await supabase
        .from('ultaura_relationships')
        .update({
          is_deceased: true,
          passed_at: passed_at ?? existing.passed_at,
          death_mentioned_at: now,
          grief_sensitivity: grief_sensitivity ?? existing.grief_sensitivity,
          updated_at: now,
        })
        .eq('id', existing.id);

      if (error) {
        logger.error({ error, lineId }, 'Failed to update relationship deceased status');
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'mark_relationship_deceased',
          success: false,
        }, { skipDebugLog: true });
        res.status(500).json({ success: false, error: 'Failed to mark relationship' });
        return;
      }
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'mark_relationship_deceased',
      success: true,
      action: 'marked_deceased',
    }, { skipDebugLog: true });

    res.json({ success: true, relationshipId });
  } catch (error) {
    logger.error({ error }, 'Error marking relationship deceased');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
