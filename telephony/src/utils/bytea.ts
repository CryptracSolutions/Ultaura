export type ByteaInput = Uint8Array | string | null | undefined;

function parseBufferJson(value: Buffer): Buffer | null {
  const text = value.toString('utf8').trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) {
    return null;
  }
  try {
    const parsed = JSON.parse(text) as { type?: string; data?: unknown };
    if (parsed?.type === 'Buffer' && Array.isArray(parsed.data)) {
      return Buffer.from(parsed.data);
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeDecoded(value: Buffer): Buffer {
  return parseBufferJson(value) ?? value;
}

export function encodeBytea(value: Uint8Array | Buffer): string {
  return `\\x${Buffer.from(value).toString('hex')}`;
}

export function decodeBytea(value: ByteaInput): Buffer | null {
  if (!value) {
    return null;
  }
  if (value instanceof Uint8Array) {
    return normalizeDecoded(Buffer.from(value));
  }
  if (typeof value !== 'string') {
    return null;
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    trimmed = trimmed.slice(1, -1).trim();
  }
  if (trimmed.startsWith('\\\\x')) {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.startsWith('\\x') || trimmed.startsWith('0x')) {
    return normalizeDecoded(Buffer.from(trimmed.slice(2), 'hex'));
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return normalizeDecoded(Buffer.from(trimmed, 'hex'));
  }
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    return normalizeDecoded(Buffer.from(trimmed, 'base64'));
  }

  return normalizeDecoded(Buffer.from(trimmed, 'utf8'));
}
