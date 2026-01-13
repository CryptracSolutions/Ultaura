import { Router, Request, Response } from 'express';
import {
  UpdateRelationshipInputSchema,
  type UpdateRelationshipInput,
} from '@ultaura/schemas/telephony';
import { logger } from '../../server.js';
import {
  getCallSession,
  incrementToolInvocations,
  recordCallEvent,
} from '../../services/call-session.js';
import { getSupabaseClient } from '../../utils/supabase.js';

export const updateRelationshipRouter = Router();

const DEFAULT_RELATION_TYPE = 'unknown';
const DEFAULT_RELATION_ROLE = 'relationship';
const MAX_RECENT_TOPICS = 5;

updateRelationshipRouter.post('/', async (req: Request, res: Response) => {
  try {
    const rawBody = req.body as Partial<UpdateRelationshipInput>;
    const parsed = UpdateRelationshipInputSchema.safeParse(rawBody);

    if (!parsed.success) {
      const callSessionId =
        typeof rawBody.callSessionId === 'string' ? rawBody.callSessionId : null;
      if (callSessionId) {
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'update_relationship',
          success: false,
          errorCode: 'validation_error',
        }, { skipDebugLog: true });
      }

      res.status(400).json({ success: false, error: 'Invalid input' });
      return;
    }

    const { callSessionId, lineId, name, updates } = parsed.data;

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

    if (!existing) {
      const insertPayload: Record<string, unknown> = {
        account_id: session.account_id,
        line_id: lineId,
        name: trimmedName,
        relation_type: DEFAULT_RELATION_TYPE,
        relation_role: DEFAULT_RELATION_ROLE,
        nickname: updates.nickname ?? null,
        contact_frequency: updates.contact_frequency ?? null,
        sentiment: updates.sentiment ?? null,
        location: updates.location ?? null,
        shared_activities: updates.shared_activity ? [updates.shared_activity] : null,
        recent_topics: updates.recent_topic ? [updates.recent_topic] : null,
        times_mentioned: 1,
        last_mentioned_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('ultaura_relationships')
        .insert(insertPayload)
        .select('id')
        .single();

      if (error || !data) {
        logger.error({ error, lineId }, 'Failed to create relationship');
        await recordCallEvent(callSessionId, 'tool_call', {
          tool: 'update_relationship',
          success: false,
        }, { skipDebugLog: true });
        res.status(500).json({ success: false, error: 'Failed to update relationship' });
        return;
      }

      await incrementToolInvocations(callSessionId);
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'update_relationship',
        success: true,
        action: 'created',
      }, { skipDebugLog: true });

      res.json({ success: true, relationshipId: data.id });
      return;
    }

    const nextRecentTopics = (() => {
      if (!updates.recent_topic) {
        return existing.recent_topics ?? null;
      }
      const topics = [updates.recent_topic, ...(existing.recent_topics ?? [])];
      const deduped = Array.from(new Set(topics.map((topic) => topic.trim()).filter(Boolean)));
      return deduped.slice(0, MAX_RECENT_TOPICS);
    })();

    const nextSharedActivities = (() => {
      if (!updates.shared_activity) {
        return existing.shared_activities ?? null;
      }
      const activities = [...(existing.shared_activities ?? []), updates.shared_activity];
      return Array.from(new Set(activities.map((activity) => activity.trim()).filter(Boolean)));
    })();

    const updatesPayload: Record<string, unknown> = {
      updated_at: now,
      last_mentioned_at: now,
      times_mentioned: (existing.times_mentioned ?? 0) + 1,
      nickname: updates.nickname ?? existing.nickname,
      contact_frequency: updates.contact_frequency ?? existing.contact_frequency,
      sentiment: updates.sentiment ?? existing.sentiment,
      location: updates.location ?? existing.location,
      recent_topics: nextRecentTopics,
      shared_activities: nextSharedActivities,
    };

    const { error: updateError } = await supabase
      .from('ultaura_relationships')
      .update(updatesPayload)
      .eq('id', existing.id);

    if (updateError) {
      logger.error({ error: updateError, lineId }, 'Failed to update relationship');
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'update_relationship',
        success: false,
      }, { skipDebugLog: true });
      res.status(500).json({ success: false, error: 'Failed to update relationship' });
      return;
    }

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'update_relationship',
      success: true,
      action: 'updated',
    }, { skipDebugLog: true });

    res.json({ success: true, relationshipId: existing.id });
  } catch (error) {
    logger.error({ error }, 'Error updating relationship');
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});
