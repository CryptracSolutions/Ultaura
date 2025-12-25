// Ultaura Module Exports

export * from './types';
export * from './constants';
export * from './prompts';

/**
 * Get short line ID (first 8 chars of UUID) for cleaner URLs
 * Example: "a1b2c3d4-..." -> "a1b2c3d4"
 */
export function getShortLineId(lineId: string): string {
  return lineId.substring(0, 8);
}
