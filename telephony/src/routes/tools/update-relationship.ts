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
import { minimizeDerivedOptionalText, minimizeDerivedText } from '../../utils/derived-artifact-minimizer.js';

export const updateRelationshipRouter = Router();

const DEFAULT_RELATION_TYPE = 'unknown';
const DEFAULT_RELATION_ROLE = 'relationship';
const MAX_RECENT_TOPICS = 5;

function normalizeNameForMatch(value: string): string {
  return minimizeDerivedText(value, 'label').toLowerCase();
}

function pickBestRelationshipMatch<T extends { updated_at?: string | null; times_mentioned?: number | null }>(
  matches: T[]
): T | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => {
    const aTime = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bTime = b.updated_at ? Date.parse(b.updated_at) : 0;
    if (aTime !== bTime) return bTime - aTime;
    const aCount = a.times_mentioned ?? 0;
    const bCount = b.times_mentioned ?? 0;
    return bCount - aCount;
  });
  return sorted[0] ?? null;
}

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
    const minimizedName = minimizeDerivedText(trimmedName, 'label');
    if (!minimizedName) {
      res.status(400).json({ success: false, error: 'Invalid name' });
      return;
    }
    const minimizedNickname = minimizeDerivedOptionalText(updates.nickname, 'label');
    const minimizedLocation = minimizeDerivedOptionalText(updates.location, 'label');
    const minimizedRecentTopic = minimizeDerivedOptionalText(updates.recent_topic, 'label');
    const minimizedSharedActivity = minimizeDerivedOptionalText(updates.shared_activity, 'label');

    const { data: candidates, error: candidatesError } = await supabase
      .from('ultaura_relationships')
      .select(
        'id,name,nickname,contact_frequency,sentiment,location,recent_topics,shared_activities,times_mentioned,updated_at,last_mentioned_at'
      )
      .eq('line_id', lineId)
      .limit(200);

    if (candidatesError) {
      logger.error({ error: candidatesError, lineId }, 'Failed to fetch relationships');
      res.status(500).json({ success: false, error: 'Failed to update relationship' });
      return;
    }

    const normalizedTarget = normalizeNameForMatch(trimmedName);

    const normalizedMatches = (candidates ?? []).filter((row) => {
      if (!row?.name || typeof row.name !== 'string') return false;
      return normalizeNameForMatch(row.name) === normalizedTarget;
    });

    const rawLower = trimmedName.toLowerCase();
    const rawMatches = (candidates ?? []).filter((row) => {
      if (!row?.name || typeof row.name !== 'string') return false;
      return row.name.trim().toLowerCase() === rawLower;
    });

    const existing =
      pickBestRelationshipMatch(normalizedMatches) ?? pickBestRelationshipMatch(rawMatches);

    if (!existing) {
      const insertPayload: Record<string, unknown> = {
        account_id: session.account_id,
        line_id: lineId,
        name: minimizedName,
        relation_type: DEFAULT_RELATION_TYPE,
        relation_role: DEFAULT_RELATION_ROLE,
        nickname: minimizedNickname,
        contact_frequency: updates.contact_frequency ?? null,
        sentiment: updates.sentiment ?? null,
        location: minimizedLocation,
        shared_activities: minimizedSharedActivity ? [minimizedSharedActivity] : null,
        recent_topics: minimizedRecentTopic ? [minimizedRecentTopic] : null,
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
      if (!minimizedRecentTopic) {
        return existing.recent_topics ?? null;
      }
      const topics = [minimizedRecentTopic, ...(existing.recent_topics ?? [])];
      const deduped = Array.from(new Set(topics.map((topic) => topic.trim()).filter(Boolean)));
      return deduped.slice(0, MAX_RECENT_TOPICS);
    })();

    const nextSharedActivities = (() => {
      if (!minimizedSharedActivity) {
        return existing.shared_activities ?? null;
      }
      const activities = [...(existing.shared_activities ?? []), minimizedSharedActivity];
      return Array.from(new Set(activities.map((activity) => activity.trim()).filter(Boolean)));
    })();

    const updatesPayload: Record<string, unknown> = {
      updated_at: now,
      last_mentioned_at: now,
      times_mentioned: (existing.times_mentioned ?? 0) + 1,
      nickname: minimizedNickname ?? existing.nickname,
      contact_frequency: updates.contact_frequency ?? existing.contact_frequency,
      sentiment: updates.sentiment ?? existing.sentiment,
      location: minimizedLocation ?? existing.location,
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
