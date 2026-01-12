import { Router, Request, Response } from 'express';
import type { Memory, MemoryType } from '@ultaura/types';
import { logger } from '../../server.js';
import { getCallSession, incrementToolInvocations, recordCallEvent } from '../../services/call-session.js';
import { getMemoriesForLine } from '../../services/memory.js';
import { enforceMemoryConsent } from './memory-guard.js';

export const reviewMemoriesRouter = Router();

const CATEGORY_TYPE_MAP: Record<string, MemoryType> = {
  fact: 'fact',
  preference: 'preference',
  preferences: 'preference',
  follow_up: 'follow_up',
  followup: 'follow_up',
  context: 'context',
  history: 'history',
  wellbeing: 'wellbeing',
  well_being: 'wellbeing',
  relationship: 'relationship',
  relationships: 'relationship',
  family: 'relationship',
  temporal: 'temporal',
  routine: 'routine',
  routines: 'routine',
  habits: 'routine',
  hobbies: 'preference',
};

function mapCategoryToType(category?: string): MemoryType | null {
  if (!category) return null;
  const normalized = category.toLowerCase().trim();
  return CATEGORY_TYPE_MAP[normalized] ?? null;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string' && typeof record.role === 'string') {
      return `${record.role} ${record.name}`.trim();
    }
    if (typeof record.description === 'string') {
      return record.description;
    }
    return JSON.stringify(record);
  }
  return String(value ?? '');
}

function listSample(items: string[], limit = 3): string {
  return items.slice(0, limit).join(', ');
}

function summarizeMemories(memories: Memory[]): string {
  if (memories.length === 0) {
    return `I don't have any saved memories yet.`;
  }

  const parts: string[] = [];
  const preferredName = memories.find(
    memory => memory.key.toLowerCase() === 'preferred_name'
  );

  if (preferredName) {
    parts.push(`I remember you prefer to be called ${formatValue(preferredName.value)}.`);
  }

  const relationships = memories.filter(m => m.type === 'relationship');
  if (relationships.length > 0) {
    const names = relationships.map(m => formatValue(m.value));
    const sample = listSample(names);
    parts.push(`You have ${relationships.length} relationship${relationships.length > 1 ? 's' : ''} I know about, including ${sample}.`);
  }

  const preferences = memories.filter(m => m.type === 'preference');
  if (preferences.length > 0) {
    const items = preferences.map(m => formatValue(m.value));
    parts.push(`You enjoy ${listSample(items)}.`);
  }

  const routines = memories.filter(m => m.type === 'routine');
  if (routines.length > 0) {
    const items = routines.map(m => formatValue(m.value));
    parts.push(`You have routines like ${listSample(items)}.`);
  }

  const temporal = memories.filter(m => m.type === 'temporal');
  if (temporal.length > 0) {
    const items = temporal.map(m => formatValue(m.value));
    parts.push(`You're dealing with ${listSample(items)}.`);
  }

  const wellbeing = memories.filter(m => m.type === 'wellbeing');
  if (wellbeing.length > 0) {
    const items = wellbeing.map(m => formatValue(m.value));
    parts.push(`You've mentioned ${listSample(items)} about how you're feeling.`);
  }

  if (parts.length === 0) {
    parts.push(`I have ${memories.length} notes saved from our conversations.`);
  }

  parts.push('Would you like me to go into more detail about any of these?');
  return parts.join(' ');
}

reviewMemoriesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { callSessionId, lineId, category } = req.body as {
      callSessionId?: string;
      lineId?: string;
      category?: string;
    };

    if (!callSessionId || !lineId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const session = await getCallSession(callSessionId);
    if (!session) {
      res.status(404).json({ error: 'Call session not found' });
      return;
    }

    const recordFailure = async (errorCode?: string) => {
      await recordCallEvent(callSessionId, 'tool_call', {
        tool: 'review_memories',
        success: false,
        errorCode,
      }, { skipDebugLog: true });
    };

    if (lineId !== session.line_id) {
      await recordFailure('unauthorized');
      res.status(403).json({ error: 'Unauthorized' });
      return;
    }

    const accountId = session.account_id;
    const consent = await enforceMemoryConsent({
      accountId,
      lineId,
      callSessionId,
      toolName: 'review_memories',
    });

    if (!consent.ok) {
      res.json({ success: false, error: consent.error });
      return;
    }

    const memories = await getMemoriesForLine(accountId, lineId, { limit: 100 });
    const categoryType = mapCategoryToType(category);
    const filtered = categoryType
      ? memories.filter(m => m.type === categoryType)
      : memories;

    const summary = summarizeMemories(filtered);
    const categories = Array.from(new Set(filtered.map(m => m.type)));

    await incrementToolInvocations(callSessionId);
    await recordCallEvent(callSessionId, 'tool_call', {
      tool: 'review_memories',
      success: true,
      memoryCount: filtered.length,
    }, { skipDebugLog: true });

    res.json({
      success: true,
      summary,
      memoryCount: filtered.length,
      categories,
    });
  } catch (error) {
    logger.error({ error }, 'Error reviewing memories');
    res.status(500).json({ error: 'Failed to review memories' });
  }
});
