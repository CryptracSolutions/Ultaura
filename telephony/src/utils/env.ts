const DEV_BACKEND_URL = 'http://localhost:3001';

export function getBackendUrl(): string {
  const backendUrl = process.env.ULTAURA_BACKEND_URL ||
    (process.env.NODE_ENV === 'production' ? '' : DEV_BACKEND_URL);

  if (!backendUrl) {
    throw new Error('ULTAURA_BACKEND_URL is required in production');
  }

  return backendUrl;
}

export function getPublicUrl(): string {
  const publicUrl = process.env.ULTAURA_PUBLIC_URL;

  if (!publicUrl) {
    throw new Error('Missing ULTAURA_PUBLIC_URL environment variable');
  }

  return publicUrl;
}

export function getWebsocketUrl(): string {
  const websocketUrl = process.env.ULTAURA_WEBSOCKET_URL;

  if (!websocketUrl) {
    throw new Error('Missing ULTAURA_WEBSOCKET_URL environment variable');
  }

  return websocketUrl;
}

export function getInternalApiSecret(): string {
  const secret = process.env.ULTAURA_INTERNAL_API_SECRET;

  if (!secret) {
    throw new Error('Missing ULTAURA_INTERNAL_API_SECRET environment variable');
  }

  return secret;
}
