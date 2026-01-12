import { logger } from '../server.js';
import { generateOpenAIEmbedding } from './embedding-providers/openai.js';
import { generateXAIEmbedding } from './embedding-providers/xai.js';

const EMBEDDING_DIMENSIONS = 1536;
const SEARCHABLE_TEXT_LIMIT = 500;
const SEMANTIC_SEARCH_ENABLED = process.env.ULTAURA_SEMANTIC_SEARCH_ENABLED !== 'false';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult | null> {
  if (!SEMANTIC_SEARCH_ENABLED) {
    return null;
  }

  const xaiModel = process.env.XAI_EMBEDDING_MODEL;
  const hasXAI = Boolean(process.env.XAI_API_KEY && xaiModel);
  if (hasXAI) {
    const embedding = await generateXAIEmbedding(text, { model: xaiModel });
    if (embedding && embedding.length === EMBEDDING_DIMENSIONS) {
      return { embedding, model: xaiModel! };
    }
    if (embedding) {
      logger.warn({ expected: EMBEDDING_DIMENSIONS, actual: embedding.length }, 'xAI embedding dimension mismatch');
    }
  }

  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  const openaiModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const embedding = await generateOpenAIEmbedding(text, { model: openaiModel });
  if (!embedding) {
    return null;
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    logger.warn({ expected: EMBEDDING_DIMENSIONS, actual: embedding.length }, 'OpenAI embedding dimension mismatch');
    return null;
  }

  return { embedding, model: openaiModel };
}

export function buildSearchableText(key: string, value: unknown): string {
  const valueText = stringifyMemoryValue(value);
  const combined = `${key} ${valueText}`.trim();
  return truncateText(combined, SEARCHABLE_TEXT_LIMIT);
}

export function formatEmbeddingForDb(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

function truncateText(text: string, maxLength: number): string {
  return text.slice(0, maxLength);
}

function stringifyMemoryValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.name === 'string' && typeof record.role === 'string') {
      const frequency = typeof record.contactFrequency === 'string'
        ? ` ${record.contactFrequency}`
        : '';
      return `relationship ${record.role} ${record.name}${frequency}`.trim();
    }

    if (typeof record.description === 'string' && typeof record.expectedEndDate === 'string') {
      return `temporal ${record.description}`.trim();
    }

    if (typeof record.description === 'string' && typeof record.level === 'string') {
      const time = typeof record.timeOfDay === 'string' ? ` at ${record.timeOfDay}` : '';
      return `routine ${record.description}${time}`.trim();
    }

    return JSON.stringify(record);
  }

  return String(value ?? '');
}
