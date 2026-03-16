import 'server-only';

import crypto from 'crypto';

// Derive an HMAC subkey from the line DEK using HKDF-SHA256.
function deriveSubkey(lineDEK: Buffer, info: string): Buffer {
  return Buffer.from(
    crypto.hkdfSync('sha256', lineDEK, Buffer.alloc(0), Buffer.from(info, 'utf8'), 32),
  );
}

export function deriveDedupeSubkey(lineDEK: Buffer): Buffer {
  return deriveSubkey(lineDEK, 'health-suggestion-dedupe-v1');
}

export function deriveEvidenceSubkey(lineDEK: Buffer): Buffer {
  return deriveSubkey(lineDEK, 'health-suggestion-evidence-v1');
}

// Compute HMAC-SHA256 dedupe key.
// Format: "type:mode:normalizedName" or "type:mode:normalizedName:similarItemId"
export function computeDedupeKey(
  subkey: Buffer,
  suggestionType: string,
  suggestionMode: string,
  normalizedName: string,
  similarItemId?: string | null,
): string {
  const parts = [suggestionType, suggestionMode, normalizedName];
  if (similarItemId) parts.push(similarItemId);
  const message = parts.join(':');
  return crypto.createHmac('sha256', subkey).update(message).digest('hex');
}

// Compute HMAC-SHA256 material evidence key.
// Based on type + normalizedName + canonical sorted JSON of structured field delta.
export function computeEvidenceKey(
  subkey: Buffer,
  suggestionType: string,
  normalizedName: string,
  proposedFieldsDelta: Record<string, unknown>,
): string {
  const sortedDelta = Object.keys(proposedFieldsDelta)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = proposedFieldsDelta[key];
      return acc;
    }, {});
  const message = JSON.stringify({ type: suggestionType, name: normalizedName, delta: sortedDelta });
  return crypto.createHmac('sha256', subkey).update(message).digest('hex');
}
