import { logger } from '../../server.js';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';

export async function generateOpenAIEmbedding(
  text: string,
  options?: {
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
  }
): Promise<number[] | null> {
  const apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const model = options?.model || process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.warn({ status: response.status }, 'OpenAI embedding API error');
      return null;
    }

    const payload = await response.json() as any;
    const embedding = payload?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      logger.warn({ payload }, 'OpenAI embedding response missing data');
      return null;
    }

    return embedding;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.warn('OpenAI embedding request timed out');
      return null;
    }
    logger.warn({ error }, 'OpenAI embedding request failed');
    return null;
  }
}
