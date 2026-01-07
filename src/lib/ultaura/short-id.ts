/**
 * Generate a short_id from a UUID.
 * Takes first 8 characters, lowercased.
 */
export function generateShortId(uuid: string): string {
  return uuid.substring(0, 8).toLowerCase();
}

/**
 * Extract display short_id from a line.
 * @deprecated Use line.short_id directly after migration
 */
export function getShortLineId(lineId: string): string {
  return lineId.substring(0, 8).toLowerCase();
}

/**
 * Check if a string looks like a short_id (8-10+ chars, alphanumeric + underscore)
 */
export function isShortId(id: string): boolean {
  return /^[a-z0-9]{8}(_\d+)?$/.test(id.toLowerCase());
}

/**
 * Check if a string is a full UUID
 */
export function isUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}
