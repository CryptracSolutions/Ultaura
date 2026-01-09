// End-of-call summarization and memory extraction
// Uses ephemeral buffer turns to extract memories after call ends

import { clearBuffer, type EphemeralBuffer } from './ephemeral-buffer.js';
import { storeMemory, getMemoriesForLine } from './memory.js';
import { logger } from '../server.js';

interface ExtractedMemory {
  type: 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing';
  key: string;
  value: string;
  confidence: number;
}

const EXTRACTION_PROMPT = `You are analyzing a conversation summary to extract memorable information about the user.

Review the conversation turns below and extract any important information worth remembering for future calls.

For each memory, provide:
- type: fact | preference | follow_up | context | history | wellbeing
- key: semantic identifier (snake_case)
- value: the information to remember
- confidence: 0-1 how confident you are this is accurate

IMPORTANT:
- Only extract genuinely useful information, not small talk
- Skip anything that was already stored during the call (marked as [STORED])
- Focus on things that would help personalize future conversations
- For follow_ups, include time context if mentioned

Respond with JSON array only, no explanation:
[{"type": "...", "key": "...", "value": "...", "confidence": 0.9}, ...]

If nothing worth storing, respond with: []

CONVERSATION TURNS:
`;

export async function summarizeAndExtractMemories(callSessionId: string): Promise<void> {
  const buffer = clearBuffer(callSessionId);

  if (!buffer || buffer.turns.length === 0) {
    logger.debug({ callSessionId }, 'No conversation buffer to summarize');
    return;
  }

  await summarizeAndExtractMemoriesFromBuffer(buffer);
}

export async function summarizeAndExtractMemoriesFromBuffer(buffer: EphemeralBuffer): Promise<void> {
  if (!buffer.turns.length) {
    return;
  }

  try {
    const turnText = buffer.turns
      .map(t => `[${t.speaker.toUpperCase()}] ${t.summary}`)
      .join('\n');

    const existingMemories = await getMemoriesForLine(buffer.accountId, buffer.lineId, { limit: 100 });
    const existingKeys = new Set(existingMemories.map(m => m.key.toLowerCase()));
    const storedDuringCall = new Set([...buffer.storedKeys].map(k => k.toLowerCase()));

    const extractedMemories = await extractMemoriesWithGrok(turnText);

    let storedCount = 0;
    for (const memory of extractedMemories) {
      const keyLower = memory.key.toLowerCase();
      if (existingKeys.has(keyLower) || storedDuringCall.has(keyLower)) {
        logger.debug({ key: memory.key }, 'Skipping already-stored memory key');
        continue;
      }

      try {
        await storeMemory(
          buffer.accountId,
          buffer.lineId,
          memory.type,
          memory.key,
          memory.value,
          {
            confidence: memory.confidence,
            source: 'conversation',
            privacyScope: 'line_only',
          }
        );
        storedCount++;
      } catch (err) {
        logger.warn({ error: err, key: memory.key }, 'Failed to store extracted memory');
      }
    }

    logger.info({
      callSessionId: buffer.callSessionId,
      turnsProcessed: buffer.turns.length,
      memoriesExtracted: extractedMemories.length,
      memoriesStored: storedCount,
    }, 'End-of-call summarization complete');

  } catch (error) {
    logger.error({ error, callSessionId: buffer.callSessionId }, 'End-of-call summarization failed');
  }
}

async function extractMemoriesWithGrok(turnText: string): Promise<ExtractedMemory[]> {
  // Skip silently if no API key
  if (!process.env.XAI_API_KEY) {
    return [];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.XAI_GROK_MODEL || 'grok-3-fast',
        messages: [
          { role: 'system', content: EXTRACTION_PROMPT },
          { role: 'user', content: turnText },
        ],
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Grok extraction API error');
      return [];
    }

    const data = await response.json() as any;
    const content = data?.choices?.[0]?.message?.content || '[]';

    try {
      return JSON.parse(content);
    } catch {
      logger.warn({ content }, 'Failed to parse extraction response as JSON');
      return [];
    }
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.warn('Grok extraction timed out after 30s');
    } else {
      logger.warn({ error }, 'Grok extraction failed');
    }
    return [];
  }
}
