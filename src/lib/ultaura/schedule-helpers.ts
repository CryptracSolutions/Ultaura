export function normalizeTimeOfDay(timeOfDay: string): string {
  const match = timeOfDay.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : timeOfDay;
}

export function extractOriginalTimeOfDay(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const value = (metadata as Record<string, unknown>).original_time_of_day;
  return typeof value === 'string' ? value : null;
}
