// End-of-call summarization and memory extraction
// Uses ephemeral buffer turns to extract memories after call ends

import { clearBuffer, type EphemeralBuffer } from './ephemeral-buffer.js';
import { storeMemory, getMemoriesForLine, updateMemory } from './memory.js';
import { logger } from '../server.js';
import { getAccountPrivacySettings, getLineVoiceConsent } from './privacy.js';

interface ExtractedMemory {
  type: 'fact' | 'preference' | 'follow_up' | 'context' | 'history' | 'wellbeing' | 'relationship' | 'temporal' | 'routine';
  key: string;
  value: unknown;
  confidence: number;
}

const EXTRACTION_PROMPT = `You are analyzing a conversation summary to extract memorable information about the user.

Review the conversation turns below and extract any important information worth remembering for future calls.

For each memory, provide:
- type: fact | preference | follow_up | context | history | wellbeing | relationship | temporal | routine
- key: semantic identifier (snake_case)
- value: the information to remember
- confidence: 0-1 how confident you are this is accurate

For relationship type, include: name, role, contactFrequency (if mentioned)
For temporal type, include: description, expectedEndDate (ISO), durationEstimateWeeks (if mentioned)
For routine type, include: description, level, and time/day info if available

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

function normalizeMemoryKey(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_');
}

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
    const privacySettings = await getAccountPrivacySettings(buffer.accountId);
    if (!privacySettings?.aiSummarizationEnabled) {
      logger.info({ accountId: buffer.accountId }, 'AI summarization disabled - skipping memory extraction');
      return;
    }

    const voiceConsent = await getLineVoiceConsent(buffer.lineId);
    if (voiceConsent?.memoryConsent !== 'granted') {
      logger.info({ lineId: buffer.lineId }, 'Memory consent not granted - skipping memory extraction');
      return;
    }

    const consentIndex = buffer.consentGrantedAtTurnIndex;
    const turnsForSummary =
      consentIndex !== null && consentIndex !== undefined
        ? buffer.turns.slice(consentIndex)
        : buffer.turns;

    if (!turnsForSummary.length) {
      logger.info({ callSessionId: buffer.callSessionId }, 'No post-consent turns to summarize');
      return;
    }

    const turnText = turnsForSummary
      .map(t => `[${t.speaker.toUpperCase()}] ${t.summary}`)
      .join('\n');

    const existingMemories = await getMemoriesForLine(buffer.accountId, buffer.lineId, { limit: 100 });
    const existingByKey = new Map<string, (typeof existingMemories)[number]>();
    for (const memory of existingMemories) {
      const normalizedKey = normalizeMemoryKey(memory.key);
      if (!existingByKey.has(normalizedKey)) {
        existingByKey.set(normalizedKey, memory);
      }
    }
    const storedDuringCall = new Set([...buffer.storedKeys].map(normalizeMemoryKey));

    const extractedMemories = await extractMemoriesWithGrok(turnText);

    let storedCount = 0;
    for (const memory of extractedMemories) {
      const normalizedKey = normalizeMemoryKey(memory.key);
      if (storedDuringCall.has(normalizedKey)) {
        logger.debug({ key: memory.key }, 'Skipping memory already handled during call');
        continue;
      }

      try {
        const existing = existingByKey.get(normalizedKey);
        const result = existing
          ? await updateMemory(buffer.accountId, buffer.lineId, existing.id, memory.value, existing, {
            callSessionId: buffer.callSessionId,
          })
          : await storeMemory(
            buffer.accountId,
            buffer.lineId,
            memory.type,
            normalizedKey,
            memory.value,
            {
              confidence: memory.confidence,
              source: 'conversation',
              privacyScope: 'line_only',
              callSessionId: buffer.callSessionId,
            }
          );

        if (result?.action !== 'skipped') {
          storedCount++;
        } else {
          logger.debug({ key: memory.key }, 'Skipping duplicate memory value');
        }
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
