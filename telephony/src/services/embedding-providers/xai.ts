import { logger } from '../../server.js';

const XAI_EMBEDDINGS_URL = 'https://api.x.ai/v1/embeddings';

export async function generateXAIEmbedding(
  text: string,
  options?: {
    apiKey?: string;
    model?: string;
    timeoutMs?: number;
  }
): Promise<number[] | null> {
  const apiKey = options?.apiKey || process.env.XAI_API_KEY;
  const model = options?.model || process.env.XAI_EMBEDDING_MODEL;

  if (!apiKey || !model) {
    return null;
  }

  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(XAI_EMBEDDINGS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
      logger.warn({ status: response.status }, 'xAI embedding API error');
      return null;
    }

    const payload = await response.json() as any;
    const embedding = payload?.data?.[0]?.embedding;
    if (!Array.isArray(embedding)) {
      logger.warn({ payload }, 'xAI embedding response missing data');
      return null;
    }

    return embedding;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      logger.warn('xAI embedding request timed out');
      return null;
    }
    logger.warn({ error }, 'xAI embedding request failed');
    return null;
  }
}
