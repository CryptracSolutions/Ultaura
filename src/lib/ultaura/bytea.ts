import 'server-only';

export type ByteaInput = Uint8Array | string | null | undefined;

export function decodeBytea(value: ByteaInput): Uint8Array | null {
  if (!value) {
    return null;
  }

  if (value instanceof Uint8Array) {
    return value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('\\x') || trimmed.startsWith('0x')) {
    return Buffer.from(trimmed.slice(2), 'hex');
  }

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed) && trimmed.length % 4 === 0) {
    return Buffer.from(trimmed, 'base64');
  }

  return Buffer.from(trimmed, 'utf8');
}
